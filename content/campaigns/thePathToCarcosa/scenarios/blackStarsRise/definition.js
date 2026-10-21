import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

const groups = [
  'black_stars_rise', 'evil_portents', 'byakhee', 'inhabitants_of_carcosa',
  'stranger', 'pentagram', 'ancient_evils',
]
const gathered = encounterCards(groups)
const setAsideEncounterCodes = new Set(['03088', '03300', '03301'])
const definitions = encounterDefinitions([...gathered, ALL_CARDS['03069b']])

export const agendaVariants = {
  tide: stages(['03275', '03276a', '03276b', '03277'], 'agenda')
    .map(card => {
      const stage = card.originalCode === '03275' ? 1 : card.originalCode === '03277' ? 3 : 2
      return { ...card, id: `agenda${stage}a`, stage: `${stage}a` }
    }),
  ritual: stages(['03278', '03279a', '03279b', '03280'], 'agenda')
    .map(card => {
      const stage = card.originalCode === '03278' ? 1 : card.originalCode === '03280' ? 3 : 2
      return { ...card, id: `agenda${stage}c`, stage: `${stage}c` }
    }),
}

export const actVariants = stages(['03281', '03282'], 'act').map(act => ({
  ...act,
  id: act.originalCode === '03281' ? 'act3Below' : 'act3Above',
  stage: '3a',
  reveal: { type: 'campaignRule' },
}))

export const scenario = {
  id: 'blackStarsRise',
  originalCode: '03274',
  name: '卡尔克萨之路 · 黑星升起',
  intro: '暴风雨笼罩圣米歇尔山。通往卡尔克萨的门可能在海面之下，也可能在修道院上空。',
  setup: '随机保留“地底洪流”或“空中漩涡”路线，布置两个彼此独立的密谋牌堆，并从晋升之门开始。',
  startLocation: 'porteDeLAvancee',
  setAsideLocations: ['choeurGothique', 'cloister', 'knightsHall', 'chapelOfStAubert', 'abbeyTower'],
  setAsideEncounterCards: ['03088', '03300', '03300', '03301', '03301', '03281', '03282'],
  locations: {
    porteDeLAvancee: location('porteDeLAvancee', '03283', ['grandRue']),
    grandRue: location('grandRue', '03284', ['porteDeLAvancee', 'outerWall', 'brokenSteps']),
    outerWall: location('outerWall', '03285', ['grandRue', 'northTower', 'brokenSteps']),
    northTower: location('northTower', '03287', ['outerWall', 'brokenSteps']),
    brokenSteps: location('brokenSteps', '03289', ['grandRue', 'outerWall', 'northTower', 'abbeyChurch']),
    abbeyChurch: location('abbeyChurch', '03291',
      ['brokenSteps', 'choeurGothique', 'cloister', 'knightsHall', 'chapelOfStAubert', 'abbeyTower']),
    choeurGothique: location('choeurGothique', '03292', ['abbeyChurch', 'abbeyTower']),
    cloister: location('cloister', '03294', ['abbeyChurch', 'knightsHall']),
    knightsHall: location('knightsHall', '03295', ['abbeyChurch', 'cloister']),
    chapelOfStAubert: location('chapelOfStAubert', '03296', ['abbeyChurch']),
    abbeyTower: location('abbeyTower', '03298', ['abbeyChurch', 'choeurGothique']),
  },
  locationVariants: {
    outerWall: ['03285', '03286'].map(code => location('outerWall', code, ['grandRue', 'northTower', 'brokenSteps'])),
    northTower: ['03287', '03288'].map(code => location('northTower', code, ['outerWall', 'brokenSteps'])),
    brokenSteps: ['03289', '03290'].map(code => location('brokenSteps', code, ['grandRue', 'outerWall', 'northTower', 'abbeyChurch'])),
    choeurGothique: ['03292', '03293'].map(code => location('choeurGothique', code, ['abbeyChurch', 'abbeyTower'])),
    chapelOfStAubert: ['03296', '03297'].map(code => location('chapelOfStAubert', code, ['abbeyChurch'])),
    abbeyTower: ['03298', '03299'].map(code => location('abbeyTower', code, ['abbeyChurch', 'choeurGothique'])),
  },
  acts: actVariants,
  agendas: [
    { ...agendaVariants.tide[0], reveal: { type: 'campaignRule' } },
    { ...agendaVariants.tide[1], reveal: { type: 'campaignRule' } },
    { ...agendaVariants.tide[3], reveal: { type: 'campaignRule' } },
  ],
  // 03275/03276a/03276b 与 03278/03279a/03279b 的 [free]：共同花费线索放毁灭。
  scriptCards: { rules: { hastenAgenda: { card: 'agenda',
    codes: ['03275', '03276a', '03276b', '03278', '03279a', '03279b'] } } },
  ...definitions,
  encounterDeck: encounterDeck(gathered.filter(card => !setAsideEncounterCodes.has(card.code))),
  resolutions: {
    noResolution: '每位调查员均被击败。进入结局3。',
    r1: '你跃入冰冷海水，开启了下方通路。',
    r2: '你跃入空中漩涡，开启了上方通路。',
    r3: '卡尔克萨与现实融为一体，所有调查员发疯。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
