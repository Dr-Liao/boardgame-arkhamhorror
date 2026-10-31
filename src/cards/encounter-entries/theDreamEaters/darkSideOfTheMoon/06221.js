// 06221 地点「月下洞穴（亮面）」（Caverns Beneath the Moon · Light Side · [[洞穴]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：强制 - 你调查月下洞穴时技能检定失败后：
// 其隐藏值 -2，直到你回合结束。
//
// 依据 Haskell Location/Cards/.../CavernsBeneathTheMoonLightSide.hs（与暗面同文）：
// 数据 + behavior.afterTest / behavior.turnEnded 结算（同一模板只留一份章节实现，卡只声明数值）。
export default {
  code: '06221',
  scope: 'location',
  implemented: true,
  locationRule: {
    shroudPenaltyOnFailedInvestigation: 2,
  },
}
