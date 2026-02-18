# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Build & Run

```bash
bun install                      # install dependencies
bun run build                    # bundle to dist/index.js (node-compatible)
bun run dev                      # watch mode for development
node dist/index.js               # run production build
bun run src/index.ts             # run directly with bun
```

Typecheck: `bunx tsc --noEmit`

Test manually by piping JSON-RPC to stdin:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js
```

## Architecture

MCP server using stdio transport. Wraps `xcodebuild` and `xcrun simctl`/`devicectl` CLI tools.

**Entry point**: `src/index.ts` — creates `McpServer`, registers all tools, connects `StdioServerTransport`.

**Tool modules** (`src/tools/`): Each file exports a `register*Tool(server: McpServer)` function. Tools use `server.registerTool(name, { inputSchema: z.object(...) }, handler)` from SDK v1.26.0 with Zod v4.

**Utils**:
- `exec.ts` — wraps `node:child_process.execFile()`, returns `{ stdout, stderr, exitCode, success }`. Truncates output at 100K chars. Also manages an in-memory log store (last 10 operations).
- `xcode.ts` — `buildXcodebuildArgs()` constructs CLI flags from typed options (workspace > project priority).

**Build**: `bun build` bundles all source + dependencies into a single `dist/index.js` targeting Node.js ESM. The `bin` field points there so `npx xpresso-mcp` works without Bun.

## Conventions

- Tool names are prefixed `xpresso_`
- All tool parameters use `z.optional()` with `.describe()` for MCP schema generation
- Handlers return `{ content: [{ type: "text", text }], isError?: boolean }`
- Timeouts scale with operation: 30s for queries, 2min for clean, 10min for build, 15min for test
- Simulator tools treat "already booted"/"already shut down" as success, not error
- `storeLog(key, output)` after build/test/run/clean so `xpresso_logs` can retrieve them
- Version must be updated in both `package.json` and `src/index.ts`
