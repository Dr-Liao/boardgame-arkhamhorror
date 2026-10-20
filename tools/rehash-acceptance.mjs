// 验收账本的「证据文件哈希」重算器。
//
// 背景：core / carcosa 两份验收账本把**验收测试文件**的 sha256 锁在账本里
// （audit/core-acceptance.json、audit/carcosa-all-card-acceptance.json），
// 生成器只在「所有行为测试都通过」时才会重写账本。Phase 5 迁移会改动这些测试文件
// （把 "断言 EFFECTS 形状" 改成 "断言读点"，见 roadmap §7 第 3 条），
// 而仓库里存在 Phase 0 就记账的既有失败，生成器的「全绿」前提暂时不成立。
//
// 这个工具只做一件事：**按当前文件内容重算 sha256**，保持账本的条目/证据映射不变。
// 它不能、也不应该改变任何一条验收结论——证据映射（哪条测试证明哪张卡）原样保留。
//
// 用法：
//   node tools/rehash-acceptance.mjs --check     # 只报告哪些文件的哈希过期（默认）
//   node tools/rehash-acceptance.mjs --write     # 重算并写回账本与配套模块
//
// 等既有失败清掉之后，仍应优先用生成器整体重写账本（node tools/audit-core-acceptance.mjs --write
// 与 node tools/audit-carcosa-all-cards.mjs --write），那时本工具自然无事可做。

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const GAME = 'games/arkhamhorror'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

// 账本 → 配套模块（模块里锁着账本 JSON 的 sha256）。
const TARGETS = [
  { ledger: 'audit/core-acceptance.json', module: 'src/cards/core-acceptance.js', sha: 'CORE_ACCEPTANCE_SHA256' },
  {
    ledger: 'audit/carcosa-all-card-acceptance.json',
    module: 'src/cards/carcosa-campaign-acceptance.js',
    sha: 'CARCOSA_ALL_CARD_ACCEPTANCE_SHA256',
  },
  {
    ledger: 'audit/carcosa-player-acceptance.json',
    module: 'src/cards/carcosa-player-acceptance.js',
    sha: 'CARCOSA_PLAYER_ACCEPTANCE_SHA256',
  },
  {
    ledger: 'audit/dunwich-acceptance.json',
    module: 'src/cards/dunwich-acceptance.js',
    sha: 'DUNWICH_ACCEPTANCE_SHA256',
  },
]

function rehashLedger({ ledger, module, sha }, write) {
  const ledgerPath = path.join(ROOT, GAME, ledger)
  const modulePath = path.join(ROOT, GAME, module)
  const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  const changed = []
  for (const entry of data.testFiles || []) {
    const filePath = path.join(ROOT, entry.file)
    if (!fs.existsSync(filePath)) throw new Error(`证据文件不存在：${entry.file}`)
    const next = hash(fs.readFileSync(filePath))
    if (next !== entry.sha256) {
      changed.push(entry.file)
      entry.sha256 = next
    }
  }
  const json = `${JSON.stringify(data, null, 2)}\n`
  const nextSha = hash(json)
  const moduleText = fs.readFileSync(modulePath, 'utf8')
  const match = new RegExp(`${sha} = '([0-9a-f]{64})'`).exec(moduleText)
  if (!match) throw new Error(`${module} 里找不到 ${sha}`)
  const moduleStale = match[1] !== nextSha
  if (!changed.length && !moduleStale) {
    console.log(`  ✔ ${ledger} 无需重算`)
    return 0
  }
  console.log(`  ${write ? '✎' : '✖'} ${ledger}：${changed.length} 个证据文件哈希过期`
    + `${moduleStale ? '，账本哈希也过期' : ''}`)
  for (const file of changed) console.log(`      ${file}`)
  if (!write) return 1
  fs.writeFileSync(ledgerPath, json)
  fs.writeFileSync(modulePath, moduleText.replace(match[0], `${sha} = '${nextSha}'`))
  return 1
}

const write = process.argv.includes('--write')
if (!write && !process.argv.includes('--check')) {
  console.error('用法：node tools/rehash-acceptance.mjs [--check|--write]')
  process.exit(2)
}
let stale = 0
for (const target of TARGETS) stale += rehashLedger(target, write)
if (!write && stale) {
  console.error(`\n${stale} 份账本的证据哈希过期：运行 node tools/rehash-acceptance.mjs --write 后审阅 diff`)
  process.exit(1)
}
console.log(write ? '✔ 账本哈希已重算（条目与证据映射未改动）' : '✔ 账本哈希与证据文件一致')
