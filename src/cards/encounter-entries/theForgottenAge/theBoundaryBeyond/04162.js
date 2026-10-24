// 04162 界限崩坏
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04162', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api, hooks) {
      // 预示者的追击：先看剧本日志里预示者是否还活着。
      const records = hooks.records()
      const alive = records.theHarbingerIsAlive === true || Number(records.theHarbingerIsStillAlive || 0) > 0
      if (alive) hooks.spawnHarbinger()
      else api.info?.('剧本日志里没有「预示者还活着」的记录，这一面没有额外效果。')
    },
  },
}
