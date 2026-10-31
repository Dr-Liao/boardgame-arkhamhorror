// 06222 地点「月之亮面」（Light Side of the Moon · [[月面]]·[[遗迹]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [action]：检定智力（1）或敏捷（1），尝试藏身于废墟之中。你每超过难度 3 点，使你的警报等级降低 1 级。
// （每轮仅限一次成功。）背面：月下洞穴（亮面）上有线索时，你不能进入月之亮面。
//
// 依据 Haskell Location/Cards/.../LightSideOfTheMoon.hs（chooseBeginSkillTest #intellect/#agility、
// PassedThisSkillTestBy n → reduceAlarmLevelBy (n div 3)、每轮一次成功）：
//   · 进入限制 → locationRule.entryErrorBlockedWhileOtherHasClues（behavior.investigatorEntryError 读）；
//   · 行动 → actions/performAction；每轮一次成功用 scenarioFlags 里的轮次记录。
const ALARM = 'alarmLevel'
const LIGHT_SIDE = '06222'
const CAVERNS_LIGHT = '06221'

export default {
  code: LIGHT_SIDE,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryErrorBlockedWhileOtherHasClues: { locationCode: CAVERNS_LIGHT },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      const used = state.scenarioFlags?.lightSideSuccessRound
      if (used === state.round) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshLightSideHide',
        actions: 1,
        label: '🏛️ 月之亮面：检定智力/敏捷（1），每超过难度 3 点使警报等级 -1（每轮仅限一次成功）',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshLightSideHide') return false
      if (state.scenarioFlags?.lightSideSuccessRound === state.round) return false
      const skill = api.choice?.({
        kind: 'skill', source: LIGHT_SIDE, seat: inv.seat,
        prompt: '选择检定技能：智力（1）或敏捷（1）。',
        options: [{ id: 'intellect', label: '智力（1）' }, { id: 'agility', label: '敏捷（1）' }],
      }) === 'agility' ? 'agility' : 'intellect'
      api.test?.(inv.seat, skill, 1, result => {
        if (!result.success) return
        const reduce = Math.floor(Math.max(0, (Number(result.value) || 0) - 1) / 3)
        if (reduce > 0) api.counters.add(inv.seat, ALARM, -reduce)
        api.setScenarioFlag?.('lightSideSuccessRound', state.round)
        api.info?.(`🏛️ 月之亮面：${inv.name} 藏身废墟，警报等级 -${reduce}（本轮已用掉这次成功）。`)
      })
      return true
    },
  },
}
