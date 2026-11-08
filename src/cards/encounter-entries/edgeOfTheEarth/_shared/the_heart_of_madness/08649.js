// 08649 伊夸之门（The Gate of Y’quaa）· 地点 · the_heart_of_madness
// 卡面：[action]：将你控制的一个激活的封印放在伊夸之门上。
//   [action]：撤退。你撤退了……（如果你控制着 1 个或更多封印，你保留它们的控制权）。
//   背面：一堵翻滚的瘴气之墙挡住了古老的大门，调查员和敌人不能进入伊夸之门。伊夸之门不能拥有附属。
// 读点：放置封印走 campaign.seals.place（唯一写入口，要求已激活+控制者本人）；撤退走 api.resign；
//   背面「不能进入/不能拥有附属」需要引擎的地点背面进入限制读点（primitive-requests/p7-08649.json）。
const CODE = '08649'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { gate: true, claimedSealsKeptOnResign: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '将你控制的一个激活的封印放到伊夸之门上',
    resolve: ({ state, inv, source, api }) => {
      const held = api.mechanics.eoteCampaign.seals.held(inv.seat).filter(seal => seal.active)
      if (!held.length) {
        api.info('「伊夸之门」：你没有已激活且未放置的封印。')
        return
      }
      const kind = held.length === 1 ? held[0].kind : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择放到伊夸之门上的封印。', options: held.map(seal => ({ id: seal.kind, label: '封印 ' + seal.kind })) })
      if (!held.some(seal => seal.kind === kind)) return
      if (api.mechanics.eoteCampaign.seals.place(kind, { seat: inv.seat, locationId: source.id })) {
        api.info('🔯 「伊夸之门」：封印 ' + kind + ' 被放到大门上。')
      }
    },
  }, {
    kind: 'action', actionKind: 'resign', label: '撤退：离开伊夸之门（保留你控制的封印）',
    resolve: ({ inv, api }) => api.resign(inv.seat),
  }],
  note: '背面「调查员与敌人不能进入、不能拥有附属」需要引擎的地点背面进入限制读点（primitive-requests/p7-08649.json）。',
}

