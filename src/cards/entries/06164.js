// 06164 飘渺灵体
// 卡面：躲避。本次躲避尝试将你的[willpower]值加入你的技能值。
//       如果你检定成功，和其他每个与你交战的敌解除交战，且你视为无形
//       (敌人不能与你交战，你不能攻击敌人也不能对敌人造成伤害)，直到本轮结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「躲避。」= countsAs:'evade'；意志闪避 = api.evade({ addSkill:'willpower' })；
//   · 成功后解除其他交战 = doEvade 的 opts.onSuccess → api.disengageAll；
//   · 「无形」= 持续效果（api.addEffect，duration endOfRound）带攻击、交战、伤害能力限制。
// 无形对普通交战及同地点庞大敌人的虚拟交战一并生效。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06164',
  playCondition: [{
    when: ({ state, inv }) => (state.enemies || []).some(enemy => enemy.engagedSeat === inv.seat),
    message: '没有与你交战的敌人，不能打出「飘渺灵体」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '飘渺灵体：意志躲避；成功后解除所有交战并化为无形',
      countsAs: 'evade',
      resolve: ({ state, inv, api }) => {
        const candidates = (state.enemies || []).filter(enemy => enemy.engagedSeat === inv.seat)
        if (!candidates.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '06164', seat: inv.seat,
          prompt: '选择要躲避的交战敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const foe = candidates.find(enemy => enemy.id === chosenId) || candidates[0]
        api.evade(inv.seat, {
          enemyId: foe.id,
          addSkill: 'willpower',
          onSuccess: () => {
            api.disengageAll(inv.seat)
            api.addEffect({
              duration: 'endOfRound',
              label: '飘渺灵体：无形（不能攻击、交战或伤害敌人，直到本轮结束）',
              sourceCode: '06164',
              modifiers: [{ target: 'capability:fight' }, { target: 'capability:engage' },
                { target: 'capability:dealEnemyDamage' }],
            })
            api.info('💨 你化为无形：解除所有交战，直到本轮结束不能攻击、交战或伤害敌人。')
          },
        })
      },
    },
  ],
  modifiers: [],
}
