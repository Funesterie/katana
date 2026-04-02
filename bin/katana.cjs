#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { analyzeFile } = require('../lib/analyze.cjs');
const {
  formatTextReport,
  formatMarkdownReport,
} = require('../lib/format.cjs');

function printUsage() {
  console.log(`katana

Usage:
  katana scan <file> [--stdout text|md|json] [--json <file>] [--md <file>] [--top <n>] [--root <dir>]

Examples:
  katana scan apps/server/server.cjs
  katana scan apps/server/server.cjs --stdout md
  katana scan apps/server/server.cjs --json katana-report.json --md katana-report.md
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {
    command,
    stdout: 'text',
    top: 10,
    targetFile: '',
    rootDir: process.cwd(),
    jsonFile: '',
    markdownFile: '',
  };

  if (command !== 'scan') return options;
  options.targetFile = args.shift() || '';

  while (args.length > 0) {
    const current = args.shift();
    if (current === '--stdout') options.stdout = String(args.shift() || 'text').trim().toLowerCase();
    else if (current === '--json') options.jsonFile = String(args.shift() || '').trim();
    else if (current === '--md') options.markdownFile = String(args.shift() || '').trim();
    else if (current === '--top') options.top = Math.max(1, Number(args.shift() || 10) || 10);
    else if (current === '--root') options.rootDir = String(args.shift() || process.cwd()).trim() || process.cwd();
    else throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

function ensureParentDir(targetPath) {
  const parent = path.dirname(targetPath);
  fs.mkdirSync(parent, { recursive: true });
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[katana] ${error.message}`);
    printUsage();
    process.exit(1);
  }

  if (options.command !== 'scan' || !options.targetFile) {
    printUsage();
    process.exit(options.command ? 1 : 0);
  }

  const report = analyzeFile(options.targetFile, {
    rootDir: options.rootDir,
    top: options.top,
  });

  if (options.jsonFile) {
    ensureParentDir(options.jsonFile);
    fs.writeFileSync(options.jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (options.markdownFile) {
    ensureParentDir(options.markdownFile);
    fs.writeFileSync(options.markdownFile, `${formatMarkdownReport(report)}\n`, 'utf8');
  }

  if (options.stdout === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (options.stdout === 'md' || options.stdout === 'markdown') {
    console.log(formatMarkdownReport(report));
    return;
  }

  console.log(formatTextReport(report));
}

try {
  main();
} catch (error) {
  console.error(`[katana] ${error.message}`);
  process.exit(1);
}
