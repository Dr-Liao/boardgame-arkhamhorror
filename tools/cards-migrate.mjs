// Phase 5 · 迁移批次编排：一次跑完「迁卡 → 账本 → replay 对比 → 守卫」四步。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/cards-migrate.mjs --batch 5b-1 --codes 01089 01090   # 迁移 + 全部门禁
//   node tools/cards-migrate.mjs --check                            # 仅门禁（CI / 提交前）
//   node tools/cards-migrate.mjs --list                             # 当前哪些卡可机械迁移
//
// 门禁顺序与 docs/architecture-refactor-roadmap.md §6 Phase 5 一致：
//   1. tools/migrate-card.mjs --write        迁卡（不可机械迁移的卡直接拒绝写入）
//   2. tools/audit-abilities.mjs --write     两份账本 + 白名单一起收缩（指标下降=迁移证据）
//   3. tools/replay-fixtures.mjs --compare   与迁移前基线逐条比指纹（行为零变化）
//   4. node --test tests/architecture-guard.test.mjs 六条守卫
//   5. npm run fast                          由人/CI 跑（这里只提示，不递归起测试进程）
//
// 基线默认取 artifacts/replay-before.json；没有就用 --baseline 先采一份。

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_BASELINE = path.join(ROOT, '..', '..', 'artifacts', 'replay-before.json')
const node = process.execPath

function run(label, args) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(node, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✖ ${label} 失败（exit ${result.status}）`)
    process.exit(result.status ?? 1)
  }
  return result.status
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--check') ? '--check' : args.includes('--list') ? '--list' : '--write'
  const batchIndex = args.indexOf('--batch')
  const batch = batchIndex >= 0 ? args[batchIndex + 1] : null
  const codesIndex = args.indexOf('--codes')
  const codes = codesIndex >= 0 ? args.slice(codesIndex + 1).filter(arg => !arg.startsWith('--')) : []
  const baselineIndex = args.indexOf('--baseline')
  const baseline = baselineIndex >= 0 ? path.resolve(args[baselineIndex + 1]) : DEFAULT_BASELINE

  if (mode === '--list') {
    run('迁移判定清单', ['tools/migrate-card.mjs', '--report'])
    return
  }

  if (mode === '--write') {
    if (!batch && !codes.length) {
      console.error('用法：node tools/cards-migrate.mjs --batch <名称> [--codes <卡号…>] [--baseline <文件>]')
      process.exit(2)
    }
    const migrateArgs = ['tools/migrate-card.mjs', '--write']
    if (batch) migrateArgs.push('--batch', batch)
    migrateArgs.push(...codes)
    run('1/4 迁卡', migrateArgs)
  }

  // --check 只校验，不写账本；--write 批次时才重写账本与白名单。
  run('2/4 更新账本与白名单', ['tools/audit-abilities.mjs', mode === '--write' ? '--write' : '--check'])

  if (existsSync(baseline)) {
    run(`3/4 replay 对比（基线 ${path.relative(ROOT, baseline)}）`, ['tools/replay-fixtures.mjs', '--compare', baseline])
  } else {
    console.log(`\n⚠ 没有基线文件 ${baseline}；先跑 node tools/replay-fixtures.mjs --baseline artifacts/replay-before.json`)
  }

  run('4/4 架构守卫', ['--test', 'tests/architecture-guard.test.mjs'])
  run('迁移产物自检', ['tools/migrate-card.mjs', '--verify'])
  console.log('\n✔ 迁移批次门禁通过。提交前再跑：npm run test:fast（涉及战役的批次还要跑对应验收文件）')
}

await main().catch(error => {
  console.error(error?.stack || String(error))
  process.exit(1)
})
