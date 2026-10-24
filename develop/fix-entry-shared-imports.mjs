// 修正条目里 _shared.js 的相对路径深度（Lead 的 brief 曾经写错一个层级）。
//   encounter-entries/theCircleUndone/<scenario>/<code>.js      → ../../_shared.js
//   encounter-entries/theCircleUndone/_shared/<group>/<code>.js → ../../../_shared.js
// 只处理 theCircleUndone 下、import '_shared.js' 的条目；幂等。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'

const base = resolve('src/cards/encounter-entries/theCircleUndone')
let fixed = 0
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.name.endsWith('.js')) continue
    const rel = relative(base, full).split('\\').join('/')
    if (rel.endsWith('_shared.js') || rel === 'README.md') continue
    const depth = rel.split('/').length // <scenario>/<code>.js = 2；_shared/<group>/<code>.js = 3
    const expected = depth === 2 ? '../../_shared.js' : '../../../_shared.js'
    const source = readFileSync(full, 'utf8')
    if (source.includes(`from '${expected}'`)) continue
    const next = source
      .replace(/from '\.\.\/\.\.\/_shared\.js'/g, `from '${expected}'`)
      .replace(/from '\.\.\/\.\.\/\.\.\/_shared\.js'/g, `from '${expected}'`)
    if (next !== source) {
      writeFileSync(full, next)
      fixed++
      console.log(rel, '->', expected)
    }
  }
}
walk(base)
console.log('fixed', fixed)
