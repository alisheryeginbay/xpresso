#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBuildTool } from "./tools/build.ts";
import { registerTestTool } from "./tools/test.ts";
import { registerRunTool } from "./tools/run.ts";
import { registerSimulatorTools } from "./tools/simulator.ts";
import { registerProjectTools } from "./tools/project.ts";
import { registerCleanTool } from "./tools/clean.ts";
import { registerLogsTool } from "./tools/logs.ts";

const server = new McpServer({
  name: "xpresso",
  version: "0.1.0",
});

// Register all tools
registerBuildTool(server);
registerTestTool(server);
registerRunTool(server);
registerSimulatorTools(server);
registerProjectTools(server);
registerCleanTool(server);
registerLogsTool(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
