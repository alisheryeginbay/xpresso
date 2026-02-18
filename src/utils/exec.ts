import { $ } from "bun";

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
  try {
    const proc = Bun.spawn(command, {
      cwd: options?.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    let timer: Timer | undefined;
    if (options?.timeout) {
      timer = setTimeout(() => proc.kill(), options.timeout);
    }

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    if (timer) clearTimeout(timer);

    return {
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode,
      success: exitCode === 0,
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      success: false,
    };
  }
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
