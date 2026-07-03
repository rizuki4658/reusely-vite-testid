import { resolveConfig } from './config/resolve.js'
import { createNodeTransformWithContext } from './adapters/node-transform.js'

export function createTestIdPlugin(options = {}) {
  const config = resolveConfig(options)

  // Mutable context — updated by Vite plugin configResolved
  const context = {
    projectRoot: process.cwd(),
  }

  // Layer 1: nodeTransform
  const nodeTransform = config.enabled
    ? createNodeTransformWithContext(config, context)
    : () => {} // no-op if disabled

  // Layer 2: Vite plugin (for render function components — stub for now)
  const plugin = {
    name: 'reusely-vue-testid',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      context.projectRoot = resolvedConfig.root
    },

    // Layer 2 transform — currently no-op
    transform(code, id) {
      if (!config.enabled || !config.renderFn.enabled) return null
      return null
    },
  }

  return { plugin, nodeTransform }
}
