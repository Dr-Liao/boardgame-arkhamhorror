// 02197 他饿了
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02197', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const zones = state.scenarioZones
      if (zones.sacrifices.length >= 2) {
        const index = Math.floor(api.random() * zones.sacrifices.length)
        zones.sacrificed.push(zones.sacrifices.splice(index, 1)[0])
      }
    },
  },
}
