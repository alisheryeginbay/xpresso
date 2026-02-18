import { exec } from "./exec.ts";

let cachedXcodePath: string | undefined;

export async function getXcodebuildPath(): Promise<string> {
  return "xcodebuild";
}

export async function getSimctlPath(): Promise<string[]> {
  return ["xcrun", "simctl"];
}

export async function getDevicectlPath(): Promise<string[]> {
  return ["xcrun", "devicectl"];
}

export async function getXcodeVersion(): Promise<string> {
  const result = await exec(["xcodebuild", "-version"]);
  return result.success ? result.stdout.trim() : "unknown";
}

export function buildXcodebuildArgs(options: {
  project?: string;
  workspace?: string;
  scheme?: string;
  destination?: string;
  configuration?: string;
  sdk?: string;
  derivedDataPath?: string;
  extraArgs?: string[];
}): string[] {
  const args: string[] = [];

  if (options.workspace) {
    args.push("-workspace", options.workspace);
  } else if (options.project) {
    args.push("-project", options.project);
  }

  if (options.scheme) args.push("-scheme", options.scheme);
  if (options.destination) args.push("-destination", options.destination);
  if (options.configuration) args.push("-configuration", options.configuration);
  if (options.sdk) args.push("-sdk", options.sdk);
  if (options.derivedDataPath)
    args.push("-derivedDataPath", options.derivedDataPath);
  if (options.extraArgs) args.push(...options.extraArgs);

  return args;
}
