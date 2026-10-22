// 04335 瓦卢西亚
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：[action]如果有至少3个[cultist]标记在混乱袋中，或被封印在场上的卡牌上：治愈2点伤害和2点恐惧。直到本局游戏结束，将瓦卢西亚的隐藏值设为0。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 瓦卢西亚（04335）：有 ≥3 个异教徒标记时治愈并令隐藏值归 0（团队每场游戏一次）。

import { sealedSymbolCountInEntry } from '../../_shared.js'

export default {
  code: '04335', scope: 'location',
  modifiers: [{
    target: 'locationShroud',
    amount: ({ state, entity }) => (state.scenarioFlags?.valusiaShroudZero ? -(entity.shroud || 0) : 0),
  }],
  locationRule: {
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags?.valusiaUsed)
      const cultists = sealedSymbolCountInEntry(state, 'cultist')
      moves.push({
        action: 'scenarioAction', rule: 'valusiaRenewal',
        label: '🐍 治愈 2 点伤害和 2 点恐惧，并把瓦卢西亚的隐藏值设为 0（团队每场游戏一次）',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）'
          : cultists >= 3 ? null : `需要混沌袋或封印区里至少有 3 个异教徒标记（当前 ${cultists} 个）`,
        used: used || undefined,
      })
    },
  },
}
