import { describe, expect, it, vi, beforeEach } from "vitest";
import { getMutationQueue, setMutationQueue } from "./offlineDb";
import { processMutationQueue } from "./offlineQueue";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("offline mutation queue", () => {
  beforeEach(async () => {
    await setMutationQueue([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    );
  });

  it("replays queued POST when processMutationQueue runs", async () => {
    await setMutationQueue([
      {
        path: "/api/test",
        method: "POST",
        body: "{}",
        token: null,
        createdAt: Date.now(),
      },
    ]);
    const n = await processMutationQueue();
    expect(n).toBe(1);
    const left = await getMutationQueue();
    expect(left.length).toBe(0);
  });
});
