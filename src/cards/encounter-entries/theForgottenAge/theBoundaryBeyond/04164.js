// 04164 时间坍塌
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04164', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { api.finish('r2') } },
}
