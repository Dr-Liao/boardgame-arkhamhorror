// 九循环《铁杉谷盛宴》调查员构筑期数据（纯数据，P5）。
//
// 五位调查员：10001 威尔森·理查德 / 10004 凯特·温斯罗普 / 10009 亚历山德拉·佐兹 /
// 10012 鸣神琥珀 / 10015 汉克‧萨姆森。印刷卡面数据（deckOptions / deckRequirements / 数值）在
// cards-data 里；本文件只放**引擎/构筑期需要的补充规则**，与参考实现的 deckbuilding 口径一致：
//   · 五位调查员都没有次级职阶选择、没有构筑期额外经验；牌组大小由卡面 deckRequirements.size 决定
//     （汉克 35 张，其余 30 张），特性/文本/等级范围全部沿用 web/deck-rules.js 的通用匹配器；
//   · 凯特开局以 10005《磁通量稳定器》（未激活面）在场：读点是条目 `investigator.startsWith`，
//     本文件只给审计同口径的 SETUP 元数据；
//   · 汉克的绑定坚毅面 10016a/10016b 不进入牌组，由濒败替换原语使用：同样只登记依赖关系。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { BONDED_CODES, DEPENDENCY_CODES, INVESTIGATOR_CODES, SIGNATURE_CODES, investigators } from './shared.js'

export const FHV_INVESTIGATOR_CODES = Object.freeze([...INVESTIGATOR_CODES])
export const FHV_SIGNATURE_CODES = Object.freeze([...SIGNATURE_CODES])
export const FHV_BONDED_CODES = Object.freeze([...BONDED_CODES])
export const FHV_DEPENDENCY_CODES = Object.freeze([...DEPENDENCY_CODES])

// 开局必须带入/预置的专属依赖（buildDeck 的签名卡校验之外，P5 审计用同一份口径）：
//   凯特：10005《磁通量稳定器》以未激活面（10005b 的背面）在场；
//   汉克：10016a/10016b 是可切换的绑定坚毅面，不进入牌组。
export const FHV_SETUP = Object.freeze({
  '10004': Object.freeze({ startsWith: Object.freeze(['10005']) }),
  '10015': Object.freeze({ bondedForms: Object.freeze(['10016a', '10016b']) }),
})

// 五位调查员都没有「构筑期额外经验」（与卡面一致）。
export const FHV_BONUS_XP = Object.freeze({})

export function fhvInvestigatorBuildRules(code) {
  const key = String(code)
  const setup = FHV_SETUP[key] || null
  const bonusXp = FHV_BONUS_XP[key] || 0
  if (!setup && !bonusXp) return null
  return Object.freeze({ code: key, setup, bonusXp })
}

export function fhvSignatureCodesFor(code) {
  const key = String(code)
  const item = investigators[key]
  return item ? [...item.signatures] : []
}

export function fhvDependencyCodesFor(code) {
  const key = String(code)
  const item = investigators[key]
  return item ? [...item.signatures, ...item.bonded] : []
}

// 审计辅助：印刷牌组要求（签名卡/弱点/随机基础弱点）与印刷牌组大小。
export function fhvDeckRequirements(code) {
  const card = ALL_CARDS[String(code)]
  const requirements = card?.deckRequirements || {}
  return Object.freeze({
    code: String(code),
    size: requirements.size ?? null,
    signatureCards: [...(requirements.signatureCards || [])],
  })
}
