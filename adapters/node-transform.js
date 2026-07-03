import { resolveNamespace } from '../core/namespace-resolver.js'
import { resolveIdentifier } from '../core/identifier-strategy.js'
import { buildAttributes } from '../core/attribute-builder.js'
import { injectAttributes } from './attribute-injector.js'

export function createNodeTransform(config, projectRoot) {
  return createNodeTransformWithContext(config, { projectRoot })
}

export function createNodeTransformWithContext(config, context) {
  let cachedFilename = null
  let cachedNamespace = null
  let usedIdentifiers = new Set()

  return function testIdNodeTransform(node, transformContext) {
    // node.type 1 = NodeTypes.ELEMENT
    if (node.type !== 1) return

    // Skip excluded components
    if (node.tagType === 1 && isExcludedComponent(node.tag, config)) return

    // --- Guard: skip if testid already exist ---
    if (hasExistingTestId(node, config)) return

    // --- Resolve namespace (cached per file) ---
    if (transformContext.filename !== cachedFilename) {
      cachedFilename = transformContext.filename
      cachedNamespace = resolveNamespace(transformContext.filename, context.projectRoot, config)
      usedIdentifiers = new Set()
    }

    // --- Extract normalized nodeData from AST ---
    const nodeData = extractNodeData(node)

    // --- Resolve identifier via core engine ---
    const result = resolveIdentifier(nodeData, config)
    if (!result) return  // skip — non-targetable or filtered

    // --- Disambiguate duplicates within same file ---
    let identifier = result.identifier
    if (usedIdentifiers.has(identifier)) {
      identifier = disambiguate(identifier, usedIdentifiers)
    }
    usedIdentifiers.add(identifier)

    // --- Build attributes via core engine ---
    const attributes = buildAttributes(
      cachedNamespace,
      identifier,
      node.tag,
      config
    )

    // --- Inject via adapter ---
    if (attributes.length > 0) {
      injectAttributes(node, attributes)
    }
  }
}

/**
 * Append -2, -3, etc. for unique identifier within a file.
 */
function disambiguate(identifier, usedSet) {
  let counter = 2
  let candidate = `${identifier}-${counter}`
  while (usedSet.has(candidate)) {
    counter++
    candidate = `${identifier}-${counter}`
  }
  return candidate
}

/**
 * Check if node is already have data-testid (manual override).
 * Check dynamic binding too `:data-testid`.
 */
function hasExistingTestId(node, config) {
  const testIdNames = Object.values(config.attributes)
    .filter(a => a.enabled)
    .map(a => a.name)

  return node.props.some(prop => {
    // Static attribute: { type: 6, name: "data-testid" }
    if (prop.type === 6 && testIdNames.includes(prop.name)) return true

    // Dynamic binding: { type: 7, name: "bind", arg: { content: "data-testid" } }
    if (prop.type === 7 && prop.name === 'bind' && prop.arg &&
        testIdNames.includes(prop.arg.content)) return true

    return false
  })
}

/**
 * Extract plain object from AST ElementNode.
 * This is boundary between compiler world and core world.
 */
function extractNodeData(node) {
  const attrs = {}
  const directives = { events: {} }
  let vModel = null
  const staticText = []
  const attrKeys = []

  for (const prop of node.props) {
    if (prop.type === 6) {
      // Static attribute
      attrs[prop.name] = prop.value?.content || ''
      attrKeys.push(prop.name)
    }

    if (prop.type === 7) {
      // Directive
      if (prop.name === 'model') {
        // v-model — extract expression
        vModel = prop.exp?.content || null
      }

      if (prop.name === 'on' && prop.arg) {
        // @click, @submit, etc.
        const eventName = prop.arg.content
        const handlerExpr = prop.exp?.content || ''
        directives.events[eventName] = handlerExpr
      }
    }
  }

  if (vModel) {
    directives.vModel = vModel
  }

  // Extract static text children
  for (const child of node.children || []) {
    if (child.type === 2) {
      // TEXT node
      const text = child.content.trim()
      if (text) staticText.push(text)
    }
  }

  return {
    tag: node.tag,
    tagType: node.tagType,
    attrs,
    directives,
    staticText,
    attrKeys,
  }
}

/**
 * Check if a component tag is excluded from testid injection.
 * Matches against exact names (Set) and regex patterns.
 */
function isExcludedComponent(tag, config) {
  if (config.filter.excludeComponents.has(tag)) return true
  return config.filter.excludeComponentPatterns.some(p => p.test(tag))
}
