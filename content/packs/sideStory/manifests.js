// 批次 2：独立支线与调查员挑战卡包（参考资源 side-stories 的 7 个独立发行）。
//
// 每条支线/挑战一个内容包：
//   81001 Curse of the Rougarou · cotr      82001 Carnevale of Horrors · coh
//   84001 Murder at the Excelsior Hotel · hotel
//   90004 Read or Die · rod                 90011 All or Nothing · aon
//   90020 Bad Blood · bad                   90032 By the Book · btb
//
// 玩家侧卡（调查员/签名/专属弱点，如 90001–90003）在上一批次已按调查员套件开放；
// 这里登记该印刷包的全部卡，供支线/挑战章节的 requiredPackIds 与 zone 归属校验使用。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { getAvailability } from '../../../src/deck/availability.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const encounterTypes = new Set(['enemy', 'treachery'])

function packEntry(code) {
  const card = ALL_CARDS[code]
  const availability = getAvailability(code)
  const type = card.type === 'investigator' || card.type === 'asset' || card.type === 'event'
    || card.type === 'skill' ? 'player' : encounterTypes.has(card.type) ? 'encounter' : 'other'
  return {
    code,
    name: card.nameZh || card.name,
    type,
    cataloged: true,
    imageAvailable: Boolean(card.imagesrc),
    rulesImplemented: availability.strictAccepted,
    deckbuilding: type === 'player' && availability.deckbuilding,
  }
}

function storyPack({ id, name, packCode, ranges, dependencies, encounterGroupIds }) {
  const catalog = Object.values(ALL_CARDS)
    .filter(card => card.pack === packCode)
    .sort((a, b) => a.code.localeCompare(b.code))
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id,
    name,
    contentVersion: '1.0.0',
    minRulesVersion: 'n6.0',
    status: 'playable',
    dependencies,
    cardRanges: ranges.map(range => ({ ...range })),
    cards: catalog.map(card => packEntry(card.code)),
    encounterGroupIds: [...encounterGroupIds],
    behaviorIds: [],
  }
}

export const sideStoryPacks = Object.freeze([
  storyPack({
    id: 'cotrCampaign', name: '诅咒的卢加鲁 · 支线内容', packCode: 'cotr',
    ranges: [{ from: '81001', to: '81036' }], dependencies: ['core'],
    encounterGroupIds: ['bayou', 'rougarou'],
  }),
  storyPack({
    id: 'cohCampaign', name: '恐惧狂欢节 · 支线内容', packCode: 'coh',
    ranges: [{ from: '82001', to: '82037' }, { from: '82002b', to: '82017b' }], dependencies: ['core'],
    encounterGroupIds: ['venice'],
  }),
  storyPack({
    id: 'hotelCampaign', name: '精益酒店谋杀案 · 支线内容', packCode: 'hotel',
    ranges: [{ from: '84001', to: '84052' }], dependencies: ['core'],
    encounterGroupIds: ['murderAtTheExcelsiorHotel', 'alienInterference', 'excelsiorManagement',
      'darkRituals', 'vileExperiments', 'sinsOfThePast'],
  }),
  storyPack({
    id: 'rodCampaign', name: 'Read or Die · 挑战内容', packCode: 'rod',
    ranges: [{ from: '90001', to: '90007' }], dependencies: ['core'],
    encounterGroupIds: ['readOrDie'],
  }),
  storyPack({
    id: 'aonCampaign', name: 'All or Nothing · 挑战内容', packCode: 'aon',
    ranges: [{ from: '90008', to: '90016' }], dependencies: ['core'],
    encounterGroupIds: ['allOrNothing'],
  }),
  storyPack({
    id: 'badCampaign', name: 'Bad Blood · 挑战内容', packCode: 'bad',
    ranges: [{ from: '90017', to: '90023' }, { from: '90023b', to: '90023b' }], dependencies: ['core'],
    encounterGroupIds: ['badBlood'],
  }),
  storyPack({
    id: 'btbCampaign', name: 'By the Book · 挑战内容', packCode: 'btb',
    ranges: [{ from: '90024', to: '90036' }, { from: '90033a', to: '90033b' }], dependencies: ['core'],
    encounterGroupIds: ['byTheBook'],
  }),
])
