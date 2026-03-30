# Configuration

rivt configuration lives in `rivt.config.json` at your project root. Alternatively, add a `"rivt"` key to your `package.json`.

## Layers

Each layer defines two things: `paths` (where the files live) and `can_import` (which other layers it can import from):

```json
{
  "layers": {
    "components": {
      "paths": ["src/components"],
      "can_import": ["hooks", "utils"]
    },
    "hooks": { "paths": ["src/hooks"], "can_import": ["services", "utils"] },
    "services": { "paths": ["src/services"], "can_import": ["utils"] },
    "utils": { "paths": ["src/utils"], "can_import": [] }
  }
}
```

The config file is the source of truth. rivt enforces exactly what's written — a layer with `"can_import": []` cannot import from any other layer, and a layer without `can_import` is treated the same way.

`rivt init` generates a complete config with conventional import relationships for standard React/TypeScript layer names. You can adjust it from there.

### Path types

Paths can be directories, exact files, or glob patterns:

```json
{
  "layers": {
    "components": {
      "paths": ["src/components"],
      "can_import": ["hooks", "utils"]
    },
    "types": { "paths": ["src/types/index.ts"], "can_import": [] },
    "hooks": { "paths": ["src/**/hooks"], "can_import": ["services", "utils"] }
  }
}
```

Glob patterns are useful for feature-based layouts:

```json
{
  "layers": {
    "components": {
      "paths": ["src/**/components"],
      "can_import": ["hooks", "utils"]
    },
    "hooks": { "paths": ["src/**/hooks"], "can_import": ["services", "utils"] }
  }
}
```

### Layer matching

When a file matches multiple layers, the longest pattern wins. Files that don't match any layer are not checked by `layer-imports` or `library-imports`.

## Library restrictions

Control which layers can import specific libraries:

```json
{
  "libraries": {
    "axios": { "allowed_in": ["services"] },
    "firebase": { "allowed_in": ["services", "stores"] }
  }
}
```

rivt auto-generates some library restrictions based on your settings:

- `react` and `react-dom` are always restricted to components, hooks, pages, stores, and contexts
- Setting `"http_client": "axios"` restricts `axios` to `services`

Use `"libraries"` to override any of these or add your own.

**`import type` statements are exempt** — type-only imports have no architectural impact.

## Settings reference

```json
{
  "http_client": "axios",
  "config_module": "src/config.ts",
  "exclude": ["tests/**", "scripts/**"],
  "disable": ["http-timeout"],
  "plugins": [],
  "layers": {},
  "libraries": {}
}
```

### config_module

Accepts a string or an array. Supports glob patterns:

```json
"config_module": "src/config.ts"
"config_module": ["src/config.ts", "src/env.ts"]
"config_module": ["src/config/**"]
```

Files matching `config_module` are exempt from the `no-env-vars` rule.

### exclude

Glob patterns for files and directories to skip entirely:

```json
"exclude": ["tests/**", "scripts/**", "storybook/**"]
```

rivt always excludes `node_modules`, `.git`, `dist`, `build`, `.next`, `.rivt`, `.cache`, and `coverage`.

### disable

Rule IDs to turn off globally:

```json
"disable": ["http-timeout"]
```

## Suppression

For granular control, suppress rules inline instead of disabling them globally.

### Inline — suppress on this line

```typescript
import { fetchUser } from "../services/user"; // rivt: disable=layer-imports
```

### Next-line — suppress on the following line

```typescript
// rivt: disable-next-line=library-imports
import { useState } from "react";
```

### File-level — suppress for the entire file

Must appear in the first 10 lines:

```typescript
// rivt: disable-file=no-env-vars
```

### Multiple rules

Comma-separate rule IDs in any suppression comment:

```typescript
// rivt: disable=layer-imports,library-imports
```

## Custom rules

### Scaffold a rule

```bash
rivt new-rule handle-loading-states
# Created .rivt/rules/handle_loading_states.ts
```

This generates a rule file with boilerplate. Fill in the `check` method — or point your AI agent at the file and tell it what to enforce. The API is intentionally simple: you get an AST, a file path, and the config. Return violations.

### Discovery

rivt auto-discovers rule exports from `.rivt/rules/`. No config changes needed. Drop a file, run `rivt check`.

```
my-project/
  .rivt/
    rules/
      handle_loading_states.ts
      require_error_boundary.ts
  src/
    ...
```

Files starting with `_` are ignored. Custom rules support the same `disable` and inline suppression as built-in rules.

### Writing a rule

A rule is an object that implements the `Rule` interface:

```typescript
// .rivt/rules/handle_loading_states.ts
import type { TSESTree } from "@typescript-eslint/typescript-estree";
import type { Rule, RivtConfig, Violation } from "rivt";

export const handleLoadingStatesRule: Rule = {
  id: "handle-loading-states",
  description: "Custom hooks must return a loading state",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    const violations: Violation[] = [];

    // walk the AST, check for your pattern
    // push violations as needed

    return violations;
  },
};
```

Key APIs available in `check`:

- `getLayer(filePath, config)` — returns the `Layer` the file belongs to (or `null`)
- `isConfigModule(filePath, config)` — whether the file is a config module
- Walk the AST from `@typescript-eslint/typescript-estree`
- Return an array of `Violation` objects with `ruleId`, `path`, `line`, `col`, `message`

### Sharing rules across repos

For rules you want in every repo, publish an npm package that exports rule objects or a `getRules` function:

```typescript
// my-rivt-rules/index.ts
import type { Rule } from "rivt";

export function getRules(): Rule[] {
  return [handleLoadingStatesRule, requireErrorBoundaryRule];
}
```

Install the package and list it in your config:

```json
{ "plugins": ["my-rivt-rules"] }
```

rivt loads the package, calls `getRules()` if it exists, and runs the returned rules. If there's no `getRules` export, rivt discovers any exported object matching the `Rule` interface.
