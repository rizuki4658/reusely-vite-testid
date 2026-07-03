import { describe, it, expect } from 'vitest'
import { injectAttributes } from '../../adapters/attribute-injector.js'

describe('injectAttributes', () => {
  it('pushes attributes to node.props', () => {
    const node = { props: [] }
    injectAttributes(node, [
      { name: 'data-testid', value: 'login-form--email-input' },
    ])

    expect(node.props).toHaveLength(1)
    expect(node.props[0].type).toBe(6) // ATTRIBUTE
    expect(node.props[0].name).toBe('data-testid')
    expect(node.props[0].value.content).toBe('login-form--email-input')
  })

  it('injects multiple attributes', () => {
    const node = { props: [] }
    injectAttributes(node, [
      { name: 'data-testid', value: 'ns--id' },
      { name: 'data-component', value: 'Button' },
    ])

    expect(node.props).toHaveLength(2)
    expect(node.props[0].name).toBe('data-testid')
    expect(node.props[1].name).toBe('data-component')
  })

  it('preserves existing props', () => {
    const node = { props: [{ type: 6, name: 'class', value: { content: 'btn' } }] }
    injectAttributes(node, [
      { name: 'data-testid', value: 'ns--id' },
    ])

    expect(node.props).toHaveLength(2)
    expect(node.props[0].name).toBe('class')
    expect(node.props[1].name).toBe('data-testid')
  })

  it('uses synthetic loc', () => {
    const node = { props: [] }
    injectAttributes(node, [{ name: 'data-testid', value: 'x' }])

    expect(node.props[0].loc.source).toBe('')
    expect(node.props[0].value.loc.source).toBe('')
  })
})
