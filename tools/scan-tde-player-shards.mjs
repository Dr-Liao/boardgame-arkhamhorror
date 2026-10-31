#!/usr/bin/env node
// 食梦者（TDE，第五循环）P7 / M2 玩家卡分片与 worker 输入快照 —— P7 主进程工具。
//
//   node tools/scan-tde-player-shards.mjs --write   生成 shards.json + workers/<worker>.input.json
//   node tools/scan-tde-player-shards.mjs --check   只读复算：分片划分 / 87 张覆盖 / 无重叠 / 输入哈希
//
// 事实源：
//   · 分片成员来自 artifacts/migration/tde/scope.json 的 shards.playerWaves（P1 锁定的唯一范围事实）；
//   · 卡面字段来自 src/cards/cards-data.js（唯一印刷事实源）；
//   · 机制归属来自 artifacts/migration/tde/mechanism-scan.json；
//   · 参考实现路径由 参考资源/ArkhamHorror-main 的 .hs 源扫描得到（只读，不进产物哈希）。
//
// 产物（.gitignore 白名单之外，属于运行目录；worker 只读）：
//   artifacts/migration/tde/shards.json
//   artifacts/migration/tde/workers/w-m2-1.input.json … w-m2-4.input.json
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(gameRoot, '..', '..')
const migrationDir = path.join(gameRoot, 'artifacts/migration/tde')
const scopePath = path.join(migrationDir, 'scope.json')
const scanPath = path.join(migrationDir, 'mechanism-scan.json')
const cardsDataPath = path.join(gameRoot, 'src/cards/cards-data.js')
const shardsPath = path.join(migrationDir, 'shards.json')
const workersDir = path.join(migrationDir, 'workers')
const referenceRoot = path.join(repoRoot, '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham')

const rel = file => path.relative(gameRoot, file).replaceAll('\\', '/')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const write = process.argv.includes('--write')
if (!write && !process.argv.includes('--check')) {
  console.error('用法：node tools/scan-tde-player-shards.mjs --write | --check')
  process.exit(2)
}

const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'))
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'))
const { ALL_CARDS } = await import(`file://${cardsDataPath.replaceAll('\\', '/')}`)

// ---- 1. 分片：以 scope.json 的 playerWaves 为唯一事实，4 片 22/22/22/21 -------------------
const waves = scope?.shards?.playerWaves
if (!Array.isArray(waves) || waves.length !== 4) throw new Error('scope.shards.playerWaves 不是 4 片')
const shardDefs = waves.map((wave, index) => {
  if (!Array.isArray(wave.codes) || !wave.codes.length) throw new Error(`分片 ${wave.id} 没有卡号`)
  // 卡号排序保持 scope 里的印刷顺序（不重排，账本按此顺序输出）。
  const codes = [...wave.codes]
  if (new Set(codes).size !== codes.length) throw new Error(`分片 ${wave.id} 有重复卡号`)
  for (const code of codes) {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`分片 ${wave.id} 含未知卡号 ${code}`)
    if (card.encounterCode) throw new Error(`玩家分片混入战役卡 ${code}`)
    if (card.type === 'investigator' || card.signatureFor) throw new Error(`玩家分片混入调查员卡 ${code}`)
  }
  const n = index + 1
  return {
    id: wave.id,
    worker: `w-m2-${n}`,
    shard: wave.id,
    name: `玩家卡 ${wave.id}（${codes[0]}–${codes[codes.length - 1]}，${codes.length} 张）`,
    codes,
    count: codes.length,
    entryFiles: codes.map(code => `src/cards/entries/${code}.js`),
    testFile: `tests/tde-player-m2-${n}.test.mjs`,
    workerReport: `artifacts/migration/tde/workers/w-m2-${n}.json`,
    primitiveRequests: 'artifacts/migration/tde/primitive-requests/',
  }
})
const expectedCounts = [22, 22, 22, 21]
shardDefs.forEach((shard, index) => {
  if (shard.count !== expectedCounts[index]) {
    throw new Error(`分片 ${shard.id} 应为 ${expectedCounts[index]} 张，scope 实为 ${shard.count} 张`)
  }
})
const allCodes = shardDefs.flatMap(shard => shard.codes)
const unique = new Set(allCodes)
if (allCodes.length !== 87 || unique.size !== 87) {
  throw new Error(`玩家分片应覆盖 87 张唯一卡，实际 ${allCodes.length} / 唯一 ${unique.size}`)
}
// 与 P7 手册的 87 张口径交叉核对：非战役、非调查员/专属、资产/事件/技能或弱点。
const playerScopeCodes = Object.values(ALL_CARDS)
  .filter(card => /^06\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator'
    && (['asset', 'event', 'skill'].includes(card.type) || ['weakness', 'basicweakness'].includes(card.subtype)))
  .map(card => card.code)
  .sort()
if (JSON.stringify([...unique].sort()) !== JSON.stringify(playerScopeCodes)) {
  throw new Error(`分片卡号与 06 段玩家卡口径不一致：${allCodes.length} vs ${playerScopeCodes.length}`)
}

// ---- 2. 参考实现索引：扫 参考资源 里的 .hs，按卡号字符串定位（只读，不写进产物哈希） ------
const referenceFiles = (() => {
  if (!fs.existsSync(referenceRoot)) return []
  const files = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.hs')) files.push(full)
    }
  }
  walk(referenceRoot)
  return files
})()
const referenceTextCache = new Map()
const referenceFilesFor = code => {
  const pattern = `"${code}"`
  const hits = []
  for (const file of referenceFiles) {
    let text = referenceTextCache.get(file)
    if (text === undefined) {
      text = fs.readFileSync(file, 'utf8')
      referenceTextCache.set(file, text)
    }
    if (text.includes(pattern)) hits.push(rel(file).replace(/^\.\.\/\.\.\//, ''))
  }
  return hits
}

// ---- 3. 每张卡的输入快照 ----------------------------------------------------------------
const mechanismsByCode = new Map((scan.cards || []).map(card => [card.code, card.mechanisms || []]))
const pickCardFields = code => {
  const card = ALL_CARDS[code]
  const out = {
    code,
    name: card.name,
    nameZh: card.nameZh || '',
    type: card.type,
    klass: card.klass || null,
    xp: card.xp || 0,
    cost: card.cost ?? null,
    slot: card.slot || null,
    traits: card.traits || [],
    traitsZh: card.traitsZh || [],
    icons: card.icons || {},
    text: card.text || '',
    textZh: card.textZh || '',
    flavor: card.flavor || '',
    flavorZh: card.flavorZh || '',
    exceptional: card.exceptional === true,
    permanent: card.permanent === true,
    exile: card.exile === true,
    hidden: card.hidden === true,
    myriad: card.myriad === true,
    deckLimit: card.deckLimit ?? null,
    subtype: card.subtype || null,
    quantity: card.quantity ?? null,
    pack: card.pack || '',
    mechanisms: mechanismsByCode.get(code) || [],
    referenceFiles: referenceFilesFor(code),
  }
  if (card.bondedCards) out.bondedCards = card.bondedCards
  if (card.bondedTo) out.bondedTo = card.bondedTo
  if (card.bondedCount) out.bondedCount = card.bondedCount
  return out
}
const shardsDoc = {
  schemaVersion: 1,
  cycle: 'tde',
  cycleName: 'The Dream Eaters',
  cycleNameZh: '食梦者',
  milestone: 'P7',
  stage: '第 5 步：批量迁移内容 · M2 玩家卡（4 子进程批量，22/22/22/21）',
  generatedBy: 'tools/scan-tde-player-shards.mjs',
  protocol: 'docs/arkham-content-migration.md §4.6（多子进程 + 原语队列）',
  docs: 'docs/tde-migration-roadmap.md §8.2 / docs/tde-player-cards.md',
  workerBrief: 'artifacts/migration/tde/workers/P7-WORKER-BRIEF.md',
  totalCards: allCodes.length,
  shardCount: shardDefs.length,
  inputSnapshot: [scopePath, scanPath, cardsDataPath].map(file => ({ path: rel(file), sha256: sha256(fs.readFileSync(file)) })),
  boundaries: {
    mainProcess: [
      'src/engine/**', 'src/cards/entries/_shared.js', 'src/cards/entries/index.js',
      'content/**', 'src/deck/**', 'web/**', 'docs/**', 'audit/**', 'tools/**',
      'tests/suites.mjs', 'tests/node-suite.mjs', 'package.json',
      'artifacts/migration/tde/shards.json', 'artifacts/migration/tde/reports/**',
      'artifacts/migration/tde/workers/P7-WORKER-BRIEF.md',
    ],
    worker: [
      'own src/cards/entries/<code>.js',
      'own tests/tde-player-m2-<n>.test.mjs',
      'own artifacts/migration/tde/workers/<worker>.json',
      'artifacts/migration/tde/primitive-requests/*.json',
    ],
  },
  indexPolicy: 'worker 不直接运行 build-card-index；用 node tools/tde-p7-index-sync.mjs（主进程批准的串行索引同步）在跑测试前收录自己新写的条目。合并后由主进程再重建一次并以 cards:check 为准。',
  disjoint: { pass: true, total: allCodes.length, unique: unique.size },
  workers: shardDefs,
}
const workerDocs = shardDefs.map(shard => ({
  schemaVersion: 1,
  shard: shard.shard,
  worker: shard.worker,
  source: 'src/cards/cards-data.js（唯一卡面事实源；中文卡文优先 textZh）',
  referenceImplementation: '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham（只读；.hs 用卡号字符串检索）',
  count: shard.count,
  testFile: shard.testFile,
  cards: shard.codes.map(pickCardFields),
}))

// ---- 4. 写盘 / 校验 ---------------------------------------------------------------------
if (write) {
  fs.writeFileSync(shardsPath, `${JSON.stringify(shardsDoc, null, 2)}\n`)
  fs.mkdirSync(workersDir, { recursive: true })
  for (const doc of workerDocs) {
    fs.writeFileSync(path.join(workersDir, `${doc.worker}.input.json`), `${JSON.stringify(doc, null, 2)}\n`)
    fs.rmSync(path.join(workersDir, `${doc.worker}.output.json`), { force: true })
  }
  console.log(JSON.stringify({ wrote: rel(shardsPath), workers: workerDocs.length, total: allCodes.length }))
} else {
  if (!fs.existsSync(shardsPath)) throw new Error('缺少 artifacts/migration/tde/shards.json：先跑 --write')
  const existing = JSON.parse(fs.readFileSync(shardsPath, 'utf8'))
  const normalize = doc => JSON.stringify({ ...doc, inputSnapshot: undefined })
  if (normalize(existing) !== normalize(shardsDoc)) {
    throw new Error('shards.json 与 scope/cards-data 不一致：重跑 node tools/scan-tde-player-shards.mjs --write')
  }
  for (const [index, doc] of workerDocs.entries()) {
    const file = path.join(workersDir, `${doc.worker}.input.json`)
    if (!fs.existsSync(file)) throw new Error(`缺少 worker 输入快照：${rel(file)}`)
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (JSON.stringify(saved) !== JSON.stringify(doc)) {
      throw new Error(`${rel(file)} 与 cards-data/mechanism-scan 不一致：重跑 --write`)
    }
    if (saved.count !== expectedCounts[index]) throw new Error(`${rel(file)} 分片张数不一致`)
  }
  console.log(JSON.stringify({ gate: { pass: true, total: allCodes.length, shards: shardDefs.map(shard => shard.count) } }))
}
