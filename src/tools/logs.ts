import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLog, getAllLogKeys } from "../utils/exec.ts";

export function registerLogsTool(server: McpServer) {
  server.registerTool("xpresso_logs", {
    title: "Get Operation Logs",
    description:
      "Retrieve the output from the most recent xpresso operation (build, test, run, clean). Useful for reviewing full output after a build or test run.",
    inputSchema: z.object({
      operation: z
        .optional(z.string())
        .describe(
          "Operation name (build, test, run, clean). If omitted, returns the most recent log.",
        ),
    }),
  }, async (args) => {
    const keys = getAllLogKeys();
    if (keys.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No operation logs stored yet. Run a build, test, or other command first.",
          },
        ],
      };
    }

    const log = getLog(args.operation);
    if (!log) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No log found for "${args.operation}". Available logs: ${keys.join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Log for "${args.operation || "most recent"}":\n\n${log}`,
        },
      ],
    };
  });
}
