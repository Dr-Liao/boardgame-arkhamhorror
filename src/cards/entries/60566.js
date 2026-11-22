// 60566 守株待兔 · 事件（2 费，快速，战术/陷阱）
// 卡面：快速。附属到你所在地点。每个地点仅限 1 张[[陷阱]]。
//       [reaction]一个敌人进入所附属的地点后，横置：攻击([combat]或[agility])该敌人，+1 技能值。
//       你可以弃掉本卡以使本次攻击造成伤害 +1。
const CODE = '60566'

export default {
  code: CODE,
  keepOnPlay: true,
  fast: true,
  assetRule: { ownerLocationAttachmentAbility: true },
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '附属到你所在地点',
      resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: CODE, ownerSeat: inv.seat }),
    },
    {
      kind: 'reaction',
      trigger: 'entersAttachedLocation',
      label: '横置守株待兔：攻击进入所附属地点的敌人（+1；可弃卡换 +1 伤害）',
      cost: { exhaust: true },
      criteria: [({ source, context }) => Boolean(context?.enemy) && context.location === source?.location],
      resolve: ({ inv, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat, prompt: '守株待兔：选择攻击技能。',
          options: [{ id: 'combat', label: '战斗' }, { id: 'agility', label: '敏捷' }],
        })
        const boost = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '守株待兔：是否弃掉本卡使本次攻击伤害 +1？',
          options: [{ id: 'keep', label: '保留（不额外伤害）' }, { id: 'discard', label: '弃掉本卡：伤害 +1' }],
        })
        api.fight(inv.seat, enemy.id, {
          skill: skill === 'agility' ? 'agility' : 'combat',
          combatBonus: 1,
          damageBonus: boost === 'discard' ? 1 : 0,
        })
        if (boost === 'discard') api.putIntoDiscard(inv.seat, CODE)
      },
    },
  ],
  modifiers: [],
  note: '「敌人进入地点」已接 entersAttachedLocation 窗口（生成/移动进入均触发）；弃卡换 +1 伤害仍在攻击参数中一并结算。',
}
