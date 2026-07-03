import { describe, it, expect } from 'vitest'
import { compile } from '@vue/compiler-dom'
import { createTestIdPlugin } from '../../index.js'

const PROJECT_ROOT = '/project'

function compileTemplate(template, filename, pluginOptions = {}) {
  const { nodeTransform } = createTestIdPlugin({ ...pluginOptions, projectRoot: PROJECT_ROOT })
  return compile(template, {
    filename: `${PROJECT_ROOT}/${filename}`,
    nodeTransforms: [nodeTransform],
  })
}

function extractTestIds(code) {
  const matches = [...code.matchAll(/data-testid[":=\s]+["']?([^"'\s,}]+)/g)]
  return matches.map(m => m[1])
}

describe('nodeTransform', () => {
  it('injects testid on native input with v-model', () => {
    const { code } = compileTemplate(
      '<div><input v-model="form.email" /></div>',
      'src/components/LoginForm.vue',
    )
    const ids = extractTestIds(code)
    expect(ids).toContain('login-form--email-input')
  })

  it('injects testid on button with event handler', () => {
    const { code } = compileTemplate(
      '<div><button @click="handleSave">Save</button></div>',
      'src/components/LoginForm.vue',
    )
    const ids = extractTestIds(code)
    expect(ids).toContain('login-form--save-btn')
  })

  it('skips elements with existing data-testid', () => {
    const { code } = compileTemplate(
      '<div><input data-testid="custom" v-model="form.email" /></div>',
      'src/components/LoginForm.vue',
    )
    expect(code).toContain('custom')
    // Should NOT have auto-generated testid
    expect(code).not.toContain('login-form--email-input')
  })

  it('skips non-targetable elements (plain div without events)', () => {
    const { code } = compileTemplate(
      '<div><div class="wrapper">text</div></div>',
      'src/components/LoginForm.vue',
    )
    expect(code).not.toContain('data-testid')
  })

  it('skips skipTags (span, img)', () => {
    const { code } = compileTemplate(
      '<div><span>text</span><img src="x" /></div>',
      'src/components/LoginForm.vue',
    )
    expect(code).not.toContain('data-testid')
  })

  it('injects on component nodes by default', () => {
    const { code } = compileTemplate(
      '<div><DatePicker v-model="date" /></div>',
      'src/components/Filters.vue',
    )
    const ids = extractTestIds(code)
    expect(ids).toContain('filters--date-picker')
  })

  it('skips excluded components', () => {
    const { code } = compileTemplate(
      '<div><IconSearch :size="16" /></div>',
      'src/components/SearchBar.vue',
      { filter: { excludeComponentPatterns: [/^Icon/] } },
    )
    expect(code).not.toContain('data-testid')
  })

  it('disambiguates duplicate identifiers', () => {
    const { code } = compileTemplate(
      '<div><button @click="handleDelete">A</button><button @click="handleDelete">B</button></div>',
      'src/components/List.vue',
    )
    const ids = extractTestIds(code)
    expect(ids).toContain('list--delete-btn')
    expect(ids).toContain('list--delete-btn-2')
  })

  it('no-ops when disabled', () => {
    const { code } = compileTemplate(
      '<div><input v-model="query" /></div>',
      'src/components/Search.vue',
      { enabled: false },
    )
    expect(code).not.toContain('data-testid')
  })

  it('applies library prefix from config', () => {
    const { code } = compileTemplate(
      '<div><input v-model="value" /></div>',
      'packages/ui/src/Input.vue',
      {
        namespace: {
          stripPaths: ['packages/ui/src/'],
          libraryPrefixes: [{ path: 'packages/ui/src/', prefix: 'ui' }],
        },
      },
    )
    const ids = extractTestIds(code)
    expect(ids).toContain('ui-input--value-input')
  })
})
