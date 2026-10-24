// 统计 content/ 下「按卡号分支」的分布（architecture-guard 的 CONTENT_BRANCH_BASELINE 口径）。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (entry.name.endsWith('.js')) files.push(full)
  }
  return files
}
const rows = []
for (const file of walk('content')) {
  const source = readFileSync(file, 'utf8')
  const matches = source.match(/(?:code|originalCode)\s*===\s*['"]0\d{4}[a-z]?['"]/g)
  if (matches) rows.push([file.replaceAll('\\', '/'), matches.length])
}
rows.sort((left, right) => right[1] - left[1])
for (const [file, count] of rows) console.log(count, file)
console.log('files', rows.length, 'total', rows.reduce((sum, row) => sum + row[1], 0))
