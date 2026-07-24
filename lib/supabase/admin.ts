import "server-only"; // build-time guard: importing this into a client component fails the build
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the server-side sieve pipeline.
 *
 * THIS KEY BYPASSES RLS. Every query made through it MUST scope `user_id`
 * explicitly — the auth.uid() policies are inert here. The owner-match trigger
 * on catches.thread_id is the backstop that turns a forgotten WHERE into a loud
 * error instead of a silent cross-user leak. Server-only: this module must
 * never be imported into a client component.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("missing Supabase admin credentials");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
