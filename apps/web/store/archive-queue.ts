import { atomWithStorage, createJSONStorage } from "jotai/utils";
import pRetry from "p-retry";
import { jotaiStore } from "@/store";
import { emailActionQueue } from "@/utils/queue/email-action-queue";
import {
  archiveThreadAction,
  trashThreadAction,
  markReadThreadAction,
} from "@/utils/actions/mail";
import { exponentialBackoff, sleep } from "@/utils/sleep";
import { useAtomValue } from "jotai";

type ActionType = "archive" | "delete" | "markRead";

type QueueItem = {
  threadId: string;
  actionType: ActionType;
  labelId?: string;
};

type QueueState = {
  activeThreads: Record<`${ActionType}-${string}`, QueueItem>;
  totalThreads: number;
};

// some users were somehow getting null for activeThreads, this should fix it
// Also fixes SSR hydration by ensuring server and client start with the same value
const createStorage = () => {
  if (typeof window === "undefined") {
    // Server-side: return minimal storage that returns initial value
    return {
      getItem: (_key: string, initialValue: QueueState) => initialValue,
      setItem: () => {},
      removeItem: () => {},
    };
  }

  const storage = createJSONStorage<QueueState>(() => localStorage);

  return {
    ...storage,
    getItem: (key: string, initialValue: QueueState) => {
      const storedValue = storage.getItem(key, initialValue);
      // Ensure activeThreads and totalThreads always exist
      if (!storedValue || typeof storedValue !== "object") {
        return initialValue;
      }
      return {
        activeThreads: storedValue.activeThreads || {},
        totalThreads: storedValue.totalThreads || 0,
      };
    },
  };
};

// Create atoms with localStorage persistence
// getOnInit: false prevents SSR hydration issues by delaying localStorage read until client-side
const queueAtom = atomWithStorage(
  "gmailActionQueue",
  { activeThreads: {}, totalThreads: 0 },
  createStorage(),
  { getOnInit: false },
);

export function useQueueState() {
  return useAtomValue(queueAtom);
}

type ActionFunction = ({
  threadId,
  labelId,
}: {
  threadId: string;
  labelId?: string;
}) => Promise<any>;

const addThreadsToQueue = ({
  actionType,
  threadIds,
  labelId,
  onSuccess,
  onError,
  emailAccountId,
}: {
  actionType: ActionType;
  threadIds: string[];
  labelId?: string;
  onSuccess?: (threadId: string) => void;
  onError?: (threadId: string) => void;
  emailAccountId: string;
}) => {
  const threads = Object.fromEntries(
    threadIds.map((threadId) => [
      `${actionType}-${threadId}`,
      { threadId, actionType, labelId },
    ]),
  );

  jotaiStore.set(queueAtom, (prev) => ({
    activeThreads: {
      ...prev.activeThreads,
      ...threads,
    },
    totalThreads: prev.totalThreads + Object.keys(threads).length,
  }));

  processQueue({ threads, onSuccess, onError, emailAccountId });
};

export const archiveEmails = async ({
  threadIds,
  labelId,
  onSuccess,
  onError,
  emailAccountId,
}: {
  threadIds: string[];
  labelId?: string;
  onSuccess: (threadId: string) => void;
  onError?: (threadId: string) => void;
  emailAccountId: string;
}) => {
  addThreadsToQueue({
    actionType: "archive",
    threadIds,
    labelId,
    onSuccess,
    onError,
    emailAccountId,
  });
};

export const markReadThreads = async ({
  threadIds,
  onSuccess,
  onError,
  emailAccountId,
}: {
  threadIds: string[];
  onSuccess: (threadId: string) => void;
  onError?: (threadId: string) => void;
  emailAccountId: string;
}) => {
  addThreadsToQueue({
    actionType: "markRead",
    threadIds,
    onSuccess,
    onError,
    emailAccountId,
  });
};

export const deleteEmails = async ({
  threadIds,
  onSuccess,
  onError,
  emailAccountId,
}: {
  threadIds: string[];
  onSuccess: (threadId: string) => void;
  onError?: (threadId: string) => void;
  emailAccountId: string;
}) => {
  addThreadsToQueue({
    actionType: "delete",
    threadIds,
    onSuccess,
    onError,
    emailAccountId,
  });
};

function removeThreadFromQueue(threadId: string, actionType: ActionType) {
  jotaiStore.set(queueAtom, (prev) => {
    const remainingThreads = Object.fromEntries(
      Object.entries(prev.activeThreads).filter(
        ([_key, value]: [string, QueueItem]) =>
          !(value.threadId === threadId && value.actionType === actionType),
      ),
    );

    return {
      ...prev,
      activeThreads: remainingThreads,
    };
  });
}

export function processQueue({
  threads,
  onSuccess,
  onError,
  emailAccountId,
}: {
  threads: Record<string, QueueItem>;
  onSuccess?: (threadId: string) => void;
  onError?: (threadId: string) => void;
  emailAccountId: string;
}) {
  const actionMap: Record<ActionType, ActionFunction> = {
    archive: ({ threadId, labelId }) =>
      archiveThreadAction(emailAccountId, { threadId, labelId }),
    delete: ({ threadId }) => trashThreadAction(emailAccountId, { threadId }),
    markRead: ({ threadId }) =>
      markReadThreadAction(emailAccountId, { threadId, read: true }),
  };

  emailActionQueue.addAll(
    Object.entries(threads).map(
      ([_key, { threadId, actionType, labelId }]) =>
        async () => {
          try {
            await pRetry(
              async (attemptCount) => {
                // biome-ignore lint/suspicious/noConsole: frontend
                console.log(
                  `Queue: ${actionType}. Processing ${threadId}${attemptCount > 1 ? ` (attempt ${attemptCount})` : ""}`,
                );

                const result = await actionMap[actionType]({
                  threadId,
                  labelId,
                });

                // when Gmail API returns a rate limit error, throw an error so it can be retried
                if (result?.serverError) {
                  // biome-ignore lint/suspicious/noConsole: frontend
                  console.error(
                    `Queue: ${actionType}. Error for ${threadId}:`,
                    result.error,
                  );
                  await sleep(exponentialBackoff(attemptCount, 1000));
                  throw new Error(result.error);
                }
                onSuccess?.(threadId);
              },
              { retries: 3 },
            );
          } catch (error) {
            // all retries failed
            // biome-ignore lint/suspicious/noConsole: frontend
            console.error(
              `Queue: ${actionType}. All retries failed for ${threadId}:`,
              error,
            );
            onError?.(threadId);
          }

          // remove completed thread from activeThreads
          removeThreadFromQueue(threadId, actionType);
        },
    ),
  );
}

export const resetTotalThreads = () => {
  jotaiStore.set(queueAtom, (prev) => ({
    ...prev,
    totalThreads: 0,
  }));
};
