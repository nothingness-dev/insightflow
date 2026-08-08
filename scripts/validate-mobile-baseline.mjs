import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(
  projectRoot,
  process.env.MOBILE_OUTPUT_DIR || 'ux-audit/mobile-baseline/generated',
);
const reportPath = path.join(outputDir, 'report.json');
const manifestPath = path.join(outputDir, 'screenshot-manifest.json');
const requiredJourneys = [
  { route: 'login', role: 'public' },
  { route: 'anonymous-survey', role: 'anonymous' },
  { route: 'employee-survey-list', role: 'employee' },
  { route: 'admin-dashboard', role: 'admin' },
];
const requiredViewports = ['mobile-320', 'mobile-390', 'desktop'];
const requiredThemes = ['light', 'dark'];
const failures = [];

function addFailure(message) {
  failures.push(message);
}

function captureFor(report, route, viewport, theme) {
  return report.captures.find(
    capture =>
      capture.route === route &&
      capture.viewport === viewport &&
      capture.theme === theme,
  );
}

let report;
try {
  report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read ${reportPath}: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(report.captures) || report.captures.length === 0) {
  addFailure('The report contains no responsive captures.');
}

for (const item of report.blocked || []) {
  addFailure(`Blocked route ${item.route}: ${item.reason}`);
}

for (const item of report.consoleErrors || []) {
  addFailure(
    `Unexpected browser message${item.route ? ` on ${item.route}` : ''}: ${item.message}`,
  );
}

for (const finding of report.findings || []) {
  if (['critical', 'high'].includes(finding.severity)) {
    addFailure(
      `${finding.severity} ${finding.route}/${finding.viewport}/${finding.theme} ` +
        `${finding.rule}: ${finding.detail}`,
    );
  }
}

for (const journey of requiredJourneys) {
  for (const viewport of requiredViewports) {
    for (const theme of requiredThemes) {
      if (!captureFor(report, journey.route, viewport, theme)) {
        addFailure(
          `Missing ${journey.role} smoke screenshot: ${journey.route}/${viewport}/${theme}.`,
        );
      }
    }
  }

  const axeCapture = captureFor(report, journey.route, 'mobile-390', 'light');
  if (axeCapture && !Array.isArray(axeCapture.axe)) {
    addFailure(`The ${journey.role} smoke journey did not record its axe result.`);
  }
}

const screenshotManifest = [];
for (const capture of report.captures || []) {
  if (!capture.file) {
    addFailure(`Capture ${capture.route} has no screenshot path.`);
    continue;
  }

  const screenshotPath = path.resolve(outputDir, capture.file);
  const relativeToOutput = path.relative(outputDir, screenshotPath);
  if (relativeToOutput.startsWith('..') || path.isAbsolute(relativeToOutput)) {
    addFailure(`Capture ${capture.route} points outside the output directory.`);
    continue;
  }

  try {
    const image = await fs.readFile(screenshotPath);
    if (image.length < 100) {
      addFailure(`Screenshot ${capture.file} is empty or truncated.`);
      continue;
    }
    screenshotManifest.push({
      file: capture.file,
      route: capture.route,
      viewport: capture.viewport,
      theme: capture.theme,
      bytes: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
    });
  } catch (error) {
    addFailure(`Screenshot ${capture.file} is unreadable: ${error.message}`);
  }
}

screenshotManifest.sort((a, b) => a.file.localeCompare(b.file));
await fs.writeFile(
  manifestPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), screenshots: screenshotManifest }, null, 2)}\n`,
  'utf8',
);

const criticalOrHigh = (report.findings || []).filter(item =>
  ['critical', 'high'].includes(item.severity),
).length;
const summary = [
  '## Mobile accessibility and responsive regression',
  '',
  `- Captures: ${report.captures?.length || 0}`,
  `- Screenshot files verified: ${screenshotManifest.length}`,
  `- Blocked routes: ${report.blocked?.length || 0}`,
  `- Critical/high findings: ${criticalOrHigh}`,
  `- Unexpected browser messages: ${report.consoleErrors?.length || 0}`,
  `- Expected failure-state messages: ${report.expectedConsoleMessages?.length || 0}`,
  `- Result: ${failures.length ? 'FAILED' : 'PASSED'}`,
  '',
];

if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join('\n'), 'utf8');
}

console.log(summary.join('\n'));
if (failures.length) {
  console.error('\nRegression gate failures:');
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
  if (failures.length > 50) console.error(`- ...and ${failures.length - 50} more.`);
  process.exit(1);
}
