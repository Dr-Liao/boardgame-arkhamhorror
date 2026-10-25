// 05057 安妮特·梅森（Anette Mason · 高阶女祭司）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：反击；强制 - 敌军阶段开始后弃遭遇牌库顶 3 张，
// 把弃掉的女巫敌人生成在她所在地点，否则重整她。生命 4×人数，胜利 2。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 强制能力写在 enemyScript.onEnemyPhaseStart：共享 encounterRules.enemyPhaseStart 会在所有章节派发，
// 因此 05057 在《联合与幻灭》等章节被生成时同样生效（旧实现在 theWitchingHour behavior 里按章硬编码）。
// 结算按卡面原文：只弃遭遇牌库顶 3 张（不足 3 张就弃现有的，不洗回弃牌堆、不继续弃）。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

const ANETTE = '05057'

function isWitchEnemy(code) {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'witch')
}

export default {
  code: ANETTE,
  scope: 'enemy',
  implemented: true,
  // 数值与「反击」由 definition 的印刷数据提供；敌军阶段开始的强制效果见下方 enemyScript。
  enemyRule: { retaliate: true },
  enemyScript: {
    onEnemyPhaseStart(state, enemy, api) {
      if (String(originalOf(enemy)) !== ANETTE) return
      const location = enemy.location
      const discarded = []
      for (let index = 0; index < 3; index++) {
        if (!state.encounterDeck.length) break
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        if (isWitchEnemy(code)) discarded.push(code)
      }
      for (const code of discarded) {
        // 生成的女巫敌人离开遭遇弃牌堆（它们已被「找出并生成」）。
        const index = state.encounterDiscard.lastIndexOf(code)
        if (index >= 0) state.encounterDiscard.splice(index, 1)
        api.spawn?.(code, location)
      }
      if (!discarded.length) {
        enemy.exhausted = false
        api.info?.('🐐 没有弃出女巫敌人：安妮特·梅森重整。')
      } else {
        api.info?.(`🕯️ 安妮特·梅森弃出 ${discarded.length} 个女巫敌人并在「${api.locName?.(location) || location}」生成。`)
      }
    },
  },
}
