import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase auth session on each request so Server Components and
 * route handlers see a live session. Value-before-identity (§8) still holds —
 * capture is anonymous and local-first; auth only gates the cloud sieve + threads.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // ONLY the authenticated surface. The capture flow (/, /api/enrich,
  // /api/transcribe) is anonymous and local-first (§8 value-before-identity) —
  // running the session refresh there is both unnecessary and adds latency to
  // the sacred capture path.
  matcher: [
    "/threads/:path*",
    "/login",
    "/auth/:path*",
    "/api/sieve/:path*",
    "/api/catch/:path*",
    "/api/merge/:path*",
    "/api/thread/:path*",
  ],
};
