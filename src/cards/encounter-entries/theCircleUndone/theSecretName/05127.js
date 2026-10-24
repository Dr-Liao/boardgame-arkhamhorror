// 05127 阻止仪式（Stopping the Ritual）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：那赫卜不能离开献祭场所；强制 - 被击败时改为治愈/横置/本轮不重整；目标 - 那赫卜无毁灭；背面→结局2。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05127', scope: 'act', implemented: true,
  // 正面强制与目标在 behavior（enemyCanBeDefeated / checkObjectives）；背面的结局 2 在这里。
  actRule: {
    onReveal(state, act, api) {
      api.info?.('⚡ 仪式被阻止：那赫卜消失了。')
      api.finish?.('resolution2')
      return true
    },
  },
}
