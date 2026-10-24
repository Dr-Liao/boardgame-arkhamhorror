#!/usr/bin/env node
// 万象无终（TCU）M2 玩家卡逐卡验收账本 —— P7。
//
//   node tools/audit-tcu-player.mjs --write   重算并写入 audit/tcu-player-acceptance.json + src/cards/tcu-player-acceptance.js
//   node tools/audit-tcu-player.mjs [--check] 默认：实跑 4 个分片测试并逐字节比对两份生成物（不一致即非零退出）
//
// 证据规则（路线图 §8.3）：
// - 逐卡证据只能来自**实跑的测试**：spawnSync 执行 tests/tcu-player-m2-{1..4}.test.mjs，
//   用 tools/core-test-reporter.mjs 读 test:pass/test:fail 事件；不读源码字符串、不读冻结 JSON 猜结论。
// - 测试名必须以 `TCU <05xxx>` 开头；87 张每张至少 1 条证据；全部用例必须 pass，不允许 skip/todo。
// - 只写目录/存在/可构筑/处理器之类「目录级证据」的卡直接拒绝，不进入账本。
// - 生成物两份：JSON 账本（人读/审计用）与 JS 模块（运行时读 verified 集合与可构筑码表）。
//   两份都由本工具生成，`--write` 后必须再跑一次默认 check 验证逐字节一致。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
// 4 个分片测试文件（与 artifacts/migration/tcu/shards.json 一一对应）。
const files = [
  `${game}/tests/tcu-player-m2-1.test.mjs`,
  `${game}/tests/tcu-player-m2-2.test.mjs`,
  `${game}/tests/tcu-player-m2-3.test.mjs`,
  `${game}/tests/tcu-player-m2-4.test.mjs`,
]
// 实现文件的哈希：包清单 + 构筑/战役接线 + 一卡一文件共享读点/分层登记 + 4 个分片测试。
// 生成物自身不在此列，避免自引用哈希。
const implementationFiles = [
  `${game}/content/packs/tcuPlayer/manifest.js`,
  `${game}/src/deck/availability.js`,
  `${game}/src/campaign/campaign.js`,
  `${game}/src/cards/entries/_shared.js`,
  `${game}/tests/suites.mjs`,
  ...files,
]
const ledgerPath = `${game}/audit/tcu-player-acceptance.json`
const modulePath = `${game}/src/cards/tcu-player-acceptance.js`
const resultsPath = 'artifacts/tcu-player/player-acceptance-results.json'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

// DSH_HOME 落在仓库根的 artifacts/ 下，与 Carcosa 的验收工具同一约定（不放游戏目录，避免污染内容包）。
const home = path.join(root, 'artifacts/tcu-player/audit-home')
fs.mkdirSync(home, { recursive: true })

// 从 node --test 内部再 spawn node --test 时，继承的 NODE_TEST_CONTEXT 会让子进程走测试子进程模式，
// 不输出完整事件流；删除后 4 个文件在同一个普通子进程里跑，结果与直接执行一致。
const testEnv = { ...process.env, DSH_HOME: home }
delete testEnv.NODE_TEST_CONTEXT
const run = spawnSync(process.execPath, [
  '--test',
  `--test-reporter=./${game}/tools/core-test-reporter.mjs`,
  ...files,
], {
  cwd: root,
  env: testEnv,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
fs.mkdirSync(path.dirname(path.join(root, resultsPath)), { recursive: true })
fs.writeFileSync(path.join(root, resultsPath), `${JSON.stringify(results, null, 2)}\n`)
if (run.status !== 0 || !results.length || results.some(result =>
  result.type !== 'test:pass' || result.skipped || result.todo)) {
  console.error(results.filter(result =>
    result.type !== 'test:pass' || result.skipped || result.todo), run.stderr)
  process.exit(1)
}
const ranFiles = new Set(results.map(result => path.relative(root, result.file).replaceAll('\\', '/')))
for (const file of files) if (!ranFiles.has(file)) throw new Error(`分片测试没有产出用例：${file}`)

// 分片级预检：每个文件至少覆盖本分片全部卡号的 `TCU <code>` 前缀测试（M2-4 是 21 张）。
// 逐卡证据检查还会兜底；这道预检让「某个分片一行测试都没写」直接有可读的报错。
const expectedPerShard = new Map([
  ['tcu-player-m2-1.test.mjs', 22],
  ['tcu-player-m2-2.test.mjs', 22],
  ['tcu-player-m2-3.test.mjs', 22],
  ['tcu-player-m2-4.test.mjs', 21],
])
for (const [name, expected] of expectedPerShard) {
  const file = `${game}/tests/${name}`
  const codes = new Set(results
    .filter(result => path.relative(root, result.file).replaceAll('\\', '/') === file)
    .map(result => (result.name.match(/^TCU (05\d{3})\b/) || [])[1])
    .filter(Boolean))
  if (codes.size < expected) {
    throw new Error(`${name} 只覆盖 ${codes.size} 张卡（应为 ${expected} 张）：缺 TCU <code> 前缀测试`)
  }
}

// 87 张玩家卡：05 段、非战役遭遇、非调查员/专属、资产/事件/技能或弱点子类型。
// 与 content/packs/tcuPlayer/manifest.js 的登记口径一致；数量写死在断言里，数据变动必须显式处理。
const cards = Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator'
    && (['asset', 'event', 'skill'].includes(card.type) || ['weakness', 'basicweakness'].includes(card.subtype)))
  .sort((left, right) => left.code.localeCompare(right.code))
if (cards.length !== 87) throw new Error(`Unexpected TCU player scope: ${cards.length}`)
const basicWeaknessCodes = cards.filter(card => card.subtype === 'basicweakness').map(card => card.code)
if (basicWeaknessCodes.join(',') !== '05041,05042') {
  throw new Error(`Unexpected TCU basic weaknesses: ${basicWeaknessCodes.join(',')}`)
}

const passed = new Map(results.map(result => [result.name, result]))
// 「目录级证据」判定：先把卡号前缀与卡名从测试名里去掉，再看剩下的描述是否只是在说
// 「目录/存在/可构筑/处理器」。直接匹配原文会误伤卡名本身含这些字的卡（例如 05032「否决存在」）。
const catalogOnly = (title, card) => {
  const name = card.nameZh || card.name || ''
  const rest = title
    .replace(new RegExp(`^TCU ${card.code}\\b`), '')
    .replace(name, '')
  return /目录|存在|可构|处理器/.test(rest)
}
const entries = cards.map(card => {
  const titles = results
    .filter(result => new RegExp(`^TCU ${card.code}\\b`).test(result.name))
    .map(result => result.name)
  if (!titles.length) throw new Error(`No per-card behavioral evidence: ${card.code} ${card.name}`)
  if (titles.every(title => catalogOnly(title, card))) {
    throw new Error(`Catalog-only proof is insufficient: ${card.code}`)
  }
  return {
    code: card.code,
    name: card.nameZh || card.name,
    type: card.type,
    class: card.klass,
    level: card.xp || 0,
    basicWeakness: basicWeaknessCodes.includes(card.code),
    status: 'verified',
    evidence: titles.map(title => {
      const result = passed.get(title)
      return { file: path.relative(root, result.file).replaceAll('\\', '/'), line: result.line ?? null, test: title }
    }),
  }
})

const profile = {
  id: 'original-circle-undone-player-cycle-2026-10',
  scope: '万象无终原始循环玩家包 87 张：85 张构筑卡与 2 张基础弱点（05041 第十三幻象、05042 高塔·XVI）。',
  basis: '原始印刷卡文、后端参考实现及所列逐卡回归测试；验收主要印刷效果和列明边界，不声称穷举所有跨循环组合。',
  houseRules: [
    '沿用项目现有的自动奖励反应、协作请求及确定性选择事务',
    '卡牌随机、搜索和选择必须通过统一存档回放路径',
    '85 张可构筑；05041/05042 只作为基础弱点依赖，不进入构筑池',
    '升级卡仅进入升级池；基础弱点只进入随机基础弱点池',
  ],
  sources: [
    'src/cards/cards-data.js',
    '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/{Asset,Event,Skill,Enemy,Treachery}/CardDefs/TheCircleUndone',
    '参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json',
  ],
}
const ledger = {
  schemaVersion: 1,
  profile,
  summary: {
    total: entries.length,
    constructible: entries.filter(entry => !entry.basicWeakness).length,
    basicWeaknesses: entries.filter(entry => entry.basicWeakness).length,
    verified: entries.length,
    unverified: 0,
    testsPassed: results.length,
  },
  testFiles: files.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
  implementationFiles: implementationFiles.map(file =>
    ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
  entries,
}
const json = `${JSON.stringify(ledger, null, 2)}\n`
const module = `// Generated by tools/audit-tcu-player.mjs after executing P7 behavioral tests.
// Detailed evidence: audit/tcu-player-acceptance.json.
export const TCU_PLAYER_ACCEPTANCE_PROFILE = ${JSON.stringify(profile, null, 2)}
export const TCU_PLAYER_ACCEPTANCE_SHA256 = '${hash(json)}'
export const TCU_PLAYER_VERIFIED_CODES = Object.freeze(${JSON.stringify(entries.map(entry => entry.code))})
export const TCU_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(${JSON.stringify(basicWeaknessCodes)})
const verified = new Set(TCU_PLAYER_VERIFIED_CODES)
export const tcuPlayerCardVerified = code => verified.has(code)
`
for (const [file, text] of [[ledgerPath, json], [modulePath, module]]) {
  const destination = path.join(root, file)
  if (process.argv.includes('--write')) fs.writeFileSync(destination, text)
  else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) {
    throw new Error(`Acceptance artifact stale: ${file}`)
  }
}
console.log(JSON.stringify(ledger.summary))
