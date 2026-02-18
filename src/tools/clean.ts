import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerCleanTool(server: McpServer) {
  server.registerTool("xpresso_clean", {
    title: "Clean Build Folder",
    description:
      "Clean the build folder for a project/workspace scheme. Removes derived data and build artifacts.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Scheme name to clean"),
      configuration: z
        .optional(z.string())
        .describe("Build configuration (Debug/Release)"),
    }),
  }, async (args) => {
    const cmdArgs = [
      "xcodebuild",
      ...buildXcodebuildArgs({
        project: args.project,
        workspace: args.workspace,
        scheme: args.scheme,
        configuration: args.configuration,
      }),
      "clean",
    ];

    const result = await exec(cmdArgs, { timeout: 120_000 });
    const output = result.stdout + (result.stderr ? `\n\nSTDERR:\n${result.stderr}` : "");
    storeLog("clean", output);

    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `Clean succeeded.\n\n${output}`
            : `Clean failed (exit code ${result.exitCode}).\n\n${output}`,
        },
      ],
      isError: !result.success,
    };
  });
}
