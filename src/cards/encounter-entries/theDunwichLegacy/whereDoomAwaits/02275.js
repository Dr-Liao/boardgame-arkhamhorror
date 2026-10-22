// 02275 呼唤远古之神
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02275', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { api.shuffleDiscard() } },
}
