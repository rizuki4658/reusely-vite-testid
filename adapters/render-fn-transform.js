const { resolveNamespace } = require('../core/namespace-resolver.js')
const { resolveIdentifier } = require('../core/identifier-strategy.js')
const { buildAttributes } = require('../core/attribute-builder.js')
const { INTERACTIVE_TAGS, STRUCTURAL_TAGS } = require('../core/constants.js')

/**
 * Create a Vite transform function for render-function components.
 * Finds h('tagName', { props }) calls and injects data-testid.
 */
function createRenderFnTransform(config, context) {
  return function transformRenderFn(code, id) {
    // Only process .vue files
    if (!id.endsWith('.vue')) return null

    // Check file matches renderFn.paths
    if (!pathMatches(id, config.renderFn.paths, context.projectRoot)) return null

    // Extract <script> block
    const script = extractScriptBlock(code)
    if (!script) return null

    // Quick checks: must import h and have render function
    if (!hasHImport(script.content)) return null

    // Resolve namespace (once per file)
    const namespace = resolveNamespace(id, context.projectRoot, config)

    // Find all h() calls
    const hCalls = findHCalls(script.content)
    if (hCalls.length === 0) return null

    // Process each h() call and collect injections
    const injections = []
    const usedIdentifiers = new Set()

    for (const hCall of hCalls) {
      const args = splitTopLevelArgs(hCall.argsText)
      if (args.length === 0) continue

      // Classify tag — only process string literals
      const tagInfo = classifyTag(args[0].text)
      if (tagInfo.type !== 'string') continue

      const tag = tagInfo.value

      // Skip filtered tags
      if (config.filter.skipTags.includes(tag.toLowerCase())) continue

      // Determine if props object exists (arg2 starts with '{')
      let hasPropsObject = false
      let propsText = null

      if (args.length >= 2 && args[1].text.trimStart().startsWith('{')) {
        hasPropsObject = true
        propsText = args[1].text.trim()
      }

      // Extract props info
      const propsInfo = propsText
        ? extractPropsInfo(propsText)
        : { attrs: {}, events: {}, attrKeys: [], hasTestId: false }

      // Skip if already has data-testid
      if (propsInfo.hasTestId) continue

      // Check targetability (same logic as identifier-strategy)
      const isInteractive = INTERACTIVE_TAGS.has(tag.toLowerCase())
      const isStructuralWithEvent = STRUCTURAL_TAGS.has(tag.toLowerCase()) &&
        Object.keys(propsInfo.events).length > 0

      if (!isInteractive && !isStructuralWithEvent) continue

      // Build nodeData and resolve identifier
      const nodeData = {
        tag,
        tagType: 0, // ELEMENT — string-literal tags are always HTML elements
        attrs: propsInfo.attrs,
        directives: { events: propsInfo.events },
        staticText: [],
        attrKeys: propsInfo.attrKeys,
      }

      const result = resolveIdentifier(nodeData, config)
      if (!result) continue

      // Disambiguate duplicates
      let identifier = result.identifier
      if (usedIdentifiers.has(identifier)) {
        identifier = disambiguate(identifier, usedIdentifiers)
      }
      usedIdentifiers.add(identifier)

      // Build attributes
      const attributes = buildAttributes(namespace, identifier, tag, config)
      if (attributes.length === 0) continue

      // Build injection string
      const propsStr = attributes
        .map(a => `'${a.name}': '${a.value}'`)
        .join(', ')

      // Determine injection position (relative to script.contentStart)
      if (hasPropsObject) {
        // Case A: inject after opening { of props object
        // Find position of arg2's opening { in the original script content
        const arg2Start = hCall.argsStart + args[1].start
        // Find the { within arg2
        const braceOffset = args[1].text.indexOf('{')
        const insertPos = script.contentStart + arg2Start + braceOffset + 1
        injections.push({
          pos: insertPos,
          text: ` ${propsStr},`,
          type: 'insert',
        })
      } else if (args.length >= 2) {
        // Case B: no props, children as 2nd arg — insert new props object before children
        const arg2Start = hCall.argsStart + args[1].start
        const insertPos = script.contentStart + arg2Start
        injections.push({
          pos: insertPos,
          text: `{ ${propsStr} }, `,
          type: 'insert',
        })
      } else {
        // Case C: only tag — insert props before closing paren
        const insertPos = script.contentStart + hCall.closeParenOffset
        injections.push({
          pos: insertPos,
          text: `, { ${propsStr} }`,
          type: 'insert',
        })
      }
    }

    if (injections.length === 0) return null

    // Apply injections in reverse order to preserve positions
    injections.sort((a, b) => b.pos - a.pos)

    let result = code
    for (const inj of injections) {
      result = result.slice(0, inj.pos) + inj.text + result.slice(inj.pos)
    }

    return { code: result, map: null }
  }
}

// --- Internal helpers ---

/**
 * Check if file path matches any of the configured renderFn.paths patterns.
 */
function pathMatches(id, paths, projectRoot) {
  if (!paths || paths.length === 0) return false

  const normalizedId = id.replace(/\\/g, '/')
  const root = (projectRoot || '').replace(/\\/g, '/').replace(/\/$/, '')
  let relativePath = normalizedId
  if (root && normalizedId.startsWith(root)) {
    relativePath = normalizedId.slice(root.length + 1)
  }

  return paths.some(pattern => {
    const normalizedPattern = pattern.replace(/\\/g, '/')
    return relativePath.startsWith(normalizedPattern) ||
           normalizedId.includes(normalizedPattern)
  })
}

/**
 * Extract <script> block content and its offset in the full .vue file.
 * Skips <script setup> blocks.
 */
function extractScriptBlock(code) {
  // Match <script> but NOT <script setup>
  const regex = /<script(?!\s+setup)([^>]*)>([\s\S]*?)<\/script>/
  const match = regex.exec(code)
  if (!match) return null

  const content = match[2]
  const contentStart = match.index + match[0].indexOf(content)

  return { content, contentStart }
}

/**
 * Check if script imports h from 'vue'.
 */
function hasHImport(scriptContent) {
  // Match: import { h } from 'vue'  OR  import { ..., h, ... } from 'vue'
  // Also handle require: const { h } = require('vue')
  return /\b(?:import\s*\{[^}]*\bh\b[^}]*\}\s*from\s*['"]vue['"]|const\s*\{[^}]*\bh\b[^}]*\}\s*=\s*require\s*\(\s*['"]vue['"]\s*\))/.test(scriptContent)
}

/**
 * Find all h() call sites in script content.
 * Returns array of { argsText, argsStart, closeParenOffset }
 */
function findHCalls(scriptContent) {
  const H_CALL = /\bh\s*\(/g
  const results = []
  let match

  while ((match = H_CALL.exec(scriptContent)) !== null) {
    const openParenIdx = scriptContent.indexOf('(', match.index)
    const closeParenIdx = matchBracket(scriptContent, openParenIdx, '(', ')')
    if (closeParenIdx === -1) continue

    const argsStart = openParenIdx + 1
    const argsText = scriptContent.slice(argsStart, closeParenIdx)

    results.push({
      argsText,
      argsStart,
      closeParenOffset: closeParenIdx,
    })
  }

  return results
}

/**
 * Find matching closing bracket, skipping strings and comments.
 * Returns index of closing bracket or -1.
 */
function matchBracket(code, openIdx, openChar, closeChar) {
  let depth = 1
  let i = openIdx + 1

  while (i < code.length && depth > 0) {
    const ch = code[i]

    // Skip string literals
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(code, i)
      continue
    }

    // Skip line comments
    if (ch === '/' && code[i + 1] === '/') {
      const newline = code.indexOf('\n', i)
      i = newline === -1 ? code.length : newline + 1
      continue
    }

    // Skip block comments
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end === -1 ? code.length : end + 2
      continue
    }

    if (ch === openChar) depth++
    if (ch === closeChar) depth--
    i++
  }

  return depth === 0 ? i - 1 : -1
}

/**
 * Skip past a string literal starting at quoteIndex.
 * Handles ', ", and ` (with ${} template expressions).
 * Returns index AFTER the closing quote.
 */
function skipString(code, quoteIndex) {
  const quote = code[quoteIndex]
  let i = quoteIndex + 1

  if (quote === '`') {
    while (i < code.length) {
      if (code[i] === '\\') { i += 2; continue }
      if (code[i] === '`') return i + 1
      if (code[i] === '$' && code[i + 1] === '{') {
        const end = matchBracket(code, i + 1, '{', '}')
        i = end === -1 ? i + 2 : end + 1
        continue
      }
      i++
    }
  } else {
    while (i < code.length) {
      if (code[i] === '\\') { i += 2; continue }
      if (code[i] === quote) return i + 1
      i++
    }
  }

  return i
}

/**
 * Split h() arguments by top-level commas (depth 0).
 * Returns array of { text, start } where start is relative to argsText.
 */
function splitTopLevelArgs(argsText) {
  const args = []
  let depth = 0
  let start = 0
  let i = 0

  while (i < argsText.length) {
    const ch = argsText[i]

    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(argsText, i)
      continue
    }

    // Skip comments
    if (ch === '/' && argsText[i + 1] === '/') {
      const nl = argsText.indexOf('\n', i)
      i = nl === -1 ? argsText.length : nl + 1
      continue
    }
    if (ch === '/' && argsText[i + 1] === '*') {
      const end = argsText.indexOf('*/', i + 2)
      i = end === -1 ? argsText.length : end + 2
      continue
    }

    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') depth--

    if (ch === ',' && depth === 0) {
      args.push({ text: argsText.slice(start, i), start })
      start = i + 1
    }

    i++
  }

  // Last argument
  const last = argsText.slice(start)
  if (last.trim()) {
    args.push({ text: last, start })
  }

  return args
}

/**
 * Classify h() tag argument as string literal or expression.
 */
function classifyTag(tagArg) {
  const trimmed = tagArg.trim()

  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return { type: 'string', value: trimmed.slice(1, -1) }
  }

  return { type: 'expression', value: trimmed }
}

/**
 * Extract semantic information from h() props object text.
 * Only extracts string-literal values and simple method references.
 */
function extractPropsInfo(propsText) {
  const attrs = {}
  const events = {}
  const attrKeys = []
  let hasTestId = false

  // Check for existing data-testid
  if (propsText.includes("'data-testid'") || propsText.includes('"data-testid"')) {
    hasTestId = true
  }

  // Extract static string-valued props: key: 'value' or key: "value"
  // Handles: name: 'email', type: 'checkbox', id: 'my-field', placeholder: 'Search'
  const SEMANTIC_KEYS = ['name', 'id', 'type', 'placeholder', 'aria-label']
  const STATIC_PROP = /(?:['"]([^'"]+)['"]|(\w+))\s*:\s*['"]([^'"]*)['"]/g
  let m
  while ((m = STATIC_PROP.exec(propsText)) !== null) {
    const key = m[1] || m[2]
    const value = m[3]
    if (SEMANTIC_KEYS.includes(key)) {
      attrs[key] = value
      attrKeys.push(key)
    }
  }

  // Extract event handlers: onXxx: this.handlerName or onXxx: handlerName
  // Skip arrow functions: onClick: (e) => ... or onClick: e => ...
  const EVENT = /\bon([A-Z]\w*)\s*:\s*(?:this\.)?(\w+)\s*(?=[,}\n])/g
  while ((m = EVENT.exec(propsText)) !== null) {
    const eventName = m[1].charAt(0).toLowerCase() + m[1].slice(1)
    const handlerName = m[2]
    events[eventName] = handlerName
  }

  return { attrs, events, attrKeys, hasTestId }
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

module.exports = {
  createRenderFnTransform,
  // Exported for testing
  extractScriptBlock,
  hasHImport,
  findHCalls,
  splitTopLevelArgs,
  classifyTag,
  extractPropsInfo,
  pathMatches,
}
