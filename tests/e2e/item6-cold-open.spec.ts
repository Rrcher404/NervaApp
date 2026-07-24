import { test, expect } from "@playwright/test";

/**
 * Item 6 acceptance: a stranger reaches FIRST CATCH LOGGED in under 90 seconds
 * WITHOUT an account. The cold open has one focal point per screen: the serif
 * question, one input, one acid button, and — critically — NO nav until they've
 * chosen to save. Value before identity: the save prompt appears only AFTER the
 * first catch, never as a wall before it.
 */
test.describe("the cold open — first catch, no account, under 90 seconds", () => {
  test("a stranger reaches FIRST CATCH LOGGED with no account, no nav, under 90s", async ({ page }) => {
    const started = Date.now();

    // land on the cold open as a stranger (no session)
    await page.goto("/");

    // one serif question, one input, one button — and NO nav (the anon cold open)
    await expect(page.getByRole("heading", { name: /what are you trying to figure out/i })).toBeVisible();
    await expect(page.getByTestId("capture-input")).toBeVisible();
    await expect(page.locator("nav")).toHaveCount(0);

    // no signup wall before the first catch
    await expect(page.getByTestId("save-expedition")).toHaveCount(0);

    // the whole cost of the first catch: type, one tap
    await page.getByTestId("capture-input").fill("Why does spaced repetition work so well for ADHD?");
    await page.getByTestId("capture-submit").click();

    // the stamp slams
    await expect(page.getByTestId("stamp")).toBeVisible();
    await expect(page.getByTestId("stamp")).toHaveText(/first catch logged/i);

    const seconds = (Date.now() - started) / 1000;
    expect(seconds, `cold open took ${seconds.toFixed(1)}s`).toBeLessThan(90);

    // and ONLY NOW: value before identity — the invitation to save (still no account)
    await expect(page.getByTestId("save-expedition")).toBeVisible();
    await expect(page.getByTestId("save-expedition-cta")).toHaveAttribute("href", "/login");
  });

  test("the method is available but costs the cold open nothing (collapsed by default)", async ({ page }) => {
    await page.goto("/");
    const method = page.getByTestId("the-method");
    await expect(method).toBeVisible();
    // collapsed: the content is not open until asked for
    await expect(method).not.toHaveAttribute("open", /.*/);
    // one click reveals the static, non-AI method — the five stages
    await method.getByText(/how the sieve works/i).click();
    await expect(method.getByText(/the five stages/i)).toBeVisible();
  });
});
