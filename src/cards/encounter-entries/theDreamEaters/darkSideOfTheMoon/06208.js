// 06208 议程 II「警报响起」（The Alarm Is Raised）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。正面无文本；背面「猫鼠游戏」（Run, Rabbit, Run!）：
// 将遭遇弃牌堆混洗入遭遇牌库。每位调查员的警报等级提高 1 级。
// 检查剧本日志。如果调查员强行进入神庙，阅读下列内容：……但没人来救你。
// 调查员队长查找遭遇牌库和遭遇弃牌堆，找出 1 张土星猫并将其抽取。
//
// 依据 Haskell Agenda/Cards/.../TheAlarmIsRaised.hs（whenHasRecord ... → findAndDrawEncounterCard Cats from Saturn）：
//   · 洗回 / 警报等级同 06207；
//   · 检索「土星猫」：牌库里的先经 api.discardEncounterCard 移到弃牌堆，再用 api.drawEncounterDiscard
//     从弃牌堆移到牌库顶并抽取（不直写 state.encounterDeck / state.encounterDiscard，R1 口径）；
//   · 记录键走 api.campaignRecord（战役记录唯一读点）。
const ALARM = 'alarmLevel'
const CATS_FROM_SATURN = '06228'
const FORCED_TEMPLE_RECORD = 'theInvestigatorsForcedTheirWayIntoTheTemple'

export default {
  code: '06208',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      api.shuffleDiscard?.()
      for (const inv of state.investigators || []) api.counters.add(inv.seat, ALARM, 1)
      api.info?.('🔔 「猫鼠游戏」：遭遇弃牌堆洗回遭遇牌库；每位调查员的警报等级 +1。')
      if (!api.campaignRecord?.(FORCED_TEMPLE_RECORD)) {
        api.info?.('……但没人来救你。')
        return true
      }
      const leadSeat = Number(state.campaign?.leadSeat ?? 0)
      if (!(state.encounterDeck || []).includes(CATS_FROM_SATURN)
        && !(state.encounterDiscard || []).includes(CATS_FROM_SATURN)) {
        api.info?.('遭遇牌库与弃牌堆里没有「土星猫」。')
        return true
      }
      // 牌库 → 弃牌堆（唯一入口），再从弃牌堆取出并抽取。
      if ((state.encounterDeck || []).includes(CATS_FROM_SATURN)) api.discardEncounterCard?.(CATS_FROM_SATURN)
      const index = (state.encounterDiscard || []).lastIndexOf(CATS_FROM_SATURN)
      if (index >= 0) api.drawEncounterDiscard?.(leadSeat, index)
      api.shuffleEncounterDeck?.()
      api.info?.('🐈 队长从遭遇牌库／弃牌堆找出 1 张「土星猫」并抽取。')
      return true
    },
  },
}
