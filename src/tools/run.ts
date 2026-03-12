import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";
import { buildXcodebuildArgs } from "../utils/xcode.ts";

export function registerRunTool(server: McpServer) {
  server.registerTool("xpresso_run", {
    title: "Build & Run App",
    description:
      "Build and run an app. For iOS: builds for simulator or physical device, installs, and launches. For macOS: builds and opens the .app directly.",
    inputSchema: z.object({
      project: z.optional(z.string()).describe("Path to .xcodeproj file"),
      workspace: z.optional(z.string()).describe("Path to .xcworkspace file"),
      scheme: z.string().describe("Build scheme name"),
      platform: z
        .optional(z.enum(["ios", "macos"]))
        .describe('Target platform: "ios" (default) or "macos"'),
      simulator: z
        .optional(z.string())
        .describe(
          "Simulator UDID or name to install and launch on (for iOS simulator)",
        ),
      device: z
        .optional(z.string())
        .describe(
          "Physical device UDID to install and launch on (use xpresso_devices to find UDIDs)",
        ),
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
    const platform = args.platform ?? "ios";

    if (platform === "macos") {
      return runMacOS(args);
    }

    if (args.simulator && args.device) {
      return {
        content: [
          {
            type: "text" as const,
            text: 'Provide either "simulator" or "device", not both.',
          },
        ],
        isError: true,
      };
    }

    if (!args.simulator && !args.device) {
      return {
        content: [
          {
            type: "text" as const,
            text: 'Either "simulator" or "device" parameter is required when platform is "ios".',
          },
        ],
        isError: true,
      };
    }

    if (args.device) {
      return runIOSDevice(args as typeof args & { device: string });
    }
    return runIOS(args as typeof args & { simulator: string });
  });
}

async function runIOS(args: {
  project?: string;
  workspace?: string;
  scheme: string;
  simulator: string;
  configuration?: string;
  bundleId?: string;
}) {
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
      /^\s+PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)/m,
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

  // Step 5: Terminate previous instance (if running), then launch
  const terminateResult = await exec([
    "xcrun",
    "simctl",
    "terminate",
    args.simulator,
    bundleId,
  ]);
  if (terminateResult.success) {
    steps.push(`TERMINATE: Killed previous instance of ${bundleId}`);
  }

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
}

async function runIOSDevice(args: {
  project?: string;
  workspace?: string;
  scheme: string;
  device: string;
  configuration?: string;
  bundleId?: string;
}) {
  const steps: string[] = [];

  // Step 1: Build for physical device
  const destination = `platform=iOS,id=${args.device}`;
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
  const settings = await exec(settingsArgs, { timeout: 30_000 });

  if (!bundleId) {
    const match = settings.stdout.match(
      /^\s+PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)/m,
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

  // Step 4: Install on physical device
  if (appPath) {
    const installResult = await exec(
      [
        "xcrun",
        "devicectl",
        "device",
        "install",
        "app",
        "--device",
        args.device,
        appPath,
      ],
      { timeout: 120_000 },
    );
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

  // Step 5: Launch (devicectl terminate requires --pid which we don't have,
  // so we use --terminate-existing on launch to kill any previous instance)
  const launchResult = await exec([
    "xcrun",
    "devicectl",
    "device",
    "process",
    "launch",
    "--terminate-existing",
    "--device",
    args.device,
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
          ? `App launched successfully (${bundleId} on device ${args.device}).\n\n${output}`
          : `Launch failed.\n\n${output}\n\nSTDERR:\n${launchResult.stderr}`,
      },
    ],
    isError: !launchResult.success,
  };
}

async function runMacOS(args: {
  project?: string;
  workspace?: string;
  scheme: string;
  configuration?: string;
  bundleId?: string;
}) {
  const steps: string[] = [];

  // Step 1: Build for macOS
  const destination = "platform=macOS";
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

  // Step 2: Get app path from build settings
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
  const settings = await exec(settingsArgs, { timeout: 30_000 });
  const builtProductsMatch = settings.stdout.match(
    /BUILT_PRODUCTS_DIR\s*=\s*(.+)/,
  );
  const targetNameMatch = settings.stdout.match(
    /TARGET_NAME\s*=\s*(.+)/,
  );

  if (!builtProductsMatch?.[1] || !targetNameMatch?.[1]) {
    const output = steps.join("\n\n");
    storeLog("run", output);
    return {
      content: [
        {
          type: "text" as const,
          text: `Build succeeded but could not determine app path from build settings.\n\n${output}`,
        },
      ],
      isError: true,
    };
  }

  const appPath = `${builtProductsMatch[1].trim()}/${targetNameMatch[1].trim()}.app`;

  // Step 3: Terminate previous instance (if running), then launch
  const appName = targetNameMatch[1].trim();
  const terminateResult = await exec(["pkill", "-x", appName]);
  if (terminateResult.success) {
    steps.push(`TERMINATE: Killed previous instance of ${appName}`);
    // Brief pause to let the process fully exit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const launchResult = await exec(["open", appPath]);
  steps.push(`LAUNCH:\n${launchResult.stdout}`);

  const output = steps.join("\n\n");
  storeLog("run", output);

  return {
    content: [
      {
        type: "text" as const,
        text: launchResult.success
          ? `App launched successfully (${appPath}).\n\n${output}`
          : `Launch failed.\n\n${output}\n\nSTDERR:\n${launchResult.stderr}`,
      },
    ],
    isError: !launchResult.success,
  };
}
