// 06219 地点「月下洞穴（暗面）」（Caverns Beneath the Moon · Dark Side · [[洞穴]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：强制 - 你调查月下洞穴时技能检定失败后：
// 其隐藏值 -2，直到你回合结束。
//
// 依据 Haskell Location/Cards/.../CavernsBeneathTheMoonDarkSide.hs（SkillTestResult #after whileInvestigating
// #failure → turnModifier ShroudModifier -2）：本章 behavior.afterTest 在转发共享层后，
// 按本条目数据在「调查失败」时 api.setShroudMod(-2)，behavior.turnEnded 在回合结束时还原。
export default {
  code: '06219',
  scope: 'location',
  implemented: true,
  locationRule: {
    shroudPenaltyOnFailedInvestigation: 2,
  },
}
