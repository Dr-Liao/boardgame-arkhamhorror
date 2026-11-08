// 地球边缘调查员的构筑期数据（纯数据模块，不含行为）。
//
// 陈丽丽（08010）的演武是双面永久资产：牌组里放 Unbroken 面卡号（08011a–08014a），
// 背面（08011b–08014b）由物理换面管线切换；每张演武配 1 张命运重担（08015，印刷 4 份上限）。
// 开局选 1 张演武，之后每 15 点经验可再加 1 张不同演武（升级入口在 P7 接入）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const EOTE_DISCIPLINE_SETS = Object.freeze([
  Object.freeze({ unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' }),
  Object.freeze({ unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' }),
])

export const EOTE_DISCIPLINE_UNBROKEN_CODES = Object.freeze(EOTE_DISCIPLINE_SETS.map(set => set.unbrokenCode))

export const EOTE_INVESTIGATOR_BUILD = Object.freeze({
  // 陈丽丽：构筑期选择演武；默认只带 1 张（自动构筑与真实大厅开局同口径）。
  '08010': Object.freeze({
    disciplineSets: EOTE_DISCIPLINE_SETS,
    disciplineCodes: EOTE_DISCIPLINE_UNBROKEN_CODES,
    startingDiscipline: '08011a',
    burdenCode: '08015',
    xpPerDiscipline: 15,
  }),
})

export function eoteInvestigatorBuildRules(code) {
  return EOTE_INVESTIGATOR_BUILD[String(code)] || null
}

// 演武卡号 → 面信息（供构筑/界面/审计使用；不写状态）。
export function eoteDisciplineFaceOf(code) {
  const card = ALL_CARDS[code]
  if (!card) return null
  return EOTE_DISCIPLINE_SETS.find(set => set.unbrokenCode === code || set.brokenCode === code) || null
}
