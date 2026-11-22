// 60563 远眺 · 事件（2 费，快速，洞察/陷阱）
// 卡面：快速。附属到你所在地点。每个地点仅限 1 张[[陷阱]]。
//       [reaction]一个敌人进入所附属的地点后，横置：调查([intellect]或[agility])，+1 技能值；
//       成功后可弃掉本卡以发现本地点额外 1 个线索（可从任意地点触发）。
// 窗口：敌人进入附属地点由引擎通用窗口 `entersAttachedLocation` 派发。
// 近似：成功后弃卡发现额外线索分支仍缺调查成功回调原语。
const CODE = '60563'

export default {
  code: CODE,
  keepOnPlay: true,
  fast: true,
  // 地点附属在能力层的枚举条件：持有者（可从任意地点触发该反应）。
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
      label: '横置远眺：调查所附属地点（+1，智识或敏捷）',
      cost: { exhaust: true },
      criteria: [({ source, context }) => Boolean(context?.enemy) && context.location === source?.location],
      resolve: ({ inv, source, api }) => {
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat, prompt: '远眺：选择调查技能。',
          options: [{ id: 'intellect', label: '智识' }, { id: 'agility', label: '敏捷' }],
        })
        api.investigate(inv.seat, { locationId: source?.location, addSkill: skill, shroudMod: 0 })
      },
    },
  ],
  modifiers: [],
  note: '「敌人进入地点」已接 entersAttachedLocation 窗口（生成/移动进入均触发）；「成功后弃卡发现额外线索」缺少调查成功回调原语。',
}
