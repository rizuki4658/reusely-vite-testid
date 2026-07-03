# Extract Plan: `@reusely/vue-testid`

## Context

Plugin `vite-plugin-vue-testid` di `plugins/vite-plugin-vue-testid/` sudah generic dan self-contained. Extract ke repo + npm package terpisah supaya bisa di-install via npm di project mana pun. Prefix "reusely" karena ini tool untuk memudahkan QA dalam e2e testing selector.

## Naming

- **Repo**: `reusely-vue-testid`
- **Package npm**: `@reusely/vue-testid`
- **Location**: `/Users/devixel_fe_2024/Documents/Works/reusely-vue-testid`

---

## Step 1: Scaffold repo baru

### Buat directory structure

```
reusely-vue-testid/
├── package.json
├── vitest.config.js
├── .gitignore
├── index.js
├── config/
│   ├── schema.js
│   └── resolve.js
├── core/
│   ├── constants.js
│   ├── hash.js
│   ├── identifier-strategy.js
│   ├── namespace-resolver.js
│   └── attribute-builder.js
├── adapters/
│   ├── node-transform.js
│   ├── attribute-injector.js
│   └── render-fn-transform.js
└── __tests__/
    ├── core/
    │   ├── hash.spec.js
    │   ├── identifier-strategy.spec.js
    │   └── namespace-resolver.spec.js
    ├── adapters/
    │   ├── attribute-injector.spec.js
    │   └── node-transform.spec.js
    └── integration.spec.js
```

### Commands

```bash
mkdir -p /Users/devixel_fe_2024/Documents/Works/reusely-vue-testid
cd /Users/devixel_fe_2024/Documents/Works/reusely-vue-testid
mkdir -p config core adapters __tests__/core __tests__/adapters
```

---

## Step 2: `package.json`

```json
{
  "name": "@reusely/vue-testid",
  "version": "0.1.0",
  "description": "Auto-inject data-testid attributes into Vue components at compile time for e2e testing",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js"
  },
  "files": [
    "index.js",
    "config/",
    "core/",
    "adapters/"
  ],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "vite": ">=4.0.0",
    "@vue/compiler-dom": ">=3.0.0"
  },
  "devDependencies": {
    "vitest": "^3.2.1",
    "vite": "^5.0.0",
    "@vue/compiler-dom": "^3.4.0"
  },
  "keywords": [
    "vue",
    "vite",
    "vite-plugin",
    "testid",
    "data-testid",
    "e2e",
    "testing",
    "qa",
    "selector",
    "automation"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/reusely/reusely-vue-testid.git"
  }
}
```

---

## Step 3: `vitest.config.js`

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.spec.js'],
  },
})
```

---

## Step 4: `.gitignore`

```
node_modules/
dist/
.DS_Store
```

---

## Step 5: Copy source files

Semua source files di-copy as-is dari `plugins/vite-plugin-vue-testid/`. Import paths tetap sama karena relative structure identik.

| Source (buyback) | Target (reusely) |
|---|---|
| `plugins/vite-plugin-vue-testid/index.js` | `index.js` |
| `plugins/vite-plugin-vue-testid/config/schema.js` | `config/schema.js` |
| `plugins/vite-plugin-vue-testid/config/resolve.js` | `config/resolve.js` |
| `plugins/vite-plugin-vue-testid/core/constants.js` | `core/constants.js` |
| `plugins/vite-plugin-vue-testid/core/hash.js` | `core/hash.js` |
| `plugins/vite-plugin-vue-testid/core/identifier-strategy.js` | `core/identifier-strategy.js` |
| `plugins/vite-plugin-vue-testid/core/namespace-resolver.js` | `core/namespace-resolver.js` |
| `plugins/vite-plugin-vue-testid/core/attribute-builder.js` | `core/attribute-builder.js` |
| `plugins/vite-plugin-vue-testid/adapters/node-transform.js` | `adapters/node-transform.js` |
| `plugins/vite-plugin-vue-testid/adapters/attribute-injector.js` | `adapters/attribute-injector.js` |
| `plugins/vite-plugin-vue-testid/adapters/render-fn-transform.js` | `adapters/render-fn-transform.js` (empty stub) |

Test files di buyback semua masih kosong (placeholder), jadi buat empty test files di `__tests__/`.

### Perubahan saat copy

**`index.js`** — Ubah plugin name supaya match package:

```js
// Before
name: 'vite-plugin-vue-testid',
// After
name: 'reusely-vue-testid',
```

**`config/resolve.js`** — Ubah error prefix:

```js
// Before
throw new Error('[vite-plugin-vue-testid] ...')
// After
throw new Error('[@reusely/vue-testid] ...')
```

Sisanya semua file **copy identik tanpa perubahan**.

---

## Step 6: Init git + initial commit

```bash
cd /Users/devixel_fe_2024/Documents/Works/reusely-vue-testid
git init
git add .
git commit -m "initial: extract @reusely/vue-testid from buyback-development-2"
```

---

## Step 7: Install dependencies + verify

```bash
cd /Users/devixel_fe_2024/Documents/Works/reusely-vue-testid
npm install
npm test
```

---

## Step 8: Update buyback project

### 8a. Link package untuk development

```bash
cd /Users/devixel_fe_2024/Documents/Works/reusely-vue-testid
npm link

cd /Users/devixel_fe_2024/Documents/Works/buyback-development-2
npm link @reusely/vue-testid
```

### 8b. Update imports

**`vite.config.js`** line 5:
```js
// Before
import { createTestIdPlugin } from './plugins/vite-plugin-vue-testid/index.js'
// After
import { createTestIdPlugin } from '@reusely/vue-testid'
```

**`vitest.config.ts`** line 4:
```js
// Before
import { createTestIdPlugin } from './plugins/vite-plugin-vue-testid/index.js'
// After
import { createTestIdPlugin } from '@reusely/vue-testid'
```

### 8c. Hapus plugin folder dari buyback

```bash
rm -rf plugins/vite-plugin-vue-testid/
```

---

## Verification

1. **Repo baru**: `npm test` di `reusely-vue-testid/` — pass (test files kosong, no failures)
2. **Buyback**: `npm run dev` — dev server start, testid muncul di browser
3. **Buyback**: `npm run build` — production build berhasil (plugin disabled via `mode !== 'production'`)
