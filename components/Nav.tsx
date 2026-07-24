"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The three stages the human touches, always one tap away (interface commandment:
 * one dominant next action; retrieval never depends on memory). Mono — this is
 * the machine's chrome, not the human's material. Hidden on the auth surfaces.
 */
const LINKS = [
  { href: "/", label: "Catch" },
  { href: "/threads", label: "Threads" },
  { href: "/return", label: "Return" },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;

  return (
    <nav className="border-b-[3px] border-ink bg-ground">
      <ul className="mx-auto flex w-full max-w-2xl items-stretch gap-0 px-6">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-x border-ink/0 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider ${
                  active ? "bg-accent text-ink" : "text-ink/60 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
