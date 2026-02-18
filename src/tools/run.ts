import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerRunTool(server: McpServer) {
  server.registerTool("xpresso_run", {
    title: "Build & Run on Simulator",
    description:
      "Build the project, install it on a simulator, and launch it. The simulator must be booted first.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Build scheme name"),
      simulator: z
        .string()
        .describe("Simulator UDID or name to install and launch on"),
      configuration: z
        .optional(z.string())
        .describe("Build configuration (Debug/Release)"),
      bundleId: z
        .optional(z.string())
        .describe(
          "App bundle identifier. If not provided, extracted from build settings.",
        ),
    }),
  }, async (args) => {
    const steps: string[] = [];

    // Step 1: Build for simulator
    const destination = `platform=iOS Simulator,id=${args.simulator}`;
    const buildArgs = [
      "xcodebuild",
      ...buildXcodebuildArgs({
        project: args.project,
        workspace: args.workspace,
        scheme: args.scheme,
        destination,
        configuration: args.configuration,
      }),
      "build",
    ];

    const buildResult = await exec(buildArgs, { timeout: 600_000 });
    steps.push(`BUILD:\n${buildResult.stdout}`);
    if (!buildResult.success) {
      const output = steps.join("\n\n");
      storeLog("run", output);
      return {
        content: [
          {
            type: "text" as const,
            text: `Build failed (exit code ${buildResult.exitCode}).\n\n${output}\n\nSTDERR:\n${buildResult.stderr}`,
          },
        ],
        isError: true,
      };
    }

    // Step 2: Get bundle ID from build settings if not provided
    let bundleId = args.bundleId;
    if (!bundleId) {
      const settingsArgs = [
        "xcodebuild",
        ...buildXcodebuildArgs({
          project: args.project,
          workspace: args.workspace,
          scheme: args.scheme,
          destination,
        }),
        "-showBuildSettings",
      ];
      const settingsResult = await exec(settingsArgs, { timeout: 30_000 });
      const match = settingsResult.stdout.match(
        /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)/,
      );
      bundleId = match?.[1]?.trim();
      if (!bundleId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Build succeeded but could not determine bundle identifier. Provide bundleId parameter.",
            },
          ],
          isError: true,
        };
      }
    }

    // Step 3: Find the .app in derived data
    const settingsArgs2 = [
      "xcodebuild",
      ...buildXcodebuildArgs({
        project: args.project,
        workspace: args.workspace,
        scheme: args.scheme,
        destination,
      }),
      "-showBuildSettings",
    ];
    const settings = await exec(settingsArgs2, { timeout: 30_000 });
    const builtProductsMatch = settings.stdout.match(
      /BUILT_PRODUCTS_DIR\s*=\s*(.+)/,
    );
    const targetNameMatch = settings.stdout.match(
      /TARGET_NAME\s*=\s*(.+)/,
    );
    const appPath =
      builtProductsMatch?.[1] && targetNameMatch?.[1]
        ? `${builtProductsMatch[1].trim()}/${targetNameMatch[1].trim()}.app`
        : undefined;

    // Step 4: Install on simulator
    if (appPath) {
      const installResult = await exec([
        "xcrun",
        "simctl",
        "install",
        args.simulator,
        appPath,
      ]);
      steps.push(`INSTALL:\n${installResult.stdout}`);
      if (!installResult.success) {
        const output = steps.join("\n\n");
        storeLog("run", output);
        return {
          content: [
            {
              type: "text" as const,
              text: `Install failed.\n\n${output}\n\nSTDERR:\n${installResult.stderr}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Step 5: Launch
    const launchResult = await exec([
      "xcrun",
      "simctl",
      "launch",
      args.simulator,
      bundleId,
    ]);
    steps.push(`LAUNCH:\n${launchResult.stdout}`);

    const output = steps.join("\n\n");
    storeLog("run", output);

    return {
      content: [
        {
          type: "text" as const,
          text: launchResult.success
            ? `App launched successfully (${bundleId} on ${args.simulator}).\n\n${output}`
            : `Launch failed.\n\n${output}\n\nSTDERR:\n${launchResult.stderr}`,
        },
      ],
      isError: !launchResult.success,
    };
  });
}
