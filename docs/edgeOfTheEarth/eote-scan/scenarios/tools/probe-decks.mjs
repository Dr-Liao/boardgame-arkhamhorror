// 检查各章开局遭遇牌库实际内容（code → 张数），用于核对 gather/setAside 展开。
import {
  loadEoteWorld, createHubGame, hubSetup, settleChoices, finishScenario, continueFromResult,
  beginChapter, INVESTIGATOR_CODES,
} from '../../../../../tests/eote-p8-fixture.mjs'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const world = await loadEoteWorld()
const codes = INVESTIGATOR_CODES.slice(0, 2)
const answers = { checkpoint1Choice: 'search', checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore', interlude2Night2: 'ignore', interlude3Night4Choice: 'ignore', interlude1DoorChoice2: 'ignore' }
const storySelect = (choice, state) => {
  const wanted = answers[state.campaign?.flow?.nodeId]
  if (!wanted) return null
  return choice.options.some(option => option.id === wanted) ? wanted : null
}
const priority = ['resolution1', 'victory', 'noResolution']
const keyFor = state => {
  const keys = Object.keys(state.scenario?.resolutions || {})
  for (const key of priority) if (keys.includes(key)) return key
  return keys[0]
}
const state = createHubGame(world, { seats: 2, seed: 'deck-probe', investigatorCodes: codes })
hubSetup(world, state, { investigatorCodes: codes })
const report = {}
for (let chapter = 0; chapter < 10; chapter++) {
  settleChoices(world, state, storySelect)
  const id = state.scenario?.id
  if (!id) break
  const counts = {}
  for (const code of state.encounterDeck || []) counts[code] = (counts[code] || 0) + 1
  const byGroup = {}
  for (const [code, count] of Object.entries(counts)) {
    const group = ALL_CARDS[code]?.encounterCode || '(unknown)'
    byGroup[group] = (byGroup[group] || 0) + count
  }
  report[id] = {
    deckSize: (state.encounterDeck || []).length,
    unique: Object.keys(counts).length,
    byGroup,
    asideAliases: (state.scenarioZones?.setAside || []).length,
    setAsideGroups: Object.fromEntries([...new Set((state.scenarioZones?.setAside || []).map(code => ALL_CARDS[code]?.encounterCode || '(unknown)'))].map(group => [group, (state.scenarioZones?.setAside || []).filter(code => (ALL_CARDS[code]?.encounterCode || '(unknown)') === group).length])),
  }
  if (state.uiState === 'inScenario') finishScenario(world, state, keyFor(state), storySelect)
  if (state.status !== 'playing') break
  continueFromResult(world, state, { upgrades: false, storySelect })
  if (state.status !== 'playing' || state.uiState !== 'scenarioSetup') break
  beginChapter(world, state)
}
console.log(JSON.stringify(report, null, 1))
