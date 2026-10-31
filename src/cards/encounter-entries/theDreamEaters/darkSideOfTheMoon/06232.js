// 06232 诡计「月球巡逻」（Lunar Patrol · [[阴谋]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// 显现 - 附属到你所在地点。
// [action]：检定敏捷（3）以避开巡逻。如果你检定成功，弃掉月球巡逻。
// 强制 - 在一位调查员离开附属地点时：该调查员的警报等级提高 1 级。
//
// 依据 Haskell Treachery/Cards/.../LunarPatrol.hs（attachTreachery、OnSameLocation actionAbility、
// Leaves #when You $ locationWithTreachery → raiseAlarmLevel）：
//   · 附属地点 → api.attachToLocation(locationId, { code })，返回 true（不进遭遇弃牌堆）；
//   · [action] 检定 → treacheryRule.locationAction 数据，本章 behavior.actions/performAction 统一提供；
//   · 离开附属地点 → treacheryRule.forcedWhenLeaves 数据，本章 behavior.locationLeft 结算。
const ALARM = 'alarmLevel'
const LUNAR_PATROL = '06232'

export default {
  code: LUNAR_PATROL,
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    locationAttachment: true,
    locationAction: {
      rule: 'tshLoseLunarPatrol',
      label: '[action]：检定敏捷（3），成功弃掉「月球巡逻」',
      skills: ['agility'],
      difficulty: 3,
      actions: 1,
    },
    forcedWhenLeaves: { alarm: 1 },
  },
  encounterResolve(state, inv, treachery, api) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    if (!location) {
      api.info?.('「月球巡逻」：没有可附属的地点，弃掉本卡。')
      return false
    }
    api.attachToLocation?.(location.id, { code: LUNAR_PATROL })
    api.info?.(`🌙 「月球巡逻」附属到「${location.name || location.id}」（离开时警报等级 +1）。`)
    return true
  },
  note: '「离开附属地点时警报等级 +1」由 behavior.locationLeft 读 forcedWhenLeaves 结算；[action] 摆脱由 behavior.actions/performAction 结算（数据在 locationAction）。',
}
