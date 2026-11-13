// 09765 快捷旅票（Expedited Ticket）· 剧情支援（永久）· globetrotting
// 卡面：永久。启程前往地图上新的目的地时，你可以放逐快捷旅票并在剧本日志中记 1 时间，
//   以旅行到地图上任意一处。
// 读点：abilities free（永久卡在场上，玩家窗口可激活；放逐经 ctx.api）；assetRule.expeditedTicket
//   给战役层启程读点；地图旅行本身走 api.tsk.map.useExpeditedTicket（需要世界地图图结构）。
// 近似：条目只负责「放逐 + 记 1 时间的使用记录」；实际旅行必须由战役启程流程传图结构完成
//   （primitive-requests/09765.json）。
const CODE = '09765'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, expeditedTicket: true },
  assetRule: { expeditedTicket: { time: 1, anywhere: true } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '[fast] 启程时放逐快捷旅票：记 1 时间，旅行到地图任意一处',
    resolve: ({ inv, source, api }) => {
      if (api.scenarioFlag?.('tskExpeditedTicketUsed') === true) return false
      api.setScenarioFlag?.('tskExpeditedTicketUsed', true)
      api.setScenarioFlag?.('tskExpeditedTicketSeat', inv.seat)
      if (source?.id) api.moveCard({ id: source.id, from: 'play', to: 'removedFromGame', ownerSeat: inv.seat })
      api.info?.('「快捷旅票」已放逐：在剧本日志记 1 时间；目的地由启程流程用 api.tsk.map.useExpeditedTicket 结算。')
      return true
    },
  }],
  note: 'approximation: 放逐与使用记录已接线（场景旗标 + moveCard removedFromGame）；'
    + '「旅行到地图任意一处」需要战役启程流程传入世界地图图结构（primitive-requests/09765.json）。',
}
