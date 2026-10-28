// 05016 “我不会再逃了！”
// 卡面：丽塔·杨牌库专用。
// 卡面：快速。只能在你回合期间打出。
// 卡面：你所在地点的所有敌人重整并与你交战。你回合的剩余时间内，每当你躲避一个敌人，
//       你可以不横置该敌人也不与其解除交战，而是改为对其造成1点伤害。(成功躲避的其他所有效果仍然有效。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「改为造成伤害」的读点在引擎的躲避结算里（src/engine/combat.js 读 inv.evadeDamageInsteadRound），
// 卡面只负责把标记设成本回合。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '05016',
  playCondition: [{ when: ownTurn(), message: '只能在你的回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '重整并交战此地点的所有敌人；本回合躲避可以改为造成伤害',
      resolve: ({ inv, state, api }) => {
        const enemies = api.enemiesAt(inv.location)
        for (const enemy of enemies) {
          api.ready(enemy)
          if (enemy.engagedSeat !== inv.seat) api.engage(enemy, inv.seat)
        }
        api.evadeDamageInstead(inv.seat)
        api.info(enemies.length
          ? `${inv.name} 地点的 ${enemies.length} 个敌人重整并与其交战；本回合躲避成功可以改为造成 1 点伤害。`
          : `${inv.name} 地点没有敌人；本回合躲避成功可以改为造成 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
