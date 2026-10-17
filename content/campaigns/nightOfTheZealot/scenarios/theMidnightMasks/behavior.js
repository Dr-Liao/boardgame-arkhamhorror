export const behavior = Object.freeze({
  id: 'theMidnightMasks',
  includeSurvivingPriest: true,
  spawnOverrides: { ghoulPriest: 'yourHouse' },
  startLocation: state => state.campaign.records.houseBurned ? 'rivertown' : 'yourHouse',
  setupLocations(state, events, api) {
    for (const [id, variants] of Object.entries(state.scenario.locationVariants || {})) {
      if (!variants.length) continue
      state.locationVariants[id] = variants[Math.floor(api.randomValue(state) * variants.length)]
      api.info(state, events, `🎲 「${id}」随机变体：${state.locationVariants[id].name}。`)
    }
    return Object.keys(state.scenario.locations).filter(id => id !== 'yourHouse' || !state.campaign.records.houseBurned)
  },
  setupEnemies(state, events, api) {
    const spots = ['southside', 'downtown', 'graveyard']
    for (let i = 0; i < state.numInvestigators - 1 && i < spots.length; i++) {
      const enemy = api.spawnEnemy(state, 'acolyte', spots[i], null)
      if (enemy) api.info(state, events, `👹 「${enemy.name}」生成于「${api.locName(state, spots[i])}」。`)
    }
  },
  modifyDeck(state, deck, events, api) {
    for (const enemy of state.enemies) {
      if (!api.removeCardByCode(deck, enemy.code)) throw new Error(`开局敌人不在遭遇牌组中：${enemy.code}`)
    }
    return deck
  },
  drawCultistActIndex: 0,
  describe(state) {
    return [`已盘问异教徒：${state.cultistsInVictory.length}/6；异教徒牌堆剩余：${state.cultistDeck.length}。`]
  },
  resolution(state, key, events, api) {
    const rec = state.campaign.records
    rec.cultistsInterrogated = [...state.cultistsInVictory].map(api.originalCardCode)
    const all = [...state.scenario.cultistDeck, 'theMaskedHunter'].map(api.originalCardCode)
    rec.cultistsEscaped = all.filter(code => !rec.cultistsInterrogated.includes(code))
    if ((state.victoryDisplay || []).some(card => card.code === 'ghoulPriest')) rec.ghoulPriestAlive = false
    rec.pastMidnight = key === 'r2'
    return { bonus: 0, award: true }
  },
})
