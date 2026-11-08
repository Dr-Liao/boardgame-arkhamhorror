// 七循环《地球边缘》（Edge of the Earth）战役共用身份与目录数据（纯数据模块）。
//
// P0（M0）只登记目录身份：卡号归属、章节身份、混乱袋与遭遇组。卡牌行为、战役流程和
// 关卡数据分别由 P1–P8 交付；本文件不提供任何可执行规则，也不让内容离开 catalog-only。
//
// 口径见 docs/edgeOfTheEarth/README.md §2/§4：
//   · 本循环内容 = 参考卡包 `eoep`（08001–08133，玩家/调查员）与 `eoec`（08501–08738，战役）；
//     连续编号只是首轮候选，最终范围以 cards-data 的 pack 归属为准（P0 scope 账本逐条核对）；
//   · 八章单元来自参考 frontend/src/arkham/data/edgeOfTheEarth.json 与 CampaignSteps.hs；
//     《亡命冰原》III 个部分共用提示卡 08501，《疯狂之心》II 个部分共用 08648；
//   · 24 个遭遇组：8 个只被单章使用（关卡专用目录），16 个跨章/战役级（战役 _shared 目录）；
//   · 混乱袋四档来自参考 Campaigns/EdgeOfTheEarth/Helpers.hs#chaosBagContents（含 [frost]）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const CAMPAIGN_ID = 'edgeOfTheEarth'
export const CYCLE_PACKS = Object.freeze(['eoep', 'eoec'])
// 首轮扫描候选范围（只用于 P0 scope 账本对账；归属以 ALL_CARDS[code].pack 为准）。
export const CANDIDATE_RANGES = Object.freeze([
  Object.freeze({ pack: 'eoep', from: '08001', to: '08133' }),
  Object.freeze({ pack: 'eoec', from: '08501', to: '08738' }),
])

// 八章单元：id 是内容层关卡 id；code 是印刷提示卡（referenceCode）；stepId 是参考实现
// CampaignSteps.hs 的 ScenarioStep 值（拆分篇章用 a/b/c 后缀，卡表中没有这些拆分卡号）。
export const chapters = Object.freeze([
  ['iceAndDeathPart1', '08501', '08501a', '亡命冰原 第 I 部分', 'Ice and Death, Part I', 'part1'],
  ['iceAndDeathPart2', '08501', '08501b', '亡命冰原 第 II 部分', 'Ice and Death, Part II', 'part2'],
  ['iceAndDeathPart3', '08501', '08501c', '亡命冰原 第 III 部分', 'Ice and Death, Part III', 'part3'],
  ['fatalMirage', '08549', '08549', '致命幻景', 'Fatal Mirage', null],
  ['toTheForbiddenPeaks', '08596', '08596', '失落之峰', 'To the Forbidden Peaks', null],
  ['cityOfTheElderThings', '08621', '08621', '古老者之城', 'City of the Elder Things', null],
  ['theHeartOfMadnessPart1', '08648', '08648a', '疯狂之心 第 I 部分', 'The Heart of Madness, Part I', 'part1'],
  ['theHeartOfMadnessPart2', '08648', '08648b', '疯狂之心 第 II 部分', 'The Heart of Madness, Part II', 'part2'],
].map(([id, code, stepId, name, nameEn, part]) => Object.freeze({
  id, code, stepId, name, nameEn, part,
  referenceCode: code,
  encounterCode: ALL_CARDS[code].encounterCode,
  packCode: ALL_CARDS[code].pack,
})))

// 印刷提示卡（混乱符号参考卡）只有 5 张，8 个章节单元共用；供 P3 规则书与 P7 章节反查。
export const SCENARIO_REFERENCE_CODES = Object.freeze([...new Set(chapters.map(chapter => chapter.referenceCode))])

// 五位调查员：丹妮拉·雷耶丝 / 诺曼·威瑟斯 / 蒙特雷·杰克 / 陈丽丽 / 鲍勃·詹金斯。
export const INVESTIGATOR_CODES = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
// 陈丽丽的双面永久演武（08011a/b–08014a/b）：由调查员能力在开局/升级时获得，不在 signatureCards 里，
// 但属于调查员专属依赖，必须归入 eoteInvestigators 分区（否则会被错分到一般玩家卡）。
export const DISCIPLINE_CODES = Object.freeze([
  '08011a', '08011b', '08012a', '08012b', '08013a', '08013b', '08014a', '08014b',
])

// 全循环印刷记录（主卡 + a/b 关联面）。范围以卡包归属为准，不用连续编号猜。
export const CYCLE_CODES = Object.freeze(Object.keys(ALL_CARDS)
  .filter(code => CYCLE_PACKS.includes(ALL_CARDS[code].pack))
  .sort())

// 调查员专属依赖 = 调查员本身 + deckRequirements.signatureCards + 演武双面卡。
const investigatorDependents = new Set(INVESTIGATOR_CODES.flatMap(code => [
  code, ...(ALL_CARDS[code].deckRequirements?.signatureCards || []),
]).concat(DISCIPLINE_CODES))

// 三包无交集分区：战役 266 / 调查员 22 / 一般玩家卡 115（P0 scope 账本门禁逐条复算）。
export const CARD_PARTITIONS = Object.freeze({
  eoteCampaign: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'eoec')),
  eoteInvestigators: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'eoep'
    && investigatorDependents.has(code))),
  eotePlayer: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].pack === 'eoep'
    && !investigatorDependents.has(code))),
})

// 包清单使用的 camelCase 遭遇组 id（与 content/schema.js 的 `id` 约束一致）。
export const toCamelCase = value => String(value).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())

// 24 个遭遇组：卡池 encounterCode 的 camelCase 形式。
export const ENCOUNTER_GROUPS = Object.freeze([...new Set(
  CARD_PARTITIONS.eoteCampaign.map(code => ALL_CARDS[code].encounterCode),
)].sort().map(toCamelCase))

// 只被单一章节单元使用的遭遇组 → 单卡文件落在该章节目录。
export const CHAPTER_ENCOUNTER_GROUPS = Object.freeze({
  iceAndDeathPart1: 'theCrash',
  iceAndDeathPart2: 'lostInTheNight',
  iceAndDeathPart3: 'seepingNightmares',
  fatalMirage: 'fatalMirage',
  toTheForbiddenPeaks: 'toTheForbiddenPeaks',
  cityOfTheElderThings: 'cityOfTheElderThings',
  theHeartOfMadnessPart1: 'theGreatSeal',
  theHeartOfMadnessPart2: 'stirringInTheDeep',
})
// 其余 16 组：跨章复用（iceAndDeath / theHeartOfMadness）或战役级共享
// （expeditionTeam 伙伴、tekelili 忒咳哩-哩牌库、memorialsOfTheLost 纪念逝者）→ 战役 _shared 目录。
export const SHARED_ENCOUNTER_GROUPS = Object.freeze(ENCOUNTER_GROUPS.filter(group =>
  !Object.values(CHAPTER_ENCOUNTER_GROUPS).includes(group)))

// 混乱袋四档：参考 Campaigns/EdgeOfTheEarth/Helpers.hs#chaosBagContents。
// 与 TIC/TDE 不同：易难度没有 [frost]，普通 1 枚、困难 2 枚、专家 3 枚；符号是 skull×2 + cultist + tablet。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '+1', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign']),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'frost',
    'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign']),
  hard: Object.freeze(['0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-4', '-5', 'frost', 'frost',
    'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign']),
  expert: Object.freeze(['0', '-1', '-2', '-2', '-3', '-4', '-4', '-5', '-7', 'frost', 'frost', 'frost',
    'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign']),
})

// P0 目录包：三包都只有身份与收录标记，规则未实现、不可构筑、战役不可启动。
// P5–P8 各包验收后改为 content/packs/<id>/manifest.js 的真实清单（与 TIC/TDE 同一迁移路径）。
export function catalogPack(id, name, cardRanges) {
  const codes = CARD_PARTITIONS[id]
  if (!codes) throw new RangeError(`未知目录包 ${id}`)
  if (!Array.isArray(cardRanges) || !cardRanges.length) throw new TypeError(`目录包 ${id} 缺少 cardRanges`)
  const encounterGroupIds = id === 'eoteCampaign' ? [...ENCOUNTER_GROUPS] : []
  return Object.freeze({
    schemaVersion: 1, id, name, contentVersion: '0.1.0', minRulesVersion: 'n6.0',
    status: 'catalog-only', dependencies: ['core'],
    cardRanges: cardRanges.map(range => Object.freeze({ ...range })),
    cards: codes.map(code => {
      const card = ALL_CARDS[code]
      const type = id === 'eoteCampaign'
        ? (['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other')
        : 'player'
      return Object.freeze({
        code, name: card.nameZh || card.name, type,
        cataloged: true, imageAvailable: !!card.imagesrc, rulesImplemented: false, deckbuilding: false,
      })
    }),
    encounterGroupIds: Object.freeze(encounterGroupIds),
    behaviorIds: Object.freeze([]),
  })
}
