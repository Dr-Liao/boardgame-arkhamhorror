// 06201 幽灵利刃
// 卡面：攻击。本次攻击将你的[willpower]值加入你的技能值。本次攻击前，你可以立即与被攻击敌人
//       交战。本次攻击造成 +1 伤害（如果该敌人非[[精英]]，改为造成 +2 伤害）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：攻击本体走 api.fight（doFight 的 addSkill 字段 = 把该属性值加入本次技能值），
// countsAs: 'fight' 让打出按「攻击」结算（借机攻击判定用同一读点）；目标过滤用
// _shared.js 的 attackableEnemies（与「攻击。」事件同一份冷漠口径）。

import { attackableEnemies } from './_shared.js'

export default {
  code: '06201',
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '你所在地点没有可以攻击的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      label: '攻击：加入意志值，对非精英敌人造成 +2 伤害',
      resolve: ({ state, inv, api }) => {
        const candidates = attackableEnemies(state, inv)
        if (!candidates.length) { api.info('这里没有可以攻击的敌人。'); return }
        const answer = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '06201', seat: inv.seat, prompt: '选择要攻击的敌人。',
          options: candidates.map(item => ({ id: item.id, label: item.name })),
        })
        const enemy = candidates.find(item => item.id === answer) || candidates[0]
        if (!enemy) return
        // 「本次攻击前，你可以立即与被攻击敌人交战。」
        if (enemy.engagedSeat !== inv.seat && enemy.massive !== true) {
          const engage = api.choice({
            kind: 'effect', source: '06201', seat: inv.seat, canSkip: true,
            prompt: `是否立即与「${enemy.name}」交战？`,
            options: [{ id: 'engage', label: '交战' }, { id: 'skip', label: '不交战' }],
          })
          if (engage === 'engage') api.engage(enemy, inv.seat)
        }
        // 「攻击」已由事件打出的行动支付，攻击本体不再耗行动点（noSpend）。
        api.fight(inv.seat, enemy.id, {
          noSpend: true,
          source: '06201',
          skill: 'combat',
          addSkill: 'willpower',
          damageBonus: enemy.elite ? 1 : 2,
        })
      },
    },
  ],
  modifiers: [],
}
