const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { analyzeFile } = require('../lib/analyze.cjs');

test('analyzeFile groups routes and helpers into extraction families', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katana-'));
  const targetFile = path.join(tempDir, 'server.cjs');
  fs.writeFileSync(targetFile, `
function verifyJWT(req, res, next) {}
async function saveUserTasks(userId, tasks) {}
const sendPlainEmailNow = async () => {};
app.get('/api/auth/login', () => {});
app.post('/api/mail/send', () => {});
app.get('/api/resources/latest', () => {});
  `.trim(), 'utf8');

  const report = analyzeFile(targetFile, { rootDir: tempDir, top: 10 });

  assert.equal(report.totals.routes, 3);
  assert.ok(report.routeGroups.some((entry) => entry.name === 'auth'));
  assert.ok(report.routeGroups.some((entry) => entry.name === 'mail'));
  assert.ok(report.helperGroups.some((entry) => entry.name === 'auth'));
  assert.ok(report.helperGroups.some((entry) => entry.name === 'memory'));
  assert.ok(report.helperGroups.some((entry) => entry.name === 'mail'));
  assert.ok(report.routeClusters.length >= 3);
  assert.ok(report.helperClusters.length >= 3);
  assert.ok(Array.isArray(report.extractionPlan));
});
