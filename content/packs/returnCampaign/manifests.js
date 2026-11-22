// 批次 2：「重返」战役包（参考战役 50/51/52 的遭遇与剧情卡）。
//
// 玩家侧的 50001–50010 / 51001–51010 / 52001–52010 与四个基础弱点已在
// `content/packs/returnPlayer/manifests.js` 注册；本文件只登记各「重返」盒里的
// 非玩家卡（幕/密谋/地点/敌人/诡计/剧情资产/提示卡），供重返战役章节的
// requiredPackIds 与 zone 归属校验使用。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { returnPlayerCards, returnWeaknesses } from '../../../src/deck/return-packs.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

// 玩家侧卡（50001–50010 / 51001–51010 / 52001–52010 与四个基础弱点）已在
// `content/packs/returnPlayer/manifests.js` 登记，本文件不重复收录。
const PLAYER_CARD_CODES = new Set([...returnPlayerCards, ...returnWeaknesses])

const encounterTypes = new Set(['enemy', 'treachery'])

// 遭遇组 id：由 encounterCode 转 camelCase，并去掉变音符号（content/schema 的 ID 只允许 ASCII）。
export function encounterGroupId(encounterCode) {
  const ascii = String(encounterCode || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const parts = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!parts.length) throw new Error(`无法从遭遇组编码生成 ID：${encounterCode}`)
  return parts[0].toLowerCase() + parts.slice(1).map(part => part[0].toUpperCase() + part.slice(1)).join('')
}

function campaignPack({ id, name, packCode, ranges, dependencies }) {
  const catalog = Object.values(ALL_CARDS)
    .filter(card => card.pack === packCode && !PLAYER_CARD_CODES.has(card.code))
    .sort((a, b) => a.code.localeCompare(b.code))
  const encounterGroupIds = [...new Set(catalog
    .filter(card => card.encounterCode)
    .map(card => encounterGroupId(card.encounterCode)))].sort()
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id,
    name,
    contentVersion: '1.0.0',
    minRulesVersion: 'n6.0',
    // 战役包随重返战役一起开放；逐卡行为由章节内容与单卡条目分别验收。
    status: 'playable',
    dependencies,
    cardRanges: ranges.map(range => ({ ...range })),
    cards: catalog.map(card => ({
      code: card.code,
      name: card.nameZh || card.name,
      type: encounterTypes.has(card.type) ? 'encounter' : 'other',
      cataloged: true,
      imageAvailable: Boolean(card.imagesrc),
      rulesImplemented: false,
      deckbuilding: false,
    })),
    encounterGroupIds,
    behaviorIds: [],
  }
}

export const returnCampaignPacks = Object.freeze([
  campaignPack({
    id: 'rtnotzCampaign',
    name: '重返夜之狂热 · 战役内容',
    packCode: 'rtnotz',
    // 50026a/b、50032a/b 为带后缀的双面提示/场景卡。
    ranges: [{ from: '50011', to: '50046' }, { from: '50026a', to: '50032b' }],
    dependencies: ['core', 'notz'],
  }),
  campaignPack({
    id: 'rtdwlCampaign',
    name: '重返敦威治遗产 · 战役内容',
    packCode: 'rtdwl',
    ranges: [{ from: '51012', to: '51072' }, { from: '51026a', to: '51026b' }],
    dependencies: ['core', 'dunwichCampaign'],
  }),
  campaignPack({
    id: 'rtptcCampaign',
    name: '重返卡尔克萨之路 · 战役内容',
    packCode: 'rtptc',
    ranges: [{ from: '52014', to: '52078' }, { from: '52023b', to: '52063b' }],
    dependencies: ['core', 'carcosaCampaign'],
  }),
])
