// 09687 逃出异界 · 幕（withoutATrace）
// 推进条件与背面结局由章节 definition 和 behavior 承接。
import { hasTrait } from '../../_shared.js'

const RED_GLOVED_MAN = '09692'

export default {
  code: '09687',
  scope: 'act',
  implemented: true,
  modifiers: [{
    target: 'loses:aloof',
    condition: { when: ({ entity }) => hasTrait(entity, 'Outsider') },
  }],
  abilities: [{
    kind: 'forced', trigger: 'assetDefeated',
    label: '戴红手套的男子被击败时：将其从游戏中移除',
    criteria: ({ context }) => (context?.asset?.originalCode || context?.assetCode) === RED_GLOVED_MAN,
    resolve: ({ context, api }) => api.removeDefeatedAssetFromGame(context),
  }],
}
