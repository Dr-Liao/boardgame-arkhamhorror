// 98007 诺曼·威瑟斯（Norman Withers）· 书籍/纪念印刷号（IotV）。
// cards-data 的 98007 与 08004 同文同面（未标记 duplicateOfCode），因此沿用 canonical 行为实现：
// 本文件只覆盖 code；investigator.deckTop、旧印换牌等读点仍由 08004 的条目维护。
// 内部提示里的 source 只是日志标签（'08004'），不影响结算。
import base from './08004.js'

export default { ...base, code: '98007' }
