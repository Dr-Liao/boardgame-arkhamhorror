// 04334 纳克特
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：[action]如果有至少3个[tablet]标记在混乱袋中，或被封印在场上的卡牌上：发现纳克特所有的线索并抽取等量的卡牌。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 纳克特（04334）：有 ≥3 个石板标记时，发现此地所有线索并抽等量的牌（团队每场游戏一次）。

import { sealedSymbolCountInEntry } from '../../_shared.js'

export default {
  code: '04334', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags?.pnakotusUsed)
      const tablets = sealedSymbolCountInEntry(state, 'tablet')
      moves.push({
        action: 'scenarioAction', rule: 'pnakotusInsight',
        label: '📚 发现纳克特所有的线索并抽取等量的卡牌（团队每场游戏一次）',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）'
          : tablets >= 3 ? null : `需要混沌袋或封印区里至少有 3 个石板标记（当前 ${tablets} 个）`,
        used: used || undefined,
      })
    },
  },
}
