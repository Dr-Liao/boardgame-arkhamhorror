// 11625 环形图书馆（古代档案库）· 地点（弃遭遇牌顶时受 1 直接恐惧并额外弃 3 张）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算。
export default {
  code: '11625',
  scope: 'location',
  implemented: true,
  flags: {"discardReaction":"horrorExtra3"},
  note: "approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算。",
  abilities: [],
}
