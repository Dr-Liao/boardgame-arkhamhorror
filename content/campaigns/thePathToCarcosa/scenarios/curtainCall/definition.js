import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'

const encounterGroups = [
  'curtain_call', 'evil_portents', 'delusions', 'hauntings',
  'cult_of_the_yellow_sign', 'striking_fear', 'rats',
]
const gathered = encounterCards(encounterGroups)
const deckCards = gathered.filter(card => !['03059', '03060'].includes(card.code))
const definitions = encounterDefinitions([...deckCards, ALL_CARDS['03059'], ALL_CARDS['03060']])
Object.assign(definitions.enemies['03059'], { aloof: true })
Object.assign(definitions.enemies['03060'], {
  massive: true, hunter: true, retaliate: true, prey: 'lowestWillpower',
})

export const scenario = {
  id: 'curtainCall',
  originalCode: '03043',
  name: '卡尔克萨之路 · 谢幕',
  intro: '你被一股看不见的力量摇醒。观众席只剩下几名观众，舞台空无一人，而你很快发现自己正在向一具尸体问话。',
  setup: '收齐“谢幕、邪兆、妄想、如影随形、黄色印记使徒、恐惧打击、老鼠”遭遇组。布置剧院、前厅、楼座与后台；将苍白面具下的男子、皇家密使及六个私密地点放在一边。调查员从剧院开始，萝拉·海耶斯改从后台开始。',
  startLocation: 'theatre',
  setAsideLocations: [
    'lightingBox', 'boxOffice', 'greenRoom',
    'dressingRoom', 'rehearsalRoom', 'trapRoom',
  ],
  locations: {
    theatre: location('theatre', '03049', ['lobby', 'backstage']),
    lobby: location('lobby', '03050', ['theatre', 'balcony', 'lightingBox', 'boxOffice', 'greenRoom']),
    balcony: location('balcony', '03051', ['theatre', 'lobby']),
    backstage: location('backstage', '03052', ['theatre', 'dressingRoom', 'rehearsalRoom', 'trapRoom']),
    lightingBox: location('lightingBox', '03053', ['lobby'], { playCostIncrease: 2 }),
    boxOffice: location('boxOffice', '03054', ['lobby']),
    greenRoom: location('greenRoom', '03055', ['lobby']),
    dressingRoom: location('dressingRoom', '03056', ['backstage']),
    rehearsalRoom: location('rehearsalRoom', '03057', ['backstage']),
    trapRoom: location('trapRoom', '03058', ['backstage']),
  },
  acts: stages(['03046', '03047a', '03047b', '03047c', '03048'], 'act').map(act => ({
    ...act,
    ...(act.originalCode === '03046' ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
    reveal: { type: 'campaignRule' },
  })),
  agendas: stages(['03044', '03045'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '所有调查员均撤退或被击败。记录“陌生人与你接触”，并将苍白面具下的男子加入调查员队长的牌组。获得胜利点经验。',
    r1: '你尝试提醒警方。记录1点确信；若你从售票处偷窃，警方会怀疑你。记录“陌生人与你接触”，追踪陌生人2次，并获得胜利点经验。',
    r2: '你选择不去警察局。记录1点疑惑。记录“陌生人与你接触”，追踪陌生人2次，并获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
