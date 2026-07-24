import type { Metadata } from "next";
import { Instrument_Serif, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { supabaseServer } from "@/lib/supabase/server";

/* The two-voice type rule (DESIGN-PRINCIPLES §5):
   serif = the human's material · mono = the machine speaking.
   The user always knows who is talking. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Sieve",
  description:
    "Pour everything in. The Sieve catches what matters, returns it at the right moment, and asks you the question that turns a scrap into knowledge.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The cold open has NO nav (§8: "no nav, ~3s to first meaning"). Nav is the
  // authenticated user's chrome — a stranger reaching FIRST CATCH LOGGED never
  // sees it, so the 90-second run has exactly one focal point per screen.
  //
  // Capture is sacred: the cold open must render with every external API down.
  // A failed/slow auth lookup degrades to the anonymous (no-nav) view — it never
  // throws the whole page. The worst case is a signed-in user momentarily missing
  // their nav during an auth outage; the stranger's capture always works.
  let user = null;
  try {
    const sb = await supabaseServer();
    ({
      data: { user },
    } = await sb.auth.getUser());
  } catch (e) {
    // Correct degradation direction, but not silent: a real auth outage that
    // strips every signed-in user's nav should be visible in telemetry.
    console.error("layout auth lookup failed — rendering anon (no nav):", e);
    user = null;
  }

  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ground text-ink">
        {user && <Nav />}
        {children}
      </body>
    </html>
  );
}
