import type { Violation } from "./models.js";

export function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) return "";

  const lines: string[] = [];

  for (const v of violations) {
    const location = `${v.path}:${v.line}:${v.col}`;
    lines.push(`${location}  ${v.ruleId}  ${v.message}`);
  }

  const fileCount = new Set(violations.map((v) => v.path)).size;
  lines.push("");
  lines.push(
    `Found ${violations.length} violation${violations.length === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}.`,
  );

  return lines.join("\n");
}
