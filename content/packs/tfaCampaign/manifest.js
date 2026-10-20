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
  status: 'playable',
  dependencies: ['core'],
  description: '231 张战役卡按原卡号分区登记；十个剧本的布置、幕议、遭遇与结局规则在 content/campaigns/theForgottenAge 中实现。卡包为 playable：逐张卡面字面核对与浏览器发布验收仍在 audit/tfa-migration.json 的 remaining 清单中跟踪。',
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
  // M3：遭遇组对照表。目录里实际只有 22 个 encounterCode，卡包 ID 用 camelCase
  // 别名登记同一组（wilds ↔ TheUntamedWilds、eztli ↔ theDoomOfEztli、
  // heart_of_the_elders ↔ sharedHeartOfTheElders + Part1/2），剧本的
  // requiredEncounterGroupIds 只引用这里出现过的 ID，注册表会强制校验。
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
