import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec, storeLog } from "../utils/exec.ts";

export function registerSimulatorTools(server: McpServer) {
  // List simulators
  server.registerTool("xpresso_simulators", {
    title: "List Simulators",
    description:
      "List all available iOS/watchOS/tvOS simulators with their state and UDID.",
    inputSchema: z.object({
      available: z
        .optional(z.boolean())
        .describe("Only show available simulators (default: true)"),
    }),
  }, async (args) => {
    const cmdArgs = ["xcrun", "simctl", "list", "devices", "--json"];

    const result = await exec(cmdArgs);
    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to list simulators.\n\n${result.stderr}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const data = JSON.parse(result.stdout);
      const devices: Record<string, unknown[]> = data.devices || {};
      const lines: string[] = [];

      for (const [runtime, deviceList] of Object.entries(devices)) {
        const filtered =
          args.available !== false
            ? (deviceList as Array<{ isAvailable?: boolean }>).filter(
                (d) => d.isAvailable,
              )
            : deviceList;
        if (filtered.length === 0) continue;

        const runtimeName = runtime.replace(
          /com\.apple\.CoreSimulator\.SimRuntime\./,
          "",
        ).replace(/-/g, " ");
        lines.push(`\n${runtimeName}:`);
        for (const device of filtered as Array<{
          name: string;
          udid: string;
          state: string;
        }>) {
          lines.push(`  ${device.name} (${device.udid}) - ${device.state}`);
        }
      }

      const output = lines.join("\n") || "No simulators found.";
      return {
        content: [{ type: "text" as const, text: output }],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: `Simulators (raw):\n${result.stdout}`,
          },
        ],
      };
    }
  });

  // Boot simulator
  server.registerTool("xpresso_boot_simulator", {
    title: "Boot Simulator",
    description: "Boot a simulator by name or UDID.",
    inputSchema: z.object({
      simulator: z.string().describe("Simulator name or UDID"),
    }),
  }, async (args) => {
    const result = await exec(["xcrun", "simctl", "boot", args.simulator]);

    if (result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Simulator "${args.simulator}" booted successfully.`,
          },
        ],
      };
    }

    // Already booted is not an error
    if (result.stderr.includes("current state: Booted")) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Simulator "${args.simulator}" is already booted.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to boot simulator "${args.simulator}".\n\n${result.stderr}`,
        },
      ],
      isError: true,
    };
  });

  // Shutdown simulator
  server.registerTool("xpresso_shutdown_simulator", {
    title: "Shutdown Simulator",
    description:
      'Shutdown a running simulator by name or UDID. Pass "all" to shutdown all simulators.',
    inputSchema: z.object({
      simulator: z
        .string()
        .describe('Simulator name, UDID, or "all" to shutdown everything'),
    }),
  }, async (args) => {
    const result = await exec([
      "xcrun",
      "simctl",
      "shutdown",
      args.simulator,
    ]);

    if (result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Simulator "${args.simulator}" shut down.`,
          },
        ],
      };
    }

    if (result.stderr.includes("current state: Shutdown")) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Simulator "${args.simulator}" is already shut down.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to shutdown simulator "${args.simulator}".\n\n${result.stderr}`,
        },
      ],
      isError: true,
    };
  });
}
