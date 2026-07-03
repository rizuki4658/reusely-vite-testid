import { describe, it, expect } from 'vitest'
import { resolveNamespace } from '../../core/namespace-resolver.js'

const defaultConfig = {
  namespace: {
    separator: '--',
    prefix: '',
    maxSegments: 4,
    stripPaths: ['src/components/', 'src/views/'],
    stripLayers: [],
    mappings: {},
    libraryPrefixes: [],
  },
}

function resolve(filename, projectRoot = '/project', config = defaultConfig) {
  return resolveNamespace(filename, projectRoot, config)
}

describe('resolveNamespace', () => {
  it('strips src/components/ and converts PascalCase to kebab', () => {
    expect(resolve('/project/src/components/LoginForm.vue')).toBe('login-form')
  })

  it('strips src/views/', () => {
    expect(resolve('/project/src/views/Dashboard.vue')).toBe('dashboard')
  })

  it('handles nested paths', () => {
    expect(resolve('/project/src/components/Auth/LoginForm.vue')).toBe('auth-login-form')
  })

  it('deduplicates redundant prefix segments', () => {
    expect(resolve('/project/src/components/Buyback/BuybackOffer/BuybackOfferSearch.vue'))
      .toBe('buyback-offer-search')
  })

  it('handles index.vue — uses parent directory name', () => {
    expect(resolve('/project/src/components/Buyback/index.vue')).toBe('buyback')
  })

  it('respects maxSegments', () => {
    const config = {
      ...defaultConfig,
      namespace: { ...defaultConfig.namespace, maxSegments: 2 },
    }
    expect(resolve('/project/src/components/A/B/C/D.vue', '/project', config)).toBe('c-d')
  })

  it('strips organizational layers', () => {
    const config = {
      ...defaultConfig,
      namespace: { ...defaultConfig.namespace, stripLayers: ['Features'] },
    }
    expect(resolve('/project/src/components/Features/Auth/LoginForm.vue', '/project', config))
      .toBe('auth-login-form')
  })

  it('applies custom mappings', () => {
    const config = {
      ...defaultConfig,
      namespace: { ...defaultConfig.namespace, mappings: { 'src/components/loginform.vue': 'login' } },
    }
    expect(resolve('/project/src/components/LoginForm.vue', '/project', config)).toBe('login')
  })

  it('applies library prefix', () => {
    const config = {
      ...defaultConfig,
      namespace: {
        ...defaultConfig.namespace,
        stripPaths: ['src/components/', 'packages/ui/src/'],
        libraryPrefixes: [{ path: 'packages/ui/src/', prefix: 'ui' }],
      },
    }
    expect(resolve('/project/packages/ui/src/Button.vue', '/project', config)).toBe('ui-button')
  })

  it('handles no library prefix match', () => {
    const config = {
      ...defaultConfig,
      namespace: {
        ...defaultConfig.namespace,
        libraryPrefixes: [{ path: 'packages/ui/src/', prefix: 'ui' }],
      },
    }
    expect(resolve('/project/src/components/LoginForm.vue', '/project', config)).toBe('login-form')
  })

  it('handles Windows-style backslashes', () => {
    expect(resolve('C:\\project\\src\\components\\LoginForm.vue', 'C:\\project')).toBe('login-form')
  })

  it('is case-insensitive for stripPaths matching', () => {
    expect(resolve('/project/SRC/Components/LoginForm.vue')).toBe('login-form')
  })
})
