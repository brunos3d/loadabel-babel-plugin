import { getImportArg } from '../util'

/**
 *
 * @param {import('@babel/helper-plugin-utils').BabelAPI} api
 * @param {import('../index').LoadabelBabelPluginOptions} options
 * @returns {import('../index').PropertyFactory}
 */
export default function resolveProperty(
  { types: t, template },
  { moduleFederation },
) {
  const templates = {
    federated: template`
      require(ID)
      
      if (require.resolveWeak) {
        return require.resolveWeak(ID)
      }
      
      return eval('require.resolve')(ID)
    `,
    standard: template`
      if (require.resolveWeak) {
        return require.resolveWeak(ID)
      }
      
      return eval('require.resolve')(ID)
    `,
  }

  function getCallValue(callPath) {
    const importArg = getImportArg(callPath)
    if (importArg.isTemplateLiteral()) {
      return t.templateLiteral(
        importArg.node.quasis,
        importArg.node.expressions,
      )
    }
    if (importArg.isBinaryExpression()) {
      return t.BinaryExpression(
        importArg.node.operator,
        importArg.node.left,
        importArg.node.right,
      )
    }
    return t.stringLiteral(importArg.node.value)
  }

  /**
   * @type {import('../index').PropertyFactory}
   */
  const factory = (
    /**
     * @type {import('../index').PropertyFactoryOptions}
     */
    { callPath, funcPath, path },
  ) => {
    const properties = path.get('arguments.1.properties')

    const isFederated =
      moduleFederation ||
      (Array.isArray(properties) &&
        properties.some(
          prop =>
            prop.isObjectProperty() &&
            prop.get('key').isIdentifier({ name: 'federated' }) &&
            prop.get('value').isBooleanLiteral({ value: true }),
        ))

    const targetTemplate = isFederated ? 'federated' : 'standard'

    return t.objectMethod(
      'method',
      t.identifier('resolve'),
      funcPath.node.params,
      t.blockStatement(
        templates[targetTemplate]({ ID: getCallValue(callPath) }),
      ),
    )
  }

  return factory
}
