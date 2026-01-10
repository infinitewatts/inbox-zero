import { atom } from "jotai";

export const refetchEmailListAtom = atom<
  { refetch: (options?: { removedThreadIds?: string[] }) => void } | undefined
>(undefined);

export const emailNavigationAtom = atom<{
  threads: { id: string }[];
  currentThreadId: string | null;
  openThread: (threadId: string) => void;
  closeThread: () => void;
} | null>(null);
