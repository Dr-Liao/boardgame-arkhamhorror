// 调查员卡面规则读点（第 6 批）。
// 数据源是 entries/<code>.js 的 `investigator` 字段；本文件只保留读点与迁移期的
// 静态索引回落，不再维护第二份调查员表。
import { registeredEntry } from '../engine/ability.js'
import { CARD_ABILITY_ENTRIES } from './card-abilities.js'

const STATIC = CARD_ABILITY_ENTRIES.filter(entry => entry.investigator)

function dataFor(code) {
  if (!code) return null
  return registeredEntry(code)?.investigator || STATIC.find(entry => entry.code === code)?.investigator || null
}

export function investigatorRule(code) {
  return dataFor(code) || {}
}

// 兼容旧读点：工具/测试仍可按调查员 code 取数据体，但数据来自条目而不是本文件的表。
export const INVESTIGATOR_ABILITIES = new Proxy({}, {
  get: (_, code) => dataFor(String(code)) || undefined,
  has: (_, code) => Boolean(dataFor(String(code))),
  ownKeys: () => STATIC.map(entry => entry.code),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
})
