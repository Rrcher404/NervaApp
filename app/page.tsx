import Capture from "@/components/Capture";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Capture is sacred — the cold open must survive an auth outage. A failed
  // getUser degrades to the anonymous view (which still captures, offline-first),
  // never a 500 on the one screen a stranger must always be able to use.
  let user = null;
  try {
    const sb = await supabaseServer();
    ({
      data: { user },
    } = await sb.auth.getUser());
  } catch (e) {
    console.error("cold-open auth lookup failed — rendering anon:", e);
    user = null;
  }

  return (
    <main className="flex-1">
      <Capture authed={!!user} />
    </main>
  );
}
