// 通用逐卡验收账本生成器（2026-11-24）
//
// 背景：`tools/audit-core-acceptance.mjs` / `audit-dunwich-acceptance.mjs` 等把「跑行为测试 →
// 逐卡收集证据 → 写账本 + 接入目录」这条流程各复制了一份。逐单元验收（docs/test/ACCEPTANCE-ORDER.md）
// 要覆盖十几个单元，继续复制会让「证据口径」越写越散，因此收敛成一个带单元配置的生成器：
//
//   tools/acceptance-units/<unitId>.mjs   单元配置（范围 / 测试文件 / 证据标题 / 输出路径 / profile）
//   node tools/audit-card-unit.mjs <unitId> [--write|--check]
//
// 硬性口径（与既有账本一致，不放宽）：
//   - 先真实执行配置里的测试文件；任何 fail / skip / todo 都不写盘。
//   - 每张卡必须至少有一条标题命中其卡号的通过用例；只证明「条目存在 / 可构筑 / 目录数据」的标题
//     不作为行为证据（配置里的 evidence.forbidTitles 会拒绝）。
//   - 写到盘的账本与模块由 --write 生成、--check 逐字节复算；账本 SHA-256 写进模块，供 import-cards
//     与目录状态维持同一份事实。
//
// 单元配置形状（见现有 acceptance-units/*.mjs）：
//   export default {
//     id: '01-a', acceptanceId: 'revised-core-2026-11',
//     exportPrefix: 'RCORE', verifiedFn: 'rcoreCardVerified',
//     profile: { id, scope, basis, houseRules, sources },
//     select: card => card.pack === 'rcore',
//     exclude: ['01000'],
//     expectedCount: 116,
//     testFiles: ['games/arkhamhorror/tests/acceptance-01-a-rcore.test.mjs'],
//     evidence: { titlePrefixes: ['RCore'], forbidTitles: /条目|目录|可构筑|存在/ },
//     outputs: { ledger: 'audit/rcore-acceptance.json', module: 'src/cards/rcore-acceptance.js' },
//   }
//
// 用法：
//   node tools/audit-card-unit.mjs 01-a --write
//   node tools/audit-card-unit.mjs 01-a          # 校验（不写盘，漂移即失败）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const unitsDir = path.join(root, game, 'tools/acceptance-units')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

function loadUnit(id) {
  const file = path.join(unitsDir, `${id}.mjs`)
  if (!fs.existsSync(file)) throw new Error(`未知验收单元：${id}（缺少 ${path.relative(root, file)}）`)
  return import(pathToFileURL(file).href)
}

const pathToFileUrl = file => pathToFileURL(file)

function selectCards(unit) {
  const excluded = new Set(unit.exclude || [])
  const cards = Object.values(ALL_CARDS)
    .filter(card => unit.select(card))
    .filter(card => !excluded.has(card.code))
    .sort((left, right) => left.code.localeCompare(right.code))
  if (cards.length !== unit.expectedCount) {
    throw new Error(`验收范围漂移：${unit.id} 期望 ${unit.expectedCount} 张，实际选中 ${cards.length} 张`)
  }
  const missing = (unit.exclude || []).filter(code => !ALL_CARDS[code])
  if (missing.length) throw new Error(`排除清单包含目录里不存在的卡号：${missing.join(', ')}`)
  return cards
}

function runTests(unit) {
  if (!Array.isArray(unit.testFiles) || !unit.testFiles.length) throw new Error(`${unit.id} 没有配置 testFiles`)
  const missing = unit.testFiles.filter(file => !fs.existsSync(path.join(root, file)))
  if (missing.length) throw new Error(`测试文件不存在：${missing.join(', ')}`)
  const gameRoot = path.join(root, game)
  const home = path.join(root, 'artifacts/card-units', unit.id, 'audit-home')
  fs.mkdirSync(home, { recursive: true })
  const run = spawnSync(process.execPath, [
    '--test',
    ...(unit.serial ? ['--test-concurrency=1'] : []),
    '--test-reporter=./tools/core-test-reporter.mjs',
    ...unit.testFiles.map(file => path.relative(gameRoot, path.join(root, file))),
  ], {
    // 与 `npm run test:fast` 一致：测试以游戏目录为 cwd 运行（部分用例按相对 cwd 读夹具）。
    cwd: gameRoot,
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  fs.writeFileSync(path.join(root, 'artifacts/card-units', unit.id, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  const bad = results.filter(result => result.type !== 'test:pass' || result.skipped || result.todo)
  if (run.status !== 0 || !results.length || bad.length) {
    console.error(JSON.stringify(bad, null, 2))
    console.error(run.stderr)
    throw new Error(`${unit.id} 的验收测试未全绿（pass=${results.length - bad.length} fail/bad=${bad.length}）`)
  }
  return results
}

function evidencePattern(unit, card) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // 关联面（正面卡找背面标题、a/b 面）允许用别名 token 作为证据；别名必须显式登记，
  // 或在单元配置里开启 linkedFace（同一张印刷卡的正/背面共用一个用例标题）。
  const linked = unit.evidence?.linkedFace && ALL_CARDS[card.code]
    ? [ALL_CARDS[card.code].linkedCardCode, ALL_CARDS[card.code].linkedToCode].filter(Boolean)
    : []
  const tokens = [...new Set([card.code, ...(unit.evidence?.aliases?.[card.code] || []), ...linked])].map(escape)
  const tokenPattern = tokens.length === 1 ? tokens[0] : `(?:${tokens.join('|')})`
  const prefixes = unit.evidence?.titlePrefixes
  if (Array.isArray(prefixes) && prefixes.length) {
    return new RegExp(`^(?:${prefixes.map(escape).join('|')}) ${tokenPattern}(?![0-9A-Za-z])`)
  }
  // 没有统一前缀时按「标题里出现完整卡号 token」判定，例如「04207 丛林之心…」。
  return new RegExp(`(?:^|[^0-9A-Za-z])${tokenPattern}(?![0-9A-Za-z])`)
}

function buildArtifacts(unit, cards, results) {
  const passed = new Map(results.map(result => [result.name, result]))
  const failed = new Map((unit.failed || []).map(entry => [entry.code, entry]))
  const unknown = [...failed.keys()].filter(code => !cards.some(card => card.code === code))
  if (unknown.length) throw new Error(`${unit.id} 的 failed 清单包含范围外卡号：${unknown.join(', ')}`)
  if (new Set((unit.failed || []).map(entry => entry.code)).size !== failed.size) throw new Error(`${unit.id} 的 failed 清单有重复卡号`)
  const forbid = unit.evidence?.forbidTitles
  const missing = []
  const entries = cards.map(card => {
    if (failed.has(card.code)) {
      const failure = failed.get(card.code)
      return {
        code: card.code,
        name: card.nameZh || card.name,
        type: card.type,
        status: 'pending',
        dimension: failure.dimension || 'unclassified',
        reason: failure.reason || '验收失败，原因见 docs/test 报告',
      }
    }
    const pattern = evidencePattern(unit, card)
    const titles = [...new Set(results.map(result => result.name).filter(name => pattern.test(name)))].sort()
    if (!titles.length) { missing.push(card.code); return null }
    if (forbid && titles.every(title => forbid.test(title))) {
      throw new Error(`逐卡证据只有目录/存在性断言，不能作为行为验收：${card.code}`)
    }
    return {
      code: card.code,
      name: card.nameZh || card.name,
      type: card.type,
      status: 'verified',
      evidence: titles.map(title => ({
        file: path.relative(root, passed.get(title).file).replaceAll('\\', '/'),
        test: title,
      })),
    }
  })
  if (missing.length) throw new Error(`缺少逐卡行为证据：${missing.join(', ')}`)
  const verifiedCodes = entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
  const ledger = {
    schemaVersion: 1,
    unit: unit.id,
    profile: unit.profile,
    summary: {
      total: entries.length,
      verified: verifiedCodes.length,
      unverified: entries.length - verifiedCodes.length,
      unimplemented: 0,
      testsPassed: results.length,
    },
    testFiles: unit.testFiles.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
    entries,
  }
  const json = `${JSON.stringify(ledger, null, 2)}\n`
  const module = `// Generated by tools/audit-card-unit.mjs ${unit.id} after executing behavioral tests.
// Detailed evidence: ${unit.outputs.ledger}. Not a promise of all-combination equivalence.
export const ${unit.exportPrefix}_ACCEPTANCE_PROFILE = ${JSON.stringify(unit.profile, null, 2)}
export const ${unit.exportPrefix}_ACCEPTANCE_SHA256 = '${hash(json)}'
const verified = new Set(${JSON.stringify(verifiedCodes)})
export const ${unit.verifiedFn} = code => verified.has(code)
`
  return { ledger, json, module }
}

export function main(args = process.argv.slice(2)) {
  const mode = args.includes('--write') ? 'write' : 'check'
  if (args.includes('--all')) {
    const ids = fs.readdirSync(unitsDir).filter(name => name.endsWith('.mjs')).map(name => name.replace(/\.mjs$/, '')).sort()
    if (!ids.length) throw new Error('tools/acceptance-units/ 下没有验收单元')
    return ids.reduce((chain, id) => chain.then(async () => {
      const unit = (await loadUnit(id)).default
      if (!unit || unit.id !== id) throw new Error(`单元配置 id 不匹配：${id}`)
      const cards = selectCards(unit)
      const results = runTests(unit)
      const { ledger, json, module } = buildArtifacts(unit, cards, results)
      const drift = []
      for (const [relative, text] of [[unit.outputs.ledger, json], [unit.outputs.module, module]]) {
        const target = path.join(root, game, relative)
        if (mode === 'write') {
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.writeFileSync(target, text, 'utf8')
        } else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) {
          drift.push(relative)
        }
      }
      if (drift.length) throw new Error(`验收生成物漂移：${drift.join(', ')}`)
      console.log(JSON.stringify({ unit: unit.id, mode, summary: ledger.summary }, null, 2))
    }), Promise.resolve())
  }
  const id = args.find(arg => !arg.startsWith('--'))
  if (!id) throw new Error('用法：node tools/audit-card-unit.mjs <unitId> [--write|--check]，或 --all / --all --write')
  return loadUnit(id).then(unitConfig => {
    const unit = unitConfig.default || unitConfig.unit
    if (!unit || unit.id !== id) throw new Error(`单元配置 id 不匹配：${id}`)
    const cards = selectCards(unit)
    const results = runTests(unit)
    const { ledger, json, module } = buildArtifacts(unit, cards, results)
    const artifacts = [
      [unit.outputs.ledger, json],
      [unit.outputs.module, module],
    ]
    const drift = []
    for (const [relative, text] of artifacts) {
      const target = path.join(root, game, relative)
      if (mode === 'write') {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, text, 'utf8')
      } else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) {
        drift.push(relative)
      }
    }
    if (drift.length) throw new Error(`验收生成物漂移：${drift.join(', ')}`)
    console.log(JSON.stringify({ unit: unit.id, mode, summary: ledger.summary, cards: cards.length }, null, 2))
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`逐卡验收失败：${error.message}`); process.exitCode = 1 })
}
