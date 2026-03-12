import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog, summarizeOutput } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerBuildTool(server: McpServer) {
  server.registerTool("xpresso_build", {
    title: "Build Xcode Project",
    description:
      "Compile an Xcode project or workspace (build only — does NOT install or launch the app). Use xpresso_run instead if you want to run the app.",
    inputSchema: z.object({
      project: z
        .optional(z.string())
        .describe("Path to .xcodeproj file"),
      workspace: z
        .optional(z.string())
        .describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Build scheme name"),
      configuration: z
        .optional(z.string())
        .describe("Build configuration (Debug/Release)"),
      destination: z
        .optional(z.string())
        .describe(
          'Build destination (e.g. "platform=iOS Simulator,name=iPhone 16")',
        ),
      sdk: z
        .optional(z.string())
        .describe("SDK to use (e.g. iphonesimulator, macosx)"),
      derivedDataPath: z
        .optional(z.string())
        .describe("Custom derived data path"),
      extraArgs: z
        .optional(z.array(z.string()))
        .describe("Additional xcodebuild arguments"),
    }),
  }, async (args) => {
    const xcodebuildArgs = [
      "xcodebuild",
      ...buildXcodebuildArgs(args),
      "build",
    ];

    const result = await exec(xcodebuildArgs, { timeout: 600_000 });
    const fullOutput = result.stdout + (result.stderr ? `\n\nSTDERR:\n${result.stderr}` : "");
    storeLog("build", fullOutput);
    const summary = summarizeOutput(result.stdout, result.stderr, result.success);

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `Build succeeded.\n\n${summary}`
            : `Build failed (exit code ${result.exitCode}).\n\n${summary}`,
        },
      ],
      isError: !result.success,
    };
  });
}
