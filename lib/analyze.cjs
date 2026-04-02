const fs = require('node:fs');
const path = require('node:path');

const ROUTE_REGEX = /\b(app|router)\.(use|get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]+)\3/;
const FUNCTION_REGEXES = [
  /^(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  /^(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s+)?function\b/,
  /^(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?(?:\([^=]*\)|[A-Za-z_$][\w$]*)\s*=>/,
];

const ROUTE_FAMILY_RULES = [
  [/^\/api\/auth(?:\/|$)/, 'auth'],
  [/^\/api\/a11\/history(?:\/|$)/, 'a11-history'],
  [/^\/api\/memory(?:\/|$)/, 'memory'],
  [/^\/api\/resources(?:\/|$)/, 'resources'],
  [/^\/api\/public\/resources(?:\/|$)/, 'public-resources'],
  [/^\/api\/mail(?:\/|$)/, 'mail'],
  [/^\/api\/files(?:\/|$)/, 'files'],
  [/^\/api\/control(?:\/|$)/, 'control'],
  [/^\/api\/a11host(?:\/|$)/, 'runtime-status'],
  [/^\/api\/a11\/capabilities(?:\/|$)/, 'runtime-status'],
  [/^\/api\/avatar(?:\/|$)/, 'avatar'],
  [/^\/api\/tts(?:\/|$)/, 'tts'],
  [/^\/api\/ai(?:\/|$)/, 'ai'],
  [/^\/api\/agent(?:\/|$)/, 'agent'],
  [/^\/files(?:\/|$)/, 'static-files'],
];

const HELPER_CATEGORY_RULES = [
  [/auth|jwt|token|password|login|register|forgot|reset/i, 'auth'],
  [/history|conversation|chatmemory|recentchat/i, 'history'],
  [/memory|memo|phantom|ghost|fact|task|ephemeral/i, 'memory'],
  [/resource|file|upload|download|shared|r2|artifact/i, 'resources'],
  [/mail|email|scheduled/i, 'mail'],
  [/image|avatar|prompt|clarification|sd/i, 'image'],
  [/runtime|supervisor|control|status|capabilities/i, 'runtime'],
  [/env|database|cors|origin/i, 'platform'],
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function makeRelative(baseDir, filePath) {
  const relative = normalizePath(path.relative(baseDir, filePath));
  return relative || path.basename(filePath);
}

function groupRouteFamily(routePath) {
  const normalized = String(routePath || '').trim();
  for (const [rule, family] of ROUTE_FAMILY_RULES) {
    if (rule.test(normalized)) return family;
  }

  const apiMatch = normalized.match(/^\/api\/([^/]+)/);
  if (apiMatch?.[1]) return apiMatch[1];

  const otherMatch = normalized.match(/^\/([^/]+)/);
  if (otherMatch?.[1]) return otherMatch[1];

  return 'misc';
}

function groupHelperCategory(name) {
  const normalized = String(name || '').trim();
  for (const [rule, category] of HELPER_CATEGORY_RULES) {
    if (rule.test(normalized)) return category;
  }
  return 'misc';
}

function buildTargetModulePath(filePath, family, kind) {
  const normalizedPath = normalizePath(filePath);
  const serverRootIndex = normalizedPath.lastIndexOf('/apps/server/');
  if (serverRootIndex >= 0) {
    const repoRoot = normalizedPath.slice(0, serverRootIndex);
    const serverRoot = `${repoRoot}/apps/server`;
    if (kind === 'route') return `${serverRoot}/src/routes/${family}.cjs`;
    return `${serverRoot}/src/services/${family}.cjs`;
  }

  const dirname = normalizePath(path.dirname(filePath));
  if (kind === 'route') return `${dirname}/katana/routes/${family}.cjs`;
  return `${dirname}/katana/services/${family}.cjs`;
}

function collectItems(lines) {
  const routes = [];
  const helpers = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    const routeMatch = rawLine.match(ROUTE_REGEX);
    if (routeMatch) {
      const [, owner, method, , routePath] = routeMatch;
      routes.push({
        owner,
        method: method.toLowerCase(),
        path: routePath,
        family: groupRouteFamily(routePath),
        line: lineNumber,
      });
    }

    for (const regex of FUNCTION_REGEXES) {
      const helperMatch = trimmed.match(regex);
      if (!helperMatch) continue;
      const name = helperMatch[2];
      helpers.push({
        name,
        category: groupHelperCategory(name),
        line: lineNumber,
      });
      break;
    }
  }

  return { routes, helpers };
}

function summarizeGroups(items, groupKey, kind, filePath, top) {
  const groups = new Map();

  for (const item of items) {
    const key = item[groupKey];
    if (!groups.has(key)) {
      groups.set(key, {
        name: key,
        kind,
        count: 0,
        firstLine: item.line,
        lastLine: item.line,
        items: [],
        targetModule: buildTargetModulePath(filePath, key, kind),
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.firstLine = Math.min(group.firstLine, item.line);
    group.lastLine = Math.max(group.lastLine, item.line);
    group.items.push(item);
  }

  return [...groups.values()]
    .sort((left, right) => {
      const spanDelta = (right.lastLine - right.firstLine) - (left.lastLine - left.firstLine);
      if (spanDelta !== 0) return spanDelta;
      return right.count - left.count;
    })
    .slice(0, top);
}

function buildClusters(items, groupKey, kind, filePath, maxGap) {
  const groups = new Map();

  for (const item of items) {
    const key = item[groupKey];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const clusters = [];
  for (const [key, entries] of groups.entries()) {
    const sorted = [...entries].sort((left, right) => left.line - right.line);
    let active = null;

    for (const entry of sorted) {
      if (!active || entry.line - active.lastLine > maxGap) {
        if (active) clusters.push(active);
        active = {
          name: key,
          kind,
          count: 0,
          firstLine: entry.line,
          lastLine: entry.line,
          items: [],
          targetModule: buildTargetModulePath(filePath, key, kind),
        };
      }

      active.count += 1;
      active.lastLine = entry.line;
      active.items.push(entry);
    }

    if (active) clusters.push(active);
  }

  return clusters.sort((left, right) => {
    const spanDelta = (right.lastLine - right.firstLine) - (left.lastLine - left.firstLine);
    if (spanDelta !== 0) return spanDelta;
    return right.count - left.count;
  });
}

function buildExtractionPlan(filePath, routeClusters, helperClusters) {
  const suggestions = [];

  for (const group of routeClusters) {
    if (group.count < 2) continue;
    suggestions.push({
      priority: 'high',
      kind: 'route',
      family: group.name,
      count: group.count,
      lineRange: [group.firstLine, group.lastLine],
      targetModule: group.targetModule,
      reason: `Move ${group.count} ${group.name} route declarations into a dedicated router.`,
    });
  }

  for (const group of helperClusters) {
    if (group.name === 'misc' && group.count < 12) continue;
    if (group.count < 3) continue;
    suggestions.push({
      priority: group.name === 'misc' ? 'low' : (group.count >= 8 ? 'high' : 'medium'),
      kind: 'service',
      family: group.name,
      count: group.count,
      lineRange: [group.firstLine, group.lastLine],
      targetModule: group.targetModule,
      reason: `Extract ${group.count} helper declarations for the ${group.name} domain.`,
    });
  }

  return suggestions
    .sort((left, right) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const delta = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
      if (delta !== 0) return delta;
      return (right.lineRange[1] - right.lineRange[0]) - (left.lineRange[1] - left.lineRange[0]);
    })
    .slice(0, 16)
    .map((entry, index) => ({
      ...entry,
      order: index + 1,
      sourceFile: filePath,
    }));
}

function analyzeFile(targetFile, { rootDir = process.cwd(), top = 10 } = {}) {
  const resolvedFile = path.resolve(targetFile);
  const raw = fs.readFileSync(resolvedFile, 'utf8');
  const lines = raw.split(/\r?\n/);
  const { routes, helpers } = collectItems(lines);
  const routeGroups = summarizeGroups(routes, 'family', 'route', resolvedFile, top);
  const helperGroups = summarizeGroups(helpers, 'category', 'service', resolvedFile, top);
  const routeClusters = buildClusters(routes, 'family', 'route', resolvedFile, 120);
  const helperClusters = buildClusters(helpers, 'category', 'service', resolvedFile, 160);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    file: {
      absolutePath: resolvedFile,
      relativePath: makeRelative(rootDir, resolvedFile),
      lineCount: lines.length,
      byteSize: Buffer.byteLength(raw, 'utf8'),
    },
    totals: {
      routes: routes.length,
      helpers: helpers.length,
      routeFamilies: routeGroups.length,
      helperCategories: helperGroups.length,
      routeClusters: routeClusters.length,
      helperClusters: helperClusters.length,
    },
    routeGroups,
    helperGroups,
    routeClusters: routeClusters.slice(0, top * 3),
    helperClusters: helperClusters.slice(0, top * 3),
    extractionPlan: buildExtractionPlan(
      resolvedFile,
      routeClusters.slice(0, top * 4),
      helperClusters.slice(0, top * 4)
    ),
  };
}

module.exports = {
  analyzeFile,
  groupRouteFamily,
  groupHelperCategory,
};
