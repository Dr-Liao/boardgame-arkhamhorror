import { ALL_CARDS } from '../../src/cards/cards-data.js'
import { getAvailability } from '../../src/deck/availability.js'
import { CONTENT_SCHEMA_VERSION } from '../schema.js'
import { manifest as fhvCampaign } from './fhvCampaign/manifest.js'
import { manifest as fhvInvestigators } from './fhvInvestigators/manifest.js'
import { manifest as tdcInvestigators } from './tdcInvestigators/manifest.js'
import { manifest as fhvPlayer } from './fhvPlayer/manifest.js'
import { manifest as tdcPlayer } from './tdcPlayer/manifest.js'
import { manifest as tdcCampaign } from './tdcCampaign/manifest.js'
import { returnPlayerPacks } from './returnPlayer/manifests.js'
import { returnCampaignPacks } from './returnCampaign/manifests.js'
import { sideStoryPacks } from './sideStory/manifests.js'

const encounterTypes = new Set(['enemy', 'treachery'])
const playerTypes = new Set(['investigator', 'asset', 'event', 'skill'])
const allCoreCodes = Object.keys(ALL_CARDS).filter(code => code.startsWith('01')).sort()
// 第 115 轮：卡包范围改成数据（与下面的 cardRanges 同源），不再按卡号分支判断归属。
const CORE_RANGES = Object.freeze([
  { from: '01000', to: '01104' }, { from: '01142', to: '01695' },
])
const NOTZ_RANGES = Object.freeze([
  { from: '01105', to: '01141' }, { from: '01121a', to: '01121b' },
])
const withinRanges = (code, ranges) => ranges.some(({ from, to }) => code >= from && code <= to)
const notzCode = code => withinRanges(code, NOTZ_RANGES)

function cardEntry(code) {
  const card = ALL_CARDS[code]
  const availability = getAvailability(code)
  const type = encounterTypes.has(card.type) ? 'encounter' : playerTypes.has(card.type) ? 'player' : 'other'
  return { code, type, cataloged: true, imageAvailable: !!card.imagesrc,
    rulesImplemented: availability.strictAccepted, deckbuilding: type === 'player' && availability.deckbuilding }
}

export const packs = Object.freeze([
  {
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'core', name: '核心包', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', dependencies: [],
    cardRanges: CORE_RANGES.map(range => ({ ...range })),
    cards: allCoreCodes.filter(code => !notzCode(code)).map(cardEntry),
    encounterGroupIds: ['rats', 'ghouls', 'strikingFear', 'ancientEvils', 'chillingCold',
      'darkCult', 'nightgaunts', 'lockedDoors', 'agentsOfYogSothoth', 'agentsOfHastur', 'pentagram',
      // P7 十循环：TDC 章节复用核心包的 Agents of Cthulhu 组（01181/01182）。声明为可用组，
      // 供 scenario.requiredEncounterGroupIds 的注册期校验；卡牌仍归属 core 包。
      'agentsOfCthulhu'],
    behaviorIds: [],
  },
  {
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'notz', name: '夜之狂热', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', dependencies: ['core'],
    cardRanges: NOTZ_RANGES.map(range => ({ ...range })),
    cards: allCoreCodes.filter(notzCode).map(cardEntry),
    encounterGroupIds: ['theGathering', 'theMidnightMasks', 'theDevourerBelow',
      // P7 十循环：TDC 的终章/序章复用《午夜假面》的 Arkham 地点组（01124–01136）。
      'arkham'], behaviorIds: [],
  },
  fhvCampaign, fhvInvestigators, fhvPlayer, tdcCampaign, tdcInvestigators, tdcPlayer,
  ...returnPlayerPacks,
  ...returnCampaignPacks,
  ...sideStoryPacks,
])
