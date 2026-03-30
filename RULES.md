# Rules

## layer-imports

Enforces import boundaries between architectural layers. Each layer declares which other layers it can import from via `can_import` in the configuration.

The conventional import graph for React/TypeScript projects:

| Layer      | Can import from                                   |
| ---------- | ------------------------------------------------- |
| pages      | components, hooks, services, utils, types, stores |
| components | hooks, utils, types, stores                       |
| hooks      | services, utils, types, stores                    |
| services   | utils, types                                      |
| utils      | types                                             |
| types      | (none)                                            |
| stores     | services, utils, types                            |
| contexts   | hooks, services, utils, types, stores             |

`rivt init` uses these conventions when generating your config. You control the final result — adjust `can_import` to match your architecture. Files not inside any configured layer are not checked.

### Violation

```typescript
// src/components/UserCard.tsx
import { fetchUser } from "../services/user";
```

```
src/components/UserCard.tsx:2:0  layer-imports  Components must not import from services. Import from hooks, utils, types, stores instead. (found: ../services/user)
```

Correct:

```typescript
// src/components/UserCard.tsx
import { useUser } from "../hooks/useUser";
```

### Glob patterns

For feature-based layouts, configure layers with glob patterns:

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

This matches `src/users/components/`, `src/orders/components/`, etc.

### Edge cases

- Relative imports are resolved against the file's location and checked the same way.
- Only relative imports (`.` or `..`) are checked for layer boundaries — bare package imports are ignored.

---

## library-imports

Restricts specific libraries to specific layers. This is separate from `layer-imports` — you can enable one without the other.

rivt auto-generates restrictions for `react` and `react-dom` (components, hooks, pages, stores, contexts) and for the library specified in `http_client`. You can override or extend these via `"libraries"` in your config.

**`import type` statements are exempt.** Type-only imports have no architectural impact — your type files can reference React types without triggering a violation.

### Violation

```typescript
// src/services/auth.ts
import { useState } from "react";
```

```
src/services/auth.ts:1:0  library-imports  Services should be framework-agnostic. Move React-specific logic to a hook or component. (found: react)
```

Correct:

```typescript
// src/services/auth.ts
import type { ReactNode } from "react"; // type import — no violation

export function getAuthToken(): string { ... }
```

### Configuration

```json
{
  "libraries": {
    "axios": { "allowed_in": ["services"] },
    "react": {
      "allowed_in": ["components", "hooks", "pages", "stores", "contexts"]
    }
  }
}
```

---

## no-env-vars

`process.env.*` and `import.meta.env.*` must not be used outside the configured config module(s).

### Violation

```typescript
// src/services/email.ts
const key = process.env.SENDGRID_API_KEY;
```

```
src/services/email.ts:1:12  no-env-vars  Do not access environment variables directly. Read from the config module instead (src/config.ts).
```

Correct:

```typescript
// src/services/email.ts
import { config } from "../config";
const key = config.sendgridApiKey;
```

### Configuration

```json
{ "config_module": "src/config.ts" }
```

Accepts a string or an array. Supports glob patterns:

```json
{ "config_module": ["src/config.ts", "src/env.ts"] }
```

---

## http-timeout

Axios calls must specify a `timeout` parameter. Missing timeouts cause cascading failures when a downstream service is slow.

Only fires when `http_client` is set to `"axios"`. Ky has a built-in default timeout, so this rule does not apply to Ky.

### Violation

```typescript
// src/services/payments.ts
const response = await axios.post("/charge", data);
```

```
src/services/payments.ts:1:22  http-timeout  Add timeout parameter to axios.post() (e.g. timeout: 10000).
```

Correct:

```typescript
const response = await axios.post("/charge", data, { timeout: 10000 });
```

Also checks `axios.create()`:

```typescript
const client = axios.create({ baseURL: "/api" });
// violation: Add timeout parameter to axios.create() (e.g. timeout: 10000).
```

---

## Custom rules

These 4 rules cover universal conventions. The real power is rules specific to your team. Scaffold one with `rivt new-rule <name>` and tell your agent what to enforce — see the [custom rules guide](CONFIGURATION.md#custom-rules).
