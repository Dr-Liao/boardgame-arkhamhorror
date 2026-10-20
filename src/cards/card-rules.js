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
export const EXPLICIT_REACTION_PROMPT = Object.freeze(['01007', '01071', '01082'])

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
