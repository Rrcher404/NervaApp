/**
 * Cron work-discovery — the FIRST i/o each background job runs, and (cycle-2
 * regrade) the last place the error-swallowing class was still alive.
 *
 * postgrest-js RESOLVES rather than rejects on an in-band RPC failure — a
 * dropped/renamed function, a revoked service_role grant, a SQL error inside the
 * function all come back as `{ data: null, error: {...} }`, not a thrown promise.
 * A caller that destructures only `data` turns that into `userIds = []`, the
 * job loops zero times, and it still writes a `completed_at` heartbeat with
 * `error = null` — a row the dead-man reads as HEALTHY. The dead component reads
 * green forever: the exact shape the committee vetoed, one layer up from the
 * endpoint the drain heartbeat closed.
 *
 * So discovery returns the error EXPLICITLY. The caller must route it into the
 * run's `error` column (and/or an ops_alert) so a broken discovery function is
 * loud, not a silently-empty successful-looking run.
 */

/** Minimal structural shape of an awaited PostgREST rpc() — no server-only import. */
export interface RpcClient {
  rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface Discovery {
  userIds: string[];
  /** non-null iff the discovery RPC itself failed — the caller MUST surface it. */
  error: string | null;
}

export async function discoverUsers(admin: RpcClient, fn: string): Promise<Discovery> {
  const { data, error } = await admin.rpc(fn);
  if (error) {
    // Do NOT fall through to an empty list that looks like "no work to do".
    return { userIds: [], error: `discovery ${fn} failed: ${error.message}` };
  }
  return { userIds: (data as string[] | null) ?? [], error: null };
}
