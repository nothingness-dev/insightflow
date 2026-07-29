import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

async function readLocalEnvironment() {
  try {
    const text = await fs.readFile(path.join(projectRoot, '.env'), 'utf8');
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes('='))
        .map(line => {
          const separator = line.indexOf('=');
          const key = line.slice(0, separator).trim();
          const value = line
            .slice(separator + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/, '$2');
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}

const localEnvironment = await readLocalEnvironment();
const baseUrl = (process.env.MOBILE_BASE_URL || 'http://127.0.0.1').replace(/\/$/, '');
const apiUrl = (process.env.MOBILE_API_URL || `${baseUrl}/api`).replace(/\/$/, '');
const outputDir = path.resolve(
  projectRoot,
  process.env.MOBILE_OUTPUT_DIR || 'ux-audit/mobile-baseline/generated',
);
const fixtureMode = process.env.MOBILE_ALLOW_LOCAL_FIXTURES === '1';
const strictMode = process.argv.includes('--strict');
const adminCredentials = {
  username:
    process.env.MOBILE_ADMIN_USERNAME ||
    localEnvironment.ADMIN_USERNAME ||
    'admin',
  password:
    process.env.MOBILE_ADMIN_PASSWORD ||
    localEnvironment.ADMIN_PASSWORD ||
    'Admin@1234',
};
let employeeCredentials =
  process.env.MOBILE_EMPLOYEE_USERNAME && process.env.MOBILE_EMPLOYEE_PASSWORD
    ? {
        username: process.env.MOBILE_EMPLOYEE_USERNAME,
        password: process.env.MOBILE_EMPLOYEE_PASSWORD,
      }
    : null;
let anonymousToken = process.env.MOBILE_ANONYMOUS_TOKEN || null;

const viewports = [
  { key: 'mobile-320', width: 320, height: 800 },
  { key: 'mobile-390', width: 390, height: 844 },
  { key: 'desktop', width: 1440, height: 900 },
];
const themes = ['light', 'dark'];

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  standards: {
    wcagTarget: 'WCAG 2.2 AA',
    minimumViewportWidth: 320,
    targetSize: 44,
    mobileFormFontSize: 16,
    zoomTarget: '200%',
  },
  routes: [],
  captures: [],
  findings: [],
  blocked: [],
  consoleErrors: [],
};

let browser;
let adminAccess = null;
let temporaryUserId = null;
let temporarySurveyId = null;
let temporaryHashLinkId = null;
let surveyId = null;
let publishedSurveyId = null;
const roleSessions = new Map();

function resolveChromePath() {
  if (process.env.E2E_CHROME_PATH) return process.env.E2E_CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
          ];
  return candidates.find(candidate => candidate && require('node:fs').existsSync(candidate));
}

function assertFixtureSafety() {
  if (!fixtureMode) return;
  const hostname = new URL(baseUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(
      'MOBILE_ALLOW_LOCAL_FIXTURES=1 is restricted to localhost/loopback targets.',
    );
  }
}

async function api(route, options = {}, token = adminAccess) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${apiUrl}${route}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${route} -> ${response.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

async function loginApi(credentials) {
  return api(
    '/auth/login/',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
    null,
  );
}

async function prepareRoutes() {
  const adminLogin = await loginApi(adminCredentials);
  adminAccess = adminLogin.access;

  let surveysResponse = await api('/admin/surveys/');
  let surveys = Array.isArray(surveysResponse)
    ? surveysResponse
    : surveysResponse?.results || [];
  surveyId = surveys[0]?.id || null;
  publishedSurveyId = surveys.find(survey => survey.status === 'published')?.id || null;

  if (fixtureMode && !publishedSurveyId) {
    const suffix = Date.now();
    const survey = await api('/admin/surveys/', {
      method: 'POST',
      body: JSON.stringify({
        title: `Mobile baseline ${suffix}`,
        description: 'Temporary fixture for responsive and accessibility baselines.',
        results_visibility: 'admin_only',
        questions: [
          {
            text: 'کیفیت همکاری را ارزیابی کنید',
            help_text: 'یک امتیاز و نظر کوتاه ثبت کنید.',
            has_score: true,
            score_required: true,
            has_comment: true,
            comment_required: false,
            has_emoji: true,
            emoji_required: true,
            display_order: 0,
            is_active: true,
          },
        ],
      }),
    });
    temporarySurveyId = survey.id;
    surveyId = survey.id;
    await api(`/admin/surveys/${survey.id}/people/`, {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'همکار نمونه دسترس‌پذیری',
        role_title: 'کارشناس',
        department: 'تضمین کیفیت',
        description: 'Temporary responsive baseline fixture',
        display_order: 0,
        is_active: true,
      }),
    });
    await api(`/admin/surveys/${survey.id}/publish/`, {
      method: 'POST',
      body: '{}',
    });
    publishedSurveyId = survey.id;
    surveysResponse = await api('/admin/surveys/');
    surveys = Array.isArray(surveysResponse)
      ? surveysResponse
      : surveysResponse?.results || [];
  }

  if (fixtureMode && !employeeCredentials) {
    const suffix = Date.now();
    employeeCredentials = {
      username: `mobile_a11y_${suffix}`,
      password: `J7!qV3#nZ8@pL2xK-${String(suffix).slice(-4)}`,
    };
    const employee = await api('/admin/users/', {
      method: 'POST',
      body: JSON.stringify({
        username: employeeCredentials.username,
        full_name: 'کاربر موقت بررسی موبایل',
        role: 'employee',
        password: employeeCredentials.password,
        password_confirm: employeeCredentials.password,
        is_active: true,
      }),
    });
    temporaryUserId = employee.id;
    const employeeLogin = await loginApi(employeeCredentials);
    await api(
      '/auth/change-password/',
      {
        method: 'POST',
        body: JSON.stringify({
          current_password: employeeCredentials.password,
          new_password: employeeCredentials.password,
          new_password_confirm: employeeCredentials.password,
        }),
      },
      employeeLogin.access,
    );
  }

  if (fixtureMode && !anonymousToken && publishedSurveyId) {
    const link = await api(`/admin/surveys/${publishedSurveyId}/hash-links/`, {
      method: 'POST',
      body: JSON.stringify({ label: `Mobile baseline ${Date.now()}` }),
    });
    temporaryHashLinkId = link.id;
    anonymousToken = link.token;
  }

  const routes = [
    { id: 'login', role: 'public', path: '/login', state: 'default', axe: true },
    { id: 'admin-dashboard', role: 'admin', path: '/admin', state: 'data', axe: true },
    { id: 'admin-survey-list', role: 'admin', path: '/admin/surveys', state: 'data' },
    { id: 'admin-survey-progress', role: 'admin', path: '/admin/survey-progress', state: 'data' },
    { id: 'admin-survey-new', role: 'admin', path: '/admin/surveys/new', state: 'empty-form' },
    {
      id: 'admin-survey-detail',
      role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}` : null,
      state: 'data',
    },
    {
      id: 'admin-survey-edit',
      role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}/edit` : null,
      state: 'data',
    },
    {
      id: 'admin-survey-results',
      role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}/results` : null,
      state: 'data',
    },
    { id: 'admin-users', role: 'admin', path: '/admin/users', state: 'data' },
    { id: 'admin-activity', role: 'admin', path: '/admin/activity', state: 'data' },
    { id: 'admin-settings', role: 'admin', path: '/admin/settings/data', state: 'data' },
    {
      id: 'employee-survey-list',
      role: 'employee',
      path: employeeCredentials ? '/surveys' : null,
      state: 'data',
      axe: true,
    },
    {
      id: 'employee-survey-detail',
      role: 'employee',
      path: employeeCredentials && publishedSurveyId ? `/surveys/${publishedSurveyId}` : null,
      state: 'data',
    },
    {
      id: 'anonymous-survey',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'available',
      axe: true,
    },
    {
      id: 'anonymous-rating-dialog',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'dialog-open',
      setup: 'open-rating-dialog',
    },
  ];

  report.routes = routes.map(({ setup, ...route }) => ({
    ...route,
    status: route.path ? 'ready' : 'blocked',
  }));
  for (const route of report.routes.filter(item => !item.path)) {
    report.blocked.push({
      route: route.id,
      reason:
        route.role === 'employee'
          ? 'Provide MOBILE_EMPLOYEE_USERNAME/PASSWORD or enable local fixtures.'
          : route.role === 'anonymous'
            ? 'Provide MOBILE_ANONYMOUS_TOKEN or enable local fixtures.'
            : 'A survey is required for this dynamic route.',
    });
  }
  return routes;
}

async function loginUi(page, credentials, expectedPath) {
  await navigate(page, '/login');
  await page.locator('input[autocomplete="username"]').fill(credentials.username);
  await page.locator('input[autocomplete="current-password"]').fill(credentials.password);
  await Promise.all([
    page.waitForURL(url => url.pathname === expectedPath, { timeout: 20_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function navigate(page, route) {
  const target = `${baseUrl}${route}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(target, { waitUntil: 'commit', timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const interactive = [
      ...document.querySelectorAll(
        'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])',
      ),
    ].filter(visible);
    const effectiveTarget = element => {
      if (
        element instanceof HTMLInputElement &&
        ['checkbox', 'radio'].includes(element.type)
      ) {
        const explicitLabel = element.id
          ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
          : null;
        const label = explicitLabel || element.closest('label');
        if (label && visible(label)) return label;
      }
      return element;
    };
    const smallTargets = interactive
      .map(element => {
        const target = effectiveTarget(element);
        const rect = target.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          name:
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.textContent?.trim().slice(0, 80) ||
            element.getAttribute('name') ||
            '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(item => item.width < 44 || item.height < 44);
    const smallMobileFormText = [
      ...document.querySelectorAll(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),select,textarea',
      ),
    ]
      .filter(visible)
      .map(element => ({
        name:
          element.getAttribute('aria-label') ||
          element.getAttribute('name') ||
          element.getAttribute('placeholder') ||
          element.tagName.toLowerCase(),
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      }))
      .filter(item => item.fontSize < 16);
    const fixedElements = [...document.querySelectorAll('*')]
      .filter(element => visible(element) && ['fixed', 'sticky'].includes(getComputedStyle(element).position))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
        };
      })
      .slice(0, 30);
    return {
      pageWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      interactiveCount: interactive.length,
      smallTargets,
      smallMobileFormText,
      fixedElements,
      h1Count: document.querySelectorAll('h1').length,
      lang: document.documentElement.lang,
      direction: document.documentElement.dir || document.body.dir || getComputedStyle(document.body).direction,
    };
  });
}

async function collectFocusEvidence(page) {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return { focused: false, visible: false };
    const style = getComputedStyle(element);
    const visible =
      style.outlineStyle !== 'none' ||
      Number.parseFloat(style.outlineWidth) > 0 ||
      (style.boxShadow && style.boxShadow !== 'none');
    return {
      focused: true,
      visible,
      tag: element.tagName.toLowerCase(),
      name:
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.textContent?.trim().slice(0, 80) ||
        '',
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
      boxShadow: style.boxShadow,
    };
  });
}

async function captureRoute(page, route, viewport, theme) {
  await navigate(page, route.path);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(350);

  if (route.setup === 'open-rating-dialog') {
    const trigger = page.locator('.person-card button:not([disabled])').first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(250);
    } else {
      report.findings.push({
        severity: 'high',
        route: route.id,
        viewport: viewport.key,
        theme,
        rule: 'dialog-state',
        detail: 'No enabled participant action was available to open the rating dialog.',
      });
    }
  }

  const relativeFile = path.join(theme, viewport.key, `${route.id}.png`);
  const screenshotPath = path.join(outputDir, relativeFile);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const metrics = await collectMetrics(page);
  const focus = await collectFocusEvidence(page);
  let axe = null;
  if (route.axe && viewport.key === 'mobile-390' && theme === 'light') {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    axe = result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
      examples: violation.nodes.slice(0, 10).map(node => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
    for (const violation of axe) {
      report.findings.push({
        severity: ['critical', 'serious'].includes(violation.impact) ? 'high' : 'medium',
        route: route.id,
        viewport: viewport.key,
        theme,
        rule: `axe:${violation.id}`,
        detail: `${violation.help} (${violation.nodes} node${violation.nodes === 1 ? '' : 's'})`,
      });
    }
  }

  if (metrics.horizontalOverflow) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'horizontal-overflow',
      detail: `${metrics.scrollWidth}px content inside a ${metrics.pageWidth}px viewport.`,
    });
  }
  if (metrics.smallTargets.length) {
    report.findings.push({
      severity: 'medium',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'target-size',
      detail: `${metrics.smallTargets.length} visible target(s) are smaller than 44 × 44 px.`,
    });
  }
  if (viewport.width <= 430 && metrics.smallMobileFormText.length) {
    report.findings.push({
      severity: 'medium',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'mobile-form-font-size',
      detail: `${metrics.smallMobileFormText.length} form control(s) use text smaller than 16 px.`,
    });
  }
  if (focus.focused && !focus.visible) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'focus-visible',
      detail: `The first keyboard-focused ${focus.tag} had no visible outline or shadow.`,
    });
  }

  report.captures.push({
    route: route.id,
    role: route.role,
    state: route.state,
    viewport: viewport.key,
    theme,
    file: relativeFile.replaceAll('\\', '/'),
    metrics,
    focus,
    axe,
  });
}

async function getRoleSession(role) {
  if (roleSessions.has(role)) return roleSessions.get(role);
  const context = await browser.newContext({
    viewport: { width: viewports[0].width, height: viewports[0].height },
    locale: 'fa-IR',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) {
      report.consoleErrors.push({
        role,
        message: `${message.type()}: ${message.text()}`,
      });
    }
  });
  page.on('pageerror', error => {
    report.consoleErrors.push({
      role,
      message: `pageerror: ${error.message}`,
    });
  });

  if (role === 'admin') await loginUi(page, adminCredentials, '/admin');
  if (role === 'employee') await loginUi(page, employeeCredentials, '/surveys');
  const session = { context, page };
  roleSessions.set(role, session);
  return session;
}

async function runRole(routes, role, viewport, theme) {
  const matchingRoutes = routes.filter(route => route.role === role && route.path);
  if (!matchingRoutes.length) return;
  const { page } = await getRoleSession(role);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  if (page.url() === 'about:blank') {
    await navigate(page, '/login');
  }
  await page.evaluate(mode => {
    localStorage.setItem('app-theme-mode', mode);
    localStorage.setItem('app-theme', 'purple');
  }, theme);
  for (const route of matchingRoutes) {
    await captureRoute(page, route, viewport, theme);
  }
}

async function writeReports() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  const findingsBySeverity = report.findings.reduce((summary, finding) => {
    summary[finding.severity] = (summary[finding.severity] || 0) + 1;
    return summary;
  }, {});
  const lines = [
    '# Generated mobile accessibility baseline',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: ${baseUrl}`,
    `Captures: ${report.captures.length}`,
    `Blocked routes: ${report.blocked.length}`,
    `Findings: ${JSON.stringify(findingsBySeverity)}`,
    '',
    '## Blocked routes',
    '',
    ...(report.blocked.length
      ? report.blocked.map(item => `- ${item.route}: ${item.reason}`)
      : ['- None']),
    '',
    '## Findings',
    '',
    ...(report.findings.length
      ? report.findings.map(
          item =>
            `- [${item.severity}] ${item.route} / ${item.viewport} / ${item.theme} / ${item.rule}: ${item.detail}`,
        )
      : ['- None']),
    '',
    'This report is a baseline, not a WCAG conformance claim. Screen-reader, zoom/reflow, and real-device checks remain manual.',
    '',
  ];
  await fs.writeFile(path.join(outputDir, 'summary.md'), lines.join('\n'), 'utf8');
}

async function cleanupFixtures() {
  if (!adminAccess) return;
  if (temporaryHashLinkId) {
    await api(`/admin/hash-links/${temporaryHashLinkId}/`, { method: 'DELETE' }).catch(() => {});
  }
  if (temporaryUserId) {
    await api(`/admin/users/${temporaryUserId}/`, { method: 'DELETE' }).catch(() => {});
  }
  if (temporarySurveyId) {
    await api(`/admin/surveys/${temporarySurveyId}/`, { method: 'DELETE' }).catch(() => {});
  }
}

let infrastructureError = null;
try {
  assertFixtureSafety();
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const routes = await prepareRoutes();
  const executablePath = resolveChromePath();
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-proxy-server'],
  });
  for (const theme of themes) {
    for (const viewport of viewports) {
      await runRole(routes, 'public', viewport, theme);
      await runRole(routes, 'anonymous', viewport, theme);
      await runRole(routes, 'employee', viewport, theme);
      await runRole(routes, 'admin', viewport, theme);
    }
  }
} catch (error) {
  infrastructureError = error;
  report.findings.push({
    severity: 'critical',
    route: 'runner',
    viewport: 'n/a',
    theme: 'n/a',
    rule: 'infrastructure',
    detail: error.stack || error.message,
  });
} finally {
  for (const session of roleSessions.values()) {
    await session.context.close().catch(() => {});
  }
  if (browser) await browser.close();
  await cleanupFixtures();
  await writeReports();
}

const summary = {
  outputDir,
  captures: report.captures.length,
  findings: report.findings.length,
  blocked: report.blocked.length,
  infrastructureError: infrastructureError?.message || null,
};
console.log(JSON.stringify(summary, null, 2));

if (
  infrastructureError ||
  (strictMode && report.findings.some(finding => ['critical', 'high'].includes(finding.severity)))
) {
  process.exit(1);
}
