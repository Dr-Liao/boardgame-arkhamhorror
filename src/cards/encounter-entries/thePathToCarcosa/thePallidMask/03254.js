// 03254 狭窄竖井
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 在你将要从狭窄竖井移动到一个未揭示地点时：检定[agility](3)。如果你检定失败，受到1点伤害并取消本次移动的效果。
// 卡面：强制 - 在狭窄竖井揭示时：将地下墓穴牌库顶的1张地下墓穴放置入场，放在狭窄竖井的上方或右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 离开惧怖地窖（03254）时的敏捷（3）检定：失败受到 1 点伤害。

export default {
  code: '03254', scope: 'location',
  locationRule: {
    onLeave: {
      test: { skill: 'agility', difficulty: 3, onlyUnrevealedDestination: true },
      onFail(state, location, api, inv) { api.damage(inv.seat, 1) },
    },
  },
}
