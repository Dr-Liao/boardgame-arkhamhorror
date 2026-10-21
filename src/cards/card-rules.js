// 卡号级规则数据（原 engine.js 的 WEAKNESS_ENEMY_EXTRA）。
// Phase 5（5a-2）：敌人型基础弱点的关键词属于**卡面数据**，不属于引擎分支；
// 引擎用 enemyWeaknessExtra(code) 读取，code 不再出现在 engine.js 里。
export const ENEMY_WEAKNESS_EXTRA = Object.freeze({
  '01101': Object.freeze({ hunter: true, prey: true, parleyCost: 4 }),
  '01102': Object.freeze({ hunter: true, prey: true, forcedDoom: true }),
  '01103': Object.freeze({ hunter: true, prey: true, blanksInvestigatorText: true }),
})

export function enemyWeaknessExtra(code) {
  return ENEMY_WEAKNESS_EXTRA[code] || {}
}

// 「文本被清空」的敌人弱点：原引擎按卡号判断，现在按数据标记判断。
export function isTextBlankEnemy(code) {
  return ENEMY_WEAKNESS_EXTRA[code]?.blanksInvestigatorText === true
}

// 卡号级规则数据：哪些卡会清空某类特质的卡面文本（原 engine.js 硬编码 02088）。
export const BLANKS_TRAITS = Object.freeze({
  '02088': Object.freeze(['ally']),
})

export function blanksTraits(code) {
  return BLANKS_TRAITS[code] || []
}

// 卡号级规则数据：即使没有 reactions 数据也需要前端「有反应提示」的卡（原 engine.js 数组）。
export const EXPLICIT_REACTION_PROMPT = Object.freeze(['01007', '01071', '01082', '02217'])

export function hasExplicitReactionPrompt(code) {
  return EXPLICIT_REACTION_PROMPT.includes(code)
}

// 卡号级规则数据：造成「中毒」的威胁卡（原 engine.js 硬编码 04102）。
export const POISON_THREAT_CODES = Object.freeze(['04102'])

export function isPoisonThreat(code) {
  return POISON_THREAT_CODES.includes(code)
}

export function poisonThreatCode() {
  return POISON_THREAT_CODES[0]
}

// 卡号级规则数据：议程在整理阶段扣减手牌上限（原 engine.js 硬编码 02043）。
export const AGENDA_HAND_SIZE_PENALTY = Object.freeze({ '02043': 3 })

export function agendaHandSizePenalty(code) {
  return AGENDA_HAND_SIZE_PENALTY[code] || 0
}

// 卡号级规则数据：剧情资产「古代遗物」的默认卡号（原 engine.js 硬编码 04061）。
export const RELIC_OF_AGES_CODE = '04061'

// 卡号级规则数据：「随机基础弱点」自身的卡号（原 engine.js 硬编码 01000）。
export const RANDOM_BASIC_WEAKNESS_CODE = '01000'

// 卡号级规则数据：调查某些地点要额外花行动（原 engine.js 硬编码 02050）。
export const INVESTIGATE_EXTRA_ACTIONS = Object.freeze({ '02050': 1 })

export function investigateExtraActionsFor(code) {
  return INVESTIGATE_EXTRA_ACTIONS[code] || 0
}

// 卡号级规则数据：敌人卡面的特殊规则（原 engine.js 硬编码 01172 / 01177 与对应的 ruleId）。
export const ENEMY_RULE_FLAGS = Object.freeze({
  // 猎手夜魇：负面标记双倍结算。
  '01172': Object.freeze({ doubleNegative: true }),
  huntingNightgaunt: Object.freeze({ doubleNegative: true }),
  // 02094：用远程/枪械/法术武器攻击它时难度 -3。
  '02094': Object.freeze({ rangedAttackDifficultyReduction: 3 }),
  // 02255：只能被 02254（深奥咒文）伤害，普通攻击/攻击行动都对它无效。
  '02255': Object.freeze({ damageOnlyFrom: '02254' }),
  // 03017：与它交战期间不能弃牌。
  '03017': Object.freeze({ locksDiscardWhileEngaged: true }),
  // 02182：与它交战期间不能移动。
  '02182': Object.freeze({ blocksMovementWhileEngaged: true }),
  // 02103：用近战武器攻击它时，武器被摧毁。
  '02103': Object.freeze({ destroysMeleeWeapon: true }),
  // 伊斯观察者：攻击时随机弃 1 张手牌，无手牌则伤害与恐惧各 +1。
  '01177': Object.freeze({ discardRandomOnAttack: true }),
  yithianObserver: Object.freeze({ discardRandomOnAttack: true }),
})

export function enemyRuleFlags(code) {
  return (code && ENEMY_RULE_FLAGS[code]) || {}
}

// 卡号级规则数据：地点离场时，按地点上的计数把对应遭遇卡放回遭遇弃牌堆
// （奥术屏障 02102 / 肮脏而寂静 02089，原 engine.js 硬编码）。
export const LOCATION_COUNTER_TREACHERY = Object.freeze({
  arcaneBarriers: '02102',
  sordidAndSilent: '02089',
})

export function locationCounterTreacheries(location) {
  return Object.entries(LOCATION_COUNTER_TREACHERY)
    .flatMap(([field, code]) => Array(location?.[field] || 0).fill(code))
}

// 卡号级规则数据：两张「附着型」弱点自身的卡号（原 engine.js 硬编码）。
export const SMITE_THE_WICKED_CODE = '02007'
export const SEARCHING_FOR_IZZIE_CODE = '02011'

// 卡号级规则数据：「弱点升级」后的替换卡号（原 engine.js 硬编码 04038 / 04041 / 04042）。
export const WEAKNESS_UPGRADE_CODES = Object.freeze({
  priceOfFailure: '04038',
  impendingDoom: '04041',
  cursedFate: '04042',
})

export function weaknessUpgradeCode(type) {
  return WEAKNESS_UPGRADE_CODES[type] || null
}

// 卡号级规则数据：结局时加入战役牌组的剧情盟友（丽塔·钱德勒，原 engine.js 硬编码 01117）。
export const LITA_CHANDLER_CODE = '01117'

// 卡号级规则数据：某个地点计数对应哪张遭遇卡（奥术屏障这类「计数器 + 卡」的机制）。
export function counterTreacheryCode(field) {
  return LOCATION_COUNTER_TREACHERY[field] || null
}

// 卡号级规则数据：会在「无人生成地点为空」时翻开探索牌库放地点的议程/幕（原 engine.js 硬编码 04318）。
export const ACTS_PLACING_LOCATION_FOR_EMPTY_SPAWN = Object.freeze(['04318'])

export function actPlacesLocationForEmptySpawn(code) {
  return ACTS_PLACING_LOCATION_FOR_EMPTY_SPAWN.includes(code)
}

// 卡号级规则数据：剧情关键敌人 / 弱点（原 engine.js 硬编码 03059）。
export const PALLID_MASK_CODE = '03059'

// 卡号级规则数据：这些地点上的「遗物」购买有折扣（原 engine.js 硬编码 04142）。
export const RELIC_DISCOUNT_LOCATION_CODES = Object.freeze(['04142'])

export function relicDiscountLocation(code) {
  return RELIC_DISCOUNT_LOCATION_CODES.includes(String(code ?? ''))
}

// 卡号级规则数据：地点被移出游戏时的「默认去向」地点（原 engine.js 硬编码 02320）。
export const RELOCATE_DESTINATION_LOCATION_CODE = '02320'

// 卡号级规则数据：旧存档迁移用到的卡号（Phase 6 从 save-migration.js 搬出来，引擎不再写死）。
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
