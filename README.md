# xpresso

Xcode MCP server. Build, test, run, and manage simulators directly from Claude Code — no Xcode GUI needed.

## Setup

```bash
bun install
```

### Add to Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "xpresso": {
      "command": "bun",
      "args": ["run", "/Users/YOUR_USER/Developer/xpresso/src/index.ts"]
    }
  }
}
```

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
