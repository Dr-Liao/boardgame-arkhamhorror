// 11624 环形图书馆（群星档案库）· 地点（弃遭遇牌顶时可弃 1 手牌额外弃 2 张；[action] 移动到已揭示[[通道]]地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算；[[通道]]移动未接线。
export default {
  code: '11624',
  scope: 'location',
  implemented: true,
  flags: {"passageway":true,"discardReaction":"extra2"},
  note: "approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算；[[通道]]移动未接线。",
  abilities: [],
}
