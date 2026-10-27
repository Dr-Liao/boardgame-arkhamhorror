// 04033 临时武器
// 卡面：你可以从你的弃牌堆中打出临时武器。如果你这么做，结算效果后将其洗入你的牌库。
// 卡面：攻击。被攻击敌人本次攻击得到-1攻击值。(如果你从弃牌堆中打出了临时武器，本次攻击造成+1伤害。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04033 临时武器：攻击同地点敌人（敌人战斗值 -1）；从弃牌堆打出时 +1 伤害，然后洗回牌库。
//
// 2026-10-27 修复（白吞卡）：「攻击。」事件必须先有一名可攻击的敌人才能结算。旧实现从
// 「同地点所有敌人」里选目标，选中未交战的冷漠敌人时 api.fight 才拒绝，费用/行动已付、
// 牌照样弃置/洗回 → 白吞一张牌。现在用 playCondition 拦住无目标打出，目标候选与打出条件
// 共用 _shared.js 的 attackableEnemies。
import { attackableEnemies } from './_shared.js'

export default {
  code: '04033',
  playableFromDiscard: true,
  shuffleBackAfterPlay: true,
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '所在地点没有可攻击的敌人（冷漠敌人需要先主动交战，或使用忽略冷漠的攻击）',
  }],
  abilities: [
    {
      kind: 'played', label: '临时武器',
      // 卡面「攻击。」= Fight 行动：打出按攻击结算，不引发借机攻击。
      countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04033'
        const targets = attackableEnemies(state, inv)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04033', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.fight(inv.seat, chosen, { enemyFightMod: -1, damageBonus: fromDiscard ? 1 : 0 })
      },
    },
  ],
  modifiers: [

  ],
}
