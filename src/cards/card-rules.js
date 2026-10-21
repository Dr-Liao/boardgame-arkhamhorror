// 卡号级规则数据的读点。
//
// Phase 3（REPORT.md 第 3 批）：这些规则原来是一张张「卡号 → 规则」表，现在全部由
// 卡条目自己声明（entries/<code>.js 或 encounter-abilities.js），本文件只保留读点，
// 不再维护第二份卡号表。引擎仍然只依赖这些函数名，所以迁移不需要改调用点。
//
// 仍未迁移的两类：
//   · 「随机基础弱点 / 古代遗物 / 击退邪恶 / 寻找伊兹 / 丽塔」这些**游戏流程常量**，
//     它们表示「哪张牌」而不是「这张牌的规则」，等第 8 批战役/叙事一起处理；
//   · 旧存档迁移常量，只在 save-migration 里使用。

import { registeredEntry, registeredEntries } from '../engine/ability.js'
import { CARD_ABILITY_ENTRIES } from './card-abilities.js'
import { investigatorRule } from './investigator-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from './encounter-abilities.js'

// 注册表由 engine.js 在模块初始化时填充；本文件可能被独立 import（测试 / 工具），
// 因此保留一份静态条目索引作为回落。两者内容相同，注册表优先。
const STATIC_ENTRIES = [...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES]
const staticEntry = code => STATIC_ENTRIES.find(entry => entry.code === code) || null
const entryOf = code => (code && (registeredEntry(code) || staticEntry(code))) || null
const allEntries = () => {
  const registered = registeredEntries()
  return registered.length ? registered : STATIC_ENTRIES
}

const entryWith = (field, value) => allEntries().find(entry => entry[field] === value) || null

// 调查员卡面规则（第 6 批）：数据在 entries/<code>.js 的 `investigator` 字段。
export { investigatorRule }

// 第 7 批：内容层从 card-data.js 的表改成读条目。
export function hiddenRuleFor(code) {
  return (code && entryOf(code)?.hiddenRule) || null
}

export function threatEffectFor(code) {
  return (code && entryOf(code)?.threatEffect) || null
}

export function enemyRuleFor(code) {
  return (code && entryOf(code)?.enemyRule) || null
}

export function treacheryRuleFor(code) {
  return (code && entryOf(code)?.treacheryRule) || null
}

// 第 7 批：遭遇卡是否已声明「规则已实现」（替代 encounter-rules 的卡号集合）。
export function implementedFor(code) {
  return (code && entryOf(code)?.implemented) === true
}

export function doomPerInvestigatorFor(code) {
  return (code && entryOf(code)?.doomPerInvestigator) === true
}

export function threatActionFor(code) {
  return (code && entryOf(code)?.threatAction) || null
}

export function threatActionByRule(rule) {
  return allEntries().find(entry => entry.threatAction?.rule === rule)?.threatAction || null
}

export function actRuleFor(code) {
  return (code && entryOf(code)?.actRule) || null
}

export function agendaRuleFor(code) {
  return (code && entryOf(code)?.agendaRule) || null
}

export function storyCardCode(role) {
  return entryWith('storyRole', role)?.code || null
}

export function vengeanceWhileFor(code) {
  return (code && entryOf(code)?.vengeanceWhile) || null
}

export function enemyStatRuleFor(code) {
  return (code && entryOf(code)?.enemyStatRule) || null
}

export function enemySpawnRuleFor(code) {
  return (code && entryOf(code)?.enemySpawnRule) || null
}

export function encounterResolveFor(code) {
  return (code && entryOf(code)?.encounterResolve) || null
}

export function encounterResolveCampaignsFor(code) {
  return (code && entryOf(code)?.encounterResolveCampaigns) || []
}

export function enemyScriptFor(code) {
  return (code && entryOf(code)?.enemyScript) || null
}

// 敌人型基础弱点的关键词（01101–01103 的条目级 enemyWeakness）。
export function enemyWeaknessExtra(code) {
  return (code && entryOf(code)?.enemyWeakness) || {}
}

// 「文本被清空」的敌人弱点：按数据标记判断。
export function isTextBlankEnemy(code) {
  return enemyWeaknessExtra(code).blanksInvestigatorText === true
}

// 哪些卡会清空某类特质的卡面文本（02088）。
export function blanksTraits(code) {
  return (code && entryOf(code)?.blanksTraits) || []
}

// 即使没有 reactions 数据也需要前端「有反应提示」的卡。
// 02217 还没有条目文件（行为未实现），暂时保留一个兜底码；补条目时一起删掉。
export function hasExplicitReactionPrompt(code) {
  return entryOf(code)?.explicitReactionPrompt === true || code === '02217'
}

// 造成「中毒」的威胁卡（04102）。
export function isPoisonThreat(code) {
  return entryOf(code)?.poisonThreat === true
}

export function poisonThreatCode() {
  return entryWith('poisonThreat', true)?.code || null
}

// 议程在整理阶段扣减手牌上限（02043）。
export function agendaHandSizePenalty(code) {
  return (code && entryOf(code)?.agendaHandSizePenalty) || 0
}

// 调查某些地点要额外花行动（02050）。
export function investigateExtraActionsFor(code) {
  return (code && entryOf(code)?.investigateExtraActions) || 0
}

// 敌人卡面的特殊规则（双倍负修正 / 远程难度减免 / 只能被某张卡伤害…）。
export function enemyRuleFlags(code) {
  return (code && entryOf(code)?.enemyRule) || {}
}

// 地点离场时，按地点上的计数把对应遭遇卡放回遭遇弃牌堆（奥术屏障 02102 / 忍气吞声 02089）。
// 计数器名由卡条目的 locationCounter 声明；排序保证与旧表的 arcaneBarriers → sordidAndSilent 顺序一致。
export function locationCounterTreacheries(location) {
  return allEntries()
    .filter(entry => entry.locationCounter && (location?.[entry.locationCounter] || 0) > 0)
    .sort((left, right) => left.locationCounter.localeCompare(right.locationCounter))
    .flatMap(entry => Array(location[entry.locationCounter]).fill(entry.code))
}

export function counterTreacheryCode(field) {
  return entryWith('locationCounter', field)?.code || null
}

// 「弱点升级」后的替换卡号（04038 / 04041 / 04042 的条目级 upgradesFrom）。
export function weaknessUpgradeCode(type) {
  return entryWith('upgradesFrom', type)?.code || null
}

// 会在「无人生成地点为空」时翻开探索牌库放地点的幕/议程（04318）。
export function actPlacesLocationForEmptySpawn(code) {
  return entryOf(code)?.placesLocationForEmptySpawn === true
}

// 剧情关键敌人 / 弱点（03059）。
export function pallidMaskCode() {
  return entryWith('pallidMask', true)?.code || null
}

// 这些地点上的「遗物」购买有折扣（04142）。
export function relicDiscountLocation(code) {
  return entryOf(String(code ?? ''))?.relicDiscountLocation === true
}

// 地点被移出游戏时的「默认去向」地点（02320）。
export function relocateDestinationCode() {
  return entryWith('relocateDestination', true)?.code || null
}

// ---------------------------------------------------------------------------
// 游戏流程常量（还不是「这张卡的规则」，第 8 批处理）
// ---------------------------------------------------------------------------
// 剧情资产「古代遗物」的默认卡号（原 engine.js 硬编码 04061）。
export const RELIC_OF_AGES_CODE = storyCardCode('relicOfAges') || '04061'
// 「随机基础弱点」自身的卡号（原 engine.js 硬编码 01000）。
export const RANDOM_BASIC_WEAKNESS_CODE = '01000'
// 两张「附着型」弱点自身的卡号（原 engine.js 硬编码）。
export const SMITE_THE_WICKED_CODE = storyCardCode('smiteTheWicked') || '02007'
export const SEARCHING_FOR_IZZIE_CODE = storyCardCode('searchingForIzzie') || '02011'
// 结局时加入战役牌组的剧情盟友（丽塔·钱德勒，原 engine.js 硬编码 01117）。
export const LITA_CHANDLER_CODE = storyCardCode('lita') || '01117'

// ---------------------------------------------------------------------------
// 旧存档迁移常量（只在 save-migration 里使用）
// ---------------------------------------------------------------------------
// 「回响」议程的毁灭阈值按调查员人数计。
export const LEGACY_AGENDA_DOOM_PER_INVESTIGATOR = Object.freeze({
  '03121': 2,
  '03122': 2,
  '03123': 3,
})
// 「束身衣」旧存档里被放在支援区，迁移时换到威胁区并补上不可离场与弃置费用。
export const LEGACY_STRAITJACKET_CODE = '03185'
// 「战斗或逃跑」旧存档的裸字段折算成持久效果时，用它的卡号做 sourceCode。
export const LEGACY_FIGHT_OR_FLIGHT_CODE = '03155'
