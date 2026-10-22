// 03241 亡者帝国
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：每个地点与其相邻的每个地点连接。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03241', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { api.spawn('03241b', state.scenarioFlags.startLocationId) } },
}
