// 98013 西拉斯·马什（Silas Marsh）· 书籍/纪念印刷号（TdG）。
// cards-data 的 98013 与 07005 同文同面（仅标点差异，未标记 duplicateOfCode），因此沿用 canonical
// 行为实现：本文件只覆盖 code；旧印「从弃牌堆投入技能并收回」与「揭示标记后收回投入技能」仍由
// 07005 的条目维护。
import base from './07005.js'

export default { ...base, code: '98013' }
