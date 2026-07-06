const { DEFAULT_CONFIG } = require('./schema.js')
const { DEFAULT_TAG_SUFFIX_MAP, DEFAULT_EVENT_TAG_SUFFIX_MAP } = require('../core/constants.js')

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      !(source[key] instanceof RegExp)
    ) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }

  return result
}

function resolveConfig(userOptions = {}) {
  const config = deepMerge(DEFAULT_CONFIG, userOptions)

  if (!config.namespace.separator) {
    throw new Error('[@reusely/vue-testid] namespace.separator cannot be empty')
  }

  if (config.namespace.maxSegments < 1) {
    throw new Error('[@reusely/vue-testid] namespace.maxSegments must be >= 1')
  }

  // Merge suffix maps: user overrides win over built-in defaults
  config.identifier.tagSuffixMap = {
    ...DEFAULT_TAG_SUFFIX_MAP,
    ...config.identifier.tagSuffixMap,
  }

  config.identifier.eventTagSuffixMap = {
    ...DEFAULT_EVENT_TAG_SUFFIX_MAP,
    ...config.identifier.eventTagSuffixMap,
  }

  // Normalize patterns: string → RegExp
  config.filter.skipPatterns = config.filter.skipPatterns.map(p =>
    typeof p === 'string' ? new RegExp(p) : p
  )

  config.filter.excludeComponents = new Set(config.filter.excludeComponents)

  config.filter.excludeComponentPatterns = config.filter.excludeComponentPatterns.map(p =>
    typeof p === 'string' ? new RegExp(p) : p
  )

  return Object.freeze(config)
}

module.exports = { resolveConfig }
