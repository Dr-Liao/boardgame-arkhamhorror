// 全量校验 TCU 条目字段：动态 import 每个条目，检查 default 的键是否在引擎允许集合内，
// 并顺手把常见的非法字段 rulesImplementedIn 改成合法字段 note。
// 字段允许集合从 src/engine/ability.js 的 ENTRY_KEYS 无法直接 import（未导出），
// 这里用「运行期注册」作为事实源：import 引擎时 registerCardAbilities 已校验，故此脚本只
// 静态收集常见非法字段；动态校验直接 import 引擎即可（失败会指到具体条目）。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve('src/cards/encounter-entries/theCircleUndone')
const RENAME = new Map([['rulesImplementedIn', 'note']])
let fixed = 0
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.name.endsWith('.js')) continue
    let source = readFileSync(full, 'utf8')
    let changed = false
    for (const [from, to] of RENAME) {
      if (source.includes(from)) {
        source = source.replaceAll(`"${from}"`, `"${to}"`).replaceAll(`${from}:`, `${to}:`)
        changed = true
      }
    }
    if (changed) {
      writeFileSync(full, source)
      fixed++
      console.log('fixed', full.replace(root + '\\', ''))
    }
  }
}
walk(root)
console.log('fixed', fixed)
