# rivt

Your architecture, enforced.

Code that compiles, passes type checking, and lints clean can still be architecturally wrong — React imported in services, `process.env` scattered across a dozen files, API calls in components instead of the service layer. Agents make it worse. They write fast, don't remember your conventions, and will pass every check you have in place.

rivt catches what ESLint and TypeScript can't: layer boundaries, library placement, environment variable hygiene. It ships with rules for universal best practices, and you can create your own for your team's specific patterns. Every violation tells you exactly what to fix. Hook it into your agent's workflow and violations get fixed automatically, before the code ever reaches you.

```
src/components/UserCard.tsx:2:0    library-imports   Components must not import axios. Move axios usage to the services layer. (found: axios)
src/services/auth.ts:1:0           library-imports   Services should be framework-agnostic. Move React-specific logic to a hook or component. (found: react)
src/hooks/useOrders.ts:8:14        no-env-vars       Do not access environment variables directly. Read from the config module instead (src/config.ts).
src/services/payments.ts:5:4       http-timeout      Add timeout parameter to axios.post() (e.g. timeout: 10000).

Found 4 violations in 4 files.
```

## Agent integration

Set it up once. Violations get fixed before you see the code.

`.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": { "stop": [{ "command": ".cursor/hooks/run-rivt.sh" }] }
}
```

`.cursor/hooks/run-rivt.sh`:

```bash
#!/bin/bash
input=$(cat)
status=$(echo "$input" | jq -r '.status // empty')

if [[ "$status" != "completed" ]]; then
    echo '{}'
    exit 0
fi

output=$(npx rivt check 2>&1)
exit_code=$?

if [[ $exit_code -ne 0 ]] && [[ -n "$output" ]]; then
    followup=$(jq -n --arg msg "rivt found architectural violations. Fix them:\n\n$output" \
        '{"followup_message": $msg}')
    echo "$followup"
else
    echo '{}'
fi

exit 0
```

Make the script executable with `chmod +x .cursor/hooks/run-rivt.sh`. Pre-commit hooks and CI checks work too — rivt exits `1` when violations are found.

## Install

```
npm install git+https://github.com/AhmedAbbasDeveloper/rivt-js.git
```

Also works with pnpm and yarn. Requires Node 20+.

## Quick start

```bash
rivt init      # detects your project layout, writes rivt.config.json
rivt check     # find violations
```

`rivt init` scans your project for conventional directory names (components, hooks, services, stores, etc.) and generates a complete `rivt.config.json` — every layer, every import rule, ready to review and adjust.

Exit codes: `0` clean, `1` violations found, `2` config error.

## Rules

rivt ships with rules for architectural concerns that ESLint and TypeScript structurally cannot check:

| Rule              | What it enforces                                               |
| ----------------- | -------------------------------------------------------------- |
| `layer-imports`   | Import boundaries between architectural layers                 |
| `library-imports` | Libraries restricted to specific layers                        |
| `no-env-vars`     | No `process.env` / `import.meta.env` outside the config module |
| `http-timeout`    | Axios calls must specify a `timeout`                           |

All rules are on by default. Disable any with `"disable": ["http-timeout"]`. See [RULES.md](RULES.md) for examples and rationale.

## Configuration

Config lives in `rivt.config.json` (or under a `"rivt"` key in `package.json`). Each layer declares where its files live (`paths`) and which other layers it can import from (`can_import`):

```json
{
  "http_client": "axios",
  "config_module": "src/config.ts",
  "layers": {
    "pages": {
      "paths": ["src/pages"],
      "can_import": [
        "components",
        "hooks",
        "services",
        "utils",
        "types",
        "stores"
      ]
    },
    "components": {
      "paths": ["src/components"],
      "can_import": ["hooks", "utils", "types", "stores"]
    },
    "hooks": {
      "paths": ["src/hooks"],
      "can_import": ["services", "utils", "types", "stores"]
    },
    "services": { "paths": ["src/services"], "can_import": ["utils", "types"] },
    "stores": {
      "paths": ["src/stores"],
      "can_import": ["services", "utils", "types"]
    },
    "utils": { "paths": ["src/utils"], "can_import": ["types"] },
    "types": { "paths": ["src/types"], "can_import": [] }
  }
}
```

Your config file is the source of truth. What you see is what rivt enforces — no hidden rules, no implicit behavior. See [CONFIGURATION.md](CONFIGURATION.md) for the full reference.

## Custom rules

The built-in rules cover universal conventions. The real power is rules specific to your team — every API call must go through the service layer, every store must follow a naming convention, every hook must handle loading states. Whatever your team cares about, codify it.

```bash
rivt new-rule handle-loading-states
# Created .rivt/rules/handle_loading_states.ts
```

The rule API is simple enough for your agent to write. Scaffold the file, tell your agent what to enforce, and run `rivt check`. rivt auto-discovers rules from `.rivt/rules/`. See [CONFIGURATION.md](CONFIGURATION.md#custom-rules) for examples and the full guide.

## Adopting in an existing codebase

Running rivt on a large codebase will surface many violations. Adopt progressively:

1. **Start with a few rules.** Disable the rest with `"disable": [...]`.
2. **Narrow the scope.** Exclude directories with `"exclude": [...]`.
3. **Add to CI.** Enforce on new code immediately.
4. **Clean up over time.** Re-enable rules as you fix violations.

Also available for [Python (FastAPI)](https://github.com/AhmedAbbasDeveloper/rivt-py).
