import { toast } from "sonner";
import { getMutationQueue, setMutationQueue, type QueuedMutation } from "./offlineDb";

const TOKEN_KEY = "ims_token";
function getStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export class OfflineMutationQueuedError extends Error {
  readonly code = "OFFLINE_QUEUED" as const;
  constructor(message = "Queued for sync when online") {
    super(message);
    this.name = "OfflineMutationQueuedError";
  }
}

export function isOfflineMutationQueuedError(e: unknown): e is OfflineMutationQueuedError {
  return e instanceof OfflineMutationQueuedError;
}

export async function enqueueOfflineMutation(params: {
  path: string;
  method: string;
  body: string;
  token: string | null;
}): Promise<void> {
  const item: QueuedMutation = {
    ...params,
    createdAt: Date.now(),
  };
  const q = await getMutationQueue();
  await setMutationQueue([...q, item]);
}

/** Replays queued JSON mutations. Returns number successfully synced. */
export async function processMutationQueue(): Promise<number> {
  const q = await getMutationQueue();
  if (q.length === 0) return 0;
  const remaining: QueuedMutation[] = [];
  let done = 0;
  for (const item of q) {
    try {
      const token = item.token ?? getStoredToken();
      const res = await fetch(item.path, {
        method: item.method,
        body: item.body,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        done += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  await setMutationQueue(remaining);
  if (done > 0) {
    toast.success(`${done} change${done === 1 ? "" : "s"} synced`, { duration: 4000 });
  }
  return done;
}

export function getPendingSyncCount(): Promise<number> {
  return getMutationQueue().then((q) => q.length);
}
