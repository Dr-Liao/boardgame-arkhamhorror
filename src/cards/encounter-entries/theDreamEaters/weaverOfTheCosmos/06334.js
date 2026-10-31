// 06334 蛛网桥梁（议程 1）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：*本密谋的毁灭阈值 +2[per_investigator]。
//       强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。
// 背面：将遭遇弃牌堆洗回遭遇牌库。
// 接线：definition 只留印刷阈值 7；「+2/人」由章节 behavior 在 setup 时按本条目
//   doomPerInvestigator/doomPerInvestigatorAmount 加进 agenda.doomThreshold。
//   「推进时不从地点移除毁灭」由引擎 advanceAgenda 直接读条目字段 doomKeptOnAgendaAdvance。
//   背面「洗回遭遇弃牌堆」由章节 behavior.agendaAdvancing 读 agendaRule.advance.shuffleEncounterDiscard 执行。
export default {
  code: '06334',
  scope: 'agenda',
  implemented: true,
  doomPerInvestigator: true,
  doomPerInvestigatorAmount: 2,
  flags: { doomThresholdPerInvestigator: 2 },
  doomKeptOnAgendaAdvance: 'locations',
  agendaRule: {
    advance: { shuffleEncounterDiscard: true },
  },
}
