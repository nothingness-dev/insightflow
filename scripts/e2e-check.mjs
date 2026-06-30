import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const apiBase = process.env.E2E_API_URL || 'http://127.0.0.1:8000/api';

/**
 * Resolve the system Chrome executable without relying on Playwright's CDN
 * download (which can be blocked by regional firewalls).
 *
 * Priority:
 *   1. E2E_CHROME_PATH env var — lets CI/CD or local devs pin a specific path.
 *   2. Platform-default locations, tried in order.
 *   3. undefined — Playwright falls back to its bundled Chromium if available.
 */
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
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : [
          // Linux — common package-manager install locations
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/snap/bin/chromium',
        ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined; // let Playwright use its own Chromium
}

const chromePath = resolveChromePath();

const report = { steps: [], problems: [], consoleErrors: [] };

function step(name, ok, detail = '') {
  report.steps.push({ name, ok, detail });
}

function problem(severity, area, detail) {
  report.problems.push({ severity, area, detail });
}

async function api(path, opts = {}, token = null) {
  const headers = { ...(opts.headers || {}) };
  if (!headers['Content-Type'] && typeof opts.body === 'string') headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiBase + path, { ...opts, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return { status: res.status, data };
}

let browser;

try {
  const launchOpts = { headless: true };
  if (chromePath) launchOpts.executablePath = chromePath;
  browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) report.consoleErrors.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => report.consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('Admin@1234');
  const loginFailures = [];
  page.on('response', response => {
    if (response.url().includes('/api/auth/login/') && response.status() >= 400) {
      loginFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  step('Admin can log in through UI', page.url().endsWith('/admin'), page.url());
  if (!page.url().endsWith('/admin')) {
    const loginBody = await page.locator('body').innerText().catch(() => '');
    const loginStorage = await page.evaluate(() => ({
      access: Boolean(localStorage.getItem('access_token')),
      user: localStorage.getItem('user'),
    }));
    throw new Error(`Login did not navigate. url=${page.url()} failures=${loginFailures.join(',') || 'none'} storage=${JSON.stringify(loginStorage)} body=${loginBody.slice(0, 500)}`);
  }

  const access = await page.evaluate(() => localStorage.getItem('access_token'));
  if (!access) throw new Error('No access token in localStorage after login');

  const unique = Date.now();
  const surveyRes = await api('/admin/surveys/', {
    method: 'POST',
    body: JSON.stringify({
      title: `E2E Hash Survey ${unique}`,
      description: 'Created by automated E2E check',
      results_visibility: 'admin_only',
      questions: [{
        text: 'Score this person',
        help_text: '',
        has_score: true,
        score_required: true,
        has_comment: false,
        comment_required: false,
        has_emoji: false,
        emoji_required: false,
        display_order: 0,
        is_active: true,
      }],
    }),
  }, access);
  const survey = surveyRes.data;
  step('Admin API can create survey', Boolean(survey.id), `survey=${survey.id}`);

  const p1 = await api(`/admin/surveys/${survey.id}/people/`, {
    method: 'POST',
    body: JSON.stringify({
      full_name: `E2E Person A ${unique}`,
      role_title: 'QA',
      department: 'Test',
      description: '',
      display_order: 0,
      is_active: true,
    }),
  }, access);
  const p2 = await api(`/admin/surveys/${survey.id}/people/`, {
    method: 'POST',
    body: JSON.stringify({
      full_name: `E2E Person B ${unique}`,
      role_title: 'QA',
      department: 'Test',
      description: '',
      display_order: 1,
      is_active: true,
    }),
  }, access);
  step('Admin API can add people', Boolean(p1.data.id && p2.data.id), `${p1.data.id}, ${p2.data.id}`);

  await api(`/admin/surveys/${survey.id}/publish/`, { method: 'POST', body: '{}' }, access);
  step('Admin API can publish survey', true);

  const linkRes = await api(`/admin/surveys/${survey.id}/hash-links/`, {
    method: 'POST',
    body: JSON.stringify({ label: 'E2E Link' }),
  }, access);
  const hashToken = linkRes.data.token;
  step('Admin API can create hash link', Boolean(hashToken), hashToken);

  await page.goto(`${base}/admin/surveys/${survey.id}`, { waitUntil: 'networkidle' });
  const adminBody = await page.locator('body').innerText();
  step('Admin survey detail renders generated survey', adminBody.includes(`E2E Hash Survey ${unique}`), `text length=${adminBody.length}`);
  step('Admin hash link panel shows /s token', adminBody.includes(`/s/${hashToken}`), hashToken);

  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonPage = await anon.newPage();
  anonPage.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) report.consoleErrors.push(`anon ${msg.type()}: ${msg.text()}`);
  });

  await anonPage.goto(`${base}/s/${hashToken}`, { waitUntil: 'networkidle' });
  const anonText = await anonPage.locator('body').innerText();
  step('Anonymous survey page opens on mobile viewport', anonText.includes(`E2E Hash Survey ${unique}`), `text length=${anonText.length}`);
  step('Anonymous page has theme switcher button', await anonPage.locator('header button[title]').count() > 0);

  async function rateVisible(score) {
    await anonPage.locator('.person-card button:not([disabled])').first().click();
    await anonPage.locator('button').filter({ hasText: String(score) }).first().click();
    await anonPage.locator('.btn-primary').last().click();
    await anonPage.waitForTimeout(1000);
  }

  await rateVisible(8);
  await rateVisible(9);
  await anonPage.waitForLoadState('networkidle').catch(() => {});
  const completeText = await anonPage.locator('body').innerText();
  step(
    'Anonymous participant can complete all people',
    completeText.includes('تمام بخش') || completeText.includes('100') || completeText.includes('۲ از ۲') || completeText.includes('2 از 2'),
    completeText.slice(0, 300),
  );

  const myRatings = await api(`/s/${hashToken}/surveys/${survey.id}/my-ratings/?anonymous_token=fresh-e2e-token`);
  step(
    'Fresh anonymous token is IP-locked after completion',
    myRatings.data.ip_locked === true && myRatings.data.is_complete === true,
    JSON.stringify(myRatings.data),
  );

  let duplicateBlocked = false;
  try {
    await api(`/s/${hashToken}/people/${p1.data.id}/rate/`, {
      method: 'POST',
      body: JSON.stringify({
        anonymous_token: 'fresh-e2e-token-2',
        answers: [{ question_id: survey.questions[0].id, score: 7 }],
      }),
    });
  } catch (err) {
    duplicateBlocked = /400/.test(err.message);
  }
  step('Second anonymous token from same IP is blocked', duplicateBlocked);
  if (!duplicateBlocked) problem('high', 'Anonymous duplicate prevention', 'Second anonymous token from the same IP was not blocked.');

  const logs = await api('/admin/activity/logs/?action=anonymous_vote&page_size=5', {}, access);
  const firstLog = logs.data.results?.[0];
  step('Anonymous vote audit API contains IP', firstLog?.ip_address === '127.0.0.1', JSON.stringify(firstLog || null));
  if (firstLog?.ip_address !== '127.0.0.1') problem('high', 'Audit API', 'Anonymous vote audit entry did not include 127.0.0.1.');

  await page.goto(`${base}/admin/activity`, { waitUntil: 'networkidle' });
  const activityText = await page.locator('body').innerText();
  step('Activity center page loads', activityText.length > 100, activityText.slice(0, 200));

  await context.close();
  await anon.close();
} catch (err) {
  problem('critical', 'E2E runner', err.stack || err.message);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify(report, null, 2));
