#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（FHV）P6 一般玩家卡分片计划与 worker 输入生成器。
//   node tools/plan-fhv-player.mjs --write   写 audit/fhv-player-shards.json、audit/fhv-player-queue.json
//                                            与 artifacts/migration/fhv/workers/w-m2-N.input.json
//   node tools/plan-fhv-player.mjs --check   只读复算（分片覆盖/输入哈希任一漂移即失败）
//
// 事实源：
//   · 范围与归属：content/campaigns/theFeastOfHemlockVale/shared.js#partitions.fhvPlayer（120 条）；
//   · 卡面字段：src/cards/cards-data.js（唯一印刷事实源）；
//   · 机制归类：audit/fhv-mechanism-scan.json（P1 扫描，逐卡 mechanisms）；
//   · 原语目录：audit/fhv-primitive-plan.json / primitive-catalog.json；
//   · 参考实现：参考资源 Arkham/Card 定义（Asset/Event/Skill 的 TheFeastOfHemlockVale.hs）。
// 分片口径：八片按印刷卡号连续切分（15/15/15/15/15/15/15/15），与八份分片测试一一对应。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const SHARDS_PATH = join(MOD, 'audit/fhv-player-shards.json')
const QUEUE_PATH = join(MOD, 'audit/fhv-player-queue.json')
const WORKERS_DIR = join(RUN, 'workers')
const REFERENCE = join(HALL, '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham')
const REFERENCE_FILES = Object.freeze([
  'Asset/Cards/TheFeastOfHemlockVale.hs',
  'Event/Cards/TheFeastOfHemlockVale.hs',
  'Skill/CardDefs/TheFeastOfHemlockVale.hs',
  'Enemy/CardDefs/TheFeastOfHemlockVale.hs',
])
const SHARD_COUNT = 12
const TEST_FILES = Object.freeze(Array.from({ length: SHARD_COUNT }, (_, index) => `tests/fhv-player-m2-${index + 1}.test.mjs`))
const json = value => JSON.stringify(value, null, 2) + '\n'
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const sha256 = text => createHash('sha256').update(text).digest('hex')

const scan = readJson(join(MOD, 'audit/fhv-mechanism-scan.json'))
const plan = readJson(join(MOD, 'audit/fhv-primitive-plan.json'))
const scanByCode = new Map((scan.cards || []).map(row => [row.code, row]))

// 原语引用：primitive-plan 的 new/reuse 行里 cards 字段包含的卡号。
const primitiveUses = new Map()
for (const row of [...(plan.new || []), ...(plan.reuse || [])]) {
  for (const code of row.cards || []) {
    if (!String(code).startsWith('100') && !String(code).startsWith('101')) continue
    const list = primitiveUses.get(code) || []
    list.push(row.id)
    primitiveUses.set(code, list)
  }
}

// 参考实现位置：三份 Haskell 文件里逐卡首个定义行。
const referenceIndex = new Map()
for (const file of REFERENCE_FILES) {
  const path = join(REFERENCE, file)
  if (!existsSync(path)) continue
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    const match = /\((?:asset|event|skill|basicWeakness|weakness) "(\d{5})"/.exec(line)
    if (match && !referenceIndex.has(match[1])) referenceIndex.set(match[1], { file, line: index + 1 })
  })
}

const basicWeakness = code => ALL_CARDS[code]?.subtype === 'basicweakness'
const researched = code => /^Researched\./m.test(String(ALL_CARDS[code]?.text || ''))
const dependencyOnly = code => (ALL_CARDS[code]?.deckLimit ?? 2) === 0
const buildable = code => !basicWeakness(code) && !dependencyOnly(code) && !researched(code)

const PLAYER_CODES = [...partitions.fhvPlayer].sort()
if (PLAYER_CODES.length !== 120) throw new Error(`fhvPlayer 分区应为 120 条记录，实际 ${PLAYER_CODES.length}`)
const perShard = PLAYER_CODES.length / SHARD_COUNT
const shards = Array.from({ length: SHARD_COUNT }, (_, index) => {
  const codes = PLAYER_CODES.slice(index * perShard, index * perShard + perShard)
  return {
    id: `M2-${index + 1}`,
    worker: `w-m2-${index + 1}`,
    name: `玩家卡 ${`M2-${index + 1}`}：${codes[0]}–${codes[codes.length - 1]}（${codes.length} 张）`,
    testFile: TEST_FILES[index],
    codes,
  }
})
const allCodes = shards.flatMap(shard => shard.codes)
if (new Set(allCodes).size !== 120 || JSON.stringify([...allCodes].sort()) !== JSON.stringify(PLAYER_CODES)) {
  throw new Error('分片必须无交集且并集 = fhvPlayer 分区')
}

const cards = PLAYER_CODES.map(code => {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`未知卡号 ${code}`)
  const shard = shards.find(item => item.codes.includes(code))
  const reference = referenceIndex.get(code) || null
  const mechanisms = (scanByCode.get(code)?.mechanisms || []).map(row => row.id || row).sort()
  return {
    code,
    name: card.nameZh || card.name,
    nameEn: card.name,
    type: card.type,
    klass: card.klass || card.faction || 'neutral',
    xp: card.xp ?? 0,
    level: card.xp ?? 0,
    cost: card.cost ?? null,
    slots: [...(card.slots || [])],
    traits: [...(card.traits || [])],
    subtype: card.subtype || null,
    deckLimit: card.deckLimit ?? 2,
    text: card.text || '',
    textZh: card.textZh || card.text || '',
    skills: { willpower: card.skillWillpower ?? 0, intellect: card.skillIntellect ?? 0, combat: card.skillCombat ?? 0, agility: card.skillAgility ?? 0, wild: card.skillWild ?? 0 },
    basicWeakness: basicWeakness(code),
    dependencyOnly: dependencyOnly(code),
    researched: researched(code),
    buildable: buildable(code),
    reference,
    mechanisms,
    primitiveUses: [...new Set(primitiveUses.get(code) || [])].sort(),
    shard: shard.id,
    entryFile: `src/cards/entries/${code}.js`,
    testFile: shard.testFile,
  }
})

const countBy = fn => Object.fromEntries([...cards.reduce((map, card) => map.set(fn(card), (map.get(fn(card)) || 0) + 1), new Map())]
  .sort(([a], [b]) => String(a).localeCompare(String(b))))
const summary = {
  total: cards.length,
  shards: shards.map(shard => ({ id: shard.id, worker: shard.worker, count: shard.codes.length, testFile: shard.testFile })),
  buildable: cards.filter(card => card.buildable).length,
  basicWeaknesses: cards.filter(card => card.basicWeakness).length,
  dependencyOnly: cards.filter(card => card.dependencyOnly).length,
  researched: cards.filter(card => card.researched).length,
  byClass: countBy(card => card.klass),
  byType: countBy(card => card.type),
  byXp: countBy(card => card.xp),
  tests: TEST_FILES,
}
const gates = {
  scopePartition: cards.length === 120,
  shardsExact: shards.length === SHARD_COUNT && shards.every(shard => shard.codes.length === perShard),
  noOverlapNoGap: new Set(allCodes).size === 120 && JSON.stringify([...allCodes].sort()) === JSON.stringify(PLAYER_CODES),
  mechanismClassified: cards.every(card => card.mechanisms.length > 0),
  referenceLocated: cards.every(card => card.reference),
  basicWeaknessesClassified: cards.filter(card => card.basicWeakness).length === 4,
  dependencyClassified: cards.filter(card => card.dependencyOnly).length === 11,
  researchedClassified: cards.filter(card => card.researched).length === 3,
  testFilesDeclared: TEST_FILES.length === SHARD_COUNT && shards.every(shard => cards.filter(card => card.shard === shard.id).every(card => card.testFile === shard.testFile)),
}
const status = Object.values(gates).every(Boolean) ? 'planned' : 'pending'

const queue = {
  schemaVersion: 1,
  cycle: 'fhv',
  phase: 'P6',
  generatedBy: 'tools/plan-fhv-player.mjs',
  items: cards.map(card => ({
    id: card.code,
    code: card.code,
    name: card.name,
    shard: card.shard,
    status: 'pending',
    kind: card.basicWeakness ? 'basic-weakness' : card.dependencyOnly ? 'dependency' : card.researched ? 'researched' : 'player-card',
    requirements: {
      entry: card.entryFile,
      test: card.testFile,
      mechanisms: card.mechanisms,
      primitives: card.primitiveUses,
      reference: card.reference,
    },
  })),
}
const report = { schemaVersion: 1, cycle: 'fhv', phase: 'P6', generatedBy: 'tools/plan-fhv-player.mjs', status, summary, gates, shards, cards, queue: { path: 'audit/fhv-player-queue.json', total: queue.items.length } }
const workerInputs = shards.map(shard => ({
  shard: shard.id,
  worker: shard.worker,
  testFile: shard.testFile,
  entryFiles: shard.codes.map(code => `src/cards/entries/${code}.js`),
  cards: cards.filter(card => card.shard === shard.id),
  instructions: [
    '只写分片内 src/cards/entries/<code>.js 与本分片 testFile；不改共享文件、不重建索引、不改其他分片文件。',
    '每张卡至少一条 P6 <code> 开头的真实行为测试（费用/目标/窗口/持续/负面路径之一）；条目自述近似用 simplified:true + note 逐条披露。',
    '缺原语时写 ../../artifacts/migration/fhv/primitive-requests/<code>.json（status pending），卡可先近似实现并在 note 披露，不直写状态绕过 API。',
    '完成后输出 JSON 摘要：{ shard, verified: [codes], blocked: [codes], approximate: [codes], tests }。',
  ],
}))

if (process.argv.includes('--write')) {
  mkdirSync(WORKERS_DIR, { recursive: true })
  mkdirSync(join(RUN, 'primitive-requests'), { recursive: true })
  writeFileSync(SHARDS_PATH, json({
    schemaVersion: 1, cycle: 'fhv', phase: 'P6', generatedBy: 'tools/plan-fhv-player.mjs',
    status, summary, gates, shards,
  }))
  writeFileSync(QUEUE_PATH, json(queue))
  writeFileSync(join(RUN, 'player-plan.json'), json(report))
  for (const input of workerInputs) writeFileSync(join(WORKERS_DIR, `${input.worker}.input.json`), json(input))
  console.log(`fhv player plan: 已写入（${summary.total} 张 / ${SHARD_COUNT} 片；可构筑 ${summary.buildable}，基础弱点 ${summary.basicWeaknesses}，绑定依赖 ${summary.dependencyOnly}，Research ${summary.researched}）`)
  console.log(json({ status, gates }))
  if (status !== 'planned') throw new Error(`fhv player plan 门禁未全真：${json(gates)}`)
} else if (process.argv.includes('--check')) {
  if (!existsSync(SHARDS_PATH) || !existsSync(QUEUE_PATH)) throw new Error('缺少分片/队列产物：先 --write')
  const freshShards = json({
    schemaVersion: 1, cycle: 'fhv', phase: 'P6', generatedBy: 'tools/plan-fhv-player.mjs',
    status, summary, gates, shards,
  })
  if (readFileSync(SHARDS_PATH, 'utf8') !== freshShards) throw new Error('audit/fhv-player-shards.json 与复算不一致：审阅后 --write')
  if (readFileSync(QUEUE_PATH, 'utf8') !== json(queue)) throw new Error('audit/fhv-player-queue.json 与复算不一致：审阅后 --write')
  for (const input of workerInputs) {
    const path = join(WORKERS_DIR, `${input.worker}.input.json`)
    if (!existsSync(path) || sha256(readFileSync(path, 'utf8')) !== sha256(json(input))) {
      throw new Error(`worker 输入缺失或漂移：${input.worker}`)
    }
  }
  console.log(`fhv player plan: 复算一致（${summary.total} 张 / ${SHARD_COUNT} 片，status=${status}）`)
} else {
  console.log(json(report))
}
