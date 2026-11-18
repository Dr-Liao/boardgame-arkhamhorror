#!/usr/bin/env node
// FHV P7：12 个场景（4 序曲 + 8 章）章测试 + 战役层（流程/正文/记录）测试聚合运行器。
//   node tools/run-fhv-scenario-tests.mjs
// 共享遭遇条目测试若存在也一并运行（主进程按需扩充）。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const SCENARIO_IDS = [
  'welcomeToHemlockVale', 'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister',
  'theThingInTheDepths', 'theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight',
  'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale',
]
const files = [
  ...SCENARIO_IDS.map(id => `tests/fhv-scenario-${id}.test.mjs`),
  'tests/fhv-campaign-flow.test.mjs',
  'tests/fhv-story.test.mjs',
  'tests/fhv-campaign-records.test.mjs',
  'tests/fhv-shared-encounters-a.test.mjs',
  'tests/fhv-shared-encounters-b.test.mjs',
]
const existing = files.filter(file => existsSync(new URL(`../${file}`, import.meta.url)))
const missing = files.filter(file => !existing.includes(file))
if (missing.length) console.log(`提示：尚未落盘的测试文件 ${missing.length} 个（${missing.join('、')}）`)
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...existing], {
  cwd: MOD, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: 'inherit',
})
process.exitCode = result.status ?? 1
