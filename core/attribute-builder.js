function resolveAttributeValue(key, context) {
  const { namespace, identifier, tagName, separator, prefix } = context

  switch (key) {
    case 'testId': {
      const ns = prefix ? `${prefix}-${namespace}` : namespace

      return `${ns}${separator}${identifier}`
    }

    case 'component':
      return tagName

    case 'feature':
      return namespace.split('-')[0]

    default:
      return null
  }
}

function buildAttributes(namespace, identifier, tagName, config) {
  const { separator, prefix } = config.namespace
  const attrs = []

  for (const [key, attrConfig] of Object.entries(config.attributes)) {
    if (!attrConfig.enabled) continue

    const value = resolveAttributeValue(key, {
      namespace, identifier, tagName, separator, prefix
    })

    if (value) {
      attrs.push({ name: attrConfig.name, value })
    }
  }

  return attrs
}

module.exports = { buildAttributes }
