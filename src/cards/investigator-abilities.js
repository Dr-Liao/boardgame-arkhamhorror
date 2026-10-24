// 调查员卡面规则读点（第 6 批）。
// 数据源是 entries/<code>.js 的 `investigator` 字段；本文件只保留读点与迁移期的
// 静态索引回落，不再维护第二份调查员表。
import { registeredEntry } from '../engine/ability.js'
import { CARD_ABILITY_ENTRIES } from './card-abilities.js'

// 第 5 步 P7：STATIC 必须惰性求值。entries → engine/card-lookup → card-rules 的链路会在
// card-abilities 初始化期间回到本模块；若此时顶层读取 CARD_ABILITY_ENTRIES 就会 TDZ 崩溃
// （05037 的 cardDef import 首次暴露了这条环）。改成第一次真正查询时再建表，数据不变。
let STATIC = null
function staticEntries() {
  STATIC ||= CARD_ABILITY_ENTRIES.filter(entry => entry.investigator)
  return STATIC
}

function dataFor(code) {
  if (!code) return null
  return registeredEntry(code)?.investigator || staticEntries().find(entry => entry.code === code)?.investigator || null
}

export function investigatorRule(code) {
  return dataFor(code) || {}
}

// 兼容旧读点：工具/测试仍可按调查员 code 取数据体，但数据来自条目而不是本文件的表。
export const INVESTIGATOR_ABILITIES = new Proxy({}, {
  get: (_, code) => dataFor(String(code)) || undefined,
  has: (_, code) => Boolean(dataFor(String(code))),
  ownKeys: () => staticEntries().map(entry => entry.code),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
})
