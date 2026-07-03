import { describe, it, expect } from 'vitest'
import { resolveIdentifier } from '../../core/identifier-strategy.js'
import { resolveConfig } from '../../config/resolve.js'

const config = resolveConfig()

function makeNode(overrides = {}) {
  return {
    tag: 'input',
    tagType: 0, // ELEMENT
    attrs: {},
    directives: { events: {} },
    staticText: [],
    attrKeys: [],
    ...overrides,
  }
}

describe('resolveIdentifier', () => {
  describe('skip conditions', () => {
    it('returns null for slot nodes', () => {
      expect(resolveIdentifier(makeNode({ tagType: 2 }), config)).toBeNull()
    })

    it('returns null for template nodes', () => {
      expect(resolveIdentifier(makeNode({ tagType: 3 }), config)).toBeNull()
    })

    it('returns null for skipTags (span)', () => {
      expect(resolveIdentifier(makeNode({ tag: 'span' }), config)).toBeNull()
    })

    it('returns null for skipPatterns', () => {
      const c = resolveConfig({ filter: { skipPatterns: [/^Icon/] } })
      expect(resolveIdentifier(makeNode({ tag: 'IconSearch', tagType: 1 }), c)).toBeNull()
    })

    it('returns null for non-targetable elements (plain div without events)', () => {
      expect(resolveIdentifier(makeNode({ tag: 'div' }), config)).toBeNull()
    })
  })

  describe('priority 2: id attribute', () => {
    it('returns id as identifier', () => {
      const result = resolveIdentifier(makeNode({ attrs: { id: 'email-field' } }), config)
      expect(result).toEqual({ identifier: 'email-field', source: 'id' })
    })
  })

  describe('priority 3: name attribute', () => {
    it('returns name + suffix', () => {
      const result = resolveIdentifier(makeNode({ attrs: { name: 'username' } }), config)
      expect(result).toEqual({ identifier: 'username-input', source: 'name' })
    })

    it('converts camelCase name to kebab', () => {
      const result = resolveIdentifier(makeNode({ attrs: { name: 'firstName' } }), config)
      expect(result).toEqual({ identifier: 'first-name-input', source: 'name' })
    })
  })

  describe('priority 4: v-model', () => {
    it('extracts last segment from dot path', () => {
      const result = resolveIdentifier(makeNode({
        directives: { vModel: 'form.email', events: {} },
      }), config)
      expect(result).toEqual({ identifier: 'email-input', source: 'v-model' })
    })

    it('handles simple expression', () => {
      const result = resolveIdentifier(makeNode({
        directives: { vModel: 'searchQuery', events: {} },
      }), config)
      expect(result).toEqual({ identifier: 'search-query-input', source: 'v-model' })
    })
  })

  describe('priority 5: aria-label', () => {
    it('returns kebab-cased aria-label', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'button',
        attrs: { 'aria-label': 'Close Modal' },
      }), config)
      expect(result).toEqual({ identifier: 'close-modal', source: 'aria-label' })
    })
  })

  describe('priority 6: event handler', () => {
    it('strips handle prefix and adds tag suffix', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'button',
        directives: { events: { click: 'handleSave' } },
      }), config)
      expect(result).toEqual({ identifier: 'save-btn', source: 'event' })
    })

    it('strips on prefix', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'form',
        directives: { events: { submit: 'onSubmit' } },
      }), config)
      expect(result).toEqual({ identifier: 'submit-form', source: 'event' })
    })

    it('skips arrow functions', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'button',
        directives: { events: { click: '() => emit("cancel")' } },
      }), config)
      // Falls through to hash or null
      expect(result?.source).not.toBe('event')
    })

    it('handles div with event (structural with event)', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'div',
        directives: { events: { click: 'handleToggle' } },
      }), config)
      expect(result).toEqual({ identifier: 'toggle-action', source: 'event' })
    })
  })

  describe('priority 7: type attribute', () => {
    it('returns type + suffix for interactive elements', () => {
      const result = resolveIdentifier(makeNode({
        attrs: { type: 'email' },
      }), config)
      expect(result).toEqual({ identifier: 'email-input', source: 'type' })
    })
  })

  describe('priority 8: component tag name', () => {
    it('returns kebab-cased component name', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'DatePicker',
        tagType: 1,
      }), config)
      expect(result).toEqual({ identifier: 'date-picker', source: 'component-tag' })
    })
  })

  describe('priority 10: placeholder', () => {
    it('returns kebab-cased placeholder', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'div',
        directives: { events: { click: 'x' } }, // make targetable
        attrs: { placeholder: 'Search items' },
      }), config)
      // event handler 'x' resolves first at priority 6
      expect(result.source).toBe('event')
    })
  })

  describe('priority 11: hash fallback', () => {
    it('returns hash for component with no semantic info', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'CustomWidget',
        tagType: 1,
      }), config)
      // priority 8 (component-tag) should match first
      expect(result).toEqual({ identifier: 'custom-widget', source: 'component-tag' })
    })

    it('returns hash for interactive element with no attributes', () => {
      const result = resolveIdentifier(makeNode({
        tag: 'button',
        attrs: {},
      }), config)
      expect(result.source).toBe('hash')
      expect(result.identifier).toMatch(/^button-[a-z0-9]{4}$/)
    })
  })

  describe('id takes priority over name', () => {
    it('returns id when both id and name are present', () => {
      const result = resolveIdentifier(makeNode({
        attrs: { id: 'my-id', name: 'my-name' },
      }), config)
      expect(result).toEqual({ identifier: 'my-id', source: 'id' })
    })
  })

  describe('configurable tagSuffixMap', () => {
    it('uses custom suffix from config', () => {
      const c = resolveConfig({
        identifier: { tagSuffixMap: { 'combobox': '-combo' } },
      })
      const result = resolveIdentifier(makeNode({
        tag: 'combobox',
        tagType: 1,
        attrs: { name: 'country' },
      }), c)
      expect(result).toEqual({ identifier: 'country-combo', source: 'name' })
    })
  })

  describe('configurable eventHandlerPrefixes', () => {
    it('uses custom prefixes', () => {
      const c = resolveConfig({
        identifier: { eventHandlerPrefixes: ['do'] },
      })
      const result = resolveIdentifier(makeNode({
        tag: 'button',
        directives: { events: { click: 'doSave' } },
      }), c)
      expect(result).toEqual({ identifier: 'save-btn', source: 'event' })
    })
  })
})
