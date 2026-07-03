import { describe, it, expect } from 'vitest'
import { stableHash } from '../../core/hash.js'

describe('stableHash', () => {
  it('returns a 4-char string', () => {
    const result = stableHash('div', 'hello', ['class'])
    expect(result).toHaveLength(4)
  })

  it('is stable — same input produces same output', () => {
    const a = stableHash('div', 'hello world', ['class', 'id'])
    const b = stableHash('div', 'hello world', ['class', 'id'])
    expect(a).toBe(b)
  })

  it('differs for different tags', () => {
    const a = stableHash('div', 'text', ['class'])
    const b = stableHash('span', 'text', ['class'])
    expect(a).not.toBe(b)
  })

  it('differs for different text', () => {
    const a = stableHash('div', 'hello', ['class'])
    const b = stableHash('div', 'world', ['class'])
    expect(a).not.toBe(b)
  })

  it('sorts attrKeys for consistency', () => {
    const a = stableHash('div', '', ['id', 'class'])
    const b = stableHash('div', '', ['class', 'id'])
    expect(a).toBe(b)
  })

  it('truncates staticText to 50 chars', () => {
    const long = 'a'.repeat(100)
    const short = 'a'.repeat(50)
    const a = stableHash('div', long, [])
    const b = stableHash('div', short, [])
    expect(a).toBe(b)
  })

  it('pads short hashes to 4 chars', () => {
    const result = stableHash('a', '', [])
    expect(result).toHaveLength(4)
  })
})
