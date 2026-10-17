import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor,
} from '../../card-data.js'

const groups = [
  'the_unspeakable_oath', 'hasturs_gift', 'inhabitants_of_carcosa',
  'delusions', 'decay', 'agents_of_hastur',
]
const gathered = encounterCards(groups)
const definitions = encounterDefinitions([...gathered, ALL_CARDS['03065b']])

Object.assign(definitions.enemies['03182b'], { elite: true, victory: 1 })
Object.assign(definitions.enemies['03183'], { hunter: true, spawn: 'basementHall' })
Object.assign(definitions.enemies['03065b'], {
  originalCode: '03065b', hunter: true, elite: true, victory: 0,
})

const isEnemyTrait = (card, trait) => card.type === 'enemy' && card.code !== '03182b'
  && (card.traits || []).includes(trait)
const monsterDeck = gathered.filter(card => isEnemyTrait(card, 'Monster')).flatMap(card =>
  Array(card.quantity || 1).fill(card.code))
// The original Chinese card data labels this trait “附身” (Possessed); the
// authoritative Haskell matcher calls the same seven-card pile LunaticsDeck.
const lunaticsDeck = gathered.filter(card => isEnemyTrait(card, 'Possessed')).flatMap(card =>
  Array(card.quantity || 1).fill(card.code))
const sideEnemyCodes = new Set([...monsterDeck, ...lunaticsDeck, '03182b'])
const mainEncounterCards = gathered.filter(card => !sideEnemyCodes.has(card.code))

const actCards = stages(['03163', '03164', '03165', '03166', '03167'], 'act')
const acts = [
  { ...actCards[0], id: 'act1', stage: '1a', objective: { type: 'clues', perInvestigator: 3 } },
  { ...actCards[1], id: 'act2v1', stage: '2a' },
  { ...actCards[2], id: 'act2v2', stage: '2a' },
  { ...actCards[3], id: 'act3', stage: '3a' },
  { ...actCards[4], id: 'act4', stage: '4a' },
].map(act => ({ ...act, reveal: { type: 'campaignRule' } }))

export const scenario = {
  id: 'theUnspeakableOath',
  originalCode: '03159',
  name: '卡尔克萨之路 · 邪秽誓约',
  intro: '你们进入阿卡姆疯人院寻找丹尼尔·契斯特菲尔德，却被锁在病房深处。',
  setup: '随机选择东西病房各一个版本放置入场；将四张病人拘禁室和丹尼尔放在一边。怪物与疯子敌人分别组成场景外牌堆。',
  startLocation: 'westernHall168',
  setAsideLocations: ['danielsCell', 'occupiedCell', 'drearyCell', 'familiarCell'],
  hallPools: {
    west: ['westernHall168', 'westernHall169'],
    east: ['easternHall170', 'easternHall171'],
  },
  locations: {
    westernHall168: location('westernHall168', '03168', ['easternHall170', 'easternHall171', 'messHall', 'yard']),
    westernHall169: location('westernHall169', '03169', ['easternHall170', 'easternHall171', 'messHall', 'yard']),
    easternHall170: location('easternHall170', '03170', ['westernHall168', 'westernHall169', 'infirmary', 'basementHall']),
    easternHall171: location('easternHall171', '03171', ['westernHall168', 'westernHall169', 'infirmary', 'basementHall']),
    kitchen: location('kitchen', '03172', ['messHall']),
    messHall: location('messHall', '03173', ['westernHall168', 'westernHall169', 'kitchen']),
    infirmary: location('infirmary', '03174', ['easternHall170', 'easternHall171']),
    yard: location('yard', '03175', ['westernHall168', 'westernHall169', 'garden']),
    garden: location('garden', '03176', ['yard']),
    basementHall: location('basementHall', '03177', ['easternHall170', 'easternHall171', 'danielsCell', 'occupiedCell', 'drearyCell', 'familiarCell']),
    danielsCell: location('danielsCell', '03178', ['basementHall'], { enterClueCost: 1 }),
    occupiedCell: location('occupiedCell', '03179', ['basementHall'], { enterClueCost: 1 }),
    drearyCell: location('drearyCell', '03180', ['basementHall'], { enterClueCost: 1 }),
    familiarCell: location('familiarCell', '03181', ['basementHall'], { enterClueCost: 1 }),
  },
  acts,
  agendas: stages(['03160', '03161', '03162'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards(['03182a']),
  monsterDeck,
  lunaticsDeck,
  encounterDeck: encounterDeck(mainEncounterCards),
  resolutions: {
    noResolution: '所有调查员均被击败：转至结局 1。',
    r1: '王带走了他的祭品；跳过幕间故事 II，直接进入剧本 V。',
    r2: '调查员逃出疯人院时受到攻击；每位调查员承受 1 点肉体创伤。',
    r3: '调查员逃出了疯人院。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
