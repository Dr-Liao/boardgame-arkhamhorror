// 98001 珍妮·巴恩斯（Jenny Barnes）· 书籍/纪念印刷号（HotH）。
// cards-data 的 98001 与 02003 同文同面（未标记 duplicateOfCode），因此沿用 canonical 行为实现：
// 本文件只覆盖 code，行为仍由 02003 的条目维护（一卡一文件 + 同一印刷只写一次）。
// 若 Lead 后续在 cards-data 把 98001 标为 02003 的 duplicateOfCode，则应改走 REPRINT_ALIASES
// 并删除本文件（重印别名号不得有自己的条目文件）。
import base from './02003.js'

export default { ...base, code: '98001' }
