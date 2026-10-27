// 03153 灵力风暴
// 卡面：攻击。本次攻击不使用[combat]，改为使用[willpower]。如果你检定成功，本次攻击不造成标准伤害，改为对该敌人所在地点的每个敌人造成2点伤害(所有额外伤害只对被攻击敌人造成)。如果本次攻击期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，对该敌人所在地点的每位调查员造成1点伤害。(FAQ v2.0)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03153 灵力风暴：用意志攻击一名交战敌人（没有交战时攻击同地点的敌人）。
//
// 2026-10-26 修复（借机攻击判定）：卡面「攻击。」是 Fight 行动关键字。旧 played 描述子只用
// resolve 结算，没有声明行动种类/免借机，引擎按普通「打出」行动结算 → 打出时先吃一次借机攻击。
// 补 countsAs:'fight' + noOpportunityAttack（与 05113/05118 同一写法；读点 lifecycle.playFlag →
// dispatch.js 的 playNoAoO，规则见 docs/card-model.md §5b）。
//
// 2026-10-27 修复（白吞卡）：卡面「攻击。」要求结算时必须有一名可攻击的敌人。旧实现直接从
// 「同地点所有敌人」里选目标，选中未交战的冷漠敌人时 api.fight 才拒绝（⛔ 需要先主动交战），
// 但打出的费用/行动已经付掉、事件照样进弃牌堆——玩家看到的就是「牌被吞了」。
// 现在：
//   · playCondition 要求同地点至少有一个可攻击的敌人（未交战的冷漠敌人不算）；
//   · resolve 的目标候选与 playCondition 共用 _shared.js 的 attackableEnemies（冷漠口径见该函数），
//     避免多敌人时选中冷漠敌人白打。
import { attackableEnemies } from './_shared.js'

export default {
  code: '03153',
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '所在地点没有可攻击的敌人（冷漠敌人需要先主动交战，或使用忽略冷漠的攻击）',
  }],
  abilities: [
    {
      kind: 'played', label: '灵力风暴',
      // 卡面「攻击。」= Fight 行动：打出它按攻击行动结算，不引发借机攻击。
      countsAs: 'fight',
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        const candidates = attackableEnemies(state, inv)
        if (!candidates.length) { api.info('这里没有可攻击的敌人。'); return }
        const targetId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'enemy', source: '03153', seat: inv.seat, prompt: '选择灵力风暴攻击的敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const target = candidates.find(enemy => enemy.id === targetId) || candidates[0]
        api.fight(inv.seat, target.id, { skill: 'willpower', stormOfSpirits: true, presentationCardCode: '03153' })
      },
    },
  ],
  modifiers: [

  ],
}
