// 06135 祖兰-提克（theSearchForKadath）· 地点（禁闭 / 城市，掩藏，线索1，帷幕4）
// 卡面：掩藏。
// 卡面：强制 - 当一轮结束时：每有一位调查员位于祖兰-提克，增加1张蜂拥卡到「夜色怪群」。
//
// 一卡一文件：规则数据在这里声明；章节 behavior.roundEnded 读取并接线。
export default {
  code: '06135', scope: 'location', implemented: true,
  locationRule: {
    onRoundEnd(state, location, api) {
      const horde = (state.enemies || []).find(enemy => (enemy.originalCode || enemy.code) === '06147'
        && enemy.swarmHostId == null)
      if (!horde) return
      const count = (state.investigators || [])
        .filter(inv => !inv.defeated && !inv.resigned && inv.location === location.id).length
      if (!count) return
      api.swarm?.place?.(horde, count, { source: '06135' })
      api.info?.(`🌑 祖兰-提克：轮末给「夜色怪群」加 ${count} 张蜂拥卡（每个在此的调查员 1 张）。`)
    },
  },
}
