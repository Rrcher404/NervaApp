import type { Metadata } from "next";
import { Instrument_Serif, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ground text-ink">{children}</body>
    </html>
  );
}
