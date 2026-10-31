// 06335 曲折道路（议程 2）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：*本密谋的毁灭阈值 +2[per_investigator]。
//       强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。
// 背面：将遭遇弃牌堆洗回遭遇牌库。
// 接线同 06334：阈值加值由章节 behavior 读 doomPerInvestigatorAmount；毁灭保留由引擎
// advanceAgenda 读 doomKeptOnAgendaAdvance；洗回遭遇弃牌堆由 behavior.agendaAdvancing 执行。
export default {
  code: '06335',
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
