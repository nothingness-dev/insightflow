import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

function resolveChromePath() {
  if (process.env.E2E_CHROME_PATH) return process.env.E2E_CHROME_PATH;
  const { platform } = process;
  const candidates =
    platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser'];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

const report = { steps: [], problems: [] };

function step(name, ok, detail = '') {
  report.steps.push({ name, ok, detail });
  if (!ok) report.problems.push({ severity: 'warning', area: name, detail });
}

let browser;

try {
  const launchOpts = { headless: true };
  const chromePath = resolveChromePath();
  if (chromePath) launchOpts.executablePath = chromePath;
  browser = await chromium.launch(launchOpts);

  const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const loginPage = await ctx1.newPage();
  await loginPage.goto(`${base}/login`, { waitUntil: 'networkidle' });

  const loginCard = await loginPage.locator('.bg-white.rounded-2xl').count();
  step('Login page renders card element', loginCard > 0, `found ${loginCard}`);

  const loginInputs = await loginPage.locator('input').count();
  step('Login page has input fields', loginInputs >= 2, `found ${loginInputs}`);

  await ctx1.close();

  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const notFoundPage = await ctx2.newPage();
  await notFoundPage.goto(`${base}/nonexistent-page`, { waitUntil: 'networkidle' });

  const notFoundText = await notFoundPage.locator('body').innerText();
  step('404 page shows not-found message', notFoundText.includes('پیدا نشد'), notFoundText.slice(0, 200));
  step('404 page has back button', await notFoundPage.locator('button').count() > 0);

  await ctx2.close();

  const ctx3 = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx3.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('Admin@1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  const isLoggedIn = page.url().includes('/admin');
  step('Admin can log in', isLoggedIn, page.url());

  if (isLoggedIn) {
    const statCards = await page.locator('.card.p-3, .card.p-5, .card[class*="p-"]').count();
    step('Dashboard has cards', statCards > 0, `found ${statCards}`);

    const colorBtn = page.locator('button[aria-label="باز کردن تنظیمات رنگ‌بندی"]');
    const colorBtnCount = await colorBtn.count();
    step('Theme switcher color button exists', colorBtnCount > 0);

    if (colorBtnCount > 0) {
      await colorBtn.click();
      await page.waitForTimeout(300);
      const panel = page.locator('.absolute.left-0.top-12');
      const panelVisible = await panel.count() > 0;
      step('Theme switcher panel opens on click', panelVisible);

      if (panelVisible) {
        const themeOptions = await panel.locator('button').count();
        step('Theme panel shows color options', themeOptions >= 4, `found ${themeOptions}`);

        await page.mouse.click(10, 10);
        await page.waitForTimeout(300);
        const panelAfterClose = await panel.count();
        step('Theme panel closes when clicking outside', panelAfterClose === 0);
      }
    }

    const darkToggle = page.locator('button[aria-label*="تغییر به حالت"]');
    const darkToggleCount = await darkToggle.count();
    step('Dark mode toggle exists', darkToggleCount > 0);

    if (darkToggleCount > 0) {
      const wasDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
      await darkToggle.click();
      await page.waitForTimeout(500);
      const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
      step('Dark mode toggle changes mode', wasDark !== isDark, `was=${wasDark} now=${isDark}`);

      await darkToggle.click();
      await page.waitForTimeout(500);
    }

    const sidebarLinks = await page.locator('.sidebar-item').count();
    step('Sidebar has navigation links', sidebarLinks >= 4, `found ${sidebarLinks}`);

    const surveysLink = page.locator('.sidebar-item', { hasText: 'نظرسنجی‌ها' });
    if (await surveysLink.count() > 0) {
      await surveysLink.first().click();
      await page.waitForTimeout(1500);
      step('Survey list page loads', page.url().includes('/admin/surveys'), page.url());

      const pageTitle = await page.locator('.page-title').count();
      step('Survey list has page title', pageTitle > 0);
    }

    const searchInput = page.locator('#survey-search, input[placeholder*="جستجو"]');
    step('Survey list has search input', await searchInput.count() > 0);

    const selectTriggers = page.locator('.select-trigger');
    step('Survey list has select filters', await selectTriggers.count() >= 1);
  }

  const ctx9 = await browser.newContext({
    viewport: { width: 1366, height: 820 },
    reducedMotion: 'reduce',
  });
  const reducedPage = await ctx9.newPage();
  await reducedPage.goto(`${base}/login`, { waitUntil: 'networkidle' });
  const reducedLogin = await reducedPage.locator('input[autocomplete="username"]').count();
  step('Login page renders with reduced-motion', reducedLogin > 0);
  await ctx9.close();

  const ctx10 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await ctx10.newPage();
  await mobilePage.goto(`${base}/login`, { waitUntil: 'networkidle' });
  const mobileLoginCard = await mobilePage.locator('.bg-white.rounded-2xl').count();
  step('Login renders on mobile viewport', mobileLoginCard > 0);
  await ctx10.close();
} catch (err) {
  report.problems.push({ severity: 'critical', area: 'motion-e2e runner', detail: err.stack || err.message });
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify(report, null, 2));
const failed = report.steps.filter(s => !s.ok);
if (failed.length > 0 || report.problems.some(p => p.severity === 'critical')) {
  process.exit(1);
}
