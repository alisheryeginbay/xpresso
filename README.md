# xpresso

Xcode MCP server. Build, test, run, and manage simulators directly from Claude Code — no Xcode GUI needed.

## Requirements

- [Bun](https://bun.sh) runtime
- Xcode with command line tools installed (`xcode-select --install`)

## Install

```bash
git clone https://github.com/alisheryeginbay/xpresso.git
cd xpresso
bun install
```

## Add to Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "xpresso": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/xpresso/src/index.ts"]
    }
  }
}
```

Replace `/absolute/path/to/xpresso` with wherever you cloned it. Then restart Claude Code.

## Verify

After restarting, ask Claude Code to list your simulators or schemes. It will use the `xpresso_*` tools automatically.

## Tools

| Tool | Description |
|------|-------------|
| `xpresso_build` | Build project/workspace with scheme |
| `xpresso_test` | Run unit/UI tests |
| `xpresso_run` | Build, install, and launch on simulator |
| `xpresso_clean` | Clean build folder |
| `xpresso_schemes` | List schemes, targets, configurations |
| `xpresso_build_settings` | Show resolved build settings |
| `xpresso_simulators` | List available simulators |
| `xpresso_boot_simulator` | Boot a simulator |
| `xpresso_shutdown_simulator` | Shutdown a simulator |
| `xpresso_devices` | List connected physical devices |
| `xpresso_logs` | Get output from last operation |

## Examples

Build a project:
```
xpresso_build(scheme: "MyApp", workspace: "MyApp.xcworkspace")
```

Run tests:
```
xpresso_test(scheme: "MyApp", workspace: "MyApp.xcworkspace", destination: "platform=iOS Simulator,name=iPhone 16")
```

Boot simulator and run:
```
xpresso_boot_simulator(simulator: "iPhone 16")
xpresso_run(scheme: "MyApp", workspace: "MyApp.xcworkspace", simulator: "<UDID>")
```

## License

MIT
