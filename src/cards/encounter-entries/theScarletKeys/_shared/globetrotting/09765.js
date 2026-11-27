// 09765 快捷旅票（Expedited Ticket）· 剧情支援（永久）· globetrotting
// 卡面：永久。启程前往地图上新的目的地时，你可以放逐快捷旅票并在剧本日志中记 1 时间，
//   以旅行到地图上任意一处。
// 战役启程流程读取 expeditedTicket 声明并在同一动作结算旅行、时间与放逐。
const CODE = '09765'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, expeditedTicket: true },
  assetRule: { expeditedTicket: { time: 1, anywhere: true } },
}
