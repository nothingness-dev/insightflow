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
const routeFilter = new Set(
  (process.env.MOBILE_ROUTE_FILTER || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
);
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
  { key: 'phone-landscape', width: 844, height: 390, special: true },
  { key: 'software-keyboard', width: 390, height: 430, special: true },
];
const themes = ['light', 'dark'];

const extremeFixtures = {
  surveyTitle: 'ارزیابی تجربه همکاری تیم بین‌المللی — InsightFlow Performance & Accessibility Review 2026 '.repeat(3).trim(),
  personName: 'نام بسیار طولانی همکار نمونه — Alexandra-Mohammadi International Operations',
  username: 'extreme.mobile.accessibility.user.with.a.very.long.identifier',
  ipv6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
  longComment: `${'این نظر طولانی برای بررسی شکست خطوط، خوانایی و اسکرول داخلی نوشته شده است. '.repeat(12)}\n${'Mixed-Latin-content-without-natural-breakpoints_'.repeat(10)}`,
  largeCount: 987654321,
};

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
    {
      id: 'admin-mobile-drawer',
      role: 'admin',
      path: '/admin',
      state: 'drawer-open',
      setup: 'open-overlay',
      mobileOnly: true,
      triggerTestId: 'admin-drawer-trigger',
      dialogTestId: 'admin-drawer-dialog',
    },
    {
      id: 'admin-shell-overflow',
      role: 'admin',
      path: '/admin',
      state: 'overflow-open',
      setup: 'open-overlay',
      mobileOnly: true,
      triggerTestId: 'shell-overflow-trigger',
      dialogTestId: 'shell-overflow-dialog',
    },
    { id: 'admin-survey-list', role: 'admin', path: '/admin/surveys', state: 'data' },
    {
      id: 'admin-survey-list-filtered', role: 'admin', path: '/admin/surveys', state: 'filtered',
      setup: 'apply-admin-search-filter', mobileOnly: true, filterSummaryTestId: 'survey-filter-summary',
    },
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
    {
      id: 'admin-users-filtered', role: 'admin', path: '/admin/users', state: 'filtered',
      setup: 'apply-admin-search-filter', mobileOnly: true, filterSummaryTestId: 'user-filter-summary',
    },
    { id: 'admin-activity', role: 'admin', path: '/admin/activity', state: 'data' },
    {
      id: 'admin-activity-filtered', role: 'admin', path: '/admin/activity', state: 'filtered',
      setup: 'apply-admin-search-filter', mobileOnly: true, filterSummaryTestId: 'activity-filter-summary',
    },
    { id: 'admin-settings', role: 'admin', path: '/admin/settings/data', state: 'data' },
    {
      id: 'employee-survey-list',
      role: 'employee',
      path: employeeCredentials ? '/surveys' : null,
      state: 'data',
      axe: true,
    },
    {
      id: 'employee-shell-overflow',
      role: 'employee',
      path: employeeCredentials ? '/surveys' : null,
      state: 'overflow-open',
      setup: 'open-overlay',
      mobileOnly: true,
      triggerTestId: 'shell-overflow-trigger',
      dialogTestId: 'shell-overflow-dialog',
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
      id: 'anonymous-shell-overflow',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'overflow-open',
      setup: 'open-overlay',
      mobileOnly: true,
      triggerTestId: 'shell-overflow-trigger',
      dialogTestId: 'shell-overflow-dialog',
    },
    {
      id: 'anonymous-rating-dialog',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'dialog-open',
      setup: 'open-rating-dialog',
    },
    {
      id: 'anonymous-rating-errors',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'validation-errors',
      setup: 'open-rating-errors',
      mobileOnly: true,
    },
    {
      id: 'anonymous-rating-text-200',
      role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'dialog-open-text-200',
      setup: 'open-rating-dialog',
      textScale: 2,
      mobileOnly: true,
    },
    {
      id: 'admin-survey-list-long-content', role: 'admin', path: '/admin/surveys',
      state: 'long-mixed-content', setup: 'mock-survey-extremes',
      viewportKeys: ['mobile-320', 'phone-landscape'],
    },
    {
      id: 'admin-survey-list-empty', role: 'admin', path: '/admin/surveys',
      state: 'empty', setup: 'mock-survey-empty', viewportKeys: ['mobile-320'],
      expectedStateTestId: 'survey-list-empty-state',
    },
    {
      id: 'admin-survey-list-error', role: 'admin', path: '/admin/surveys',
      state: 'server-error', setup: 'mock-survey-error', viewportKeys: ['mobile-320'],
      expectedStateTestId: 'survey-list-load-error',
    },
    {
      id: 'admin-survey-list-loading', role: 'admin', path: '/admin/surveys',
      state: 'slow-loading', setup: 'mock-survey-loading', viewportKeys: ['mobile-320'],
      captureWhileLoading: true,
    },
    {
      id: 'admin-activity-extremes', role: 'admin', path: '/admin/activity',
      state: 'ipv6-large-counts-long-content', setup: 'mock-activity-extremes',
      viewportKeys: ['mobile-320', 'phone-landscape'],
    },
    {
      id: 'admin-activity-text-200', role: 'admin', path: '/admin/activity',
      state: 'pagination-and-status-text-200', setup: 'mock-activity-extremes',
      textScale: 2, viewportKeys: ['mobile-390'],
    },
    {
      id: 'admin-survey-progress-extremes', role: 'admin', path: '/admin/survey-progress',
      state: 'large-counts-long-content', setup: 'mock-progress-extremes',
      viewportKeys: ['mobile-320'],
    },
    {
      id: 'admin-users-permission-denied', role: 'admin', path: '/admin/users',
      state: 'permission-denied', setup: 'mock-users-permission-denied',
      viewportKeys: ['mobile-320'], expectedStateTestId: 'user-list-load-error',
    },
    {
      id: 'employee-survey-list-offline', role: 'employee',
      path: employeeCredentials ? '/surveys' : null, state: 'offline',
      setup: 'mock-employee-offline', viewportKeys: ['mobile-320'],
      expectedStateTestId: 'employee-survey-list-load-error',
    },
    {
      id: 'admin-survey-results-extremes', role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}/results` : null,
      state: 'long-comments-large-counts', setup: 'mock-results-extremes',
      viewportKeys: ['mobile-320', 'phone-landscape'],
    },
    {
      id: 'admin-survey-results-text-200', role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}/results` : null,
      state: 'comment-pagination-text-200', setup: 'mock-results-extremes',
      textScale: 2, viewportKeys: ['mobile-390'],
    },
    {
      id: 'admin-survey-results-error', role: 'admin',
      path: surveyId ? `/admin/surveys/${surveyId}/results` : null,
      state: 'server-error', setup: 'mock-results-error', viewportKeys: ['mobile-320'],
      expectedStateTestId: 'survey-results-load-error',
    },
    {
      id: 'admin-survey-new-text-200', role: 'admin', path: '/admin/surveys/new',
      state: 'text-enlargement-200', textScale: 2, viewportKeys: ['mobile-320'],
    },
    {
      id: 'admin-survey-new-keyboard', role: 'admin', path: '/admin/surveys/new',
      state: 'software-keyboard', setup: 'verify-software-keyboard',
      viewportKeys: ['software-keyboard'],
    },
    {
      id: 'admin-back-navigation', role: 'admin', path: '/admin/surveys/new',
      state: 'back-navigation', setup: 'verify-back-navigation', viewportKeys: ['mobile-320'],
    },
    {
      id: 'anonymous-rating-landscape', role: 'anonymous',
      path: anonymousToken ? `/s/${anonymousToken}` : null,
      state: 'dialog-open-landscape', setup: 'open-rating-dialog',
      viewportKeys: ['phone-landscape'],
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

async function installNetworkScenario(page, entry) {
  const handlers = [];
  let releaseLoading = null;
  const add = async (pattern, handler) => {
    handlers.push({ pattern, handler });
    await page.route(pattern, handler);
  };
  const transformJson = async (requestRoute, transform) => {
    const response = await requestRoute.fetch();
    const payload = await response.json();
    await requestRoute.fulfill({ response, json: transform(payload) });
  };
  const updateListPayload = (payload, update) => {
    if (Array.isArray(payload)) return update(payload);
    return { ...payload, results: update(Array.isArray(payload?.results) ? payload.results : []) };
  };

  if (entry.setup === 'mock-survey-extremes') {
    await add(/\/api\/admin\/surveys\/(?:\?.*)?$/, requestRoute => transformJson(requestRoute, payload => (
      updateListPayload(payload, surveys => {
        const fallback = {
          id: surveyId || 999999,
          title: extremeFixtures.surveyTitle,
          description: extremeFixtures.longComment,
          question: extremeFixtures.longComment,
          status: 'published',
          questions: [],
          questions_count: 98765,
          people_count: 87654321,
          total_responses: extremeFixtures.largeCount,
          created_at: new Date().toISOString(),
        };
        const first = surveys[0] || fallback;
        return [{
          ...first,
          title: extremeFixtures.surveyTitle,
          description: extremeFixtures.longComment,
          questions_count: 98765,
          people_count: 87654321,
          total_responses: extremeFixtures.largeCount,
        }, ...surveys.slice(1)];
      })
    )));
  }

  if (entry.setup === 'mock-survey-empty') {
    await add(/\/api\/admin\/surveys\/(?:\?.*)?$/, async requestRoute => {
      await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  if (entry.setup === 'mock-survey-error') {
    await add(/\/api\/admin\/surveys\/(?:\?.*)?$/, async requestRoute => {
      await requestRoute.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'سرویس موقتاً در دسترس نیست — Service temporarily unavailable' }),
      });
    });
  }

  if (entry.setup === 'mock-survey-loading') {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    releaseLoading = release;
    await add(/\/api\/admin\/surveys\/(?:\?.*)?$/, async requestRoute => {
      await gate;
      await requestRoute.continue().catch(() => {});
    });
  }

  if (entry.setup === 'mock-activity-extremes') {
    await add(/\/api\/admin\/activity\/logs\/(?:\?.*)?$/, requestRoute => transformJson(requestRoute, payload => {
      const log = {
        id: 999999,
        action: 'extreme_mobile_state',
        action_label: 'بررسی محتوای بسیار طولانی و Mixed-Latin audit event',
        actor: null,
        actor_username: extremeFixtures.username,
        actor_full_name: extremeFixtures.personName,
        actor_role: 'admin',
        actor_display: extremeFixtures.personName,
        description: extremeFixtures.longComment,
        target_type: 'survey',
        target_id: String(extremeFixtures.largeCount),
        target_repr: extremeFixtures.surveyTitle,
        status: 'failed',
        is_critical: true,
        ip_address: extremeFixtures.ipv6,
        user_agent: `MobileExtreme/${'x'.repeat(180)}`,
        metadata: { count: extremeFixtures.largeCount, ipv6: extremeFixtures.ipv6 },
        created_at: new Date().toISOString(),
      };
      if (Array.isArray(payload)) return [log, ...payload];
      return {
        ...payload,
        count: Math.max(Number(payload?.count) || 0, extremeFixtures.largeCount),
        results: [log, ...(Array.isArray(payload?.results) ? payload.results : [])],
      };
    }));
    await add(/\/api\/admin\/activity\/stats\/(?:\?.*)?$/, requestRoute => transformJson(requestRoute, payload => ({
      ...payload,
      total_activities: extremeFixtures.largeCount,
      today_activities: 876543210,
      week_activities: 765432109,
      critical_activities: 654321098,
      failed_activities: 543210987,
    })));
  }

  if (entry.setup === 'mock-progress-extremes') {
    await add(/\/api\/admin\/surveys\/progress\/(?:\?.*)?$/, async requestRoute => {
      const pendingUsers = Array.from({ length: 13 }, (_, index) => ({
        id: 900000 + index,
        username: `${extremeFixtures.username}.${index}`,
        full_name: `${extremeFixtures.personName} ${index + 1}`,
      }));
      const payload = {
        summary: {
          total_surveys: extremeFixtures.largeCount,
          total_assigned_responses: 876543210,
          total_completed_responses: 765432109,
          total_anonymous_participants: 654321098,
          total_pending_responses: 543210987,
          overall_completion_percentage: 87.6,
        },
        surveys: [{
          survey_id: surveyId || 999999,
          title: extremeFixtures.surveyTitle,
          status: 'published',
          active_people_count: 876543210,
          active_questions_count: 765432109,
          tracking_enabled: true,
          assigned_employees: extremeFixtures.largeCount,
          completed_employees: 876543210,
          anonymous_participants: 654321098,
          pending_employees: pendingUsers.length,
          completion_percentage: 88.7,
          last_employee_response_at: new Date().toISOString(),
          last_anonymous_response_at: new Date().toISOString(),
          last_response_at: new Date().toISOString(),
          pending_users: pendingUsers,
        }],
      };
      await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
  }

  if (entry.setup === 'mock-users-permission-denied') {
    await add(/\/api\/admin\/users\/(?:\?.*)?$/, async requestRoute => {
      await requestRoute.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'شما اجازه مشاهده این بخش را ندارید — Permission denied' }),
      });
    });
  }

  if (entry.setup === 'mock-employee-offline') {
    await add(/\/api\/surveys\/(?:\?.*)?$/, requestRoute => requestRoute.abort('internetdisconnected'));
  }

  if (entry.setup === 'mock-results-error') {
    await add(/\/api\/admin\/surveys\/\d+\/results\/(?:\?.*)?$/, async requestRoute => {
      await requestRoute.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'نتایج موقتاً در دسترس نیست' }),
      });
    });
  }

  if (entry.setup === 'mock-results-extremes') {
    await add(/\/api\/admin\/surveys\/\d+\/results\/(?:\?.*)?$/, async requestRoute => {
      const question = {
        question_id: 990001,
        question_text: extremeFixtures.surveyTitle,
        has_score: true,
        score_required: true,
        has_comment: true,
        comment_required: false,
        has_emoji: true,
        emoji_required: false,
        average_score: 9.8,
        total_score: extremeFixtures.largeCount,
        responses_count: 876543210,
        votes_count: 876543210,
        comments: [],
        comments_count: 41,
        average_emoji_numeric: 3.8,
        average_emoji_label: 'عالی',
        emoji_responses_count: 765432109,
        emoji_votes_count: 765432109,
        emoji_breakdown: { bad: 12345678, average: 23456789, good: 34567890, excellent: 654321098 },
      };
      const payload = {
        survey: {
          id: surveyId || 999999,
          title: extremeFixtures.surveyTitle,
          description: extremeFixtures.longComment,
          status: 'closed',
          questions: [question],
          questions_count: 1,
          people_count: extremeFixtures.largeCount,
          total_responses: extremeFixtures.largeCount,
        },
        results: [{
          rank: 1,
          person_id: 990001,
          full_name: extremeFixtures.personName,
          photo_url: null,
          department: 'International Operations / واحد بسیار طولانی تجربه مشتری',
          role_title: 'Senior Accessibility & Reliability Specialist',
          average_score: 9.8,
          total_score: extremeFixtures.largeCount,
          votes_count: 876543210,
          comments: [{ question_id: question.question_id, question_text: question.question_text, comment: extremeFixtures.longComment }],
          comments_count: 41,
          question_results: [question],
          result_section: 'all',
        }],
      };
      await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await add(/\/api\/admin\/surveys\/\d+\/comments\/(?:\?.*)?$/, async requestRoute => {
      await requestRoute.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 41,
          page: 1,
          page_size: 20,
          total_pages: 3,
          comments: [
            { comment: extremeFixtures.longComment, question_text: extremeFixtures.surveyTitle },
            { comment: `${extremeFixtures.longComment}\n${extremeFixtures.ipv6}`, question_text: 'Mixed content' },
          ],
        }),
      });
    });
  }

  return {
    releaseLoading: () => releaseLoading?.(),
    cleanup: async () => {
      releaseLoading?.();
      await page.waitForTimeout(25);
      for (const { pattern, handler } of handlers.reverse()) {
        await page.unroute(pattern, handler).catch(() => {});
      }
    },
  };
}

async function applyExtremeSetup(page, entry, viewport, theme) {
  let evidence = null;

  if (entry.captureWhileLoading) {
    const loadingVisible = await page.locator('[aria-busy="true"]').first().isVisible().catch(() => false);
    evidence = { ...(evidence || {}), loadingVisible };
    if (!loadingVisible) {
      report.findings.push({
        severity: 'high', route: entry.id, viewport: viewport.key, theme,
        rule: 'loading-state', detail: 'The slow response did not expose a visible busy skeleton.',
      });
    }
  }

  if (entry.textScale) {
    const textEvidence = await page.evaluate(() => {
      const saveBar = document.querySelector('[data-testid="survey-form-save-bar"]');
      const saveBarRect = saveBar?.getBoundingClientRect() || null;
      return {
        rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        saveBarPresent: Boolean(saveBar),
        saveBarVisible: saveBar
          ? Boolean(saveBarRect && saveBarRect.top >= 0 && saveBarRect.bottom <= innerHeight + 1)
          : null,
      };
    });
    evidence = { ...(evidence || {}), textEnlargement: textEvidence };
    if (textEvidence.rootFontSize < 31 || (textEvidence.saveBarPresent && !textEvidence.saveBarVisible)) {
      report.findings.push({
        severity: 'high', route: entry.id, viewport: viewport.key, theme,
        rule: 'text-enlargement', detail: JSON.stringify(textEvidence),
      });
    }
  }

  if (entry.expectedStateTestId) {
    const state = page.getByTestId(entry.expectedStateTestId);
    await state.waitFor({ state: 'visible', timeout: 5_000 });
    evidence = { ...(evidence || {}), expectedStateVisible: true };
  }

  if (entry.setup === 'mock-results-extremes') {
    const questionsTab = page.getByRole('tab').nth(1);
    await questionsTab.click();
    const commentsTrigger = page.getByTestId('lazy-comments-trigger').first();
    await commentsTrigger.click();
    await page.getByTestId('lazy-comments-panel').first().waitFor({ state: 'visible', timeout: 5_000 });
    evidence = { ...(evidence || {}), commentsPanelVisible: true };

    if (entry.textScale) {
      const resultsReflow = await page.evaluate(() => {
        const visible = element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const lineCount = element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const lineTops = [];
          for (const rect of range.getClientRects()) {
            if (rect.width <= 0 || rect.height <= 0) continue;
            if (!lineTops.some(top => Math.abs(top - rect.top) <= 2)) lineTops.push(rect.top);
          }
          return lineTops.length;
        };
        const contentWidthsEm = [...document.querySelectorAll('[data-testid="question-stat-content"]')]
          .filter(visible)
          .map(element => {
            const width = element.getBoundingClientRect().width;
            const fontSize = Number.parseFloat(getComputedStyle(element).fontSize) || 1;
            return Math.round((width / fontSize) * 10) / 10;
          });
        const compactLineCounts = [
          ...document.querySelectorAll('[data-testid="lazy-comments-label"], button'),
        ]
          .filter(element => visible(element) && (
            ['قبلی', 'بعدی'].includes(element.textContent?.trim()) ||
            element.matches('[data-testid="lazy-comments-label"]')
          ))
          .map(element => ({ label: element.textContent?.trim() || '', lines: lineCount(element) }));
        return {
          minimumContentWidthEm: contentWidthsEm.length ? Math.min(...contentWidthsEm) : 0,
          compactLineCounts,
        };
      });
      evidence = { ...(evidence || {}), resultsReflow };
      if (
        resultsReflow.minimumContentWidthEm < 6 ||
        resultsReflow.compactLineCounts.some(item => item.lines > 1)
      ) {
        report.findings.push({
          severity: 'high', route: entry.id, viewport: viewport.key, theme,
          rule: 'results-text-reflow', detail: JSON.stringify(resultsReflow),
        });
      }
    }
  }

  if (entry.setup === 'verify-software-keyboard') {
    const field = page.locator('#survey-description');
    const saveBar = page.getByTestId('survey-form-save-bar');
    await field.focus();
    await field.fill('Keyboard viewport resilience check');
    await field.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.waitForTimeout(100);
    const [fieldRect, saveBarRect] = await Promise.all([field.boundingBox(), saveBar.boundingBox()]);
    const keyboardEvidence = {
      activeIsField: await field.evaluate(element => document.activeElement === element),
      fieldVisible: Boolean(fieldRect && fieldRect.y >= 0 && fieldRect.y + fieldRect.height <= viewport.height + 1),
      saveBarVisible: Boolean(saveBarRect && saveBarRect.y >= 0 && saveBarRect.y + saveBarRect.height <= viewport.height + 1),
      fieldClearOfSaveBar: Boolean(fieldRect && saveBarRect && fieldRect.y + fieldRect.height <= saveBarRect.y - 4),
      fieldRect,
      saveBarRect,
    };
    evidence = { ...(evidence || {}), softwareKeyboard: keyboardEvidence };
    if (Object.values(keyboardEvidence).slice(0, 4).some(value => !value)) {
      report.findings.push({
        severity: 'high', route: entry.id, viewport: viewport.key, theme,
        rule: 'software-keyboard-overlap', detail: JSON.stringify(keyboardEvidence),
      });
    }
  }

  if (entry.setup === 'verify-back-navigation') {
    await navigate(page, '/admin/surveys');
    await page.getByTestId('create-survey-button').click();
    await page.waitForURL(url => url.pathname === '/admin/surveys/new', { timeout: 5_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    const backPath = new URL(page.url()).pathname;
    const backReturnedToList = backPath === '/admin/surveys';
    await page.goForward({ waitUntil: 'domcontentloaded' });
    const forwardPath = new URL(page.url()).pathname;
    const forwardReturnedToForm = forwardPath === '/admin/surveys/new';
    evidence = { ...(evidence || {}), backNavigation: { backPath, forwardPath, backReturnedToList, forwardReturnedToForm } };
    if (!backReturnedToList || !forwardReturnedToForm) {
      report.findings.push({
        severity: 'high', route: entry.id, viewport: viewport.key, theme,
        rule: 'history-navigation', detail: JSON.stringify(evidence.backNavigation),
      });
    }
  }

  return evidence;
}

async function collectExtremeEvidence(page, entry, viewport, theme) {
  const markerEntries = {
    'mock-survey-extremes': [extremeFixtures.surveyTitle],
    'mock-activity-extremes': [extremeFixtures.ipv6, extremeFixtures.longComment.slice(0, 60)],
    'mock-progress-extremes': [extremeFixtures.surveyTitle, extremeFixtures.personName],
    'mock-results-extremes': [extremeFixtures.surveyTitle, extremeFixtures.longComment.slice(0, 60)],
  };
  const markers = markerEntries[entry.setup] || [];
  const evidence = await page.evaluate(markerValues => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const matches = [...document.querySelectorAll('main *')]
      .filter(element => visible(element) && markerValues.some(marker => element.textContent?.includes(marker)))
      .filter(element => ![...element.children].some(child => markerValues.some(marker => child.textContent?.includes(marker))))
      .map(element => {
        const style = getComputedStyle(element);
        const overflows = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
        const intentionallyScrollable = [style.overflowX, style.overflowY].some(value => ['auto', 'scroll'].includes(value));
        const clipsOverflow = [style.overflowX, style.overflowY].some(value => ['hidden', 'clip'].includes(value));
        return {
          tag: element.tagName.toLowerCase(),
          overflows,
          intentionallyScrollable,
          clipped: overflows && clipsOverflow && !intentionallyScrollable,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        };
      });
    return { markerCount: markerValues.length, matches, clippedCount: matches.filter(match => match.clipped).length };
  }, markers);

  if (markers.length && (evidence.matches.length < markers.length || evidence.clippedCount > 0)) {
    report.findings.push({
      severity: 'high', route: entry.id, viewport: viewport.key, theme,
      rule: 'extreme-content-integrity', detail: JSON.stringify(evidence),
    });
  }
  return markers.length ? evidence : null;
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
        const hasExpandedBreadcrumbTarget = target.classList.contains('breadcrumb-link');
        return {
          tag: element.tagName.toLowerCase(),
          name:
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.textContent?.trim().slice(0, 80) ||
            element.getAttribute('name') ||
            '',
          width: Math.round(hasExpandedBreadcrumbTarget ? Math.max(rect.width, 44) : rect.width),
          height: Math.round(hasExpandedBreadcrumbTarget ? Math.max(rect.height, 44) : rect.height),
        };
      })
      .filter(item => item.width < 44 || item.height < 44);
    const compactLabels = new Set(['قبلی', 'بعدی', 'موفق', 'ناموفق', 'مدیر', 'کارمند']);
    const visualLineCount = element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = [];
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (!lineTops.some(top => Math.abs(top - rect.top) <= 2)) lineTops.push(rect.top);
      }
      return lineTops.length;
    };
    const wrappedCompactLabels = [...document.querySelectorAll('button,span')]
      .filter(element => visible(element) && compactLabels.has(element.textContent?.trim()))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.textContent?.trim() || '',
          lineCount: visualLineCount(element),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          whiteSpace: getComputedStyle(element).whiteSpace,
        };
      })
      .filter(item => item.lineCount > 1 || item.whiteSpace !== 'nowrap');
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
      wrappedCompactLabels,
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

async function applyAdminSearchFilter(page, route, viewport, theme) {
  const input = page.locator('main input').filter({ visible: true }).first();
  if (await input.count() === 0) {
    report.findings.push({
      severity: 'high', route: route.id, viewport: viewport.key, theme,
      rule: 'admin-filter-controls', detail: 'No visible search field was available for the filtered-state check.',
    });
    return null;
  }

  await input.fill('milestone-6-mobile-filter');
  await page.waitForTimeout(650);
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  const summary = page.getByTestId(route.filterSummaryTestId);
  const summaryVisible = await summary.isVisible().catch(() => false);
  const clearActionVisible = summaryVisible
    ? await summary.getByRole('button', { name: /پاک کردن فیلترها/ }).isVisible().catch(() => false)
    : false;

  if (!summaryVisible || !clearActionVisible) {
    report.findings.push({
      severity: 'high', route: route.id, viewport: viewport.key, theme,
      rule: 'admin-filter-summary', detail: JSON.stringify({ summaryVisible, clearActionVisible }),
    });
  }
  return { summaryVisible, clearActionVisible };
}

async function collectAdminDensityEvidence(page, route, viewport, theme) {
  const responsiveLists = {
    'admin-survey-list': ['survey-mobile-list', 'survey-desktop-table'],
    'admin-users': ['user-mobile-list', 'user-desktop-table'],
    'admin-activity': ['activity-mobile-log-list', 'activity-desktop-log-table'],
  };
  const selectors = responsiveLists[route.id];
  const evidence = {};

  if (selectors) {
    evidence.mobileListVisible = await page.getByTestId(selectors[0]).isVisible().catch(() => false);
    evidence.desktopTableVisible = await page.getByTestId(selectors[1]).isVisible().catch(() => false);
    const expected = viewport.width <= 430
      ? evidence.mobileListVisible && !evidence.desktopTableVisible
      : !evidence.mobileListVisible && evidence.desktopTableVisible;
    if (!expected) {
      report.findings.push({
        severity: 'high', route: route.id, viewport: viewport.key, theme,
        rule: 'responsive-admin-data-view', detail: JSON.stringify(evidence),
      });
    }
  }

  if ((route.id.startsWith('admin-survey-new') || route.id === 'admin-survey-edit') && viewport.width <= 430) {
    const detailsVisible = await page.getByTestId('survey-form-details-section').isVisible().catch(() => false);
    const questionsVisible = route.id === 'admin-survey-new'
      ? await page.getByTestId('survey-form-questions-section').isVisible().catch(() => false)
      : null;
    const saveBar = page.getByTestId('survey-form-save-bar');
    const saveBarVisible = await saveBar.isVisible().catch(() => false);
    const saveBarRect = saveBarVisible ? await saveBar.boundingBox() : null;
    const saveBarContained = Boolean(
      saveBarRect && saveBarRect.x >= 0 && saveBarRect.x + saveBarRect.width <= viewport.width + 1 &&
      saveBarRect.y >= 0 && saveBarRect.y + saveBarRect.height <= viewport.height + 1,
    );
    Object.assign(evidence, { detailsVisible, questionsVisible, saveBarVisible, saveBarContained, saveBarRect });
    if (!detailsVisible || questionsVisible === false || !saveBarVisible || !saveBarContained) {
      report.findings.push({
        severity: 'high', route: route.id, viewport: viewport.key, theme,
        rule: 'mobile-survey-editor-structure', detail: JSON.stringify(evidence),
      });
    }
  }

  return Object.keys(evidence).length ? evidence : null;
}

async function collectParticipationEvidence(page, route, viewport, theme) {
  if (!['anonymous-survey', 'employee-survey-detail'].includes(route.id)) return null;
  const prefix = route.role === 'anonymous' ? 'anonymous' : 'employee';
  const evidence = await page.evaluate(prefixValue => {
    const cards = [...document.querySelectorAll(`[data-testid^="${prefixValue}-participant-card-"]`)];
    const actions = [...document.querySelectorAll(`[data-testid^="${prefixValue}-rating-trigger-"]`)];
    const progress = document.querySelector(`[data-testid="${prefixValue}-participation-progress"]`);
    const progressbar = progress?.querySelector('[role="progressbar"]');
    const sticky = document.querySelector(`[data-testid="${prefixValue}-sticky-next"]`);
    return {
      cardCount: cards.length,
      compactIdentityCount: cards.filter(card => card.querySelector(`[data-testid^="${prefixValue}-participant-identity-"]`)).length,
      emptyMediaReserved: cards.some(card => (
        !card.querySelector(`[data-testid^="${prefixValue}-participant-media-"]`) &&
        !card.querySelector(`[data-testid^="${prefixValue}-participant-identity-"]`)
      )),
      allActionsTouchSized: actions.every(action => {
        const rect = action.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),
      progressVisible: Boolean(progress && progress.getBoundingClientRect().height > 0),
      progressValue: progressbar?.getAttribute('aria-valuenow') ?? null,
      progressMax: progressbar?.getAttribute('aria-valuemax') ?? null,
      stickyVisible: Boolean(sticky && sticky.getBoundingClientRect().height > 0),
      stickyPosition: sticky ? getComputedStyle(sticky).position : null,
    };
  }, prefix);

  const invalid = {
    cardsRendered: evidence.cardCount > 0,
    compactIdentityAvailable: evidence.compactIdentityCount === evidence.cardCount,
    noEmptyMediaReservation: !evidence.emptyMediaReserved,
    touchSizedActions: evidence.allActionsTouchSized,
    progressAvailable: evidence.progressVisible && evidence.progressValue !== null && evidence.progressMax !== null,
    stickyContinuation: evidence.stickyVisible && evidence.stickyPosition === 'sticky',
  };
  if (Object.values(invalid).some(value => !value)) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'participation-flow',
      detail: JSON.stringify({ ...invalid, evidence }),
    });
  }
  return evidence;
}

async function openAndVerifyOverlay(page, route, viewport, theme) {
  const trigger = page.getByTestId(route.triggerTestId);
  const dialog = page.getByTestId(route.dialogTestId);

  if (!(await trigger.isVisible().catch(() => false))) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'overlay-trigger',
      detail: `The ${route.triggerTestId} trigger was not visible.`,
    });
    return null;
  }

  await trigger.focus();
  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 3_000 });
  await page.waitForTimeout(100);

  const initialFocusContained = await dialog.evaluate(
    element => element.contains(document.activeElement),
  );

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 3_000 });
  const escapeClosed = !(await dialog.isVisible().catch(() => false));
  const focusRestored = await trigger.evaluate(
    element => document.activeElement === element,
  );

  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 3_000 });
  await page.waitForTimeout(100);

  const reopenedFocusContained = await dialog.evaluate(
    element => element.contains(document.activeElement),
  );

  const evidence = {
    initialFocusContained,
    escapeClosed,
    focusRestored,
    reopenedFocusContained,
  };

  if (Object.values(evidence).some(value => !value)) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'overlay-focus-management',
      detail: JSON.stringify(evidence),
    });
  }

  return evidence;
}

async function openAndVerifyRatingModal(page, route, viewport, theme) {
  const trigger = page.locator('[data-testid^="anonymous-rating-trigger-"]:not([disabled])').first();
  const dialog = page.getByTestId('anonymous-rating-modal');

  if (!(await trigger.isVisible().catch(() => false))) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'dialog-state',
      detail: 'No enabled participant action was available to open the rating dialog.',
    });
    return null;
  }

  await trigger.focus();
  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 3_000 });
  await page.waitForTimeout(150);

  const header = dialog.getByTestId('modal-header');
  const body = dialog.getByTestId('modal-body');
  const footer = dialog.getByTestId('modal-footer');
  const initialFocusContained = await dialog.evaluate(element => element.contains(document.activeElement));
  const beforeScroll = await Promise.all([header.boundingBox(), footer.boundingBox()]);
  const bodyScroll = await body.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(100);
  const afterScroll = await Promise.all([header.boundingBox(), footer.boundingBox()]);
  const persistentChrome = Boolean(
    beforeScroll[0] && beforeScroll[1] && afterScroll[0] && afterScroll[1] &&
    Math.abs(beforeScroll[0].y - afterScroll[0].y) < 1 &&
    Math.abs(beforeScroll[1].y - afterScroll[1].y) < 1,
  );
  const chromeVisible = await header.isVisible() && await footer.isVisible();
  const independentlyScrollable = ['auto', 'scroll'].includes(bodyScroll.overflowY);

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 3_000 });
  const escapeClosed = !(await dialog.isVisible().catch(() => false));
  const focusRestored = await trigger.evaluate(element => document.activeElement === element);

  // Let the intentional incomplete-close warning leave before the visual state
  // so it does not obscure the dialog header in screenshots.
  const statusMessages = page.locator('[role="status"]');
  if (await statusMessages.count()) {
    await statusMessages.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 3_000 });
  await page.waitForTimeout(100);
  const reopenedFocusContained = await dialog.evaluate(element => element.contains(document.activeElement));

  let selectedState = null;
  if (route.setup === 'open-rating-dialog') {
    const scoreOption = dialog.locator('button[aria-label^="امتیاز "]').first();
    const emojiOption = dialog.locator('button[aria-label^="امتیاز کیفی:"]').first();
    const hitTargetMatches = locator => locator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    });
    let scoreHitTarget = false;
    let emojiHitTarget = false;
    if (await scoreOption.isVisible().catch(() => false)) {
      await scoreOption.focus();
      await page.waitForTimeout(50);
      scoreHitTarget = await hitTargetMatches(scoreOption).catch(() => false);
      await page.keyboard.press('Space');
    }
    if (await emojiOption.isVisible().catch(() => false)) {
      await emojiOption.focus();
      await page.waitForTimeout(50);
      emojiHitTarget = await hitTargetMatches(emojiOption).catch(() => false);
      await page.keyboard.press('Space');
    }
    selectedState = {
      scorePressed: await scoreOption.getAttribute('aria-pressed').catch(() => null),
      scoreHasCheck: await scoreOption.locator('svg').count().then(count => count > 0).catch(() => false),
      scoreHitTarget,
      emojiPressed: await emojiOption.getAttribute('aria-pressed').catch(() => null),
      emojiHasCheck: await emojiOption.locator('span svg').count().then(count => count > 0).catch(() => false),
      emojiHitTarget,
    };
  }

  let validationSummary = null;
  if (route.setup === 'open-rating-errors') {
    await page.getByTestId('anonymous-rating-submit').click();
    const summary = page.getByTestId('modal-error-summary');
    await summary.waitFor({ state: 'visible', timeout: 3_000 });
    await page.waitForTimeout(100);
    validationSummary = {
      visible: await summary.isVisible(),
      focused: await summary.evaluate(element => document.activeElement === element),
      footerVisible: await footer.isVisible(),
    };
  }

  const evidence = {
    initialFocusContained,
    escapeClosed,
    focusRestored,
    reopenedFocusContained,
    chromeVisible,
    persistentChrome,
    independentlyScrollable,
    bodyScroll,
    validationSummary,
    selectedState,
  };
  const coreChecks = {
    initialFocusContained,
    escapeClosed,
    focusRestored,
    reopenedFocusContained,
    chromeVisible,
    persistentChrome,
    independentlyScrollable,
    validationSummaryValid: validationSummary
      ? Object.values(validationSummary).every(Boolean)
      : true,
    selectedStateExposed: selectedState
      ? Object.values(selectedState).every(value => value === true || value === 'true')
      : true,
  };

  if (Object.values(coreChecks).some(value => !value)) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'rating-modal-accessibility',
      detail: JSON.stringify({ ...coreChecks, bodyScroll }),
    });
  }

  return evidence;
}

async function captureRoute(page, route, viewport, theme) {
  const networkScenario = await installNetworkScenario(page, route);
  await navigate(page, route.path);
  if (route.captureWhileLoading) {
    await page.locator('[aria-busy="true"]').first().waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForTimeout(100);
  } else {
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  await page.evaluate(scale => {
    document.documentElement.style.fontSize = scale ? `${scale * 100}%` : '';
  }, route.textScale || null);
  await page.waitForTimeout(100);

  let overlayEvidence = null;
  let modalEvidence = null;
  if (route.setup === 'open-overlay') {
    overlayEvidence = await openAndVerifyOverlay(page, route, viewport, theme);
  }

  if (['open-rating-dialog', 'open-rating-errors'].includes(route.setup)) {
    modalEvidence = await openAndVerifyRatingModal(page, route, viewport, theme);
  }
  let filterEvidence = null;
  if (route.setup === 'apply-admin-search-filter') {
    filterEvidence = await applyAdminSearchFilter(page, route, viewport, theme);
  }
  const extremeSetupEvidence = await applyExtremeSetup(page, route, viewport, theme);

  const relativeFile = path.join(theme, viewport.key, `${route.id}.png`);
  const screenshotPath = path.join(outputDir, relativeFile);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: !modalEvidence });

  const metrics = await collectMetrics(page);
  const focus = await collectFocusEvidence(page);
  const participationEvidence = await collectParticipationEvidence(page, route, viewport, theme);
  const adminDensityEvidence = await collectAdminDensityEvidence(page, route, viewport, theme);
  const extremeEvidence = await collectExtremeEvidence(page, route, viewport, theme);
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
  if (metrics.wrappedCompactLabels.length) {
    report.findings.push({
      severity: 'high',
      route: route.id,
      viewport: viewport.key,
      theme,
      rule: 'compact-label-wrap',
      detail: JSON.stringify(metrics.wrappedCompactLabels),
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
    overlayEvidence,
    modalEvidence,
    participationEvidence,
    filterEvidence,
    adminDensityEvidence,
    extremeSetupEvidence,
    extremeEvidence,
  });
  await networkScenario.cleanup();
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
  const matchingRoutes = routes.filter(
    route =>
      route.role === role &&
      route.path &&
      (routeFilter.size === 0 || routeFilter.has(route.id)) &&
      (route.viewportKeys ? route.viewportKeys.includes(viewport.key) : !viewport.special) &&
      (!route.mobileOnly || viewport.width <= 430),
  );
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
    'This report is a baseline, not a WCAG conformance claim. A 200% text-scale reflow state is automated; screen-reader, browser-zoom, and real-device checks remain manual.',
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
