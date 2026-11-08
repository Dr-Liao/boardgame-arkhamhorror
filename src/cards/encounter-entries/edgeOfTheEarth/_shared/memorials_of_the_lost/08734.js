// 08734 埃尔斯沃思的靴子（Ellsworth 的靴子）· 剧情资产 · memorials_of_the_lost
// 卡面：每位调查员仅限 1 张[[鞋子]]。[reaction]你所在地点的最后一个线索被发现后，横置：移动到
//   一个连接地点；或弃掉埃尔斯沃思的靴子来移动到任意一个已揭示地点。
// 读点：clueDiscovered 窗口 + api.moveInvestigator；弃掉自己走 api.discardAsset。
const CODE = '08734'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { memorial: true, footwear: true },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '本地最后一个线索被发现后：横置移动，或弃掉靴子移动到任意已揭示地点',
    criteria: ({ state, inv, source, context }) => context?.lastClue === true && inv?.location === context?.location,
    resolve: ({ state, inv, source, api }) => {
      const here = state.locations.find(loc => loc.id === inv.location)
      const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
      const options = [
        ...destinations.map(id => ({ id: 'move:' + id, label: '移动到「' + (state.locations.find(loc => loc.id === id)?.name || id) + '」' })),
        ...state.locations.filter(loc => loc.id !== inv.location && loc.revealed).map(loc => ({ id: 'discard:' + loc.id, label: '弃掉靴子，移动到「' + (loc.name || loc.id) + '」' })),
        { id: 'skip', label: '不移动' },
      ]
      const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '埃尔斯沃思的靴子：选择去向。', options })
      if (String(pick).startsWith('move:')) api.moveInvestigator(inv.seat, String(pick).slice(5))
      else if (String(pick).startsWith('discard:')) {
        api.discardAsset(inv.seat, source)
        api.moveInvestigator(inv.seat, String(pick).slice(8))
      }
      api.exhaust(source)
    },
  }],
}

