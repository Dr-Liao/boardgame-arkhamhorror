// P8 eote migration ledger：《地球边缘》发布验收账本与总迁移账本的 Node 校验。
//
// 两份账本由 tools/audit-eote-release.mjs / tools/audit-eote.mjs 生成（确定性 --write/--check）。
// 本测试只从「真实事实源」复算关键数字，并校验两份账本的结构、状态推导、确认清单与披露完整性；
// 不把账本里的结论当输入再复制一遍。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildReleaseAcceptance } from '../tools/audit-eote-release.mjs'
import { buildMigrationLedger } from '../tools/audit-eote.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CARD_PARTITIONS, chapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_KEYWORDS } from '../content/campaigns/edgeOfTheEarth/keywords.js'
import { EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'
import {
  KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS,
  assertMigrationConfirmations,
} from '../content/migration-confirmation.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RELEASE_LEDGER = 'audit/eote-release-acceptance.json'
const MIGRATION_LEDGER = 'audit/eote-migration.json'
const readLedger = path => JSON.parse(readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, ''))
const json = value => JSON.parse(JSON.stringify(value))
const REQUIRED_RELEASE_KEYS = Object.freeze([
  'schemaVersion', 'campaignId', 'milestone', 'generatedBy', 'status', 'evidence', 'campaign',
  'chapters', 'checks', 'missing', 'browser', 'screenshots', 'deferred', 'sourceFiles', 'gate',
])
const RELEASE_CHECK_KEYS = Object.freeze([
  'releaseDesktop', 'releaseMobile', 'progressionDesktop', 'progressionMobile',
  'onlineDesktop', 'onlineMobile', 'privacyDesktop', 'privacyMobile',
  'permissionDesktop', 'permissionMobile', 'disconnectDesktop', 'disconnectMobile',
])
const chapterIds = chapters.map(chapter => chapter.id)

test('P8 eote migration ledger · 两份账本存在且结构完整', () => {
  assert.ok(existsSync(join(MOD, RELEASE_LEDGER)), `缺少 ${RELEASE_LEDGER}`)
  assert.ok(existsSync(join(MOD, MIGRATION_LEDGER)), `缺少 ${MIGRATION_LEDGER}`)
  const release = readLedger(RELEASE_LEDGER)
  const migration = readLedger(MIGRATION_LEDGER)

  for (const key of REQUIRED_RELEASE_KEYS) assert.ok(Object.hasOwn(release, key), `release 缺少字段 ${key}`)
  assert.equal(release.campaignId, 'edgeOfTheEarth')
  assert.equal(release.milestone, 'P8')
  assert.deepEqual(Object.keys(release.checks).sort(), [...RELEASE_CHECK_KEYS].sort())
  assert.ok(Object.values(release.checks).every(value => typeof value === 'boolean'))
  assert.ok(Array.isArray(release.missing))
  // P0-11 诚实降级：release.missing 除 12 项浏览器 checks 外，还包含 chapters/allCards 两个独立 gate。
  // 旧账本三者恒真时该断言等价于「missing 与 checks=false 对齐」；现在按真实 gate 推导。
  const expectedMissing = new Set([
    ...RELEASE_CHECK_KEYS.filter(key => release.checks[key] !== true),
    ...(release.chapters.every(row => row.verified === true) ? [] : ['chapters']),
    ...(release.allCards?.pass === true ? [] : ['allCards']),
  ])
  assert.deepEqual([...release.missing].sort(), [...expectedMissing].sort(),
    'release missing 必须与失败 checks/gate（含 chapters/allCards）对齐')
  assert.equal(release.gate.pass, release.status === 'passed')
  assert.ok(release.screenshots && typeof release.screenshots.total === 'number')
  assert.ok(release.browser && release.browser.ledger === 'audit/eote-release-browser.json')
  assert.ok(release.allCards && release.allCards.path === 'audit/eote-all-card-acceptance.json')
  // P0-11 诚实降级：行为等价认证只能由全卡账本的可追溯证据完整性推导，不由「旧账本 status」自证。
  const allCardLedger = readLedger('audit/eote-all-card-acceptance.json')
  const behaviorEvidenceComplete = allCardLedger.summary.missing === 0 && allCardLedger.summary.blocked === 0
  assert.equal(typeof release.equivalence?.certified, 'boolean', 'release 账本必须登记 equivalence.certified')
  assert.equal(release.equivalence.certified, behaviorEvidenceComplete,
    'release.equivalence.certified 必须等于全卡账本 missing/blocked=0')
  assert.ok(typeof release.equivalence.basis === 'string' && release.equivalence.basis.length > 0,
    'release equivalence 必须写明认证口径（simplified ≠ 等价）')
  assert.ok(typeof release.equivalence.independentAudit?.independentVerdict === 'string'
    && release.equivalence.independentAudit.independentVerdict.length > 0,
  'release equivalence 必须登记独立复核结论（旧账本 verified 结论不成立）')
  assert.equal(migration.releaseAcceptance.equivalenceCertified, behaviorEvidenceComplete,
    'migration.releaseAcceptance.equivalenceCertified 必须等于全卡账本 missing/blocked=0')
  assert.ok(typeof migration.releaseAcceptance.equivalenceNote === 'string'
    && migration.releaseAcceptance.equivalenceNote.length > 0, 'migration 必须披露等价性口径说明')
  assert.ok(typeof migration.releaseAcceptance.independentAudit?.independentVerdict === 'string'
    && migration.releaseAcceptance.independentAudit.independentVerdict.length > 0,
  'migration 必须登记独立复核结论')

  assert.equal(migration.schemaVersion, 2)
  assert.equal(migration.cycle, 'eote')
  assert.equal(migration.campaignId, 'edgeOfTheEarth')
  assert.equal(migration.milestone, 'P8')
  assert.ok(['verified', 'pending'].includes(migration.status))
  assert.ok(migration.gates && Object.values(migration.gates).every(value => typeof value === 'boolean'))
  assert.equal(migration.gates.pass, migration.status === 'verified')
  assert.ok(Array.isArray(migration.chapters) && migration.chapters.length === 8)
  assert.ok(Array.isArray(migration.remaining))
  assert.ok(Array.isArray(migration.releaseAcceptance.deferred))
  assert.ok(Array.isArray(migration.releaseAcceptance.remaining))
  assert.equal(migration.releaseAcceptance.earlyAccess, false)
})

test('P8 eote migration ledger · 403/266/22/115 与主卡/关联面事实从 cards-data 复算', () => {
  const migration = readLedger(MIGRATION_LEDGER)
  const campaign = Object.keys(ALL_CARDS).filter(code => ALL_CARDS[code].pack === 'eoec').length
  const playerPack = Object.keys(ALL_CARDS).filter(code => ALL_CARDS[code].pack === 'eoep').length
  const investigators = CARD_PARTITIONS.eoteInvestigators.length
  const player = CARD_PARTITIONS.eotePlayer.length
  assert.equal(campaign, 266)
  assert.equal(investigators, 22)
  assert.equal(player, 115)
  assert.equal(campaign + playerPack, 403)
  assert.equal(campaign + investigators + player, 403)
  assert.deepEqual(migration.counts.packs, { eoteCampaign: 266, eoteInvestigators: 22, eotePlayer: 115 })
  assert.equal(migration.counts.records, 403)
  assert.equal(migration.counts.main, 367)
  assert.equal(migration.counts.faces, 36)
  assert.equal(migration.counts.chapters, 8)
  assert.equal(migration.counts.keywords, 38)
  assert.equal(migration.counts.storySections, 469)
  assert.equal(migration.campaign.scenarioIds.length, 8)
  assert.ok(migration.scopeChecks.records && migration.scopeChecks.partitions,
    'scope 账本与实时卡数一致')
})

test('P8 eote migration ledger · confirmations 三组全 verified 且符合迁移确认口径', () => {
  const migration = readLedger(MIGRATION_LEDGER)
  const confirmations = migration.confirmations
  assert.equal(confirmations.scenarios.status, 'verified')
  assert.equal(confirmations.keywords.status, 'verified')
  assert.equal(confirmations.rulebook.status, 'verified')
  assert.equal(confirmations.scenarios.items.length, 8)
  assert.deepEqual(confirmations.scenarios.items.map(item => item.id), chapterIds)
  for (const item of confirmations.scenarios.items) {
    assert.deepEqual(Object.keys(item.checks).sort(), [...SCENARIO_MIGRATION_CHECKS].sort())
    assert.ok(Object.values(item.checks).every(value => value === true), `${item.id} 12 项检查应全真`)
    assert.ok(item.evidence.length > 0, `${item.id} 缺少证据路径`)
  }
  assert.deepEqual(confirmations.keywords.items.map(item => item.id).sort(), EOTE_KEYWORDS.map(item => item.id).sort())
  for (const item of confirmations.keywords.items) {
    assert.deepEqual(Object.keys(item.checks).sort(), [...KEYWORD_MIGRATION_CHECKS].sort())
    assert.ok(Object.values(item.checks).every(value => value === true), `${item.id} 关键词检查应全真`)
  }
  assert.equal(confirmations.rulebook.entries, 23)
  assert.deepEqual(Object.keys(confirmations.rulebook.checks).sort(), [...RULEBOOK_MIGRATION_CHECKS].sort())
  assert.ok(Object.values(confirmations.rulebook.checks).every(value => value === true))
  // 与 content/migration-confirmation.js 的唯一确认口径互相校验（战役 playable 时三组必须全 verified）。
  assertMigrationConfirmations({ confirmations, playable: migration.playable, earlyAccess: false }, chapterIds)
})

test('P8 eote migration ledger · 确定性：导出 builder 两次深相等且与签入账本一致', () => {
  const releaseA = buildReleaseAcceptance()
  const releaseB = buildReleaseAcceptance()
  assert.deepEqual(releaseA, releaseB)
  assert.deepEqual(json(releaseA), readLedger(RELEASE_LEDGER))
  const migrationA = buildMigrationLedger()
  const migrationB = buildMigrationLedger()
  assert.deepEqual(migrationA, migrationB)
  assert.deepEqual(json(migrationA), readLedger(MIGRATION_LEDGER))
  // 顶层无时间戳/耗时/宿主字段（确定性口径）。
  for (const key of ['generatedAt', 'timestamp', 'durationMs', 'host', 'gitHead']) {
    assert.equal(Object.hasOwn(releaseA, key), false, `release 不应含 ${key}`)
    assert.equal(Object.hasOwn(migrationA, key), false, `migration 不应含 ${key}`)
  }
})

test('P8 eote migration ledger · releaseAcceptance 无未披露 remaining（每项有证据路径）', () => {
  const migration = readLedger(MIGRATION_LEDGER)
  const { deferred, remaining, status } = migration.releaseAcceptance
  // pending 原语请求必须逐条出现在 deferred（「已披露近似」）。
  const requestDir = join(MOD, 'artifacts/migration/eote/primitive-requests')
  const requestFiles = existsSync(requestDir)
    ? readdirSync(requestDir).filter(name => name.endsWith('.json')).sort()
    : []
  for (const file of requestFiles) {
    const request = readLedger(`artifacts/migration/eote/primitive-requests/${file}`)
    if (request.status !== 'pending') continue
    assert.ok(deferred.some(entry => entry.id === `primitiveRequest:${request.id ?? file.replace(/\.json$/, '')}`),
      `pending 原语请求 ${file} 未披露到 deferred`)
  }
  for (const entry of deferred) {
    assert.ok(typeof entry.id === 'string' && entry.id.length > 0)
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0, `${entry.id} 缺少披露理由`)
    assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${entry.id} 缺少证据路径`)
  }
  for (const entry of remaining) {
    assert.match(entry.id, /^(gate|missing|confirmation):/, `remaining 项 ${entry.id} 缺少来源分类`)
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0, `${entry.id} 缺少原因`)
    assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${entry.id} 缺少证据路径`)
  }
  if (status === 'passed') assert.equal(remaining.length, 0, 'passed 时 remaining 必须为空')
  else assert.ok(remaining.length > 0, 'pending 时必须解释 remaining')
})

test('P8 eote migration ledger · 发布浏览器账本缺失时显式记 missing 而不伪造', () => {
  const release = readLedger(RELEASE_LEDGER)
  const browserPath = join(MOD, 'audit/eote-release-browser.json')
  if (!existsSync(browserPath)) {
    assert.equal(release.status, 'failed')
    assert.ok(release.evidence.missingInputs.includes('audit/eote-release-browser.json'))
    assert.equal(release.gate.pass, false)
    assert.equal(release.screenshots.total, 0)
    assert.ok(release.missing.length > 0)
  } else {
    assert.equal(release.browser.ledger, 'audit/eote-release-browser.json')
    assert.equal(release.gate.pass, release.status === 'passed')
  }
})

test('P8 eote migration ledger · 总账本 status 只由全 gates 与三组确认推导', () => {
  const migration = readLedger(MIGRATION_LEDGER)
  const report = buildMigrationLedger()
  const gates = Object.entries(report.gates).filter(([key]) => key !== 'pass')
  const allGatesTrue = gates.every(([, value]) => value === true)
  const confirmationsVerified = Object.values(report.confirmations).every(section => section.status === 'verified')
  assert.equal(report.gates.pass, allGatesTrue && confirmationsVerified)
  assert.equal(report.status, allGatesTrue && confirmationsVerified ? 'verified' : 'pending')
  assert.equal(migration.gates.pass, migration.status === 'verified')
  if (migration.status === 'verified') {
    assert.ok(gates.every(([, value]) => value === true))
    assert.ok(Object.values(migration.confirmations).every(section => section.status === 'verified'))
  } else {
    assert.ok(migration.releaseAcceptance.remaining.length > 0 || migration.evidence.missingInputs.length > 0)
  }
  // 剧情/指南事实与 P7 生成物一致（8 章 469 段、8 个指南文件）。
  const storyChapters = Object.keys(EOTE_STORY_TEXT.chapters)
  assert.equal(storyChapters.length, 8)
  assert.equal(storyChapters.reduce((sum, id) => sum + (EOTE_STORY_TEXT.chapters[id].sectionCount || 0), 0), 469)
  assert.equal(migration.story.chapters, 8)
  assert.equal(migration.story.sections, 469)
  assert.ok(migration.story.guideFiles.every(file => file.exists))
})
