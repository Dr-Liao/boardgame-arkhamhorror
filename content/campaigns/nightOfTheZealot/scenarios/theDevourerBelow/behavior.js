export const behavior = Object.freeze({
  id: 'theDevourerBelow',
  includeSurvivingPriest: true,
  setupLocations(state, events, api) {
    return ['mainPath', ...api.shuffle(state.scenario.woodsPool, () => api.randomValue(state)).slice(0, 4)]
  },
  modifyDeck(state, deck, events, api) {
    const keys = Object.keys(state.scenario.agentSets || {})
    if (!keys.length) return deck
    const key = keys[Math.floor(api.randomValue(state) * keys.length)]
    api.info(state, events, `🎲 随机使者组：${key}。`)
    return deck.concat(state.scenario.agentSets[key])
  },
  afterDeckSetup(state, events, api) {
    const escaped = (state.campaign.records.cultistsEscaped || []).length
    const extraDoom = Math.floor((escaped + 1) / 2)
    if (extraDoom > 0) {
      state.doom += extraDoom
      api.info(state, events, `🌑 逃跑的异教徒 ${escaped} 名，密谋上额外放置 ${extraDoom} 点毁灭（当前 ${state.doom}）。`)
    }
  },
  afterMulligan(state, events, api) {
    if (!state.campaign.records.pastMidnight) return
    for (const inv of state.investigators) {
      api.discardRandomFromHand(state, inv, 2)
      api.info(state, events, `${inv.name} 因午夜已至，随机弃掉 2 张起始手牌。`)
    }
  },
  interruptRitualActIndex: 2,
  sacrificeLita: true,
  describe(state) {
    return state.actIndex === 2 ? [`破坏仪式进度：${state.actClues}/${state.numInvestigators * 2}。`] : []
  },
  resolution(state, key, events, api) {
    const { campaign } = state
    const rec = campaign.records
    if (key === 'noResolution') {
      rec.succumbedToUmordhoth = true
      campaign.failed = true
      for (const record of Object.values(campaign.investigators)) record.status = 'killed'
      return { bonus: 0, award: false }
    }
    rec[key === 'r1' ? 'ritualBroken' : key === 'r2' ? 'repelledUmordhoth' : 'sacrificedLita'] = true
    for (const inv of state.investigators) {
      api.addTrauma(state, inv.seat, 'mental', 2, events)
      if (key !== 'r1') api.addTrauma(state, inv.seat, 'physical', 2, events)
      if (key === 'r3') {
        const pool = api.basicWeaknessPool().filter(code => api.ALL_CARDS[code].traits.some(trait => trait.toLowerCase() === 'madness'))
        if (!pool.length) throw new Error('疯狂弱点依赖缺失')
        api.campaignCardChange(campaign, inv.seat, pool[Math.floor(api.randomValue(state) * pool.length)], 'add', 'sacrificedLita')
      }
    }
    return { bonus: key === 'r1' ? 5 : key === 'r2' ? 10 : 0, award: true }
  },
})
