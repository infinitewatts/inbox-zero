import useSWR from "swr";
import type { ThreadsResponse } from "@/app/api/threads/route";
import type { Thread as EmailThread } from "@/components/email-list/types";
import type { ThreadsQuery } from "@/app/api/threads/validation";

export type Thread = EmailThread;

export function useThreads({
  fromEmail,
  limit,
  type,
  refreshInterval,
}: {
  fromEmail?: string;
  type?: string;
  limit?: number;
  refreshInterval?: number;
}) {
  const query: ThreadsQuery = {};

  if (fromEmail) query.fromEmail = fromEmail;
  if (limit) query.limit = limit;
  if (type) query.type = type;

  const queryParams = new URLSearchParams();
  if (query.fromEmail) queryParams.set("fromEmail", query.fromEmail);
  if (query.limit) queryParams.set("limit", String(query.limit));
  if (query.type) queryParams.set("type", query.type);
  const url = `/api/threads?${queryParams.toString()}`;
  return useSWR<ThreadsResponse>(url, { refreshInterval });
}
