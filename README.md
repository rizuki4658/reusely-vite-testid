# @reusely/vue-testid

Auto-inject `data-testid` attributes into Vue components at compile time. No manual annotation needed — your QA team gets stable selectors for e2e testing out of the box.

## How it works

The plugin hooks into Vue's template compiler via `nodeTransforms`. During compilation, it analyzes each element's attributes, directives, and context to generate a semantic `data-testid` automatically.

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
import { createTestIdPlugin } from '@reusely/vue-testid'

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
import { createTestIdPlugin } from '@reusely/vue-testid'

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
| 8 | Component tag | `<DatePicker />` | `date-picker` |
| 9 | `placeholder` | `placeholder="Search..."` | `search` |
| 10 | Hash fallback | (no semantic info) | `div-a3f2` |

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
    skipTags: [                // HTML tags to never inject on
      'span', 'br', 'hr', 'img', 'svg', 'path',
      'template', 'slot', 'transition', 'keep-alive',
      'teleport',
    ],
    skipPatterns: [],          // regex patterns to skip (e.g. [/^Icon/])
    excludeComponents: [],     // component names to skip
    excludeComponentPatterns: [],
  },
})
```

## Recipes

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
      'src/views/',
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

Add suffixes for your UI library's custom components:

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

### Skip specific tags

```js
createTestIdPlugin({
  filter: {
    skipTags: [
      // defaults
      'span', 'br', 'hr', 'img', 'svg', 'path',
      'template', 'slot', 'transition', 'keep-alive',
      'teleport',
      // custom
      'lottie-player',
    ],
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
