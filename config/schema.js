const DEFAULT_CONFIG = {
  enabled: true,

  attributes: {
    testId: {
      enabled: true,
      name: 'data-testid',
    },
    component: {
      enabled: false,
      name: 'data-component',
    },
    feature: {
      enabled: false,
      name: 'data-feature',
    },
  },

  namespace: {
    separator: '--',
    prefix: '',
    maxSegments: 4,
    stripPaths: [
      'src/components/',
      'src/views/',
    ],
    stripLayers: [],
    mappings: {},
    libraryPrefixes: [],   // e.g. [{ path: 'packages/ui/src/', prefix: 'ui' }]
  },

  identifier: {
    hashFallback: true,
    generateId: null,
    tagSuffixMap: {},              // user overrides, merged with built-in defaults
    eventTagSuffixMap: {},         // user overrides, merged with built-in defaults
    eventHandlerPrefixes: ['handle', 'on'],
  },

  filter: {
    include: [],
    exclude: [],
    skipTags: [
      'span', 'br', 'hr', 'img', 'svg', 'path',
      'template', 'slot', 'transition', 'keep-alive',
      'teleport',
    ],
    skipPatterns: [],
    excludeComponents: [],         // component names to skip (e.g. ['RouterLink'])
    excludeComponentPatterns: [],  // regex patterns to skip (e.g. [/^Icon/])
    componentMode: 'interactive',  // 'all' = inject on all components, 'interactive' = only with v-model/events/id/name/aria-label
  },

  renderFn: {
    enabled: false,
    paths: [],
  },
}

module.exports = { DEFAULT_CONFIG }
