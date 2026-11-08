// P8 eote all-cards：403 条《地球边缘》记录的逐卡验收账本测试。
//
// P0-11 修复后的口径（诚实优先，不再要求「零 missing」的假绿）：
// 1) 403 全覆盖、266/22/115 分片、状态与 summary 自洽、两次构建一致且与账本一致；
// 2) 每条 evidence 必须可追溯：strong 标题来自本次实跑 passRecords；file/ledger 证据引用的测试文件
//    必须存在且全文含该卡号 token（双面卡接受基号 token）；scenario-ledger 还必须是章节测试文件；
// 3) missing/blocked/simplified 的计数必须与生成器一致，且 release/migration 账本如实反映
//    （equivalenceCertified = 全卡账本 missing/blocked=0）；不允许用「evidence 非空」冒充可追溯。
// 测试用 --write 账本里的实跑快照复算（不重复跑测试）；CLI 实跑由
//   node tools/audit-eote-all-cards.mjs --write / --check 验证。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLedger } from '../tools/audit-eote-all-cards.mjs'

const MOD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => JSON.parse(fs.readFileSync(path.join(MOD, relative), 'utf8'))
const ledger = readJson('audit/eote-all-card-acceptance.json')
const scope = readJson('audit/eote-scope.json')
const stable = value => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}
const stableJson = value => JSON.stringify(stable(value))
const snapshot = {
  testFiles: ledger.testRun.testFiles,
  totalPasses: ledger.testRun.totalPasses,
  exitCode: ledger.testRun.exitCode,
  passRecords: ledger.testRun.passRecords,
  failRecords: ledger.testRun.failRecords,
  filesWithPasses: new Set(ledger.testRun.passRecords.map(record => record.file)),
}
// 与 tools/audit-eote-all-cards.mjs#tokenPattern 同口径：双面演武 a/b 面同时接受基号 token。
const tokenPattern = code => {
  const escaped = String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const face = /^(\d{5})[a-z]$/.exec(String(code))
  const body = face ? `${face[1]}[a-z]?` : escaped
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?:$|[^A-Za-z0-9])`)
}
const fileTextCache = new Map()
const fileText = relative => {
  if (!fileTextCache.has(relative)) {
    const absolute = path.join(MOD, relative)
    fileTextCache.set(relative, fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null)
  }
  return fileTextCache.get(relative)
}
const fileMentionsCode = (relative, code) => {
  const text = fileText(relative)
  return text == null ? false : tokenPattern(code).test(text)
}

test('P8 eote all-cards 403 全覆盖与分片 266/22/115', () => {
  assert.equal(ledger.summary.total, 403)
  assert.equal(ledger.records.length, 403)
  assert.equal(scope.partitions.eoteCampaign.length, 266)
  assert.equal(scope.partitions.eoteInvestigators.length, 22)
  assert.equal(scope.partitions.eotePlayer.length, 115)
  const codes = ledger.records.map(record => record.code)
  assert.equal(new Set(codes).size, 403, '卡号不得重复')
  const expected = new Set([
    ...scope.partitions.eoteCampaign, ...scope.partitions.eoteInvestigators, ...scope.partitions.eotePlayer,
  ])
  assert.deepEqual([...codes].sort(), [...expected].sort(), '账本必须覆盖 scope 全部 403 卡号')
  for (const [partition, total] of [['eoteCampaign', 266], ['eoteInvestigators', 22], ['eotePlayer', 115]]) {
    assert.equal(ledger.records.filter(record => record.partition === partition).length, total)
    assert.equal(ledger.summary.partitions[partition].total, total)
  }
})

test('P8 eote all-cards 如实登记 missing/blocked，summary 与 gate 自洽', () => {
  const statuses = ['verified', 'simplified', 'no-behavior', 'missing', 'blocked']
  const counted = Object.fromEntries(statuses.map(status => [status, 0]))
  for (const record of ledger.records) {
    assert.ok(statuses.includes(record.status), `${record.code} 非法状态 ${record.status}`)
    counted[record.status] += 1
    assert.equal(typeof record.titleMatched, 'boolean')
    assert.equal(typeof record.ledgerMatched, 'boolean')
    assert.equal(typeof record.traceable, 'boolean', `${record.code} 缺少 traceable 标志`)
    if (record.status === 'no-behavior') continue
    assert.ok(record.entry?.file, `${record.code} 缺条目文件`)
    assert.match(record.entry.sha256 || '', /^[0-9a-f]{64}$/, `${record.code} 条目缺 sha256`)
    if (record.status === 'missing' || record.status === 'blocked') {
      // 诚实口径：无逐卡可追溯证据的卡必须如实 marked，不得带假证据。
      assert.equal(record.evidence.length, 0, `${record.code} missing/blocked 不应带证据`)
      assert.equal(record.traceable, false, `${record.code} missing/blocked 不应可追溯`)
      if (record.status === 'blocked') {
        assert.ok(record.pendingRequests.length > 0, `${record.code} blocked 必须披露 pending 原始请求`)
      }
      continue
    }
    assert.ok(record.evidence.length > 0, `${record.code} 缺测试证据`)
    assert.equal(record.traceable, true, `${record.code} 证据必须可追溯`)
    if (record.status === 'simplified') {
      assert.ok(record.pendingRequests.length > 0, `${record.code} simplified 必须披露 pending 请求`)
    }
  }
  for (const status of statuses) {
    assert.equal(ledger.summary[status], counted[status], `summary.${status} 与明细不一致`)
    assert.equal(ledger.summary.partitions.eoteCampaign[status] ?? 0,
      ledger.records.filter(record => record.partition === 'eoteCampaign' && record.status === status).length)
  }
  assert.equal(statuses.reduce((sum, status) => sum + counted[status], 0), 403)
  const incomplete = counted.missing + counted.blocked
  assert.equal(ledger.summary.gateComplete, incomplete === 0, 'gateComplete 必须等于 missing+blocked=0')
  assert.equal(ledger.gates.noMissingOrBlocked, incomplete === 0)
  assert.equal(ledger.summary.evidence.withoutEvidence, incomplete)
  assert.equal(ledger.summary.evidence.withoutTraceableEvidence, incomplete,
    'withoutTraceableEvidence 必须等于 missing+blocked（有证据就必须可追溯）')
  assert.equal(ledger.gates.everyBehaviorCardHasEvidence,
    ledger.summary.evidence.withoutTraceableEvidence === 0, 'gate 必须取决于可追溯证据而非 evidence 非空')
  assert.equal(ledger.status,
    incomplete === 0 && ledger.gates.noFailedTests === true ? 'verified' : 'pending')
  if (incomplete > 0) {
    assert.equal(ledger.summary.missing + ledger.summary.blocked,
      ledger.records.filter(record => record.status !== 'no-behavior' && record.evidence.length === 0).length,
      'missing/blocked 必须逐条对应无证据记录（不得静默丢失）')
  }
  const statusRequests = new Set(ledger.records
    .filter(record => record.status === 'simplified' || record.status === 'blocked')
    .flatMap(record => record.pendingRequests))
  for (const requestId of statusRequests) {
    assert.ok(ledger.summary.pendingBehaviorRequests.includes(requestId),
      `状态披露的 pending 请求 ${requestId} 未进入 summary.pendingBehaviorRequests`)
  }
  for (const summary of Object.values(ledger.summary.partitions)) {
    const sum = statuses.reduce((total, status) => total + (summary[status] || 0), 0)
    assert.equal(sum, summary.total, '分片 summary 必须等于各状态之和')
  }
})

test('P8 eote all-cards 参考卡与证据可追溯口径', () => {
  for (const code of ['08596', '08621']) {
    const record = ledger.records.find(item => item.code === code)
    assert.ok(record, `${code} 必须在账本里`)
    assert.equal(record.kind, 'reference-card')
    assert.equal(record.status, 'no-behavior')
    assert.equal(record.entry.file, null)
  }
  assert.equal(ledger.summary['no-behavior'], 2)
  // 每条证据都必须可追溯到真实测试：strong 标题来自本次实跑；文件型必须文件存在且含卡号 token。
  const passTitles = new Set(ledger.testRun.passRecords.map(record => record.test))
  for (const record of ledger.records) {
    for (const item of record.evidence) {
      assert.ok(['strong', 'file', 'player-ledger', 'investigator-ledger', 'scenario-ledger'].includes(item.kind),
        `${record.code} 未知证据类型 ${item.kind}`)
      assert.equal(item.traceable, true, `${record.code} 证据必须声明 traceable`)
      if (item.kind === 'strong' || item.kind === 'player-ledger') {
        assert.ok(passTitles.has(item.test), `${record.code} strong/player 证据标题必须来自本次实跑：${item.test}`)
        // 双面卡允许基号 token 命中（与生成器同口径）。
        assert.ok(tokenPattern(record.code).test(item.test) || tokenPattern(record.canonicalCode).test(item.test),
          `${record.code} strong 标题未含卡号 token`)
        continue
      }
      assert.ok(item.file, `${record.code} ${item.kind} 证据缺 file`)
      assert.ok(fileMentionsCode(item.file, record.code) || fileMentionsCode(item.file, record.canonicalCode),
        `${record.code} 证据引用的 ${item.file} 不含卡号 token（不可追溯）`)
      if (item.kind === 'scenario-ledger') {
        assert.match(item.file, /^tests\/eote-scenario-.*\.test\.mjs$/, 'scenario-ledger 必须引用章节测试文件')
        assert.ok(typeof item.chapter === 'string' && item.chapter.length > 0, 'scenario-ledger 必须记录章节归属')
      }
    }
  }
  assert.match(ledger.sources.scopeSha256, /^[0-9a-f]{64}$/)
  assert.equal(ledger.sources.entryFiles.length, 401, '401 张行为卡应有条目文件 sha256（403-2 参考卡）')
  assert.equal(ledger.sources.testFiles.length, ledger.testRun.testFiles.length)
  assert.ok(ledger.sources.testFiles.every(file => /^[0-9a-f]{64}$/.test(file.sha256)))
  assert.equal(new Set(ledger.sources.primitiveRequests).size, ledger.sources.primitiveRequests.length,
    'primitiveRequests 不得重复登记同名请求')
})

test('P8 eote all-cards 两次构建一致且与账本一致', () => {
  const first = buildLedger({ testRun: snapshot })
  const second = buildLedger({ testRun: snapshot })
  assert.equal(stableJson(first), stableJson(second), '同一实跑快照的两次构建必须完全一致')
  assert.equal(stableJson(first), stableJson(ledger), '复算结果必须与 audit/eote-all-card-acceptance.json 一致（--check 口径）')
  assert.equal(first.gates.deterministic, true)
})
