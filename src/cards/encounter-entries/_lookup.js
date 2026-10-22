// 非玩家条目的跨条目查询（唯一读点）。
//
// 为什么用「注册 + 惰性建表」而不是直接 import index.js：
//   条目 → _lookup.js → index.js → 条目 是 ESM 循环。如果 _lookup.js 在模块初始化时
//   import index.js，那么单独 import 一个带跨条目查询的条目（02043 等）时，index.js 的
//   数组字面量会先读到尚未初始化的条目绑定，直接 TDZ 报错。
//   因此 index.js 在求值完成后调用 registerNonPlayerEntries()；_lookup.js 只在
//   对局的 resolve / 规则函数里读表，那时所有模块都已就绪。
//
// 条目之间禁止互相 import；需要看另一张卡时只从这里取。

let entryList = null
let byCode = null

export function registerNonPlayerEntries(entries) {
  entryList = entries
  byCode = null
}

function list() {
  if (!entryList) throw new Error('encounter-entries/index.js 尚未加载：跨条目查询只能在对局中调用')
  return entryList
}

const table = () => (byCode ||= new Map(list().map(entry => [entry.code, entry])))

export const entryByCode = code => table().get(code) || null
export const nonPlayerEntryFor = entryByCode
export const someNonPlayerEntry = predicate => list().some(predicate)
export const pallidMaskCode = () => list().find(entry => entry.pallidMask === true)?.code || null
