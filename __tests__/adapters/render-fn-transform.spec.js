import { describe, it, expect } from 'vitest'
import {
  createRenderFnTransform,
  extractScriptBlock,
  hasHImport,
  findHCalls,
  splitTopLevelArgs,
  classifyTag,
  extractPropsInfo,
  pathMatches,
} from '../../adapters/render-fn-transform.js'
import { resolveConfig } from '../../config/resolve.js'

// --- Unit tests for internal helpers ---

describe('extractScriptBlock', () => {
  it('extracts content between <script> tags', () => {
    const code = '<script>\nconst x = 1\n</script>'
    const result = extractScriptBlock(code)
    expect(result).not.toBeNull()
    expect(result.content).toBe('\nconst x = 1\n')
  })

  it('returns null for no script block', () => {
    const code = '<template><div>hello</div></template>'
    expect(extractScriptBlock(code)).toBeNull()
  })

  it('ignores <script setup>', () => {
    const code = '<script setup>\nconst x = ref(1)\n</script>'
    expect(extractScriptBlock(code)).toBeNull()
  })

  it('extracts non-setup script when both exist', () => {
    const code = '<script>\nexport default {}\n</script>\n<script setup>\nconst x = 1\n</script>'
    const result = extractScriptBlock(code)
    expect(result.content).toBe('\nexport default {}\n')
  })
})

describe('hasHImport', () => {
  it('detects ESM import of h', () => {
    expect(hasHImport("import { h } from 'vue'")).toBe(true)
    expect(hasHImport('import { defineComponent, h, ref } from "vue"')).toBe(true)
  })

  it('detects CJS require of h', () => {
    expect(hasHImport("const { h } = require('vue')")).toBe(true)
    expect(hasHImport('const { defineComponent, h } = require("vue")')).toBe(true)
  })

  it('returns false when h is not imported', () => {
    expect(hasHImport("import { ref } from 'vue'")).toBe(false)
    expect(hasHImport('const x = 1')).toBe(false)
  })

  it('does not match h in other words', () => {
    expect(hasHImport("import { helper } from 'vue'")).toBe(false)
  })
})

describe('findHCalls', () => {
  it('finds simple h() calls', () => {
    const code = "h('div', { class: 'x' })"
    const results = findHCalls(code)
    expect(results.length).toBe(1)
    expect(results[0].argsText).toBe("'div', { class: 'x' }")
  })

  it('finds nested h() calls', () => {
    const code = "h('div', {}, h('span', { class: 'inner' }))"
    const results = findHCalls(code)
    expect(results.length).toBe(2)
  })

  it('does not match non-h functions', () => {
    const code = "hash('abc') + helper('x')"
    const results = findHCalls(code)
    expect(results.length).toBe(0)
  })

  it('handles multiline h() calls', () => {
    const code = `h('div', {
      class: 'container',
      onClick: this.handleClick
    }, children)`
    const results = findHCalls(code)
    expect(results.length).toBe(1)
  })

  it('handles h() calls with strings containing parentheses', () => {
    const code = "h('div', { title: 'hello (world)' })"
    const results = findHCalls(code)
    expect(results.length).toBe(1)
  })
})

describe('splitTopLevelArgs', () => {
  it('splits simple args', () => {
    const args = splitTopLevelArgs("'div', { class: 'x' }, children")
    expect(args.length).toBe(3)
    expect(args[0].text.trim()).toBe("'div'")
    expect(args[1].text.trim()).toBe("{ class: 'x' }")
    expect(args[2].text.trim()).toBe('children')
  })

  it('handles nested objects with commas', () => {
    const args = splitTopLevelArgs("'div', { style: { color: 'red', fontSize: '12px' } }, ch")
    expect(args.length).toBe(3)
    expect(args[1].text.trim()).toBe("{ style: { color: 'red', fontSize: '12px' } }")
  })

  it('handles string args with commas', () => {
    const args = splitTopLevelArgs("'div', 'hello, world'")
    expect(args.length).toBe(2)
    expect(args[1].text.trim()).toBe("'hello, world'")
  })

  it('handles single arg', () => {
    const args = splitTopLevelArgs("'div'")
    expect(args.length).toBe(1)
  })
})

describe('classifyTag', () => {
  it('returns string for single-quoted tag', () => {
    expect(classifyTag("'div'")).toEqual({ type: 'string', value: 'div' })
  })

  it('returns string for double-quoted tag', () => {
    expect(classifyTag('"input"')).toEqual({ type: 'string', value: 'input' })
  })

  it('returns expression for variable', () => {
    expect(classifyTag('Loading')).toEqual({ type: 'expression', value: 'Loading' })
  })

  it('returns expression for this reference', () => {
    expect(classifyTag('this.$props.tag')).toEqual({ type: 'expression', value: 'this.$props.tag' })
  })

  it('returns expression for ternary', () => {
    const tag = "cond ? RouterLink : 'div'"
    expect(classifyTag(tag).type).toBe('expression')
  })
})

describe('extractPropsInfo', () => {
  it('extracts string-literal name', () => {
    const result = extractPropsInfo("{ name: 'email', class: 'input' }")
    expect(result.attrs.name).toBe('email')
  })

  it('extracts string-literal type', () => {
    const result = extractPropsInfo("{ type: 'checkbox' }")
    expect(result.attrs.type).toBe('checkbox')
  })

  it('extracts string-literal id', () => {
    const result = extractPropsInfo("{ id: 'my-field' }")
    expect(result.attrs.id).toBe('my-field')
  })

  it('extracts string-literal placeholder', () => {
    const result = extractPropsInfo("{ placeholder: 'Search items' }")
    expect(result.attrs.placeholder).toBe('Search items')
  })

  it('extracts event handlers with this prefix', () => {
    const result = extractPropsInfo("{ onClick: this.handleSave }")
    expect(result.events.click).toBe('handleSave')
  })

  it('extracts event handlers without this prefix', () => {
    const result = extractPropsInfo("{ onClick: handleSave }")
    expect(result.events.click).toBe('handleSave')
  })

  it('extracts multiple events', () => {
    const result = extractPropsInfo("{ onClick: this.handleSave, onInput: this.onKeyup }")
    expect(result.events.click).toBe('handleSave')
    expect(result.events.input).toBe('onKeyup')
  })

  it('detects existing data-testid', () => {
    const result = extractPropsInfo("{ 'data-testid': 'my-id', class: 'x' }")
    expect(result.hasTestId).toBe(true)
  })

  it('ignores non-semantic keys', () => {
    const result = extractPropsInfo("{ class: 'foo', disabled: true, ref: 'myRef' }")
    expect(Object.keys(result.attrs).length).toBe(0)
  })

  it('ignores dynamic values for semantic keys', () => {
    const result = extractPropsInfo("{ name: this.name, type: myType }")
    expect(Object.keys(result.attrs).length).toBe(0)
  })
})

describe('pathMatches', () => {
  it('matches file path against patterns', () => {
    expect(pathMatches(
      '/project/system-design/src/components/button/button.vue',
      ['system-design/src/components/'],
      '/project'
    )).toBe(true)
  })

  it('does not match unrelated paths', () => {
    expect(pathMatches(
      '/project/src/components/MyComponent.vue',
      ['system-design/src/components/'],
      '/project'
    )).toBe(false)
  })

  it('returns false for empty paths array', () => {
    expect(pathMatches(
      '/project/system-design/src/components/button.vue',
      [],
      '/project'
    )).toBe(false)
  })
})

// --- Integration tests ---

describe('createRenderFnTransform', () => {
  const PROJECT_ROOT = '/project'

  function createTransform(overrides = {}) {
    const config = resolveConfig({
      renderFn: { enabled: true, paths: ['system-design/src/components/'] },
      ...overrides,
    })
    const context = { projectRoot: PROJECT_ROOT }
    return createRenderFnTransform(config, context)
  }

  function wrapInVueFile(scriptContent) {
    return `<script>\nimport { defineComponent, h } from 'vue'\n${scriptContent}\n</script>`
  }

  const FILE_ID = '/project/system-design/src/components/checkbox/checkbox.vue'

  it('injects testid into h("input") with type', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('input', { type: 'checkbox', onInput: this.changeValue })
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    expect(result.code).toContain("'data-testid':")
    expect(result.code).toContain('checkbox')
  })

  it('injects testid into h("div") with event handler', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('div', { class: 'icon', onClick: this.handleToggle })
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    expect(result.code).toContain("'data-testid':")
    expect(result.code).toContain('toggle')
  })

  it('skips h(Loading) — component reference', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      import Loading from '../loading'
      export default defineComponent({
        render() {
          return h(Loading)
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).toBeNull()
  })

  it('skips h("span") — skipTags', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('span', { class: 'content' }, 'text')
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).toBeNull()
  })

  it('skips h() with existing data-testid', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', { 'data-testid': 'custom-id', onClick: this.handleSave })
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).toBeNull()
  })

  it('skips non-interactive div without events', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('div', { class: 'wrapper' }, children)
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).toBeNull()
  })

  it('disambiguates duplicates within same file', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('div', {}, [
            h('button', { onClick: this.handleSave }),
            h('button', { onClick: this.handleSave }),
          ])
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    // Should have two different testids
    const matches = result.code.match(/'data-testid'/g)
    expect(matches.length).toBe(2)
    // Second should be disambiguated
    expect(result.code).toContain('save-btn-2')
  })

  it('returns null for non-matching file paths', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', { onClick: this.handleSave })
        }
      })
    `)

    const result = transform(code, '/project/src/components/Other.vue')
    expect(result).toBeNull()
  })

  it('returns null when renderFn.enabled is false', () => {
    const config = resolveConfig({ renderFn: { enabled: false, paths: [] } })
    const context = { projectRoot: PROJECT_ROOT }
    const transform = createRenderFnTransform(config, context)
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', { onClick: this.handleSave })
        }
      })
    `)

    // renderFn.paths is empty so it won't match anyway
    const result = transform(code, FILE_ID)
    expect(result).toBeNull()
  })

  it('returns null for non-.vue files', () => {
    const transform = createTransform()
    const code = "import { h } from 'vue'\nh('div', {})"
    const result = transform(code, '/project/system-design/src/components/utils.js')
    expect(result).toBeNull()
  })

  it('handles h("button") with no semantic props — uses hash fallback', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', { class: 'btn' })
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    expect(result.code).toContain("'data-testid':")
  })

  it('uses correct namespace from file path', () => {
    const transform = createTransform({
      namespace: {
        stripPaths: ['system-design/src/components/'],
        libraryPrefixes: [
          { path: 'system-design/src/components/', prefix: 'bbui' },
        ],
      },
      renderFn: { enabled: true, paths: ['system-design/src/components/'] },
    })
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', { onClick: this.handleSave })
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    expect(result.code).toContain('bbui-checkbox')
  })

  it('injects props object when h() has no props (children as 2nd arg)', () => {
    const transform = createTransform()
    const code = wrapInVueFile(`
      export default defineComponent({
        render() {
          return h('button', this.$slots.default())
        }
      })
    `)

    const result = transform(code, FILE_ID)
    expect(result).not.toBeNull()
    // Should insert { 'data-testid': '...' } before the children arg
    expect(result.code).toMatch(/h\('button',\s*\{\s*'data-testid':/)
  })
})
