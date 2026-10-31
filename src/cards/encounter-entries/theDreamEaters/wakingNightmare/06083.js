// 06083 爆发（Outbreak）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：显现 - 进行一次蛛群滋生检定。若你位于寄生地点，把揭示的每个 [tablet] 标记当作 [skull] 结算。
// 读点：条目声明数据（treacheryRule.infestationTest / treatTabletAsSkullAtInfested）；
//   章节 behavior.resolveEncounter 覆盖共享分派时，先读 treacheryRuleFor(code)?.infestationTest 执行
//   behavior.infestationTest(inv.seat, { treatTabletAsSkull: inv 在寄生地点 })，再转发
//   encounterRules.resolveEncounter。
// 为什么不写 encounterResolve：滋生检定的袋机械（06078）在章节 behavior 里，条目拿不到该函数；
//   用数据 + behavior 分派保持「一条规则只实现一次」（06064/06065/06066/06067/06074/06075 共用同一实现）。
export default {
  code: '06083',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    infestationTest: true,
    treatTabletAsSkullAtInfested: true,
  },
}
