// 06298 缟玛瑙大门（Onyx Gates）
// 卡面：缟玛瑙大门隐藏值 +1[per_investigator]。
//       强制 - 缟玛瑙大门揭示后：检查剧本日志。「卡达斯的证据」旁边每有一次记录，
//       移除缟玛瑙大门上的 1 个线索。
//
// 行为位置：
//   · 隐藏值 +1[per_investigator] → `locationRule.shroudPerInvestigator`，章节 behavior.locationShroudModifier 读；
//   · 揭示后移除线索 → 本文件 locationRule.onReveal（引擎直读地点条目），
//     读取战役记录 evidenceOfKadath（number，P8-CAMPAIGN-FACTS #23），走 api.removeLocationClues。
export default {
  code: '06298',
  scope: 'location',
  implemented: true,
  locationRule: {
    shroudPerInvestigator: 1,
    onReveal(state, location, api) {
      const tally = Number(state?.campaign?.records?.evidenceOfKadath || 0)
      if (!(tally > 0)) return
      const removed = api.removeLocationClues?.(location.id, tally)
      api.info?.(`🪨 缟玛瑙大门：剧本日志记录了 ${tally} 份「卡达斯的证据」，移除 ${removed ?? 0} 个线索。`)
    },
  },
}
