import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theFeastOfHemlockVale'
export const CAMPAIGN_NAME = '铁杉谷盛宴'
export const CATALOG_STATUS = 'catalog-only'
export const catalogMetadata = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: CATALOG_STATUS,
})

export const investigators = Object.freeze({
  '10001': { signatures: ['10002', '10003'], bonded: [] },
  '10004': { signatures: ['10005', '10008'], bonded: ['10005b', '10006', '10007'] },
  '10009': { signatures: ['10010', '10011'], bonded: [] },
  '10012': { signatures: ['10013', '10014'], bonded: [] },
  '10015': { signatures: ['10017', '10018'], bonded: ['10016a', '10016b'] },
})

// P5（M1 调查员批次）：五位正式调查员与其 15 张专属/绑定依赖。
// 签名卡与专属弱点随调查员牌组强制带入（buildDeck 校验），绑定面不进入牌组、只作依赖。
export const INVESTIGATOR_CODES = Object.freeze(Object.keys(investigators).sort())
export const SIGNATURE_CODES = Object.freeze(Object.values(investigators)
  .flatMap(item => item.signatures).sort())
export const BONDED_CODES = Object.freeze(Object.values(investigators)
  .flatMap(item => item.bonded).sort())
export const DEPENDENCY_CODES = Object.freeze([...SIGNATURE_CODES, ...BONDED_CODES].sort())

// 标记名与引擎同源（小写 `autofail`/`eldersign`/`elderthing`，见 src/engine/tests.js 的
// `token === 'eldersign'` 判定）：早先写成 `elderSign` 时旧印会按未知标记结算（无修正、不触发
// 调查员旧印效果），四档袋因此全部失效——P8 统一成引擎标记名。
export const CHAOS_BAGS = Object.freeze({
  easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', 'skull', 'skull', 'eldersign'],
  standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-3', '-4', 'skull', 'skull', 'eldersign'],
  hard: ['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-5', '-5', '-7', 'skull', 'skull', 'eldersign'],
  expert: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', '-5', '-6', '-7', '-8', 'skull', 'skull', 'eldersign'],
})

// Frontend step IDs can point to a time-card face while the scenario uses 10704 for symbols.
export const chapters = Object.freeze([
  { id: 'welcomeToHemlockVale', stepCode: '10704', referenceCodes: ['10704'], source: 'PreludeWelcomeToHemlockVale', guide: 'base', name: '欢迎来到铁杉谷' },
  { id: 'writtenInRock', stepCode: '10501', referenceCodes: ['10501', '10502'], group: 'written_in_rock', source: 'WrittenInRock', name: '岩间密语' },
  { id: 'hemlockHouse', stepCode: '10523', referenceCodes: ['10523'], group: 'hemlock_house', source: 'HemlockHouse', name: '汉洛克庄园' },
  { id: 'theSilentHeath', stepCode: '10549', referenceCodes: ['10549'], group: 'the_silent_heath', source: 'TheSilentHeath', name: '寂静荒野' },
  { id: 'theLostSister', stepCode: '10569', referenceCodes: ['10569'], group: 'the_lost_sister', source: 'TheLostSister', name: '消失的姐妹' },
  { id: 'theThingInTheDepths', stepCode: '10588', referenceCodes: ['10588'], group: 'the_thing_in_the_depths', source: 'TheThingInTheDepths', name: '深沼之物' },
  { id: 'theTwistedHollow', stepCode: '10605', referenceCodes: ['10605'], group: 'the_twisted_hollow', source: 'TheTwistedHollow', name: '扭曲空洞' },
  { id: 'dawnOfTheSecondDay', stepCode: '10677a', referenceCodes: ['10704'], source: 'PreludeDawnOfTheSecondDay', guide: 'base', name: '第二日黎明' },
  { id: 'theLongestNight', stepCode: '10626', referenceCodes: ['10626'], group: 'the_longest_night', source: 'TheLongestNight', name: '最长一夜' },
  { id: 'dawnOfTheFinalDay', stepCode: '10679a', referenceCodes: ['10704'], source: 'PreludeDawnOfTheFinalDay', guide: 'base', name: '最终日黎明' },
  { id: 'preludeTheFinalEvening', stepCode: '10679b', referenceCodes: ['10704'], source: 'PreludeTheFinalEvening', guide: 'base', name: '最终夜' },
  { id: 'fateOfTheVale', stepCode: '10651', referenceCodes: ['10651'], group: 'fate_of_the_vale', source: 'FateOfTheVale', name: '山谷的命运' },
])

const packCodes = pack => Object.values(ALL_CARDS).filter(card => card.pack === pack).map(card => card.code).sort()
const investigatorCodes = Object.entries(investigators).flatMap(([code, { signatures, bonded }]) => [code, ...signatures, ...bonded]).sort()
const investigatorSet = new Set(investigatorCodes)
export const partitions = Object.freeze({
  fhvCampaign: packCodes('fhvc'),
  fhvInvestigators: investigatorCodes,
  fhvPlayer: packCodes('fhvp').filter(code => !investigatorSet.has(code)),
})
export const encounterGroups = Object.freeze(Object.groupBy(partitions.fhvCampaign, code => ALL_CARDS[code].encounterCode))
export const encounterGroupId = group => group.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

// 本循环全部卡号（含关联面 a/b）；顺序稳定，供关键词复算、规则书卡文直达与审计逐张比对。
export const CYCLE_CODES = Object.freeze([
  ...partitions.fhvCampaign, ...partitions.fhvInvestigators, ...partitions.fhvPlayer,
].sort())
// 各章节桌面的剧本参考卡（去重）：序曲与八章实际使用的提示卡。
export const SCENARIO_REFERENCE_CODES = Object.freeze(
  [...new Set(chapters.flatMap(chapter => chapter.referenceCodes))].sort())

export function catalogPack(id, label, typeFor) {
  const codes = partitions[id]
  const numericCodes = codes.filter(code => code.length === 5)
  const faceCodes = codes.filter(code => code.length === 6)
  return Object.freeze({
    ...catalogMetadata,
    id,
    name: `${CAMPAIGN_NAME} · ${label}`,
    dependencies: ['core'],
    cardRanges: [numericCodes, faceCodes].filter(group => group.length).map(group => ({ from: group[0], to: group.at(-1) })),
    cards: codes.map(code => {
      const card = ALL_CARDS[code]
      return {
        code, name: card.nameZh || card.name, type: typeFor(card), cataloged: true,
        imageAvailable: !!card.imagesrc, rulesImplemented: false, deckbuilding: false,
        ...(Object.hasOwn(investigators, code) ? { investigator: true } : {}),
        ...(id === 'fhvInvestigators' && !Object.hasOwn(investigators, code) ? { dependencyOnly: true } : {}),
      }
    }),
    encounterGroupIds: id === 'fhvCampaign' ? Object.keys(encounterGroups).map(encounterGroupId).sort() : [],
    behaviorIds: [],
  })
}
