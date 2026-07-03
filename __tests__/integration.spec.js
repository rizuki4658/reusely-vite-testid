import { describe, it, expect } from 'vitest'
import { compile } from '@vue/compiler-dom'
import { createTestIdPlugin } from '../index.js'

describe('integration: full pipeline', () => {
  it('processes a realistic component template', () => {
    const { nodeTransform } = createTestIdPlugin({ projectRoot: '/project' })

    const template = `
      <form @submit="handleSubmit">
        <input id="email" v-model="form.email" />
        <input name="password" type="password" />
        <select v-model="form.role">
          <option>admin</option>
        </select>
        <button @click="handleCancel">Cancel</button>
        <button type="submit">Submit</button>
      </form>
    `

    const { code } = compile(template, {
      filename: '/project/src/components/Auth/RegisterForm.vue',
      nodeTransforms: [nodeTransform],
    })

    expect(code).toContain('register-form--submit-form')
    expect(code).toContain('register-form--email')           // id priority
    expect(code).toContain('register-form--password-input')  // name priority
    expect(code).toContain('register-form--role-select')     // v-model on select
    expect(code).toContain('register-form--cancel-btn')      // event handler
  })

  it('returns plugin and nodeTransform from createTestIdPlugin', () => {
    const { plugin, nodeTransform } = createTestIdPlugin()

    expect(plugin.name).toBe('reusely-vue-testid')
    expect(plugin.enforce).toBe('pre')
    expect(typeof plugin.configResolved).toBe('function')
    expect(typeof plugin.transform).toBe('function')
    expect(typeof nodeTransform).toBe('function')
  })

  it('respects all config overrides together', () => {
    const { nodeTransform } = createTestIdPlugin({
      projectRoot: '/project',
      namespace: {
        stripPaths: ['src/views/'],
        stripLayers: ['Features'],
        libraryPrefixes: [{ path: 'lib/ui/', prefix: 'myui' }],
      },
      filter: {
        excludeComponentPatterns: [/^Icon/],
      },
      identifier: {
        tagSuffixMap: { 'combo': '-combo' },
        eventHandlerPrefixes: ['do', 'handle', 'on'],
      },
    })

    const { code } = compile(
      '<div><button @click="doSave">Save</button></div>',
      {
        filename: '/project/src/views/Features/Settings/General.vue',
        nodeTransforms: [nodeTransform],
      },
    )

    expect(code).toContain('settings-general--save-btn')
  })
})
