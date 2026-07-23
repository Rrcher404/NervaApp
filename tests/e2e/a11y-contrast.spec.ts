import { test, expect } from "@playwright/test";

/**
 * WCAG AA guard. Halvorsen found five failing pairs in the item-1 gate; this
 * spec computes real contrast ratios from COMPUTED styles so they cannot
 * silently regress. DESIGN-PRINCIPLES §5: every text/background pair passes AA.
 */

function parseRGB(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparseable colour: ${s}`);
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Alpha-composite fg over bg, then compute the WCAG contrast ratio. */
function contrast(fg: string, bg: string): number {
  const [fr, fg_, fb, fa] = parseRGB(fg);
  const [br, bg_, bb] = parseRGB(bg);
  const composited: [number, number, number] = [
    fr * fa + br * (1 - fa),
    fg_ * fa + bg_ * (1 - fa),
    fb * fa + bb * (1 - fa),
  ];
  const l1 = luminance(composited);
  const l2 = luminance([br, bg_, bb]);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

test("every rendered text node meets WCAG AA against the parchment ground", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await expect(page.getByTestId("capture-input")).toBeVisible();

  // seed one of each state so the catch card, citation line and URL all render
  await page.getByTestId("capture-input").fill("https://example.com/");
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);

  const samples = await page.evaluate(() => {
    // Tailwind 4 emits oklab() for alpha-modified colours. Resolve anything
    // the browser can parse down to sRGB by painting it and reading it back.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const toRGBA = (css: string): string => {
      if (/^rgba?\(/.test(css)) return css;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(4)})`;
    };

    const out: { text: string; color: string; bg: string; size: number; weight: string }[] =
      [];
    const walk = (el: Element) => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          const parent = node.parentElement!;
          const cs = getComputedStyle(parent);
          // find the nearest non-transparent background
          let bgEl: Element | null = parent;
          let bg = "rgba(255, 255, 255, 1)";
          while (bgEl) {
            const c = toRGBA(getComputedStyle(bgEl).backgroundColor);
            if (c && !/rgba\(0, 0, 0, 0(\.0+)?\)|transparent/.test(c)) {
              bg = c;
              break;
            }
            bgEl = bgEl.parentElement;
          }
          out.push({
            text: node.textContent.trim().slice(0, 45),
            color: toRGBA(cs.color),
            bg,
            size: parseFloat(cs.fontSize),
            weight: cs.fontWeight,
          });
        }
        if (node.nodeType === Node.ELEMENT_NODE) walk(node as Element);
      }
    };
    walk(document.body);

    // ::placeholder is a pseudo-element and NEVER a child text node, so the
    // walk above cannot see it. Halvorsen caught this test reporting a clean
    // pass while a real 3.40:1 failure sat on the page. A guard with a blind
    // spot is worse than no guard.
    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[placeholder], textarea[placeholder]",
      ),
    )) {
      if (!el.placeholder?.trim()) continue;
      const cs = getComputedStyle(el, "::placeholder");
      let bgEl: Element | null = el;
      let bg = "rgba(255, 255, 255, 1)";
      while (bgEl) {
        const c = toRGBA(getComputedStyle(bgEl).backgroundColor);
        if (c && !/rgba\(0, 0, 0, 0(\.0+)?\)|transparent/.test(c)) {
          bg = c;
          break;
        }
        bgEl = bgEl.parentElement;
      }
      out.push({
        text: `::placeholder "${el.placeholder.trim().slice(0, 20)}"`,
        color: toRGBA(cs.color),
        bg,
        size: parseFloat(cs.fontSize || getComputedStyle(el).fontSize),
        weight: cs.fontWeight || getComputedStyle(el).fontWeight,
      });
    }

    return out;
  });

  expect(samples.length).toBeGreaterThan(5);

  const failures: string[] = [];
  for (const s of samples) {
    const bold = Number(s.weight) >= 700;
    // WCAG large text: >=24px, or >=18.66px bold
    const isLarge = s.size >= 24 || (bold && s.size >= 18.66);
    const required = isLarge ? 3.0 : 4.5;
    const ratio = contrast(s.color, s.bg);
    if (ratio < required) {
      failures.push(
        `"${s.text}" — ${ratio.toFixed(2)}:1 (needs ${required}:1) @ ${s.size}px w${s.weight}`,
      );
    }
  }

  expect(failures, `WCAG AA failures:\n${failures.join("\n")}`).toHaveLength(0);
});
