// =============================================================================
//  test_page_post.js  — v4: Two-step composer (التالي → نشر)
// =============================================================================
require("dotenv").config();
const { chromium } = require("playwright");

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep   = (min, max = min) => new Promise(r => setTimeout(r, randInt(min, max)));

async function jitterMouse(page) {
  const vp = page.viewportSize() || { width: 1366, height: 768 };
  for (let i = 0; i < randInt(2, 4); i++) {
    await page.mouse.move(
      randInt(vp.width * 0.2, vp.width * 0.8),
      randInt(vp.height * 0.2, vp.height * 0.8),
      { steps: randInt(5, 10) }
    );
    await sleep(100, 250);
  }
}

// Helper: click a button by exact aria-label or text inside a locator scope
async function clickBtn(scope, matches, label = "button") {
  for (const m of matches) {
    for (const locStr of [
      `div[role="button"][aria-label="${m}"]`,
      `button[aria-label="${m}"]`,
      `div[role="button"]:has-text("${m}")`,
      `button:has-text("${m}")`,
    ]) {
      try {
        const el = scope.locator(locStr).first();
        if (await el.isVisible({ timeout: 3_000 })) {
          await el.scrollIntoViewIfNeeded();
          await sleep(400, 800);
          await el.click();
          console.log(`[INFO] ✅ Clicked ${label}: "${m}"`);
          return true;
        }
      } catch { /* try next */ }
    }
  }
  return false;
}

(async () => {
  const PAGE_URL    = process.env.GROUP_URL;
  const POST_TEXT   = process.env.POST_CONTENT;
  const COOKIES_STR = process.env.FB_COOKIES;

  if (!PAGE_URL || !POST_TEXT || !COOKIES_STR) {
    console.error("[FATAL] Missing env vars"); process.exit(1);
  }

  const cookies = JSON.parse(COOKIES_STR);
  console.log(`[INFO] Loaded ${cookies.length} cookies`);

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  const browser = await chromium.launch({
    headless: false,
    slowMo: 30,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1366,768"],
  });

  const context = await browser.newContext({
    userAgent: UA,
    locale: "ar-EG",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "ar,en;q=0.9" },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // ── 1. Navigate ──────────────────────────────────────────────────────────
    console.log(`[INFO] Navigating to: ${PAGE_URL}`);
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(4_000, 5_500);

    if (page.url().includes("login")) throw new Error("Auth failed — check cookies");
    console.log("[INFO] ✅ Logged in via cookies");

    await jitterMouse(page);
    await sleep(1_500, 2_500);

    // ── 2. Click "بم تفكر؟" trigger ──────────────────────────────────────────
    console.log("[INFO] Clicking composer trigger...");
    const trigger = page.locator([
      'div[role="button"]:has-text("بم تفكر؟")',
      'span:has-text("بم تفكر؟")',
      'div[role="button"]:has-text("What\'s on your mind")',
    ].join(', ')).first();

    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click();
    console.log("[INFO] ✅ Composer trigger clicked");

    // ── 3. Wait for modal ────────────────────────────────────────────────────
    console.log("[INFO] Waiting for modal dialog...");
    const dialog = page.locator('div[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    console.log("[INFO] ✅ Modal open");
    await sleep(1_500, 2_500);

    // ── 4. Find editor and type ──────────────────────────────────────────────
    const editor = dialog.locator('[contenteditable="true"]').first();
    await editor.waitFor({ state: "visible", timeout: 8_000 });
    await editor.click();
    await sleep(600, 1_200);

    console.log(`[INFO] Typing: "${POST_TEXT}"`);
    for (const ch of POST_TEXT) {
      await page.keyboard.type(ch, { delay: randInt(60, 130) });
      if (Math.random() < 0.08) await sleep(150, 400);
    }
    console.log("[INFO] ✅ Text typed");
    await sleep(2_000, 3_000);

    await page.screenshot({ path: "step1-typed.png" });
    console.log("[INFO] Screenshot: step1-typed.png");

    // ── 5. STEP 1: Click "التالي" (Next) ────────────────────────────────────
    console.log("[INFO] Clicking 'التالي' (Next)...");
    const clickedNext = await clickBtn(dialog, ["التالي", "Next"], "Next button");

    if (!clickedNext) {
      // Maybe it's already a single-step composer — try "نشر" directly
      console.log("[WARN] 'التالي' not found — trying 'نشر' directly...");
      const clickedPost = await clickBtn(dialog, ["نشر", "Post"], "Post button");
      if (!clickedPost) {
        await page.screenshot({ path: "debug-no-next.png", fullPage: true });
        throw new Error("Neither 'التالي' nor 'نشر' found. See debug-no-next.png");
      }
      // Single-step success
      await sleep(6_000, 9_000);
      await page.screenshot({ path: "success.png" });
      console.log("[SUCCESS] 🎉 Posted! (single-step flow)");
    } else {
      // ── 6. STEP 2: Wait for next view and click "نشر" ─────────────────────
      console.log("[INFO] Waiting for Step 2 (نشر screen)...");
      await sleep(2_500, 4_000);

      await page.screenshot({ path: "step2-preview.png" });
      console.log("[INFO] Screenshot: step2-preview.png");

      // The second step may be a new dialog or updated same dialog
      // Scan all visible dialogs for "نشر"
      const dialogs = page.locator('div[role="dialog"]');
      const count = await dialogs.count();
      console.log(`[INFO] Dialog count: ${count}`);

      let posted = false;
      for (let i = 0; i < count; i++) {
        const d = dialogs.nth(i);
        const clicked = await clickBtn(d, ["نشر", "Post", "نشر الآن", "Publish now", "Publish"], "Post button");
        if (clicked) { posted = true; break; }
      }

      // Global fallback
      if (!posted) {
        console.log("[WARN] Trying global page scan for نشر...");
        const clicked = await clickBtn(page, ["نشر", "Post", "نشر الآن", "Publish now"], "Post button (global)");
        if (!clicked) {
          await page.screenshot({ path: "debug-no-post.png", fullPage: true });
          throw new Error("'نشر' button not found in step 2. See debug-no-post.png");
        }
        posted = true;
      }

      await sleep(6_000, 9_000);
      await page.screenshot({ path: "success.png" });
      console.log("[SUCCESS] 🎉 Posted successfully! Screenshot: success.png");
    }

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    try { await page.screenshot({ path: "debug-error.png", fullPage: true }); } catch {}
    await browser.close();
    process.exit(1);
  }

  await sleep(4_000);
  await browser.close();
  console.log("[INFO] Done ✅");
})();
