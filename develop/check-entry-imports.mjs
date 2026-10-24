// 扫描 encounter-entries 下新增条目的 import 路径是否存在（快速静态检查，不 import）。
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

const root = resolve('src/cards/encounter-entries')
const problems = []
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.name.endsWith('.js')) continue
    const source = readFileSync(full, 'utf8')
    for (const match of source.matchAll(/from '(\.[^']+)'/g)) {
      const target = resolve(dirname(full), match[1])
      if (!existsSync(target)) problems.push(`${full.replace(root + '\\', '')} -> ${match[1]}`)
    }
  }
}
walk(root)
console.log(problems.length ? problems.join('\n') : 'imports OK')
