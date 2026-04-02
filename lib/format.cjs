function formatLineRange(firstLine, lastLine) {
  if (!firstLine && !lastLine) return '-';
  if (firstLine === lastLine) return `L${firstLine}`;
  return `L${firstLine}-L${lastLine}`;
}

function formatTextReport(report) {
  const lines = [];
  lines.push(`Katana report for ${report.file.relativePath}`);
  lines.push(`- ${report.file.lineCount} lines`);
  lines.push(`- ${report.totals.routes} route declarations`);
  lines.push(`- ${report.totals.helpers} helper declarations`);
  lines.push(`- ${report.totals.routeClusters} route clusters`);
  lines.push(`- ${report.totals.helperClusters} helper clusters`);
  lines.push('');
  lines.push('Top route families');
  for (const group of report.routeGroups) {
    lines.push(`- ${group.name}: ${group.count} routes, ${formatLineRange(group.firstLine, group.lastLine)} -> ${group.targetModule}`);
  }
  lines.push('');
  lines.push('Top helper families');
  for (const group of report.helperGroups) {
    lines.push(`- ${group.name}: ${group.count} helpers, ${formatLineRange(group.firstLine, group.lastLine)} -> ${group.targetModule}`);
  }
  lines.push('');
  lines.push('Recommended cuts');
  for (const cut of report.extractionPlan) {
    lines.push(`${cut.order}. [${cut.priority}] ${cut.kind} ${cut.family} ${formatLineRange(cut.lineRange[0], cut.lineRange[1])} -> ${cut.targetModule}`);
    lines.push(`   ${cut.reason}`);
  }
  return lines.join('\n');
}

function formatMarkdownReport(report) {
  const lines = [];
  lines.push(`# Katana Report`);
  lines.push('');
  lines.push(`- File: \`${report.file.relativePath}\``);
  lines.push(`- Lines: \`${report.file.lineCount}\``);
  lines.push(`- Route declarations: \`${report.totals.routes}\``);
  lines.push(`- Helper declarations: \`${report.totals.helpers}\``);
  lines.push(`- Route clusters: \`${report.totals.routeClusters}\``);
  lines.push(`- Helper clusters: \`${report.totals.helperClusters}\``);
  lines.push('');
  lines.push(`## Route Families`);
  lines.push('');
  lines.push(`| Family | Count | Lines | Target |`);
  lines.push(`| --- | ---: | --- | --- |`);
  for (const group of report.routeGroups) {
    lines.push(`| ${group.name} | ${group.count} | ${formatLineRange(group.firstLine, group.lastLine)} | \`${group.targetModule}\` |`);
  }
  lines.push('');
  lines.push(`## Helper Families`);
  lines.push('');
  lines.push(`| Family | Count | Lines | Target |`);
  lines.push(`| --- | ---: | --- | --- |`);
  for (const group of report.helperGroups) {
    lines.push(`| ${group.name} | ${group.count} | ${formatLineRange(group.firstLine, group.lastLine)} | \`${group.targetModule}\` |`);
  }
  lines.push('');
  lines.push(`## Extraction Plan`);
  lines.push('');
  for (const cut of report.extractionPlan) {
    lines.push(`### ${cut.order}. ${cut.kind} \`${cut.family}\``);
    lines.push('');
    lines.push(`- Priority: \`${cut.priority}\``);
    lines.push(`- Lines: \`${formatLineRange(cut.lineRange[0], cut.lineRange[1])}\``);
    lines.push(`- Target: \`${cut.targetModule}\``);
    lines.push(`- Reason: ${cut.reason}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  formatTextReport,
  formatMarkdownReport,
};
