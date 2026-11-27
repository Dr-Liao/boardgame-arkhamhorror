// 06289 混沌化身（Chaos Incarnate，议程 3，毁灭阈值 5）
// 正面：无卡面文本。
// 背面（A Dream Devoured）：每位调查员被击败，并且发疯。
//
// 行为位置：本文件 agendaRule.onReveal（章节 behavior.agendaReveal 调用）。
// 发疯通过统一退场原语同时处理击败、精神创伤和战役记录。
export default {
  code: '06289',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const investigators = (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      for (const inv of investigators) {
        api.info?.(`💀 混沌化身吞噬了 ${inv.name} 的梦境：${inv.name} 被击败并发疯。`)
        api.driveInsane(inv.seat)
      }
      return true
    },
  },
}
