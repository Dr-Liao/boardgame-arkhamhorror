// 分层跑 Arkham 回归：node tools/run-tests.mjs <fast|slow|assets|all> [额外的 node 测试参数…]
//
// 把清单里的每个文件交给 node 自己的测试运行器并行执行（默认按 CPU 并行），
// 墙钟约等于最慢的几个单文件，而不是各文件相加。2026-10-24 P0+P1 实测：fast ≈25s、
// slow ≈64s、assets ≈25s、all ≈82s（32 线程本机；机器/内容不同会有差异；逐文件耗时用
// node tools/test-timings.mjs <tier>，tier 墙钟用它不带 --serial 的输出）。
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
