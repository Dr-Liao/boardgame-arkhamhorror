#!/usr/bin/env node
// P8 剧本迁移分片扫描：把 tdeCampaign 的 283 条遭遇记录按「章对」切成 6 个 worker 分片，
// 同时生成每个 worker 的输入清单（一次性产物，运行目录不签入）。
//
//   node tools/scan-tde-scenario-shards.mjs [--write]
//
// 口径（路线图 §9）：
//   · 8 个章节组（253 条）+ 12 个战役共享组（30 条）= 283 条，每张卡只进一片；
//   · 分片按「章对」切：对 1（A1+B1）/ 对 2A（A2 最大章）/ 对 2B+对 3A / 对 3B / 对 4A / 对 4B+共享组；
//   · 每片同时登记该 worker 负责的章节模块（definition/layout/behavior/chaos/index）。
//   · Search 章 53 条单独占一片（路线图 R6：不按章均分）。
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MOD = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACTS = resolve(MOD, 'artifacts/migration/tde')
const WRITE = process.argv.includes('--write')

const readJson = path => JSON.parse(readFileSync(resolve(MOD, path), 'utf8'))
const sha256 = text => createHash('sha256').update(text).digest('hex')

export const SHARDS = Object.freeze([
  {
    id: 'P8-1',
    owner: 'w-p8-a',
    modules: ['beyondTheGatesOfSleep', 'wakingNightmare'],
    groups: ['beyondTheGatesOfSleep', 'wakingNightmare'],
    note: '对 1：A1《梦境门外》+ B1《清醒噩梦》',
  },
  {
    id: 'P8-2',
    owner: 'w-p8-b',
    modules: ['theSearchForKadath'],
    groups: ['theSearchForKadath'],
    note: '对 2 的 A 侧：最大章《寻觅卡达斯》（53 条，单独一片）',
  },
  {
    id: 'P8-3',
    owner: 'w-p8-c',
    modules: ['aThousandShapesOfHorror', 'darkSideOfTheMoon'],
    groups: ['aThousandShapesOfHorror', 'darkSideOfTheMoon'],
    note: '对 2 的 B 侧 + 对 3 的 A 侧：《万千骇形》+《月之暗面》',
  },
  {
    id: 'P8-4',
    owner: 'w-p8-d',
    modules: ['pointOfNoReturn'],
    groups: ['pointOfNoReturn'],
    note: '对 3 的 B 侧：《无归之地》',
  },
  {
    id: 'P8-5',
    owner: 'w-p8-e',
    modules: ['whereTheGodsDwell'],
    groups: ['whereTheGodsDwell'],
    note: '对 4 的 A 侧：《神居之所》',
  },
  {
    id: 'P8-6',
    owner: 'w-p8-f',
    modules: ['weaverOfTheCosmos'],
    groups: ['weaverOfTheCosmos', 'agentsOfAtlachNacha', 'agentsOfNyarlathotep', 'corsairs',
      'creaturesOfTheUnderworld', 'descentIntoThePitch', 'dreamersCurse', 'dreamlands',
      'mergingRealities', 'spiders', 'terrorOfTheVale', 'whispersOfHypnos', 'zoogs'],
    note: '对 4 的 B 侧：《编织宇宙》+ 12 个战役共享组',
  },
])

const TYPE_LABEL = Object.freeze({
  act: '幕', agenda: '议程', location: '地点', enemy: '敌人', treachery: '诡计',
  story: '剧情', asset: '剧情支援', scenario: '剧本参考卡',
})

function main() {
  const scope = readJson('artifacts/migration/tde/scope.json')
  const scan = readJson('artifacts/migration/tde/mechanism-scan.json')
  const cards = new Map(scan.cards.map(card => [card.code, card]))
  // 分片清单用 camelCase 组 id；mechanism-scan 的组 id 是 snake_case encounterCode。
  const camelToSnake = new Map(scope.encounterGroups.map(group => [group.id, group.encounterCode]))
  const groups = new Map(scan.encounterGroups.map(group => [group.id, group]))
  const groupFor = id => groups.get(id) || groups.get(camelToSnake.get(id))
  const problems = []

  const shards = SHARDS.map(shard => {
    const records = []
    for (const groupId of shard.groups) {
      const group = groupFor(groupId)
      if (!group) {
        problems.push(`${shard.id}: 未知遭遇组 ${groupId}`)
        continue
      }
      for (const code of group.codes) {
        const card = cards.get(code)
        if (!card) {
          problems.push(`${shard.id}: 卡 ${code} 不在 mechanism-scan.cards`)
          continue
        }
        records.push({
          code,
          type: card.type,
          typeLabel: TYPE_LABEL[card.type] || card.type,
          name: card.nameZh || card.name,
          nameEn: card.name,
          face: card.face === true,
          encounterCode: group.encounterCode,
          group: groupId,
        })
      }
    }
    return {
      id: shard.id,
      owner: shard.owner,
      modules: shard.modules,
      groups: shard.groups,
      note: shard.note,
      records,
      counts: Object.fromEntries(Object.entries(records.reduce((acc, record) => {
        acc[record.type] = (acc[record.type] || 0) + 1
        return acc
      }, {})).sort(([a], [b]) => a.localeCompare(b))),
      recordCount: records.length,
    }
  })

  // 守恒：283 = Σ 分片；每张卡只出现一次；分片组/模块与 scope 一致。
  const seen = new Map()
  for (const shard of shards) {
    for (const record of shard.records) {
      if (seen.has(record.code)) problems.push(`重复分片：${record.code} 同时在 ${seen.get(record.code)} 与 ${shard.id}`)
      else seen.set(record.code, shard.id)
    }
  }
  const expected = scope.counts.packs.tdeCampaign
  const total = shards.reduce((sum, shard) => sum + shard.recordCount, 0)
  if (total !== expected) problems.push(`分片记录数 ${total} 与 scope 的 tdeCampaign ${expected} 不一致`)
  if (seen.size !== expected) problems.push(`分片唯一卡数 ${seen.size} 与 ${expected} 不一致`)
  const chapterGroups = new Set(scope.encounterGroups.filter(group => group.kind === 'chapter').map(group => group.id))
  const shardGroups = new Set(shards.flatMap(shard => shard.groups))
  for (const groupId of chapterGroups) if (!shardGroups.has(groupId)) problems.push(`章节组未分片：${groupId}`)
  for (const shard of shards) for (const moduleId of shard.modules) {
    if (!chapterGroups.has(moduleId)) problems.push(`${shard.id}: 模块 ${moduleId} 不是章节组`)
  }
  for (const scenarioId of scope.chapters.map(chapter => chapter.id)) {
    if (!shards.some(shard => shard.modules.includes(scenarioId))) problems.push(`章节模块未分片：${scenarioId}`)
  }

  const payload = {
    schemaVersion: 1,
    cycle: 'tde',
    step: 'P8 剧本迁移分片',
    generatedBy: 'tools/scan-tde-scenario-shards.mjs --write',
    source: {
      scope: 'artifacts/migration/tde/scope.json',
      scopeSha256: sha256(readFileSync(resolve(MOD, 'artifacts/migration/tde/scope.json'), 'utf8')),
      mechanismScan: 'artifacts/migration/tde/mechanism-scan.json',
      mechanismScanSha256: sha256(readFileSync(resolve(MOD, 'artifacts/migration/tde/mechanism-scan.json'), 'utf8')),
    },
    totals: { records: total, shards: shards.length, expected },
    shards,
    gate: { pass: problems.length === 0, problems },
  }

  console.log(`P8 分片：${shards.length} 片 / ${total} 条记录（期望 ${expected}）— ${payload.gate.pass ? 'PASS' : 'FAIL'}`)
  for (const shard of shards) {
    console.log(`  ${shard.id} ${shard.owner}  ${String(shard.recordCount).padStart(3)} 条  ${JSON.stringify(shard.counts)}`)
  }
  for (const problem of problems) console.log(`  ✗ ${problem}`)

  if (WRITE) {
    mkdirSync(resolve(ARTIFACTS, 'workers'), { recursive: true })
    writeFileSync(resolve(ARTIFACTS, 'p8-shards.json'), `${JSON.stringify(payload, null, 2)}\n`)
    for (const shard of shards) {
      const lines = [
        `# ${shard.id}（${shard.owner}）· ${shard.note}`,
        '',
        `负责章节模块：${shard.modules.map(id => `\`${id}\``).join('、')}`,
        `遭遇组：${shard.groups.map(id => `\`${id}\``).join('、')}`,
        `记录：${shard.recordCount} 条（${Object.entries(shard.counts).map(([type, n]) => `${TYPE_LABEL[type] || type} ${n}`).join(' / ')}）`,
        '',
        '| # | 卡号 | 类型 | 中文名 | 英文名 | 组 | 面 |',
        '| ---: | --- | --- | --- | --- | --- | --- |',
        ...shard.records.map((record, index) => `| ${index + 1} | ${record.code} | ${record.typeLabel} | ${record.name} | ${record.nameEn} | ${record.encounterCode} | ${record.face ? '是' : ''} |`),
        '',
      ]
      writeFileSync(resolve(ARTIFACTS, 'workers', `${shard.owner}.inventory.md`), lines.join('\n'))
    }
    console.log(`已写入 artifacts/migration/tde/p8-shards.json 与 workers/*.inventory.md`)
  }
  process.exit(problems.length === 0 ? 0 : 1)
}

main()
