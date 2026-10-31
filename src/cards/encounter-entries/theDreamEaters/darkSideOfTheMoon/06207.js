// 06207 议程 I「无声暗涌」（Silent Stirring）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。正面无文本；背面「抛出钥匙」（Throw Away the Key）：
// 将遭遇弃牌堆混洗入遭遇牌库。每位调查员的警报等级提高 1 级。
//
// 依据 Haskell Agenda/Cards/.../SilentStirring.hs（shuffleEncounterDiscardBackIn + raiseAlarmLevel 全体）：
//   · 洗回 → api.shuffleDiscard（引擎唯一「遭遇弃牌堆洗回遭遇牌库」写入口）；
//   · 警报等级 → api.counters.add(seat, 'alarmLevel', 1)（按调查员的计数器，上限在 setup 里由
//     behavior 用 api.counters.setMax 设为 5；「5 或更高」仍用 >= 判定）。
const ALARM = 'alarmLevel'

export default {
  code: '06207',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      api.shuffleDiscard?.()
      for (const inv of state.investigators || []) api.counters.add(inv.seat, ALARM, 1)
      api.info?.('🔔 「抛出钥匙」：遭遇弃牌堆洗回遭遇牌库；每位调查员的警报等级 +1。')
      return true
    },
  },
}
