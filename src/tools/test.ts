import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerTestTool(server: McpServer) {
  server.registerTool("xpresso_test", {
    title: "Run Xcode Tests",
    description:
      "Run unit or UI tests for an Xcode project/workspace. Returns test results including pass/fail counts.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Test scheme name"),
      destination: z
        .optional(z.string())
        .describe('Test destination (e.g. "platform=iOS Simulator,name=iPhone 16")'),
      configuration: z
        .optional(z.string())
        .describe("Build configuration (Debug/Release)"),
      testPlan: z.optional(z.string()).describe("Test plan name"),
      onlyTesting: z
        .optional(z.array(z.string()))
        .describe("Run only these test targets/classes/methods"),
      skipTesting: z
        .optional(z.array(z.string()))
        .describe("Skip these test targets/classes/methods"),
      extraArgs: z
        .optional(z.array(z.string()))
        .describe("Additional xcodebuild arguments"),
    }),
  }, async (args) => {
    const xcodebuildArgs = [
      "xcodebuild",
      ...buildXcodebuildArgs({
        project: args.project,
        workspace: args.workspace,
        scheme: args.scheme,
        destination: args.destination,
        configuration: args.configuration,
      }),
      "test",
    ];

    if (args.testPlan) xcodebuildArgs.push("-testPlan", args.testPlan);
    if (args.onlyTesting) {
      for (const t of args.onlyTesting) {
        xcodebuildArgs.push("-only-testing:" + t);
      }
    }
    if (args.skipTesting) {
      for (const t of args.skipTesting) {
        xcodebuildArgs.push("-skip-testing:" + t);
      }
    }
    if (args.extraArgs) xcodebuildArgs.push(...args.extraArgs);

    const result = await exec(xcodebuildArgs, { timeout: 900_000 });
    const output = result.stdout + (result.stderr ? `\n\nSTDERR:\n${result.stderr}` : "");
    storeLog("test", output);

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `Tests passed.\n\n${output}`
            : `Tests failed (exit code ${result.exitCode}).\n\n${output}`,
        },
      ],
      isError: !result.success,
    };
  });
}
