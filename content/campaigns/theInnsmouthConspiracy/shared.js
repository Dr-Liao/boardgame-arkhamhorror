// 《印斯茅斯暗潮》战役共用身份与目录数据（纯数据模块）。
//
// P7 之前这里导出 `catalogPack()`，用一张宽泛的卡号范围生成三个 catalog-only 内容包。
// P8 生产注册后三个包各自有真实 manifest（content/packs/tic*/manifest.js），本文件
// 只保留「哪些卡属于哪个包/遭遇组」的唯一定义，供包清单、章节装配与审计工具复用。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const CAMPAIGN_ID = 'theInnsmouthConspiracy'
export const chapters = Object.freeze([
  ['thePitOfDespair', '07041', '绝望深坑', 'The Pit of Despair'],
  ['theVanishingOfElinaHarper', '07056', '艾莲娜·哈珀失踪案', 'The Vanishing of Elina Harper'],
  ['inTooDeep', '07123', '深陷危局', 'In Too Deep'],
  ['devilReef', '07163', '魔鬼礁石', 'Devil Reef'],
  ['horrorInHighGear', '07198', '全速恐惧', 'Horror in High Gear'],
  ['aLightInTheFog', '07231', '雾中之光', 'A Light in the Fog'],
  ['theLairOfDagon', '07274', '达贡巢穴', 'The Lair of Dagon'],
  ['intoTheMaelstrom', '07311', '暗潮之下', 'Into the Maelstrom'],
].map(([id, code, name, nameEn]) => Object.freeze({ id, code, name, nameEn,
  encounterCode: ALL_CARDS[code].encounterCode, packCode: ALL_CARDS[code].pack })))
export const INVESTIGATOR_CODES = Object.freeze(['07001', '07002', '07003', '07004', '07005'])
export const CYCLE_CODES = Object.freeze(Object.keys(ALL_CARDS).filter(code => /^07\d{3}[a-z]?$/.test(code)).sort())
const investigators = new Set(INVESTIGATOR_CODES.flatMap(code => [code, ...(ALL_CARDS[code].deckRequirements?.signatureCards || [])]))
export const CARD_PARTITIONS = Object.freeze({
  ticCampaign: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].encounterCode)),
  ticInvestigators: Object.freeze(CYCLE_CODES.filter(code => !ALL_CARDS[code].encounterCode && investigators.has(code))),
  ticPlayer: Object.freeze(CYCLE_CODES.filter(code => !ALL_CARDS[code].encounterCode && !investigators.has(code))),
})
export const ENCOUNTER_GROUPS = Object.freeze([...new Set(CARD_PARTITIONS.ticCampaign.map(code => ALL_CARDS[code].encounterCode))].sort())
// 包清单使用的 camelCase 遭遇组 id（与 content/schema.js 的 `id` 约束一致）。
export const toCamelCase = value => String(value).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
export const ENCOUNTER_GROUP_IDS = Object.freeze(ENCOUNTER_GROUPS.map(toCamelCase))
// 八张剧本参考卡：它们的「实现」就是对应章节的 definition/behavior（没有单卡行为文件）。
export const SCENARIO_REFERENCE_CODES = Object.freeze(chapters.map(chapter => chapter.code))
const symbols = ['skull', 'skull', 'cultist', 'cultist', 'tablet', 'tablet', 'elderthing', 'elderthing', 'autofail', 'eldersign']
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-2', ...symbols]),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', ...symbols]),
  hard: Object.freeze(['0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', ...symbols]),
  expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', ...symbols]),
})
