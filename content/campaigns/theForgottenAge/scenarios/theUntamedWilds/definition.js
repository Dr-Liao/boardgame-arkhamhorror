import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup: gather TheUntamedWilds / Rainforest / Serpents / Expedition /
// GuardiansOfTime / Poison / AncientEvils；把 AgentsOfYig 与遗迹地点、伊塔卡、
// 亚历山卓.维拉、4 张中毒放在一边。
const deckGroups = ['rainforest', 'serpents', 'expedition', 'guardians_of_time', 'poison', 'ancientEvils']
const gathered = encounterCards(deckGroups).filter(card => card.code !== '04102')
const setAside = ['04051', '04052', '04102', '04083', '04084', '04085']
  .map(code => ALL_CARDS[code])
const definitions = encounterDefinitions([...gathered, ...setAside])

const locations = {
  expeditionCamp: location('expeditionCamp', '04050', {
    symbol: 'circle', links: ['square', 'diamond', 'moon'],
  }),
  ruinsOfEztli: location('ruinsOfEztli', '04053', {
    symbol: 'hourglass', links: ['triangle', 'heart'],
  }),
  pathOfThorns: location('pathOfThorns', '04069', {
    symbol: 'square', links: ['circle', 'diamond', 'triangle', 'squiggle'],
  }),
  riverCanyon: location('riverCanyon', '04070', {
    symbol: 'diamond', links: ['circle', 'moon', 'heart', 'triangle', 'square'],
  }),
  ropeBridge: location('ropeBridge', '04071', {
    symbol: 'moon', links: ['circle', 'diamond', 'heart', 't'],
  }),
  serpentsHaven: location('serpentsHaven', '04072', {
    symbol: 'triangle', links: ['squiggle', 'square', 'diamond', 'hourglass'],
  }),
  circuitousTrail: location('circuitousTrail', '04073', {
    symbol: 'heart', links: ['hourglass', 'diamond', 'moon', 't'],
  }),
  templeOfTheFang: location('templeOfTheFang', '04074', {
    symbol: 'squiggle', links: ['square', 'triangle', 'equals'],
  }),
  overgrownRuins: location('overgrownRuins', '04075', {
    symbol: 't', links: ['moon', 'heart', 'equals'],
  }),
}
linkSymbolLocations(locations)

export const EXPLORATION_LOCATIONS = [
  'pathOfThorns', 'riverCanyon', 'ropeBridge', 'serpentsHaven', 'circuitousTrail',
]
export const RUINS_LOCATIONS = ['ruinsOfEztli', 'templeOfTheFang', 'overgrownRuins']
export const EXPLORATION_TREACHERIES = {
  lostInTheWilds: '04081',
  overgrowth: '04076',
  snakeBite: '04080',
  lowOnSupplies: '04082',
  arrowsFromTheTrees: '04087',
}

export const scenario = {
  id: 'theUntamedWilds',
  originalCode: '04043',
  name: '失落的时代 · 荒莽密林',
  intro: '你们跟随伊塔卡的脚步深入丛林。地图上的空白比任何标记都多，而这里的每一棵树都像在等你们走错路。',
  setup: '收齐“荒莽密林、雨林、蛇族、远征、守卫者、毒素、远古邪魔”遭遇组；把“伊格的使徒”与三处遗迹地点、伊塔卡、亚历山卓·维拉和 4 张“中毒”放在一边。建立探索牌库（5 处雨林地点 + 5 张远征诡计），从探险营地开始。',
  startLocation: 'expeditionCamp',
  locations,
  setAsideLocations: ['ruinsOfEztli', 'templeOfTheFang', 'overgrownRuins'],
  agentSets: {
    agentsOfYig: ['04083', '04084', '04085'],
  },
  acts: stages(['04046', '04047', '04048', '04049'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(index >= 2 ? {
      objective: { type: 'clues', perInvestigator: index === 2 ? 3 : 2, atLocation: 'ruinsOfEztli' },
    } : {}),
  })),
  agendas: stages(['04044', '04045'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards(['04051']),
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '你们没能找到遗迹。记录“被迫等待更多补给”；若场景尚未推进到第 3 步，记录“伊塔卡饶有兴致地观察”，亚历山卓跟随你们进入遗迹。获得胜利点经验。',
    r1: '你们清出了通往埃兹特里遗迹的道路。记录“通向遗迹的道路已清出”“亚历山卓留在了营地”“你们赢得了伊塔卡的信任”。获得胜利点经验。',
    r2: '你们击退了守卫者，遗迹就在眼前。记录“通向遗迹的道路已清出”，亚历山卓跟随你们进入遗迹，伊塔卡对你们充满戒心。获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
