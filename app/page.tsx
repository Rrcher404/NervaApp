import Capture from "@/components/Capture";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  return (
    <main className="flex-1">
      <Capture authed={!!user} />
    </main>
  );
}
