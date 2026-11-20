// 11627 高空栈道（冲突档案库）· 地点（你在此弃遭遇牌后，最近的重整非[[精英]]敌人移动到本地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算。
export default {
  code: '11627',
  scope: 'location',
  implemented: true,
  flags: {"discardReaction":"enemyMove"},
  note: "approximation：弃牌反应在 behavior.applyArchiveDiscardReactions 内按所在地点结算。",
  abilities: [],
}
