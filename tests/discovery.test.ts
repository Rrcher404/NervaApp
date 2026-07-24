import { describe, it, expect } from "vitest";
import { discoverUsers, type RpcClient } from "../lib/sieve/discovery";

/**
 * The cycle-2-regrade HIGH, encoded: a discovery RPC that fails IN-BAND (postgrest
 * resolves with {data:null, error}, never throws) must NOT read as "no work to do".
 * If it did, the cron writes a completed_at heartbeat with error=null, and the
 * dead-man — which keys on `completed_at is not null and error is null` — reads it
 * as a healthy run. Dead component, green forever. This test is the guard's proof.
 */

function fakeRpc(result: { data: unknown; error: { message: string } | null }): RpcClient {
  return { rpc: () => Promise.resolve(result) };
}

describe("discoverUsers — the green-forever guard", () => {
  it("surfaces an in-band RPC error instead of swallowing it into an empty list", async () => {
    const admin = fakeRpc({ data: null, error: { message: "function does not exist" } });
    const { userIds, error } = await discoverUsers(admin, "users_with_pending_catches");
    // The whole point: a failed discovery is LOUD, not a silently-empty success.
    expect(error).not.toBeNull();
    expect(error).toContain("users_with_pending_catches");
    expect(error).toContain("function does not exist");
    expect(userIds).toEqual([]);
  });

  it("a revoked-grant style error is surfaced too (the exact failure this repo keeps causing)", async () => {
    const admin = fakeRpc({ data: null, error: { message: "permission denied for function" } });
    const { error } = await discoverUsers(admin, "users_with_threads");
    expect(error).toContain("permission denied");
  });

  it("returns the user list cleanly on success, with no phantom error", async () => {
    const admin = fakeRpc({ data: ["u1", "u2", "u3"], error: null });
    const { userIds, error } = await discoverUsers(admin, "users_with_pending_catches");
    expect(error).toBeNull();
    expect(userIds).toEqual(["u1", "u2", "u3"]);
  });

  it("a genuinely empty backlog is success with an empty list — not an error", async () => {
    const admin = fakeRpc({ data: [], error: null });
    const { userIds, error } = await discoverUsers(admin, "users_with_pending_catches");
    // distinguishes 'no work' (data:[], error:null) from 'broken' (data:null, error:set)
    expect(error).toBeNull();
    expect(userIds).toEqual([]);
  });

  it("null data with no error degrades to empty (a truly empty result), not a crash", async () => {
    const admin = fakeRpc({ data: null, error: null });
    const { userIds, error } = await discoverUsers(admin, "users_with_pending_catches");
    expect(error).toBeNull();
    expect(userIds).toEqual([]);
  });
});
