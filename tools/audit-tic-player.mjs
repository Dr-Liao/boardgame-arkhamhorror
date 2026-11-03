import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CARD_PARTITIONS } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { MOD, RUN, sha, json, readJson, writeJson, sourceLock } from './tic-migration-lib.mjs'
import { evidenceHashes, currentEvidence } from './tic-evidence.mjs'

export const PLAYER_TEST_FILES = ['tests/tic-player-primitives.test.mjs', 'tests/tic-player-guardian-seeker.test.mjs',
  'tests/tic-player-rogue-mystic.test.mjs', 'tests/tic-player-survivor-neutral.test.mjs']
const ledgerPath = join(MOD, 'audit/tic-player-acceptance.json')
const modulePath = join(MOD, 'src/cards/tic-player-acceptance.js')
export const playerImplementationFiles = () => evidenceHashes().filter(lock => lock.path !== 'src/cards/tic-player-acceptance.js')

export function buildPlayerStageAudit() {
  const ledger = existsSync(ledgerPath) ? readJson(ledgerPath) : null
  const node = currentEvidence('node-acceptance'), replay = currentEvidence('player-replay')
  const regression = currentEvidence('interaction-regression'), browser = currentEvidence('interactions-browser')
  const gates = {
    everyCardVerified: ledger?.summary.verified === CARD_PARTITIONS.ticPlayer.length && ledger?.summary.missing === 0 && ledger?.summary.simplified === 0,
    implementationCurrent: !!ledger && json(ledger.implementationFiles) === json(playerImplementationFiles()),
    executedNode: !!node && CARD_PARTITIONS.ticPlayer.every(code => node.testTitles.some(title => title.startsWith(`P6 ${code} `))),
    replayUnchanged: !!replay, fullFastPassed: !!regression,
    desktopAndMobile: !!browser && ['desktop', 'mobile'].every(size => browser.tests.some(row => row.status === 'passed' && row.title.includes(`P6 ${size}`))),
    shardsAndQueue: ledger?.gates.shardsExact === true && ledger?.gates.noPendingRequests === true,
  }
  return { status: Object.values(gates).every(Boolean) ? 'verified' : 'pending', gates,
    evidence: ['audit/tic-player-acceptance.json', 'audit/tic-player-shards.json', 'audit/tic-player-queue.json',
      'audit/tic-node-acceptance.json', 'audit/tic-player-replay.json', 'audit/tic-interactions-browser.json', 'audit/tic-interaction-regression.json'],
    summary: ledger?.summary || null }
}

export function auditPlayers() {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...PLAYER_TEST_FILES],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  let results
  try { results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
  catch { throw new Error(`玩家卡行为测试事件流无效：${run.stdout}\n${run.stderr}`) }
  writeJson(join(RUN, 'reports/player-test-events.json'), results)
  if (run.status !== 0 || !results.length || results.some(row => row.type !== 'test:pass' || row.skipped || row.todo)) {
    throw new Error(`玩家卡测试未全部通过：${json(results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo))}\n${run.stderr}`)
  }
  const shards = readJson(join(MOD, 'audit/tic-player-shards.json'))
  const flat = shards.shards.flatMap(shard => shard.codes)
  const shardsExact = new Set(flat).size === flat.length && json([...flat].sort()) === json([...CARD_PARTITIONS.ticPlayer].sort())
  const entryByCode = new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
  const entries = CARD_PARTITIONS.ticPlayer.map(code => {
    const card = ALL_CARDS[code], entry = entryByCode.get(code)
    const tests = results.filter(row => row.name.startsWith(`P6 ${code} `))
    if (!tests.length) throw new Error(`卡牌缺少已执行行为证据：${code}`)
    if (!entry || entry.simplified || entry.abilities?.some(ability => ability.simplified)) throw new Error(`未实现或简化卡不能验收：${code}`)
    const basicWeakness = card.subtype === 'basicweakness'
    return { code, name: card.nameZh || card.name, class: card.klass, level: card.xp ?? null, basicWeakness,
      deckbuilding: !basicWeakness && (card.deckLimit || 0) > 0, status: 'verified',
      channel: EFFECTS[code] ? 'hybrid' : 'descriptor', simplified: false,
      canonicalCode: card.duplicateOfCode || code, aliases: card.duplicatedBy || [],
      source: sourceLock(`src/cards/entries/${code}.js`, MOD),
      evidence: tests.map(row => ({ file: relative(MOD, row.file).replaceAll('\\', '/'), line: row.line, test: row.name })) }
  })
  const queuePath = join(MOD, 'audit/tic-player-queue.json')
  const queue = existsSync(queuePath) ? readJson(queuePath) : { items: [] }
  const noPendingRequests = queue.items.length > 0 && queue.items.every(item => ['done', 'rejected'].includes(item.status)
    && item.cards.every(code => entries.some(entry => entry.code === code && entry.evidence.length)))
  const report = { schemaVersion: 1, generatedBy: 'node tools/audit-tic-player.mjs --write',
    profile: { id: 'innsmouth-player-p6', basis: '原始印刷卡文、本地锁定参考实现和实际逐卡行为测试；不声称穷举跨循环组合。' },
    summary: { total: entries.length, verified: entries.length, missing: 0, simplified: 0,
      buildable: entries.filter(entry => entry.deckbuilding).length, dependencyOnly: entries.filter(entry => !entry.deckbuilding).length,
      testsPassed: results.length },
    shards: shards.shards.map(({ worker, codes }) => ({ worker, codes })),
    gates: { shardsExact, noPendingRequests }, implementationFiles: playerImplementationFiles(), entries }
  const verified = entries.map(entry => entry.code), buildable = entries.filter(entry => entry.deckbuilding).map(entry => entry.code)
  const basic = entries.filter(entry => entry.basicWeakness).map(entry => entry.code)
  const module = `// Generated by tools/audit-tic-player.mjs from executed behavioral tests.\n`
    + `export const TIC_PLAYER_VERIFIED_CODES = Object.freeze(${JSON.stringify(verified)})\n`
    + `export const TIC_PLAYER_BUILDABLE_CODES = Object.freeze(${JSON.stringify(buildable)})\n`
    + `export const TIC_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(${JSON.stringify(basic)})\n`
    + `const verified = new Set(TIC_PLAYER_VERIFIED_CODES)\nexport const ticPlayerCardVerified = code => verified.has(code)\n`
  if (process.argv.includes('--write')) { writeJson(ledgerPath, report); writeJson(join(RUN, 'player-acceptance.json'), report); writeFileSync(modulePath, module) }
  else if (!existsSync(ledgerPath) || readFileSync(ledgerPath, 'utf8') !== json(report) || readFileSync(modulePath, 'utf8') !== module) throw new Error('TIC 玩家卡验收生成物漂移；审阅后 --write')
  if (!Object.values(report.gates).every(Boolean)) throw new Error(`TIC 分片或原语队列门禁失败：${json(report.gates)}`)
  console.log(json(report.summary))
  return report
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) auditPlayers()
