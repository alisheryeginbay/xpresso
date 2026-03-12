import { execFile, type ExecFileException } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

const MAX_OUTPUT = 100_000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return (
    text.slice(0, MAX_OUTPUT) +
    `\n\n--- truncated (${text.length - MAX_OUTPUT} chars omitted) ---`
  );
}

export async function exec(
  command: string[],
  options?: { cwd?: string; timeout?: number },
): Promise<ExecResult> {
  const [cmd, ...args] = command as [string, ...string[]];
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd: options?.cwd,
        timeout: options?.timeout,
        maxBuffer: 1024 * 1024 * 50,
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const exitCode = error?.code
          ? typeof error.code === "number"
            ? error.code
            : 1
          : 0;
        resolve({
          stdout: truncate(stdout || ""),
          stderr: truncate(stderr || ""),
          exitCode,
          success: exitCode === 0,
        });
      },
    );
  });
}

/** Summarize xcodebuild output to only actionable info */
export function summarizeOutput(stdout: string, stderr: string, success: boolean): string {
  const lines = stdout.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];
  const testLines: string[] = [];
  const summaryLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/:\s*error:/i.test(line) || /^error:/i.test(trimmed)) {
      errors.push(trimmed);
    } else if (/:\s*warning:/i.test(line)) {
      warnings.push(trimmed);
    } else if (/^\*\*\s/.test(trimmed)) {
      summaryLines.push(trimmed);
    } else if (/^(Test Case|Test Suite|Executed \d)/.test(trimmed)) {
      testLines.push(trimmed);
    }
  }

  // On failure with no extracted errors, include stderr or last 30 lines of stdout
  if (!success && errors.length === 0) {
    if (stderr.trim()) {
      errors.push(stderr.trim());
    } else {
      const tail = lines.slice(-30).join("\n").trim();
      if (tail) errors.push(tail);
    }
  }

  const parts: string[] = [];
  if (errors.length) parts.push(`Errors (${errors.length}):\n${errors.join("\n")}`);
  if (warnings.length) parts.push(`Warnings (${warnings.length}):\n${warnings.join("\n")}`);
  if (testLines.length) parts.push(testLines.join("\n"));
  if (summaryLines.length) parts.push(summaryLines.join("\n"));

  if (!parts.length) return "No issues.";

  parts.push("(Full log available via xpresso_logs)");
  return parts.join("\n\n");
}

/** Store for recent operation logs */
const logStore = new Map<string, string>();

export function storeLog(key: string, content: string): void {
  logStore.set(key, content);
  // Keep only last 10 entries
  if (logStore.size > 10) {
    const oldest = logStore.keys().next().value!;
    logStore.delete(oldest);
  }
}

export function getLog(key?: string): string | undefined {
  if (key) return logStore.get(key);
  // Return most recent
  let last: string | undefined;
  for (const v of logStore.values()) last = v;
  return last;
}

export function getAllLogKeys(): string[] {
  return [...logStore.keys()];
}
