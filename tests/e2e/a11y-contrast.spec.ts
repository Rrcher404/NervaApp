import { test, expect, type Page } from "@playwright/test";

/**
 * WCAG AA guard. DESIGN-PRINCIPLES §5: every text/background pair passes AA.
 *
 * This guard has been wrong twice, and both times in the same shape — it
 * reported clean while a real failure sat on the page, because it never looked
 * at the thing that was failing:
 *   1. ::placeholder is a pseudo-element, never a child text node.
 *   2. CSS opacity is invisible to computed colour — the disabled button read
 *      14.97:1 while rendering at 2.46:1.
 * Both are now handled. The third recurrence of the pattern was "states the
 * test never renders", so the error surfaces are exercised too.
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

interface Sample {
  text: string;
  color: string;
  bg: string;
  size: number;
  weight: string;
}

async function sampleContrast(page: Page): Promise<Sample[]> {
  // Let animations settle — sampling mid-stamp reads opacity 0 and reports a
  // phantom 1.00:1.
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((a) => a.finished)),
  );

  return page.evaluate(() => {
    // Tailwind 4 emits oklab(); resolve anything the browser can parse to sRGB.
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

    /** Product of every ancestor's opacity — computed colour ignores it. */
    const effectiveOpacity = (el: Element): number => {
      let o = 1;
      let cur: Element | null = el;
      while (cur) {
        const v = parseFloat(getComputedStyle(cur).opacity);
        if (!Number.isNaN(v)) o *= v;
        cur = cur.parentElement;
      }
      return o;
    };
    const applyOpacity = (fg: string, bg: string, o: number): string => {
      if (o >= 0.999) return fg;
      const f = fg.match(/[\d.]+/g)!.map(Number);
      const b = bg.match(/[\d.]+/g)!.map(Number);
      const a = (f[3] ?? 1) * o;
      return `rgba(${f[0] * a + b[0] * (1 - a)}, ${f[1] * a + b[1] * (1 - a)}, ${
        f[2] * a + b[2] * (1 - a)
      }, 1)`;
    };

    const pageBg = toRGBA(getComputedStyle(document.body).backgroundColor);
    const nearestBg = (start: Element): string => {
      let el: Element | null = start;
      while (el) {
        const c = toRGBA(getComputedStyle(el).backgroundColor);
        if (c && !/rgba\(0, 0, 0, 0(\.0+)?\)|transparent/.test(c)) return c;
        el = el.parentElement;
      }
      return pageBg;
    };

    const out: Sample[] = [];
    interface Sample {
      text: string;
      color: string;
      bg: string;
      size: number;
      weight: string;
    }

    const walk = (el: Element) => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          const parent = node.parentElement!;
          const cs = getComputedStyle(parent);
          const o = effectiveOpacity(parent);
          const bg = applyOpacity(nearestBg(parent), pageBg, o);
          out.push({
            text: node.textContent.trim().slice(0, 45),
            color: applyOpacity(toRGBA(cs.color), bg, o),
            bg,
            size: parseFloat(cs.fontSize),
            weight: cs.fontWeight,
          });
        }
        if (node.nodeType === Node.ELEMENT_NODE) walk(node as Element);
      }
    };
    walk(document.body);

    // ::placeholder is a pseudo-element and NEVER a child text node.
    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[placeholder], textarea[placeholder]",
      ),
    )) {
      if (!el.placeholder?.trim()) continue;
      const cs = getComputedStyle(el, "::placeholder");
      const o = effectiveOpacity(el);
      const bg = applyOpacity(nearestBg(el), pageBg, o);
      out.push({
        text: `::placeholder "${el.placeholder.trim().slice(0, 20)}"`,
        color: applyOpacity(toRGBA(cs.color), bg, o),
        bg,
        size: parseFloat(cs.fontSize || getComputedStyle(el).fontSize),
        weight: cs.fontWeight || getComputedStyle(el).fontWeight,
      });
    }
    return out;
  });
}

function assertAA(samples: Sample[], scenario: string) {
  expect(samples.length, `${scenario}: nothing sampled`).toBeGreaterThan(3);
  const failures: string[] = [];
  for (const s of samples) {
    const bold = Number(s.weight) >= 700;
    const isLarge = s.size >= 24 || (bold && s.size >= 18.66);
    const required = isLarge ? 3.0 : 4.5;
    const ratio = contrast(s.color, s.bg);
    if (ratio < required) {
      failures.push(
        `"${s.text}" — ${ratio.toFixed(2)}:1 (needs ${required}:1) @ ${s.size}px w${s.weight}`,
      );
    }
  }
  expect(failures, `${scenario} — WCAG AA failures:\n${failures.join("\n")}`).toHaveLength(
    0,
  );
}

test("cold open, and a catch with its citation, meet AA", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await expect(page.getByTestId("capture-input")).toBeVisible();

  // cold open: empty state AND the disabled primary button
  assertAA(await sampleContrast(page), "cold open");

  await page.getByTestId("capture-input").fill("https://example.com/");
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  assertAA(await sampleContrast(page), "after a catch");
});

test("the crisis surfaces meet AA too", async ({ page }) => {
  // Halvorsen: "the two surfaces built for an actual crisis are exactly the two
  // the guard has never once looked at."
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", {
      configurable: true,
      writable: true,
      value: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("capture-input")).toBeVisible();

  await expect(page.getByTestId("storage-down")).toBeVisible();
  assertAA(await sampleContrast(page), "storage-down banner");

  await page.getByTestId("capture-input").fill("a thought that will not save");
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("save-error")).toBeVisible();
  assertAA(await sampleContrast(page), "save-error banner");
});
