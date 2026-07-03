import { INTERACTIVE_TAGS, STRUCTURAL_TAGS, TAG_TYPES } from './constants.js'
import { stableHash } from './hash.js'

/**
 * Resolve semantic identifier from element attributes/directives.
 * Priority chain:
 *   1. Explicit data-testid (handled by caller)
 *   2. id attribute
 *   3. name attribute + type suffix
 *   4. v-model binding
 *   5. aria-label
 *   6. Event handler
 *   7. type attribute (interactive elements only)
 *   8. Component tag name
 *   9. Slot context modifier (handled in duplicate detection)
 *   10. Static placeholder
 *   11. Hash fallback
 *
 * @param {Object} nodeData - Normalized node information
 * @param {string}   nodeData.tag        - e.g. "input", "Button", "DatePicker"
 * @param {number}   nodeData.tagType    - 0=ELEMENT, 1=COMPONENT, 2=SLOT, 3=TEMPLATE
 * @param {Object}   nodeData.attrs      - Static attributes: { id: "x", name: "y", type: "email" }
 * @param {Object}   nodeData.directives - Directive info: { vModel: "form.email", events: { click: "handleSave" } }
 * @param {string[]} nodeData.staticText - Direct text children
 * @param {string[]} nodeData.attrKeys   - All static attribute keys
 * @param {Object}   config              - Resolved config
 * @returns {{ identifier: string, source: string }|null}
 *   identifier: resolved ID, e.g. "email-input"
 *   source: which priority resolved it, e.g. "v-model"
 *   null: skip injection for this node
 */
export function resolveIdentifier(nodeData, config) {
  const { tag, tagType, attrs, directives, staticText, attrKeys } = nodeData

  // --- Skip conditions ---

  // Skip non-element nodes
  if (tagType === TAG_TYPES.SLOT || tagType === TAG_TYPES.TEMPLATE) {
    return null
  }

  // Skip filtered tags (from config)
  if (config.filter.skipTags.includes(tag.toLowerCase())) {
    return null
  }

  // Skip filtered patterns (e.g. /^Icon/)
  if (config.filter.skipPatterns.some(p => p.test(tag))) {
    return null
  }

  // --- Targetability check ---
  const isInteractive = INTERACTIVE_TAGS.has(tag.toLowerCase())
  const isComponent = tagType === TAG_TYPES.COMPONENT
  const isStructuralWithEvent = STRUCTURAL_TAGS.has(tag.toLowerCase()) &&
    directives.events && Object.keys(directives.events).length > 0

  if (!isInteractive && !isComponent && !isStructuralWithEvent) {
    return null  // non-targetable element
  }

  // --- Priority 1: Explicit data-testid ---
  // Already handled by caller (hasExistingTestId check) — SKIP

  // --- Priority 2: id attribute ---
  if (attrs.id) {
    return { identifier: attrs.id, source: 'id' }
  }

  // --- Priority 3: name attribute + type suffix ---
  if (attrs.name) {
    const suffix = resolveTypeSuffix(tag, config)
    return {
      identifier: toKebabCase(attrs.name) + suffix,
      source: 'name'
    }
  }

  // --- Priority 4: v-model binding ---
  if (directives.vModel) {
    const lastSegment = extractLastPathSegment(directives.vModel)
    const suffix = resolveTypeSuffix(tag, config)
    return {
      identifier: toKebabCase(lastSegment) + suffix,
      source: 'v-model'
    }
  }

  // --- Priority 5: aria-label ---
  if (attrs['aria-label']) {
    return {
      identifier: toKebabCase(attrs['aria-label']),
      source: 'aria-label'
    }
  }

  // --- Priority 6: Event handler ---
  if (directives.events) {
    const eventId = resolveEventIdentifier(directives.events, tag, config)
    if (eventId) {
      return { identifier: eventId, source: 'event' }
    }
  }

  // --- Priority 7: type attribute (interactive elements only) ---
  if (attrs.type && isInteractive) {
    const suffix = resolveTypeSuffix(tag, config)
    return {
      identifier: toKebabCase(attrs.type) + suffix,
      source: 'type'
    }
  }

  // --- Priority 8: Component tag name ---
  if (isComponent) {
    return {
      identifier: toKebabCase(tag),
      source: 'component-tag'
    }
  }

  // --- Priority 9: Slot context modifier ---
  // Handled in duplicate detection (node-transform.js) — not standalone

  // --- Priority 10: Static placeholder ---
  if (attrs.placeholder) {
    return {
      identifier: toKebabCase(attrs.placeholder),
      source: 'placeholder'
    }
  }

  // --- Priority 11: Hash fallback ---
  if (config.identifier.hashFallback) {
    const hash = stableHash(tag, staticText.join(' '), attrKeys)
    return {
      identifier: `${tag}-${hash}`,
      source: 'hash'
    }
  }

  return null
}

// --- Internal helpers ---

/**
 * Extract last segment from dot-path expression.
 * "form.email" → "email"
 * "searchQuery" → "searchQuery"
 * "data.customer_visibility" → "customer_visibility"
 */
function extractLastPathSegment(expression) {
  const parts = expression.split('.')
  return parts[parts.length - 1]
}

/**
 * Resolve type suffix based on tag name.
 * Reads from config.identifier.tagSuffixMap (merged with defaults in resolve.js).
 */
function resolveTypeSuffix(tag, config) {
  const normalized = tag.toLowerCase()
  return config.identifier.tagSuffixMap[normalized] || ''
}

/**
 * Extract action name from event handler expression.
 *
 * "handleSave" → "save"
 * "onSubmit" → "submit"
 * "handleDeleteApiKey(row)" → "delete-api-key"
 * "() => emit('cancel')" → null (arrow fn, skip)
 */
function resolveEventIdentifier(events, tag, config) {
  // Priority: @click → @submit → @change → first event
  const priorityEvents = ['click', 'submit', 'change']

  let eventName = null
  let handlerExpr = null

  for (const ev of priorityEvents) {
    if (events[ev]) {
      eventName = ev
      handlerExpr = events[ev]
      break
    }
  }

  if (!handlerExpr) {
    // Use first available event
    const firstKey = Object.keys(events)[0]
    if (firstKey) {
      eventName = firstKey
      handlerExpr = events[firstKey]
    }
  }

  if (!handlerExpr) return null

  // Skip arrow functions and complex expressions
  if (handlerExpr.includes('=>') || handlerExpr.includes(';')) return null

  // Extract function name (strip arguments)
  let fnName = handlerExpr.split('(')[0].trim()

  // Strip handler prefixes (configurable)
  for (const prefix of config.identifier.eventHandlerPrefixes) {
    if (fnName.toLowerCase().startsWith(prefix.toLowerCase()) && fnName.length > prefix.length) {
      fnName = fnName.slice(prefix.length)
      // Lowercase first char after stripping
      fnName = fnName.charAt(0).toLowerCase() + fnName.slice(1)
      break
    }
  }

  const suffix = config.identifier.eventTagSuffixMap[tag.toLowerCase()] || '-action'
  return toKebabCase(fnName) + suffix
}

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}
