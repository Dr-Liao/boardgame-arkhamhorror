// 对 TCU 新增条目做语法检查（node --check 等价，逐文件），报告非法文件。
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve('src/cards/encounter-entries/theCircleUndone')
const failures = []
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.name.endsWith('.js')) continue
    const result = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' })
    if (result.status !== 0) {
      const message = (result.stderr || '').split('\n').filter(line => line.includes('Error') || line.includes('SyntaxError')).slice(0, 2).join(' | ')
      failures.push(`${full.replace(root + '\\', '')}: ${message}`)
    }
  }
}
walk(root)
console.log(failures.length ? failures.join('\n') : 'syntax OK')
