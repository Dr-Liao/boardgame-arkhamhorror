import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

// M0 catalogue baseline: every 04-cycle card that carries an encounter set is
// campaign content. Linked faces (a/b codes) are resolved through the catalog,
// not declared twice in pack manifests.
const campaignCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && card.encounterCode)
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaCampaign',
  name: '失落的时代 · 战役内容',
  contentVersion: '0.1.0',
  minRulesVersion: 'n4.2',
  status: 'catalog-only',
  dependencies: ['core'],
  description: 'M0 目录基线：原版失落的时代战役卡已按原卡号分区登记，规则尚未实现。',
  cardRanges: [{ from: '04001', to: '04347' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: false,
    deckbuilding: false,
  })),
  encounterGroupIds: [
    'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
    'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
    'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
    'wilds', 'rainforest', 'serpents', 'expedition', 'guardiansOfTime',
    'agentsOfYig', 'poison', 'traps', 'ruins', 'pnakoticBrotherhood', 'venom',
    'flux', 'pillarsOfJudgment', 'knyan', 'sharedHeartOfTheElders',
  ],
  behaviorIds: [],
}
