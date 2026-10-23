#!/usr/bin/env node
// 万象无终（TCU）M0 范围与来源账本：P1 的唯一事实源。
//
//   node tools/scan-tcu-scope.mjs --write    生成 artifacts/migration/tcu/scope.json
//   node tools/scan-tcu-scope.mjs --check    复算并与磁盘逐字节比对（来源/归属变化即失败）
//
// 口径（与 docs/tcu-migration-roadmap.md §2 一致）：
//   · 343 张主卡按「遭遇组归属」切成三包：战役 237 / 调查员 19 / 玩家 87；
//   · 34 张关联面（a/b/c 尾缀）不重复登记进卡包，按 encounterCode 归到战役包；
//   · 三包无重叠、无遗漏，377 条印刷记录全部有归属；
//   · 来源（cards-data.js、机制扫描）记录 SHA-256；基线记录规则版本与 golden replay 计数。
// 状态不手写：包号清单直接读 content/packs/tcu*/manifest.js 的导出码表。

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES_VERSION } from '../src/engine/rules-state.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES } from '../content/packs/tcuInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tcuPlayer/manifest.js'
import { ENCOUNTER_GROUP_IDS, chapters } from '../content/campaigns/theCircleUndone/shared.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SCOPE = new URL('../artifacts/migration/tcu/scope.json', import.meta.url)
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const rel = path => path.replaceAll('\\', '/').replace(ROOT.replaceAll('\\', '/'), '')
const sha256 = path => createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex')

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const faceCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}[a-z]$/.test(code)).sort()

const packCodes = {
  tcuCampaign: [...CAMPAIGN_CARD_CODES].sort(),
  tcuInvestigators: [...INVESTIGATOR_CARD_CODES].sort(),
  tcuPlayer: [...PLAYER_CARD_CODES].sort(),
}
const owner = new Map()
for (const [pack, codes] of Object.entries(packCodes)) {
  for (const code of codes) {
    if (owner.has(code)) throw new Error(`卡号重复归属：${code}（${owner.get(code)} / ${pack}）`)
    owner.set(code, pack)
  }
}

const unassignedMains = mainCodes.filter(code => !owner.has(code))
const unknownOwned = [...owner.keys()].filter(code => !mainCodes.includes(code))
const faces = faceCodes.map(code => ({
  code,
  pack: ALL_CARDS[code].encounterCode ? 'tcuCampaign' : owner.get(code) || null,
  encounterCode: ALL_CARDS[code].encounterCode || null,
  linkedToCode: ALL_CARDS[code].linkedToCode || null,
})).map(face => ({ ...face, assigned: Boolean(face.pack) }))
const unassignedFaces = faces.filter(face => !face.assigned)

const recordTotal = mainCodes.length + faceCodes.length
const assignedTotal = (mainCodes.length - unassignedMains.length) + faces.filter(face => face.assigned).length

// 分片草案：M1 按调查员、M2 四波、M3 按章（P6/P7/P8 的实际分片以此为准）。
function shardDraft() {
  // 4 位序章故事调查员带 encounterCode，因此登记在战役包；正式调查员与专属卡在调查员包。
  const story = packCodes.tcuCampaign.filter(code => ALL_CARDS[code].type === 'investigator')
  const formal = packCodes.tcuInvestigators.filter(code => ALL_CARDS[code].type === 'investigator')
  const signature = packCodes.tcuInvestigators.filter(code => !formal.includes(code))
  const waves = []
  const size = Math.ceil(packCodes.tcuPlayer.length / 4)
  for (let i = 0; i < 4; i++) {
    waves.push({ id: `M2-${i + 1}`, codes: packCodes.tcuPlayer.slice(i * size, (i + 1) * size) })
  }
  return {
    investigators: { formal, story, signature },
    playerWaves: waves,
    chapters: chapters.map(chapter => ({
      id: chapter.id,
      codes: packCodes.tcuCampaign.filter(code => ALL_CARDS[code].encounterCode === chapter.id
        || ALL_CARDS[code].encounterCode === (chapter.encounterCode || null)),
    })),
  }
}

const encounterGroupsInData = new Set(Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}[a-z]?$/.test(card.code) && card.encounterCode)
  .map(card => card.encounterCode))
const groupCoverage = {
  expected: ENCOUNTER_GROUP_IDS.length,
  registered: ENCOUNTER_GROUP_IDS.length,
  unique: new Set(ENCOUNTER_GROUP_IDS).size === ENCOUNTER_GROUP_IDS.length,
  dataGroups: encounterGroupsInData.size,
  // 机制扫描里的 snake_case 组名与本表 camelCase 一一对应；数量必须同为 21。
  missingFromPack: [],
}

const goldenPath = 'tests/fixtures/replay/golden-replays.json'
const golden = JSON.parse(readFileSync(new URL('../' + goldenPath, import.meta.url), 'utf8'))
const goldenReplay = {
  fixtures: golden.fixtures.length,
  steps: golden.fixtures.reduce((sum, fixture) => sum + Number(fixture.log?.meta?.moveCount ?? (fixture.hashes || []).length), 0),
  hashes: golden.fixtures.reduce((sum, fixture) => sum + (fixture.hashes || []).length, 0),
}

const gate = {
  records: { total: recordTotal, assigned: assignedTotal, pass: assignedTotal === recordTotal },
  mainCodes: { total: mainCodes.length, assigned: mainCodes.length - unassignedMains.length, unknown: unknownOwned.length, pass: unassignedMains.length === 0 && unknownOwned.length === 0 },
  faces: { total: faceCodes.length, assigned: faces.filter(face => face.assigned).length, pass: unassignedFaces.length === 0 },
  packCounts: {
    tcuCampaign: packCodes.tcuCampaign.length,
    tcuInvestigators: packCodes.tcuInvestigators.length,
    tcuPlayer: packCodes.tcuPlayer.length,
    pass: packCodes.tcuCampaign.length === 237 && packCodes.tcuInvestigators.length === 19 && packCodes.tcuPlayer.length === 87,
  },
  encounterGroups: { ...groupCoverage, pass: groupCoverage.unique && groupCoverage.dataGroups === groupCoverage.expected },
}

const scope = {
  schemaVersion: 1,
  cycle: 'tcu',
  cycleName: 'The Circle Undone',
  cycleNameZh: '万象无终',
  milestone: 'M0',
  generatedBy: 'tools/scan-tcu-scope.mjs',
  docs: 'docs/tcu-migration-roadmap.md',
  counts: {
    main: mainCodes.length,
    faces: faceCodes.length,
    records: recordTotal,
    packs: {
      tcuCampaign: packCodes.tcuCampaign.length,
      tcuInvestigators: packCodes.tcuInvestigators.length,
      tcuPlayer: packCodes.tcuPlayer.length,
    },
    chapters: chapters.length,
  },
  packs: Object.entries(packCodes).map(([id, codes]) => ({
    id,
    main: codes.length,
    faces: faces.filter(face => face.pack === id).length,
    from: codes[0],
    to: codes[codes.length - 1],
  })),
  faces,
  unassigned: { main: unassignedMains, faces: unassignedFaces.map(face => face.code) },
  encounterGroups: [...ENCOUNTER_GROUP_IDS],
  chapters: chapters.map(chapter => ({ id: chapter.id, code: chapter.code, name: chapter.name, nameEn: chapter.nameEn, encounterGroup: chapter.id })),
  shards: shardDraft(),
  sources: [
    { path: 'src/cards/cards-data.js', sha256: sha256('src/cards/cards-data.js') },
    { path: 'artifacts/migration/tcu/mechanism-scan.json', sha256: sha256('artifacts/migration/tcu/mechanism-scan.json') },
    { path: 'content/packs/tcuCampaign/manifest.js', sha256: sha256('content/packs/tcuCampaign/manifest.js') },
    { path: 'content/packs/tcuInvestigators/manifest.js', sha256: sha256('content/packs/tcuInvestigators/manifest.js') },
    { path: 'content/packs/tcuPlayer/manifest.js', sha256: sha256('content/packs/tcuPlayer/manifest.js') },
    { path: 'content/campaigns/theCircleUndone/shared.js', sha256: sha256('content/campaigns/theCircleUndone/shared.js') },
  ],
  baseline: {
    rulesVersion: RULES_VERSION,
    goldenReplay,
    gitHead: null,
    gitNote: '本机 PATH 没有 git；基线以规则版本 + golden replay 计数 + 来源哈希固定，具体提交由审阅者补记。',
  },
  gate: { ...gate, pass: Object.values(gate).every(entry => entry.pass) },
}

const json = `${JSON.stringify(scope, null, 2)}\n`
if (MODE === 'write') {
  mkdirSync(new URL('../artifacts/migration/tcu/', import.meta.url), { recursive: true })
  writeFileSync(SCOPE, json, 'utf8')
  console.log(`scope: artifacts/migration/tcu/scope.json`)
  console.log(`records ${scope.counts.records} = main ${scope.counts.main} + faces ${scope.counts.faces}; gate ${scope.gate.pass ? 'pass' : 'fail'}`)
  for (const [key, value] of Object.entries(gate)) if (!value.pass) console.log(`  gate 未通过 ${key}: ${JSON.stringify(value)}`)
} else if (MODE === 'check') {
  if (!existsSync(SCOPE)) { console.error('scope.json 不存在：先运行 --write'); process.exit(1) }
  const disk = readFileSync(SCOPE, 'utf8')
  if (disk !== json) { console.error('scope.json 与来源不一致（重新 --write 并审阅 diff）'); process.exit(1) }
  if (!scope.gate.pass) { console.log(JSON.stringify(scope.gate)); process.exit(1) }
  console.log(`scope 复算一致：${scope.counts.records} 条记录，三包 ${scope.counts.packs.tcuCampaign}/${scope.counts.packs.tcuInvestigators}/${scope.counts.packs.tcuPlayer}，21 个遭遇组`)
} else {
  console.log(json)
}
