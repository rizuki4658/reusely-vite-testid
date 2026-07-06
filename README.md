# reusely-vite-testid

Auto-inject `data-testid` attributes into Vue components at compile time. No manual annotation needed — your QA team gets stable selectors for e2e testing out of the box.

## How it works

The plugin has two layers:

1. **Template transform** — hooks into Vue's `nodeTransforms` to inject `data-testid` on elements in `<template>` blocks
2. **Render function transform** — parses `h()` calls in `<script>` blocks and injects `data-testid` into props objects

```
src/components/Auth/LoginForm.vue
┌─────────────────────────────────────────┐
│ <input v-model="form.email" />          │  → data-testid="login-form--email-input"
│ <input v-model="form.password" />       │  → data-testid="login-form--password-input"
│ <button @click="handleSubmit">Login</button> │  → data-testid="login-form--submit-btn"
└─────────────────────────────────────────┘
```

Format: `{namespace}--{identifier}`

- **Namespace**: derived from file path (`LoginForm.vue` → `login-form`)
- **Identifier**: derived from element semantics (v-model, name, id, event handler, etc.)

## Install

```bash
npm install reusely-vite-testid --save-dev
```

## Setup

### Vite

```js
// vite.config.js
import { createTestIdPlugin } from 'reusely-vite-testid'

const { plugin, nodeTransform } = createTestIdPlugin({
  enabled: process.env.NODE_ENV !== 'production',
})

export default defineConfig({
  plugins: [
    plugin,
    vue({
      template: {
        compilerOptions: {
          nodeTransforms: [nodeTransform],
        },
      },
    }),
  ],
})
```

### Vitest

```js
// vitest.config.js
import { createTestIdPlugin } from 'reusely-vite-testid'

const { plugin, nodeTransform } = createTestIdPlugin({ enabled: true })

export default defineConfig({
  plugins: [
    plugin,
    vue({
      template: {
        compilerOptions: {
          nodeTransforms: [nodeTransform],
        },
      },
    }),
  ],
})
```

## Identifier Priority Chain

The plugin resolves identifiers in this order. First match wins:

| Priority | Source | Example Input | Example Output |
|----------|--------|---------------|----------------|
| 1 | Explicit `data-testid` | `data-testid="custom"` | `custom` (preserved, no override) |
| 2 | `id` attribute | `id="email-field"` | `email-field` |
| 3 | `name` attribute | `name="username"` | `username-input` |
| 4 | `v-model` binding | `v-model="form.email"` | `email-input` |
| 5 | `aria-label` | `aria-label="Search"` | `search` |
| 6 | Event handler | `@click="handleSave"` | `save-btn` |
| 7 | `type` attribute | `<input type="email">` | `email-input` |
| 8 | Component tag | `<DatePicker />` | `date-picker` (only in `componentMode: 'all'`) |
| 9 | `placeholder` | `placeholder="Search..."` | `search` |
| 10 | Hash fallback | (no semantic info) | `div-a3f2` |

## Component Mode

Controls when `data-testid` is injected on Vue components (custom elements like `<DatePicker />`, `<Tooltip />`, etc.).

| Mode | Behavior |
|------|----------|
| `'interactive'` (default) | Only inject on components that resolved via semantic priorities 2-6 (id, name, v-model, aria-label, event handler). Components with no semantic info are skipped — this avoids Vue fragment warnings. |
| `'all'` | Inject on all components, including those without semantic attributes. Uses kebab-cased tag name as fallback (priority 8). Recommended when combined with `excludeComponents` for known fragment components. |

```js
createTestIdPlugin({
  filter: {
    componentMode: 'all',
    excludeComponents: [
      'RouterView', 'TransitionGroup', 'Transition',
    ],
  },
})
```

**Why this matters:** Vue 3 components that render fragment or text root nodes cannot inherit non-prop attributes like `data-testid`. Injecting on these components produces console warnings. Use `excludeComponents` to skip them when using `componentMode: 'all'`.

## Render Function Transform

For components that use `h()` render functions instead of `<template>`, the plugin provides a Vite `transform` hook that parses `h()` calls and injects `data-testid` into props.

### Setup

```js
createTestIdPlugin({
  renderFn: {
    enabled: true,
    paths: ['system-design/src/components/'],
  },
})
```

### How it works

The transform finds `h()` calls with string-literal tags and extracts semantic info from the props object:

```js
// Before
h('input', { type: 'checkbox', onInput: this.changeValue })

// After
h('input', { 'data-testid': 'bbui-checkbox--checkbox-input', type: 'checkbox', onInput: this.changeValue })
```

### What gets processed

- `h('div', { onClick: this.handleToggle })` — structural element with event handler
- `h('input', { type: 'email' })` — interactive element
- `h('button', { onClick: this.handleSave })` — interactive element with event

### What gets skipped

- `h(MyComponent)` — component references (not string literal)
- `h(cond ? A : B, ...)` — dynamic/conditional tags
- `h('span', ...)` — tags in `skipTags`
- `h('div', { class: 'wrapper' })` — structural element without events
- `h()` calls with existing `data-testid` in props

### Extractable props

Only **string-literal** values and **method references** can be extracted at compile time:

| Pattern | Extracted |
|---------|-----------|
| `type: 'checkbox'` | `attrs.type = 'checkbox'` |
| `name: 'email'` | `attrs.name = 'email'` |
| `id: 'my-field'` | `attrs.id = 'my-field'` |
| `placeholder: 'Search'` | `attrs.placeholder = 'Search'` |
| `onClick: this.handleSave` | `events.click = 'handleSave'` |
| `onInput: this.changeValue` | `events.input = 'changeValue'` |
| `name: this.$props.name` | skipped (dynamic) |
| `type: type \|\| 'text'` | skipped (expression) |
| `onClick: (e) => emit()` | skipped (arrow function) |

## Configuration

All options are optional. Defaults are designed to work out of the box for most Vue projects.

```js
createTestIdPlugin({
  // Master switch
  enabled: true,

  // Which attributes to inject
  attributes: {
    testId: { enabled: true, name: 'data-testid' },
    component: { enabled: false, name: 'data-component' },
    feature: { enabled: false, name: 'data-feature' },
  },

  namespace: {
    separator: '--',           // between namespace and identifier
    prefix: '',                // global prefix for all testids
    maxSegments: 4,            // max path segments in namespace
    stripPaths: [              // path prefixes to remove
      'src/components/',
      'src/views/',
    ],
    stripLayers: [],           // folder names to skip (e.g. ['Features'])
    mappings: {},              // manual overrides: { 'path/file.vue': 'custom-namespace' }
    libraryPrefixes: [],       // UI library path → prefix mapping
  },

  identifier: {
    hashFallback: true,        // generate hash for elements without semantic info
    tagSuffixMap: {},          // extend/override tag → suffix mapping
    eventTagSuffixMap: {},     // extend/override event tag → suffix mapping
    eventHandlerPrefixes: ['handle', 'on'],
  },

  filter: {
    componentMode: 'interactive', // 'interactive' | 'all'
    skipTags: [                // HTML tags to never inject on
      'span', 'br', 'hr', 'img', 'svg', 'path',
      'template', 'slot', 'transition', 'keep-alive',
      'teleport',
    ],
    skipPatterns: [],          // regex patterns to skip (e.g. [/^Icon/])
    excludeComponents: [],     // component names to skip (supports PascalCase and kebab-case)
    excludeComponentPatterns: [],  // regex patterns to skip components
  },

  // Render function transform (for h() calls)
  renderFn: {
    enabled: false,            // enable render function transform
    paths: [],                 // file path prefixes to process (e.g. ['system-design/src/'])
  },
})
```

## Recipes

### Full setup with render function support

```js
createTestIdPlugin({
  enabled: true,
  namespace: {
    stripPaths: [
      'src/components/',
      'src/views/',
      'system-design/src/components/',
    ],
    stripLayers: ['Features'],
    libraryPrefixes: [
      { path: 'system-design/src/components/', prefix: 'bbui' },
    ],
  },
  filter: {
    componentMode: 'all',
    excludeComponents: [
      'RouterView', 'RouterLink',
      'TransitionGroup', 'Transition',
    ],
    excludeComponentPatterns: [/^Icon/],
  },
  renderFn: {
    enabled: true,
    paths: ['system-design/src/components/'],
  },
})
```

### Skip specific components

Component names are matched in both PascalCase and kebab-case:

```js
createTestIdPlugin({
  filter: {
    excludeComponents: [
      'RouterView',      // matches <RouterView> and <router-view>
      'TransitionGroup', // matches <TransitionGroup> and <transition-group>
    ],
  },
})
```

### Skip Icon components

```js
createTestIdPlugin({
  filter: {
    excludeComponentPatterns: [/^Icon/],
  },
})
```

### UI library prefix

If you have a design system in a separate folder:

```js
createTestIdPlugin({
  namespace: {
    stripPaths: [
      'src/components/',
      'packages/ui/src/components/',
    ],
    libraryPrefixes: [
      { path: 'packages/ui/src/components/', prefix: 'ui' },
    ],
  },
})
```

This turns `packages/ui/src/components/Button.vue` → `ui-button`.

### Custom tag suffixes

```js
createTestIdPlugin({
  identifier: {
    tagSuffixMap: {
      'bselect': '-select',
      'datepickerpanel': '-picker',
      'combobox': '-select',
    },
  },
})
```

### Organizational layers

If your folder structure has grouping layers you want to ignore:

```
src/components/Features/Buyback/BuybackOffer/BuybackOfferSearch.vue
```

```js
createTestIdPlugin({
  namespace: {
    stripLayers: ['Features'],
  },
})
```

Result: `buyback-offer-search` (instead of `features-buyback-offer-search`).

## Built-in Suffix Defaults

### Tag suffix map

| Tag | Suffix |
|-----|--------|
| `input` | `-input` |
| `textarea` | `-input` |
| `select` | `-select` |
| `checkbox` | `-checkbox` |
| `datepicker` | `-picker` |

### Event tag suffix map

| Tag | Suffix |
|-----|--------|
| `button` | `-btn` |
| `a` | `-link` |
| `form` | `-form` |
| `div` | `-action` |
| `li` | `-item` |
| `td` | `-cell` |
| _(other)_ | `-action` |

## Duplicate Detection

When multiple elements in the same file resolve to the same identifier, the plugin automatically appends `-2`, `-3`, etc:

```html
<button @click="handleDelete">Delete</button>  → delete-btn
<button @click="handleDelete">Delete</button>  → delete-btn-2
```

## Manual Override

Existing `data-testid` attributes are always preserved. The plugin never overwrites manual annotations:

```html
<input data-testid="my-custom-id" v-model="form.email" />
<!-- Keeps "my-custom-id", does NOT generate "email-input" -->
```

## v-for Elements

Elements inside `v-for` get the same static testid. Use the index or item id to query:

```js
// Cypress
cy.get('[data-testid="order-item--card"]').eq(2)

// Playwright
page.locator('[data-testid="order-item--card"]').nth(2)
```

Or override manually for unique IDs:

```html
<OrderItem v-for="item in items" :data-testid="'order-' + item.id" />
```

## License

MIT
