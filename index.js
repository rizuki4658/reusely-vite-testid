const { resolveConfig } = require('./config/resolve.js')
const { createNodeTransformWithContext } = require('./adapters/node-transform.js')
const { createRenderFnTransform } = require('./adapters/render-fn-transform.js')

function createTestIdPlugin(options = {}) {
  const config = resolveConfig(options)

  // Mutable context — updated by Vite plugin configResolved
  const context = {
    projectRoot: options.projectRoot || process.cwd(),
  }

  // Layer 1: nodeTransform (template compilation)
  const nodeTransform = config.enabled
    ? createNodeTransformWithContext(config, context)
    : () => {} // no-op if disabled

  // Layer 2: render function transform (h() calls)
  const renderFnTransform = config.enabled && config.renderFn.enabled
    ? createRenderFnTransform(config, context)
    : null

  const plugin = {
    name: 'reusely-vue-testid',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      context.projectRoot = resolvedConfig.root
    },

    transform(code, id) {
      if (!renderFnTransform) return null
      return renderFnTransform(code, id)
    },
  }

  return { plugin, nodeTransform }
}

module.exports = { createTestIdPlugin }
