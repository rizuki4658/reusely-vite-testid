const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * FNV-1a 32-bit hash.
 * @param {string} str
 * @returns {number} Unsigned 32-bit integer
 */
function fnv1a32(str) {
  let hash = FNV_OFFSET
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * FNV_PRIME) >>> 0
  }
  return hash
}

/**
 * Generate a stable 4-char base36 hash from element characteristics.
 *
 * @param {string} tag - Element tag name
 * @param {string} staticText - Direct text content, trimmed
 * @param {string[]} attrKeys - Sorted static attribute keys
 * @returns {string} 4-char base36 hash, e.g. "a3f2"
 */
function stableHash(tag, staticText, attrKeys) {
  const input = [
    tag,
    staticText.slice(0, 50),
    attrKeys.sort().join(','),
  ].join('|')

  const hash = fnv1a32(input)
  return hash.toString(36).slice(0, 4).padStart(4, '0')
}

module.exports = { stableHash }
