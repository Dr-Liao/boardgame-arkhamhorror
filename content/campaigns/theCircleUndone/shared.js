// 万象无终（The Circle Undone）· 战役共享常量（M0 骨架）。
//
// P1 只锁定「范围与来源」：9 章清单、遭遇组、混乱袋、记录键占位。
// 剧情文本、记录语义、关键词与规则书分别属 P9 / P8 / P4；此处不预先声称任何规则已实现。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theCircleUndone'

// 9 章：id 用 camelCase（与既有三循环一致），code 是该章封面/参考卡的原卡号。
// 每章自己的遭遇组 id 与章节 id 相同（机制扫描里 9 个 chapter 组的 camelCase 形式）。
export const chapters = Object.freeze([
  { id: 'disappearanceAtTheTwilightEstate', code: '05043', name: '暮色庄园失踪事件', nameEn: 'Disappearance at the Twilight Estate' },
  { id: 'theWitchingHour', code: '05050', name: '巫异时刻', nameEn: 'The Witching Hour' },
  { id: 'atDeathsDoorstep', code: '05065', name: '死亡门前', nameEn: "At Death's Doorstep" },
  { id: 'theSecretName', code: '05120', name: '隐秘之名', nameEn: 'The Secret Name' },
  { id: 'theWagesOfSin', code: '05161', name: '恶罪报应', nameEn: 'The Wages of Sin' },
  { id: 'forTheGreaterGood', code: '05197', name: '崇高利益', nameEn: 'For the Greater Good' },
  { id: 'unionAndDisillusion', code: '05238', name: '聚合幻灭', nameEn: 'Union and Disillusion' },
  { id: 'inTheClutchesOfChaos', code: '05284', name: '混沌魔掌', nameEn: 'In the Clutches of Chaos' },
  { id: 'beforeTheBlackThrone', code: '05325', name: '黑色王座', nameEn: 'Before the Black Throne' },
])

// 21 个遭遇组：9 个章节组 + 12 个循环共享组（卡包 manifest 登记同一份清单）。
// 12 个循环共享组（机制扫描的 snake_case id 转成包清单要求的 camelCase）。
export const SHARED_ENCOUNTER_GROUP_IDS = Object.freeze([
  'agentsOfAzathoth', 'anettesCoven', 'cityOfSins', 'inexorableFate', 'musicOfTheDamned',
  'realmOfDeath', 'secretsOfTheUniverse', 'silverTwilightLodge', 'spectralPredators',
  'theWatcher', 'trappedSpirits', 'witchcraft',
])

export const ENCOUNTER_GROUP_IDS = Object.freeze([
  ...chapters.map(chapter => chapter.id),
  ...SHARED_ENCOUNTER_GROUP_IDS,
])

// 正式调查员与序章故事调查员（P6/M1 才逐人验收）。
export const INVESTIGATOR_CODES = Object.freeze(['05001', '05002', '05003', '05004', '05005', '05006'])
export const STORY_INVESTIGATOR_CODES = Object.freeze(['05046', '05047', '05048', '05049'])

// 基础混乱袋：参考实现 Campaigns/TheCircleUndone/ChaosBag.hs（13 枚 × 4 难度，skull×2）。
// 逐章临时标记（符号增删）属 P8 的 tcu-chaos.js，不在本文件展开。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-3', 'skull', 'skull', 'autofail', 'eldersign']),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'autofail', 'eldersign']),
  hard: Object.freeze(['0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', 'skull', 'skull', 'autofail', 'eldersign']),
  expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-4', '-6', '-8', 'skull', 'skull', 'autofail', 'eldersign']),
})

// 战役记录键：只登记第 2 步原语已经用到的键（Memento/看守人），其余 60 个键在 P9 随剧情补。
// 类型必须是 boolean | number | string | string[]（content/schema.js 校验）。
export const recordTypes = Object.freeze({
  mementosDiscovered: 'string[]',
  youAreBeingHunted: 'string[]',
  wasTakenByTheWatcher: 'string[]',
  missingPersons: 'string[]',
})

export const recordDefaults = Object.freeze(Object.fromEntries(
  Object.entries(recordTypes).map(([key, type]) => [key, type === 'string[]' ? [] : type === 'number' ? 0 : type === 'boolean' ? false : ''])))

export const CONTENT_VERSION = '0.1.0'
export const MIN_RULES_VERSION = 'n6.0'
export { CONTENT_SCHEMA_VERSION }
