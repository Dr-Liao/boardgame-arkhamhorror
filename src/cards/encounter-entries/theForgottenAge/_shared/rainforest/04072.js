// 04072 万蛇据点
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：万蛇据点的每个[[蛇族]]敌人得到+1攻击值。
// 卡面：强制 - 在你在万蛇据点调查或探索后，如果你已中毒：受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 万蛇据点（04072）：此处的每个蛇族敌人战斗 +1。
// 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 enemyStatModifier 分支。

import { hasTrait, isPoisonedInvestigator } from '../../../_shared.js'

export default {
  code: '04072',
  name: '万蛇据点',
  scope: 'location',
  text: '此处的每个[[蛇族]]敌人战斗 +1。强制 - 在你在万蛇据点调查或探索后，如果你已中毒：受到 1 点伤害。',
  modifiers: [{
    target: 'enemyFight', amount: 1,
    condition: { when: ({ entity }) => hasTrait(entity, 'Serpent') },
  }],
  // 第 115 轮：调查/探索后的中毒伤害从 theUntamedWilds 的 behavior 分支迁来。
  locationRule: {
    afterExplore({ inv, api }) {
      if (isPoisonedInvestigator(inv)) api.damage(inv.seat, 1)
    },
    afterTest({ inv, result, api }) {
      if (result.source?.label !== '调查' || !isPoisonedInvestigator(inv)) return
      api.damage(inv.seat, 1)
    },
  },
}
