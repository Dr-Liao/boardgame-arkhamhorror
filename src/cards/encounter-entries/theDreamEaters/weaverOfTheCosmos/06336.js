// 06336 现实交织（议程 3）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：*本密谋的毁灭阈值 +2[per_investigator]。背面：（→R2）
// 接线：阈值同 06334/06335；「推进 → 结局 2」由章节 behavior.agendaAdvancing 读
//   agendaRule.advance.finish 调 api.finish('resolution2')（本议程推进即本章结束）。
export default {
  code: '06336',
  scope: 'agenda',
  implemented: true,
  doomPerInvestigator: true,
  doomPerInvestigatorAmount: 2,
  flags: { doomThresholdPerInvestigator: 2 },
  agendaRule: {
    advance: { finish: 'resolution2' },
  },
}
