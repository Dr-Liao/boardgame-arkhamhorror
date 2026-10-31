// 06215 地点「月兽之城」（City of the Moon-Beasts · [[月面]]·[[城市]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：X 为所有调查员之中最高的警报等级（隐藏值 X）。
// 强制 - 当一轮结束时：位于月兽之城的每位调查员检定敏捷（2）。检定失败的每位调查员必须将自己的
// 警报等级提高 1 级。
//
// 依据 Haskell Location/Cards/.../CityOfTheMoonBeasts.hs（withXShroud / getMaxAlarmLevel、轮末 agility 检定）：
//   · 隐藏值 = 最高警报等级 → locationRule.shroudModifier（本章 behavior.locationShroudModifier 分派），
//     印刷值 0（数据在 definition 的 extraRules 里覆盖）；
//   · 轮末强制 → locationRule.forced.roundEnd（behavior.roundEnded 分派）。
const ALARM = 'alarmLevel'

export default {
  code: '06215',
  scope: 'location',
  implemented: true,
  locationRule: {
    shroudModifier(state, location, inv, api) {
      // X = 最高警报等级（api.counters.highestOf）。
      return Number(api?.counters?.highestOf?.(ALARM) || 0)
    },
    forced: {
      roundEnd(state, location, api) {
        for (const inv of state.investigators || []) {
          if (inv.defeated || inv.resigned || inv.location !== location.id) continue
          api.test?.(inv.seat, 'agility', 2, result => {
            if (result.success) return
            api.counters.add(inv.seat, ALARM, 1)
            api.info?.(`🏙️ 月兽之城：${inv.name} 敏捷检定失败，警报等级 +1（当前 ${api.counters.get(inv.seat, ALARM)}）。`)
          })
        }
      },
    },
  },
}
