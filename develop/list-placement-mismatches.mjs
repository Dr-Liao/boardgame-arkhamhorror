// 列出所有「条目文件路径 ≠ 归属算法结果」的条目（逐条，而不是测试只报第一条）。
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { loadPlacementIndex, resolvePlacements } from '../tools/encounter-entry-placement.mjs'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
import { encounterEntryFiles } from '../tools/build-encounter-index.mjs'

const root = resolve('src/cards/encounter-entries')
const files = await encounterEntryFiles()
const byCode = new Map(files.map(file => [file.code, file.relative]))
const placements = resolvePlacements(NON_PLAYER_ABILITY_ENTRIES, loadPlacementIndex())
const mismatches = []
for (const placement of placements) {
  if (placement.unresolved) {
    mismatches.push({ code: placement.code, actual: byCode.get(placement.code) || null, expected: null, unresolved: true })
    continue
  }
  const actual = byCode.get(placement.code) || null
  if (actual !== placement.targetPath) mismatches.push({ code: placement.code, actual, expected: placement.targetPath })
}
console.log(JSON.stringify(mismatches, null, 1))
console.log('total mismatches', mismatches.length)
