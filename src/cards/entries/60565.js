// 60565 隐秘藏身处 · 事件（1 费，供给/诡计）
// 卡面：附属到你所在地点。每个地点仅限 1 张。
//       [reaction]在一轮结束时，本地点的每位调查员可以选择一项：抽 1 张卡牌、获得 1 资源、
//       治愈 1 点伤害、或治愈 1 点恐惧。
//       强制 - 一个敌人进入本地点后：弃掉隐秘藏身处。
const CODE = '60565'

export default {
  code: CODE,
  keepOnPlay: true,
  // 轮末选择对同地点所有调查员共享；「敌人进入后弃置」的强制效果对持有者始终可用。
  assetRule: { sharedLocationAbility: true, ownerLocationAttachmentAbility: true },
  abilities: [
    {
      kind: 'played',
      label: '附属到你所在地点',
      resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: CODE, ownerSeat: inv.seat }),
    },
    {
      kind: 'reaction',
      trigger: 'roundEnds',
      label: '轮末：本地点的每位调查员选择抽 1 张 / 获 1 资源 / 治愈 1 伤害或恐惧',
      criteria: [({ state, source }) => (state.investigators || []).some(inv =>
        !inv.defeated && !inv.resigned && inv.location === source?.location)],
      resolve: ({ state, source, api }) => {
        const locationId = source?.location
        for (const inv of state.investigators.filter(item =>
          !item.defeated && !item.resigned && item.location === locationId)) {
          const options = [{ id: 'draw', label: '抽取 1 张卡牌' }, { id: 'resource', label: '获得 1 资源' }]
          if ((inv.damage || 0) > 0) options.push({ id: 'damage', label: '治愈 1 点伤害' })
          if ((inv.horror || 0) > 0) options.push({ id: 'horror', label: '治愈 1 点恐惧' })
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: '隐秘藏身处：选择一项（抽 1 张 / 1 资源 / 治愈 1 伤害或恐惧）。',
            options: [{ id: 'skip', label: '不选择' }, ...options],
          })
          if (answer === 'draw') api.drawCards(inv.seat, 1)
          else if (answer === 'resource') api.gainResources(inv.seat, 1)
          else if (answer === 'damage') api.healDamage(inv.seat, 1)
          else if (answer === 'horror') api.healHorror(inv.seat, 1)
        }
      },
    },
    {
      kind: 'forced',
      trigger: 'entersAttachedLocation',
      label: '强制：敌人进入本地点后弃掉隐秘藏身处',
      criteria: [({ source, context }) => Boolean(context?.enemy) && context.location === source?.location],
      resolve: ({ inv, source, api }) => {
        source ? api.movePlayerAttachment(source, 'discard') : api.putIntoDiscard(inv.seat, CODE)
      },
    },
  ],
  modifiers: [],
  note: '敌人进入附属地点由引擎通用窗口 entersAttachedLocation 真实派发（生成/移动进入均触发）；轮末四选一仍按原实现。',
}
