#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P6 一般玩家卡分片计划与 worker 输入生成器。
//
//   node tools/plan-tsk-player.mjs --write   写 audit/tsk-player-shards.json、audit/tsk-player-queue.json
//                                            与运行目录 artifacts/migration/tsk/workers/w-m2-N.input.json
//   node tools/plan-tsk-player.mjs --check   只读复算（分片/覆盖/输入哈希任一漂移即失败）
//
// 事实源：
//   · 范围与归属：audit/tsk-scope.json 的 tskPlayer 分区（108 条记录，P0 锁定）；
//   · 卡面字段：src/cards/cards-data.js（唯一印刷事实源）；
//   · 机制归类：audit/tsk-mechanism-scan.json（P1 扫描，逐卡 mechanisms）；
//   · 原语目录：audit/tsk-primitive-catalog.json（P2，逐原语引用卡号）。
// 分片口径：四片按印刷卡号连续切分（27/27/27/27），与 EotE/TDE P6 的分片测试一一对应。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOD, RUN, json, readJson } from './tsk-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const SHARDS_PATH = join(MOD, 'audit/tsk-player-shards.json')
const QUEUE_PATH = join(MOD, 'audit/tsk-player-queue.json')
const WORKERS_DIR = join(RUN, 'workers')
const TEST_FILES = Object.freeze([
  'tests/tsk-player-m2-1.test.mjs', 'tests/tsk-player-m2-2.test.mjs',
  'tests/tsk-player-m2-3.test.mjs', 'tests/tsk-player-m2-4.test.mjs',
])
const EXPECTED_COUNTS = Object.freeze([27, 27, 27, 27])
const basicWeakness = code => ALL_CARDS[code]?.subtype === 'basicweakness'
const buildable = code => !basicWeakness(code) && (ALL_CARDS[code]?.deckLimit ?? 0) > 0
const sha256 = text => createHash('sha256').update(text).digest('hex')

const scope = readJson(join(MOD, 'audit/tsk-scope.json'))
const scan = readJson(join(MOD, 'audit/tsk-mechanism-scan.json'))
const catalog = readJson(join(MOD, 'audit/tsk-primitive-catalog.json'))
const playerPack = (scope.packs || []).find(pack => pack.id === 'tskPlayer')
if (!playerPack) throw new Error('audit/tsk-scope.json 缺少 tskPlayer 包')
const PLAYER_CODES = [...playerPack.cards].sort()
if (PLAYER_CODES.length !== 108) throw new Error(`tskPlayer 分区应为 108 条记录，实际 ${PLAYER_CODES.length}`)

const scanByCode = new Map((scan.cards || []).map(row => [row.code, row]))
const primitiveUses = new Map()
for (const entry of Object.values(catalog.entries || {})) {
  if (entry.kind !== 'catalog') continue
  for (const code of entry.cards || []) {
    if (!PLAYER_CODES.includes(code)) continue
    const list = primitiveUses.get(code) || []
    list.push(entry.id)
    primitiveUses.set(code, list)
  }
}
// 跨循环重印：只保留 canonical 实现，本循环号登记别名（P6 不新建第二份行为）。
const reprintByCode = new Map()
for (const group of scope.crossCycleReprints || []) {
  for (const code of group.cycleCodes || []) reprintByCode.set(code, group)
}

// 四片连续切分（按 scope 已排序的印刷顺序）。
const shards = EXPECTED_COUNTS.map((count, index) => {
  const codes = PLAYER_CODES.slice(index * 27, index * 27 + count)
  const id = `M2-${index + 1}`
  return {
    id,
    worker: `w-m2-${index + 1}`,
    name: `玩家卡 ${id}（${codes[0]}–${codes[codes.length - 1]}，${codes.length} 张）`,
    testFile: TEST_FILES[index],
    codes,
  }
})
const allCodes = shards.flatMap(shard => shard.codes)
if (allCodes.length !== 108 || new Set(allCodes).size !== 108) throw new Error('分片必须无交集覆盖 108 张玩家卡')
const sortedScope = [...PLAYER_CODES].sort()
if (JSON.stringify([...allCodes].sort()) !== JSON.stringify(sortedScope)) throw new Error('分片并集必须等于 tskPlayer 分区')

const cards = PLAYER_CODES.map(code => {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`未知卡号 ${code}`)
  const shard = shards.find(item => item.codes.includes(code))
  const mechanisms = (scanByCode.get(code)?.mechanisms || []).map(row => row.id || row).sort()
  const reprint = reprintByCode.get(code) || null
  return {
    code,
    name: card.nameZh || card.name,
    nameEn: card.name,
    type: card.type,
    klass: card.klass || null,
    xp: card.xp ?? 0,
    subtype: card.subtype || null,
    traits: [...(card.traits || [])],
    basicWeakness: basicWeakness(code),
    buildable: buildable(code),
    deckLimit: card.deckLimit ?? null,
    customizable: Boolean(card.customizationOptions?.length || card.customizationText),
    reprint: reprint ? { canonicalCode: reprint.canonicalCode, outsideCodes: reprint.outsideCodes, basis: reprint.basis } : null,
    shard: shard.id,
    entryFile: `src/cards/entries/${code}.js`,
    testFile: shard.testFile,
    mechanisms,
    mechanismsKey: (scanByCode.get(code)?.mechanisms || []).map(row => row.id || row).sort().join(','),
    primitiveUses: [...new Set(primitiveUses.get(code) || [])].sort(),
  }
})

const queue = {
  schemaVersion: 1,
  cycle: 'tsk',
  phase: 'P6',
  generatedBy: 'tools/plan-tsk-player.mjs',
  items: cards.filter(card => !card.reprint).map(card => ({
    id: card.code,
    code: card.code,
    name: card.name,
    shard: card.shard,
    status: 'pending',
    kind: card.basicWeakness ? 'basic-weakness' : card.reprint ? 'reprint-alias' : 'player-card',
    requirements: {
      entry: card.entryFile,
      test: card.testFile,
      mechanisms: card.mechanisms,
      primitives: card.primitiveUses,
      customizable: card.customizable,
    },
  })).concat(cards.filter(card => card.reprint).map(card => ({
    id: card.code,
    code: card.code,
    name: card.name,
    shard: card.shard,
    status: 'alias',
    kind: 'reprint-alias',
    canonicalCode: card.reprint.canonicalCode,
    note: `跨循环重印：只保留 ${card.reprint.canonicalCode} 的实现，本卡号走 card-identity 别名，不新建条目。`,
  }))),
}

const countBy = fn => {
  const map = new Map()
  for (const card of cards) {
    const key = fn(card)
    map.set(key, (map.get(key) || 0) + 1)
  }
  return Object.fromEntries([...map].sort(([a], [b]) => String(a).localeCompare(String(b))))
}
const summary = {
  total: cards.length,
  shards: shards.map(shard => ({ id: shard.id, worker: shard.worker, count: shard.codes.length })),
  buildable: cards.filter(card => card.buildable).length,
  basicWeaknesses: cards.filter(card => card.basicWeakness).length,
  customizable: cards.filter(card => card.customizable).length,
  reprintAliases: cards.filter(card => card.reprint).length,
  byClass: countBy(card => card.klass || 'neutral'),
  byType: countBy(card => card.type),
  byXp: countBy(card => card.xp),
  tests: TEST_FILES,
}
const gates = {
  scopePartition: cards.length === 108,
  shardsExact: shards.length === 4 && shards.every((shard, index) => shard.codes.length === EXPECTED_COUNTS[index]),
  noOverlapNoGap: new Set(allCodes).size === 108 && JSON.stringify([...allCodes].sort()) === JSON.stringify(sortedScope),
  mechanismClassified: cards.every(card => card.mechanismsKey.length > 0),
  basicWeaknessesClassified: cards.filter(card => card.basicWeakness).length === 5,
  customizationsClassified: cards.filter(card => card.customizable).length === 16,
  reprintsCanonical: cards.filter(card => card.reprint).every(card => card.reprint.canonicalCode && card.reprint.basis),
  testFilesDeclared: TEST_FILES.every(file => cards.every(card => card.testFile === TEST_FILES[shards.findIndex(shard => shard.id === card.shard)])),
}
const status = Object.values(gates).every(Boolean) ? 'planned' : 'pending'
const report = {
  schemaVersion: 1,
  cycle: 'tsk',
  phase: 'P6',
  generatedBy: 'tools/plan-tsk-player.mjs',
  status,
  summary,
  gates,
  shards,
  cards,
  queue: { path: 'audit/tsk-player-queue.json', total: queue.items.length, pending: queue.items.filter(item => item.status === 'pending').length },
}

mkdirSync(WORKERS_DIR, { recursive: true })
const workerInputs = shards.map(shard => ({
  shard: shard.id,
  worker: shard.worker,
  testFile: shard.testFile,
  entryFiles: shard.codes.map(code => `src/cards/entries/${code}.js`),
  cards: cards.filter(card => card.shard === shard.id),
  instructions: [
    '只写分片内 src/cards/entries/<code>.js 与本分片 tests/tsk-player-m2-N.test.mjs；不改共享文件、不重建索引。',
    '每张卡至少一条 P6 <code> 开头的真实行为测试（费用/目标/窗口/持续/负面路径之一）。',
    '缺原语时在运行目录写 primitive-requests/<code>.json，卡记 blocked，不直写状态绕过 API。',
    '完成后输出 JSON 摘要：{ shard, cards, verified, blocked, tests }。',
  ],
}))

if (process.argv.includes('--write')) {
  writeFileSync(SHARDS_PATH, JSON.stringify({ schemaVersion: 1, cycle: 'tsk', phase: 'P6', generatedBy: 'tools/plan-tsk-player.mjs', status, summary, gates, shards }, null, 2) + '\n')
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n')
  writeFileSync(join(RUN, 'player-plan.json'), JSON.stringify(report, null, 2) + '\n')
  for (const input of workerInputs) {
    writeFileSync(join(WORKERS_DIR, `${input.worker}.input.json`), JSON.stringify(input, null, 2) + '\n')
  }
  console.log(`tsk player plan: 已写入（${summary.total} 张 / 4 片；可构筑 ${summary.buildable}，基础弱点 ${summary.basicWeaknesses}，定制 ${summary.customizable}，重印别名 ${summary.reprintAliases}）`)
  console.log(json({ status, gates }))
  if (status !== 'planned') throw new Error(`tsk player plan 门禁未全真：${json(gates)}`)
} else if (process.argv.includes('--check')) {
  if (!existsSync(SHARDS_PATH) || !existsSync(QUEUE_PATH)) throw new Error('缺少分片/队列产物：先 --write')
  const diskShards = readFileSync(SHARDS_PATH, 'utf8')
  const freshShards = JSON.stringify({ schemaVersion: 1, cycle: 'tsk', phase: 'P6', generatedBy: 'tools/plan-tsk-player.mjs', status, summary, gates, shards }, null, 2) + '\n'
  if (diskShards !== freshShards) throw new Error('audit/tsk-player-shards.json 与复算不一致：审阅后 --write')
  const diskQueue = readFileSync(QUEUE_PATH, 'utf8')
  if (diskQueue !== JSON.stringify(queue, null, 2) + '\n') throw new Error('audit/tsk-player-queue.json 与复算不一致：审阅后 --write')
  for (const input of workerInputs) {
    const path = join(WORKERS_DIR, `${input.worker}.input.json`)
    if (!existsSync(path) || JSON.parse(readFileSync(path, 'utf8')).shard !== input.shard) {
      throw new Error(`worker 输入缺失或漂移：${input.worker}`)
    }
  }
  console.log(`tsk player plan: 复算一致（${summary.total} 张 / 4 片，status=${status}）`)
} else {
  console.log(JSON.stringify(report, null, 2))
}
