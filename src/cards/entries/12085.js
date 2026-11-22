// 12085 切肉刀（Meat Cleaver）
// 卡面：[action]：攻击([combat])。你本次攻击得到 +2[combat]（如果你剩余神智值不超过 3，改为 +3[combat]）。
//       如果本次攻击击败了敌人，你可以治愈 1 点恐惧。
//       [reaction]在你触发上述[action]能力时，受到 1 点恐惧：本次攻击造成伤害 +1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [action] 武器攻击 = kind:'action' + countsAs:'fight' + target { kind:'enemy' }；
//   · 攻击主流程 = api.fight（战斗加值/伤害加值走 opts.combatBonus/opts.damageBonus）；
//   · 「剩余神智 ≤3」= api.maxSanity(seat) - inv.horror（修正后神智上限 - 恐惧）；
//   · [reaction]「受 1 恐惧换 +1 伤害」= 触发 [action] 时询问后 api.horror + damageBonus
//     （卡面时机本身就在检定前，与描述子同一结算点）；
//   · 「击败敌人后可治愈 1 点恐惧」= api.fight 返回后读 state.enemies（被击败的实例已离场），
//     再走 api.healHorror（applyHorror/healHorror 的统一入口）。

const CODE = '12085'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      label: '攻击：+2[战斗]（剩余神智≤3 时 +3）；可受 1 恐惧换 +1 伤害；击败后可治愈 1 恐惧',
      cost: { action: true },
      resolve: ({ target, inv, api, state }) => {
        const enemy = target?.entity
        if (!enemy) return
        const remainingSanity = (api.maxSanity(inv.seat) ?? inv.sanity ?? 0) - (Number(inv.horror) || 0)
        const combatBonus = remainingSanity <= 3 ? 3 : 2
        let damageBonus = 0
        const answer = api.choice({
          kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '切肉刀：是否受到 1 点恐惧，使本次攻击造成 +1 伤害？',
          options: [{ id: 'skip', label: '不受恐惧' }, { id: 'pay', label: '受 1 点恐惧，伤害 +1' }],
        })
        if (answer === 'pay') {
          api.horror(inv.seat, 1)
          damageBonus = 1
        }
        const result = api.fight(inv.seat, enemy.id, { combatBonus, damageBonus })
        if (!result?.success) return
        if ((state.enemies || []).some(item => item.id === enemy.id)) return
        const heal = api.choice({
          kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '切肉刀：本次攻击击败了敌人。是否治愈 1 点恐惧？',
          options: [{ id: 'skip', label: '不治愈' }, { id: 'heal', label: '治愈 1 点恐惧' }],
        })
        if (heal === 'heal') {
          api.healHorror(inv.seat, 1)
          api.info(`🔪 「切肉刀」：击败敌人，治愈 1 点恐惧。`)
        }
      },
    },
  ],
  modifiers: [],
}
