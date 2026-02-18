import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerBuildTool(server: McpServer) {
  server.registerTool("xpresso_build", {
    title: "Build Xcode Project",
    description:
      "Build an Xcode project or workspace with the specified scheme. Returns build output including warnings and errors.",
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
    const output = result.stdout + (result.stderr ? `\n\nSTDERR:\n${result.stderr}` : "");
    storeLog("build", output);

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `Build succeeded.\n\n${output}`
            : `Build failed (exit code ${result.exitCode}).\n\n${output}`,
        },
      ],
      isError: !result.success,
    };
  });
}
