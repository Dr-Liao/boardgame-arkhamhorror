// 分层跑 Arkham 回归：node tools/run-tests.mjs <fast|slow|assets|all> [额外的 node 测试参数…]
//
// 把清单里的每个文件交给 node 自己的测试运行器并行执行（默认按 CPU 并行），
// 比塞进单个入口文件串行导入快一个数量级：fast 43s → 7s，all 328s → 约 135s。
// suites.mjs 是分层的唯一清单，suite-manifest.test.mjs 负责守住它和 node-suite.mjs 的一致性，
// 所以无论跑哪个 tier 都会先跑守卫。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { FAST_TESTS, SLOW_TESTS, ASSET_TESTS } from '../tests/suites.mjs'

const GUARD = 'tests/suite-manifest.test.mjs'
const TIERS = {
  fast: FAST_TESTS,
  slow: SLOW_TESTS,
  assets: ASSET_TESTS,
  all: [...FAST_TESTS, ...SLOW_TESTS, ...ASSET_TESTS],
}

const [tier, ...rest] = process.argv.slice(2)
const files = TIERS[tier]
if (!files) {
  console.error(`用法: node tools/run-tests.mjs <${Object.keys(TIERS).join('|')}> [node 测试参数…]`)
  process.exit(2)
}

const result = spawnSync(process.execPath, ['--test', GUARD, ...files.map(file => `tests/${file}`), ...rest], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
