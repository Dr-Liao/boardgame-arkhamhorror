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
