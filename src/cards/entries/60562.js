// 60562 诱敌陷阱 · 事件（2 费，快速，陷阱/诡计）
// 卡面：快速。附属到你所在地点。每个地点仅限 1 张[[陷阱]]。
//       [reaction]一个敌人进入所附属的地点后，横置：躲避([intellect]或[agility])，+1 技能值；
//       成功后可弃掉本卡以移动到本地点（可从任意地点触发）。
// 窗口：敌人进入附属地点由引擎通用窗口 `entersAttachedLocation` 派发（生成与移动进入都触发）。
// 近似：成功后弃卡移动分支仍缺 evade 成功回调原语。
const CODE = '60562'

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
      label: '横置诱敌陷阱：对进入所附属地点的敌人进行躲避（+1，智识或敏捷）',
      cost: { exhaust: true },
      criteria: [({ source, context }) => Boolean(context?.enemy) && context.location === source?.location],
      resolve: ({ inv, source, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat, prompt: '诱敌陷阱：选择躲避技能。',
          options: [{ id: 'intellect', label: '智识' }, { id: 'agility', label: '敏捷' }],
        })
        api.evade(inv.seat, { enemyId: enemy.id, addSkill: skill, suggestAssetId: source?.id })
      },
    },
  ],
  modifiers: [],
  note: '「敌人进入地点」已接 entersAttachedLocation 窗口（生成/移动进入均触发）；「成功后弃卡移动」缺少 evade 成功回调原语（见 primitive-requests/w6-enter-location-trap-window.json）。',
}
