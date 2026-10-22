// 02064 地下打手
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02064', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const aside = state.scenarioZones.clubAside || []
      const candidates = aside.filter(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
        && ALL_CARDS[code]?.type === 'enemy')
      if (candidates.length) {
        const code = candidates[Math.floor(api.random() * candidates.length)]
        aside.splice(aside.indexOf(code), 1)
        api.spawn(code, 'cloverClubLounge')
      }
      state.encounterDeck.push(...aside.splice(0))
      api.shuffleDiscard()
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === 'laBellaLuna')) {
        inv.location = 'cloverClubLounge'
      }
      for (const enemy of state.enemies.filter(item => item.location === 'laBellaLuna')) enemy.location = 'cloverClubLounge'
      api.remove('laBellaLuna')
    },
  },
}
