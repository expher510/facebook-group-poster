// =============================================================================
//  facebook-group-poster — index.js
//  Production script: works for Facebook Pages AND Groups
//  Flow: Open composer → Type text → التالي (Next) → نشر (Post)
//  Anti-detection: random UA, human typing, mouse jitter, random delays
// =============================================================================

require("dotenv").config();
const { chromium } = require("playwright");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep   = (min, max = min) => new Promise(r => setTimeout(r, randInt(min, max)));

async function jitterMouse(page) {
  const vp = page.viewportSize() || { width: 1366, height: 768 };
  for (let i = 0; i < randInt(3, 6); i++) {
    await page.mouse.move(
      randInt(vp.width * 0.2, vp.width * 0.8),
      randInt(vp.height * 0.2, vp.height * 0.8),
      { steps: randInt(5, 12) }
    );
    await sleep(120, 350);
  }
}

async function randomScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, randInt(150, 500) * (Math.random() > 0.3 ? 1 : -1));
    await sleep(300, 700);
  }
}

/** Try to click a button by aria-label or text inside a given scope. Returns true on success. */
async function clickBtn(scope, matches, tag = "button") {
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
          await sleep(400, 900);
          await el.click();
          console.log(`[INFO] ✅ Clicked ${tag}: "${m}"`);
          return true;
        }
      } catch { /* try next */ }
    }
  }
  return false;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TARGET_URL      = process.env.GROUP_URL;
const POST_CONTENT    = process.env.POST_CONTENT;
const FB_COOKIES_JSON = process.env.FB_COOKIES;

if (!TARGET_URL || !POST_CONTENT || !FB_COOKIES_JSON) {
  console.error("[FATAL] Missing required env vars: GROUP_URL, POST_CONTENT, FB_COOKIES");
  process.exit(1);
}

// Randomised realistic desktop user-agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
];
const UA = USER_AGENTS[randInt(0, USER_AGENTS.length - 1)];

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("[INFO] Launching browser…");
  const cookies = JSON.parse(FB_COOKIES_JSON);

  const browser = await chromium.launch({
    headless: true,                    // headless on GitHub Actions (no display)
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1366,768",
    ],
  });

  const context = await browser.newContext({
    userAgent: UA,
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "ar,en;q=0.9" },
  });

  // Stealth: hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins",   { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["ar", "en-US"] });
  });

  console.log(`[INFO] Injecting ${cookies.length} session cookies…`);
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    // ── 1. Navigate ──────────────────────────────────────────────────────────
    console.log(`[INFO] Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(3_500, 6_000);

    if (page.url().includes("login") || page.url().includes("checkpoint")) {
      throw new Error(`Cookie auth failed — redirected to: ${page.url()}`);
    }
    console.log("[INFO] ✅ Cookie authentication confirmed");

    // ── 2. Human-like warm-up ────────────────────────────────────────────────
    await jitterMouse(page);
    await randomScroll(page, randInt(2, 4));
    await sleep(2_000, 4_000);

    // ── 3. Click composer trigger ("بم تفكر؟" / "Write something…") ─────────
    console.log("[INFO] Opening post composer…");
    const trigger = page.locator([
      // Arabic page composer
      'div[role="button"]:has-text("بم تفكر؟")',
      'span:has-text("بم تفكر؟")',
      // Arabic group composer
      'div[role="button"]:has-text("اكتب شيئًا")',
      // English fallbacks
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Write something")',
      // Generic placeholders
      '[placeholder="اكتب شيئًا..."]',
      '[placeholder="Write something..."]',
      '[aria-label="اكتب شيئًا..."]',
      '[aria-label="Write something..."]',
    ].join(', ')).first();

    await trigger.waitFor({ state: "visible", timeout: 15_000 });
    await trigger.scrollIntoViewIfNeeded();
    await sleep(600, 1_200);
    await trigger.click();
    console.log("[INFO] ✅ Composer trigger clicked");

    // ── 4. Wait for modal ────────────────────────────────────────────────────
    console.log("[INFO] Waiting for composer modal…");
    const dialog = page.locator('div[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 12_000 });
    console.log("[INFO] ✅ Modal open");
    await sleep(1_500, 2_500);

    // ── 5. Find editor inside modal and type ─────────────────────────────────
    const editor = dialog.locator('[contenteditable="true"]').first();
    await editor.waitFor({ state: "visible", timeout: 8_000 });
    await editor.click();
    await sleep(700, 1_300);

    console.log("[INFO] Typing post content…");
    for (const ch of POST_CONTENT) {
      await page.keyboard.type(ch, { delay: randInt(50, 130) });
      if (Math.random() < 0.07) await sleep(200, 600);
    }
    console.log("[INFO] ✅ Content typed");
    await sleep(2_500, 4_500);

    // ── 6. Click "التالي" (Next) if present — Facebook Pages use 2-step flow ─
    console.log("[INFO] Looking for 'التالي' (Next) button…");
    const hasNext = await clickBtn(dialog, ["التالي", "Next"], "Next");

    if (hasNext) {
      // Two-step flow: wait for step 2 then click "نشر"
      console.log("[INFO] Two-step flow detected. Waiting for Publish screen…");
      await sleep(2_500, 4_000);

      // Collect all open dialogs (Facebook may open a 2nd dialog for step 2)
      const allDialogs = page.locator('div[role="dialog"]');
      const dlgCount   = await allDialogs.count();
      console.log(`[INFO] Dialog count after Next: ${dlgCount}`);

      let posted = false;
      for (let i = dlgCount - 1; i >= 0; i--) {
        const d = allDialogs.nth(i);
        if (await clickBtn(d, ["نشر", "نشر الآن", "Post", "Publish now", "Publish"], "Post")) {
          posted = true; break;
        }
      }

      if (!posted) {
        // Global page fallback
        posted = await clickBtn(page, ["نشر", "نشر الآن", "Post", "Publish now"], "Post (global)");
      }

      if (!posted) {
        await page.screenshot({ path: "debug-no-post-btn.png", fullPage: true });
        throw new Error("'نشر' button not found in step 2. See debug-no-post-btn.png");
      }

    } else {
      // Single-step flow (Groups): click "نشر" directly
      console.log("[INFO] Single-step flow — clicking 'نشر' directly…");
      const posted = await clickBtn(dialog, ["نشر", "Post", "نشر الآن"], "Post");
      if (!posted) {
        await page.screenshot({ path: "debug-no-post-btn.png", fullPage: true });
        throw new Error("'نشر' button not found. See debug-no-post-btn.png");
      }
    }

    // ── 7. Confirm publish ───────────────────────────────────────────────────
    console.log("[INFO] Waiting for post to publish…");
    await sleep(6_000, 10_000);

    if (page.url().includes("login") || page.url().includes("checkpoint")) {
      throw new Error(`Unexpected redirect after posting: ${page.url()}`);
    }

    console.log("[SUCCESS] 🎉 Post published successfully!");

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    try { await page.screenshot({ path: "debug-error.png", fullPage: true }); } catch {}
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log("[INFO] Browser closed. Done ✅");
})();
