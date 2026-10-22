// 03161 精神折磨
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03161', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const monsters = state.scenarioZones.monsters
      if (monsters.length) {
        state.encounterDeck.push(monsters.splice(Math.floor(api.random() * monsters.length), 1)[0])
        api.shuffleEncounterDeck()
      }
      if (!(state.campaign.records.vipsSlain || []).includes('03065')) api.spawn('03065b', 'garden')
    },
  },
}
