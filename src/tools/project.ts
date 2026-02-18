import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerProjectTools(server: McpServer) {
  // List schemes
  server.registerTool("xpresso_schemes", {
    title: "List Schemes",
    description:
      "List all available schemes, targets, and build configurations for an Xcode project or workspace.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
    }),
  }, async (args) => {
    const cmdArgs = ["xcodebuild", "-list"];
    if (args.workspace) cmdArgs.push("-workspace", args.workspace);
    else if (args.project) cmdArgs.push("-project", args.project);

    const result = await exec(cmdArgs, { timeout: 30_000 });

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to list schemes.\n\n${result.stderr}\n${result.stdout}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        { type: "text" as const, text: result.stdout.trim() },
      ],
    };
  });

  // Show build settings
  server.registerTool("xpresso_build_settings", {
    title: "Show Build Settings",
    description:
      "Show resolved build settings for a scheme. Useful for finding bundle IDs, SDK paths, derived data paths, etc.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Scheme name"),
      configuration: z
        .optional(z.string())
        .describe("Build configuration (Debug/Release)"),
      filter: z
        .optional(z.string())
        .describe(
          "Filter settings by keyword (case-insensitive substring match)",
        ),
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
      "-showBuildSettings",
    ];

    const result = await exec(cmdArgs, { timeout: 30_000 });

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to get build settings.\n\n${result.stderr}`,
          },
        ],
        isError: true,
      };
    }

    let output = result.stdout.trim();
    if (args.filter) {
      const filterLower = args.filter.toLowerCase();
      output = output
        .split("\n")
        .filter((line) => line.toLowerCase().includes(filterLower))
        .join("\n");
      if (!output) output = `No settings matching "${args.filter}" found.`;
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  });

  // List physical devices
  server.registerTool("xpresso_devices", {
    title: "List Connected Devices",
    description:
      "List connected physical Apple devices (iPhones, iPads, etc.) using devicectl.",
    inputSchema: z.object({}),
  }, async () => {
    const result = await exec(
      ["xcrun", "devicectl", "list", "devices"],
      { timeout: 15_000 },
    );

    if (!result.success) {
      // devicectl might not be available on older Xcode
      const fallback = await exec(
        ["xcrun", "xctrace", "list", "devices"],
        { timeout: 15_000 },
      );
      if (fallback.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: fallback.stdout.trim() || "No devices found.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to list devices.\n\n${result.stderr}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: result.stdout.trim() || "No connected devices found.",
        },
      ],
    };
  });
}
