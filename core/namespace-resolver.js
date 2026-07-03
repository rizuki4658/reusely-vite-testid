/**
 * Normalize path: backslash → forward slash, strip projectRoot.
 * Does NOT lowercase — case is preserved for toKebabCase to detect
 * PascalCase boundaries (e.g. DashboardCardItem → dashboard-card-item).
 */
function normalizePath(filePath, projectRoot) {
  let normalized = filePath.replace(/\\/g, '/')
  if (projectRoot) {
    const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
    if (normalized.startsWith(root)) {
      normalized = normalized.slice(root.length + 1)
    }
  }
  return normalized.replace(/\/$/, '')
}

/**
 * PascalCase/camelCase → kebab-case.
 * "BuybackOfferSearch" → "buyback-offer-search"
 * "PayoutMethodForm" → "payout-method-form"
 * "email-template" → "email-template" (sudah kebab)
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

/**
 * Deduplicate: jika segment N+1 dimulai dengan segment N, hanya gunakan N+1.
 *
 * ["buyback", "buyback-offer", "buyback-offer-search"]
 *   → step 1: "buyback-offer" starts with "buyback" → drop "buyback"
 *   → step 2: "buyback-offer-search" starts with "buyback-offer" → drop "buyback-offer"
 *   → result: ["buyback-offer-search"]
 *
 * ["buyback", "tabs"] → tidak deduplicate (tabs tidak start with buyback)
 *   → result: ["buyback", "tabs"] → "buyback-tabs"
 */
function deduplicateSegments(segments) {
  if (segments.length <= 1) return segments

  const result = []
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]
    const next = segments[i + 1]

    if (next && next.startsWith(current + '-')) {
      continue
    }

    if (next && next === current) {
      continue
    }

    result.push(current)
  }

  return result
}


export function resolveNamespace(filename, projectRoot, config) {
  const { stripPaths, stripLayers, maxSegments, mappings, libraryPrefixes } = config.namespace

  // Normalize path (OS-agnostic, case preserved)
  let relativePath = normalizePath(filename, projectRoot)
  const relativePathLower = relativePath.toLowerCase()

  // Check custom mappings first (case-insensitive lookup)
  if (mappings[relativePathLower]) {
    return mappings[relativePathLower]
  }

  // Detect library prefix BEFORE strip — stripPaths will remove the prefix
  let matchedLibraryPrefix = null
  for (const { path, prefix } of libraryPrefixes) {
    if (relativePathLower.startsWith(path.toLowerCase().replace(/\\/g, '/'))) {
      matchedLibraryPrefix = prefix
      break
    }
  }

  // Strip known prefixes (case-insensitive match, preserve original case for remainder)
  for (const prefix of stripPaths) {
    const normalizedPrefix = prefix.toLowerCase().replace(/\\/g, '/')
    if (relativePathLower.startsWith(normalizedPrefix)) {
      relativePath = relativePath.slice(normalizedPrefix.length)
      break
    }
  }

  // Strip .vue extension (case-insensitive)
  relativePath = relativePath.replace(/\.vue$/i, '')

  // Split into segments
  let segments = relativePath.split('/')

  // Strip organizational layers (case-insensitive)
  segments = segments.filter(seg =>
    !stripLayers.some(layer => seg.toLowerCase() === layer.toLowerCase())
  )

  // index.vue — use parent directory name (case-insensitive)
  if (segments.length > 0 && segments[segments.length - 1].toLowerCase() === 'index') {
    segments.pop()
  }

  // PascalCase/camelCase → kebab-case
  segments = segments.map(toKebabCase)

  // Deduplicate redundant prefixes
  segments = deduplicateSegments(segments)

  // Limit segments
  if (segments.length > maxSegments) {
    segments = segments.slice(segments.length - maxSegments)
  }

  // Apply library prefix if matched
  if (matchedLibraryPrefix) {
    return matchedLibraryPrefix + '-' + segments.join('-')
  }

  return segments.join('-')
}
