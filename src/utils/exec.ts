import { execFile } from "node:child_process";

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
  const [cmd, ...args] = command;
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd: options?.cwd,
        timeout: options?.timeout,
        maxBuffer: 1024 * 1024 * 50,
      },
      (error, stdout, stderr) => {
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
