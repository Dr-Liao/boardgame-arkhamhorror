// P0-11：P8 逐卡账本证据有效性（scenario-ledger 分组不再全落 Heart Part2）+ 账本 --check 一致性
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const MOD = fileURLToPath(new URL('../../../../../../', import.meta.url)).replace(/[\\/]$/, '')

const evidence = {
  ledger: 'audit/eote-all-card-acceptance.json（records[].evidence[0]）',
  rootCause: 'tools/audit-eote-scenarios.mjs:88-90（group flatMap 不用 group）/ tools/audit-eote-all-cards.mjs:258-261（last-wins）',
  checker: 'node tools/audit-eote-all-cards.mjs --check（语义漂移 exit 2；gate 不完整 exit 1）',
  scenario: 'audit/eote-scenario-acceptance.json#chapters[].cardCodes（每章污染 264 张的根因产物）',
}

const readJson = rel => JSON.parse(readFileSync(`${MOD}/${rel}`, 'utf8'))
const codeRe = code => new RegExp(`(?<![0-9A-Za-z])${String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`)
const testFiles = existsSync(`${MOD}/tests`) ? readdirSync(`${MOD}/tests`).filter(name => name.endsWith('.test.mjs')) : []
const fileCache = new Map()
const testText = name => {
  const rel = `tests/${name}`
  if (!fileCache.has(rel)) fileCache.set(rel, existsSync(`${MOD}/${rel}`) ? readFileSync(`${MOD}/${rel}`, 'utf8') : '')
  return fileCache.get(rel)
}

/** 从条目路径推断「应该引用哪一章测试」（与报告口径一致；_shared 归共享组测试）。 */
function expectedTestOf(entryFile = '') {
  const match = entryFile.match(/encounter-entries\/edgeOfTheEarth\/([^/]+)\/([^/]+)\/?([^/]*)$/)
  if (!match) return null
  if (match[1] !== '_shared') return `tests/eote-scenario-${match[1]}.test.mjs`
  if (['the_heart_of_madness'].includes(match[2])) return 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs'
  if (['ice_and_death'].includes(match[2])) return 'tests/eote-scenario-iceAndDeathPart1.test.mjs'
  return 'tests/eote-scenario-shared.test.mjs'
}

function ledgerAnalysis() {
  const ledger = readJson('audit/eote-all-card-acceptance.json')
  const records = ledger.records || []
  // strong 证据可以只给标题；用账本 testRun.passRecords 把标题解析到本次实跑文件（与报告复核口径一致，
  // 覆盖 08011b–08014b 这类「b 面由 a 面标题测试覆盖」的已披露假阳性）。
  const passByTitle = new Map()
  for (const record of ledger.testRun?.passRecords || []) {
    if (record?.test && record?.file && !passByTitle.has(record.test)) passByTitle.set(record.test, record.file)
  }
  const rows = records.map(record => {
    const item = (record.evidence || [])[0] || null
    const kind = item?.kind || 'none'
    const file = item?.file || null
    const title = item?.test || null
    const resolvedFile = file || (kind === 'strong' && title ? (passByTitle.get(title) || null) : null)
    const fileName = resolvedFile ? String(resolvedFile).replace(/^tests\//, '') : null
    const text = fileName ? testText(fileName) : ''
    const codeInCitedFile = Boolean(text && codeRe(record.code).test(text))
    const titleHasCode = Boolean(title && String(title).includes(record.code))
    const expectedTest = expectedTestOf(record.entry?.file || '')
    const chapterMatches = Boolean(expectedTest && resolvedFile === expectedTest)
    return {
      code: record.code, partition: record.partition, status: record.status,
      entryFile: record.entry?.file || null,
      kind, file: resolvedFile, title, codeInCitedFile, titleHasCode, expectedTest, chapterMatches,
      valid: codeInCitedFile || titleHasCode || chapterMatches,
    }
  })
  const scenarioRows = rows.filter(row => row.kind === 'scenario-ledger')
  const claimed = rows.filter(row => ['verified', 'simplified'].includes(row.status))
  const invalidClaimed = claimed.filter(row => !row.valid)
  const missingBlocked = rows.filter(row => ['missing', 'blocked'].includes(row.status))
  const byFile = scenarioRows.reduce((map, row) => {
    map[row.file] = (map[row.file] || 0) + 1
    return map
  }, {})
  const misattributed = scenarioRows.filter(row => row.file && /theHeartOfMadnessPart2/.test(row.file)
    && !row.codeInCitedFile && !/heartOfMadness/.test(row.expectedTest || ''))
  const invalid = rows.filter(row => !row.valid)
  return {
    ledger,
    records,
    rows,
    claimed,
    invalidClaimed,
    missingBlocked,
    scenarioRows,
    byFile,
    misattributed,
    invalid,
    invalidByKind: invalid.reduce((map, row) => { map[row.kind] = (map[row.kind] || 0) + 1; return map }, {}),
  }
}

function scenarioAcceptanceAnalysis() {
  if (!existsSync(`${MOD}/audit/eote-scenario-acceptance.json`)) return null
  const acceptance = readJson('audit/eote-scenario-acceptance.json')
  const chapters = (acceptance.chapters || []).map(chapter => ({
    id: chapter.id, count: (chapter.cardCodes || []).length,
    signature: JSON.stringify(chapter.cardCodes || []),
  }))
  const distinct = new Set(chapters.map(chapter => chapter.signature)).size
  return { chapters, distinct, chapterCount: chapters.length, allIdentical: chapters.length > 1 && distinct === 1 }
}

export const p011 = {
  id: 'P0-11',
  title: 'P8 账本证据有效性：scenario-ledger 分组不再全落 Heart Part2 / invalid 下降 / --check 一致',
  async run(ctx) {
    if (!existsSync(`${MOD}/audit/eote-all-card-acceptance.json`)) {
      ctx.fail('[P0-11] audit/eote-all-card-acceptance.json 存在', {
        expected: '账本文件存在', actual: '缺失', evidence: evidence.ledger,
      })
      return
    }
    const analysis = ledgerAnalysis()
    ctx.note('[P0-11] 账本规模', {
      records: analysis.records.length,
      scenarioLedger: analysis.scenarioRows.length,
      invalid: analysis.invalid.length,
      invalidByKind: analysis.invalidByKind,
      scenarioEvidenceFiles: analysis.byFile,
    }, evidence.ledger)
    // (1) scenario-ledger 分组：不再全部指向 Heart Part2 测试。
    //     重建后若该假 kind 被彻底移除（0 条）也视为达标（根因已消除），但必须由其他证据种类承接。
    const heartFile = 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs'
    const heartCount = analysis.scenarioRows.filter(row => row.file === heartFile).length
    const heartShare = analysis.scenarioRows.length ? (heartCount / analysis.scenarioRows.length) : 0
    const scenarioLedgerOk = analysis.scenarioRows.length === 0 || heartShare < 0.5
    ctx.check('[P0-11] scenario-ledger 不再全落 tests/eote-scenario-theHeartOfMadnessPart2.test.mjs',
      scenarioLedgerOk, {
        expected: `scenario-ledger 为空（假 kind 移除）或 Heart Part2 占比 < 50%（修复前 129/129=100%）`,
        actual: `scenario-ledger=${analysis.scenarioRows.length} 指向 Heart Part2=${heartCount}（${(heartShare * 100).toFixed(1)}%）files=${JSON.stringify(analysis.byFile)}`,
        evidence: evidence.rootCause,
      })
    // (2) 错配证据：entry 章节 ≠ 引用测试章节且引用文件不含卡号
    ctx.check('[P0-11] scenario-ledger 不再把非 Heart 章节卡错配给 Heart Part2 测试',
      analysis.misattributed.length === 0, {
        expected: '0 条「entry 非 Heart2 且引用 Heart2 测试且文件不含卡号」',
        actual: `${analysis.misattributed.length} 条：${JSON.stringify(analysis.misattributed.slice(0, 8).map(row => row.code))}`,
        evidence: evidence.rootCause,
      })
    // (3) 假绿消除的核心：所有「声称 verified/simplified」的记录必须带可追溯证据。
    ctx.check('[P0-11] 账本所有 verified/simplified 声称均有可追溯证据（假绿消除，invalidClaimed=0）',
      analysis.invalidClaimed.length === 0, {
        expected: '0 条「声称 verified/simplified 但证据不可追溯」',
        actual: `claimed=${analysis.claimed.length} invalidClaimed=${analysis.invalidClaimed.length}：${JSON.stringify(analysis.invalidClaimed.slice(0, 8).map(row => [row.code, row.kind, row.file]))}`,
        evidence: '修复前独立复算：131 条不可追溯证据（129 scenario-ledger + 强证据/文件型）；见 verify/player-b-verify.md',
      })
    // (4) invalid 计数下降：按「声称 verified/simplified 却不可追溯」口径，修复前 131 → 0。
    ctx.check('[P0-11] 账本 invalid（声称已验收但证据不可追溯）计数显著下降（131 → 0）',
      analysis.invalidClaimed.length < 131, {
        expected: '< 131（修复前复核口径 131）', actual: `invalidClaimed=${analysis.invalidClaimed.length}`,
        evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/player-b-verify.md（修复前 131 invalid）',
      })
    // (5) 如实暴露：无证据的卡降级为 missing/blocked（而不是伪装 verified），gate/status 与之一致。
    const ledger = analysis.ledger
    const gates = ledger.gates || {}
    const summary = ledger.summary || {}
    const withoutTraceable = summary.evidence?.withoutTraceableEvidence
    const exposed = analysis.missingBlocked.length
    ctx.check('[P0-11] 账本如实暴露无证据卡：missing/blocked 与 withoutTraceableEvidence 一致，且不再声称 verified',
      exposed === withoutTraceable && (gates.noMissingOrBlocked === false ? ledger.status !== 'verified' : true)
      && (analysis.invalidClaimed.length === 0), {
        expected: 'missing+blocked === summary.evidence.withoutTraceableEvidence；有缺失时 status 不得为 verified',
        actual: `missing=${analysis.rows.filter(row => row.status === 'missing').length} blocked=${analysis.rows.filter(row => row.status === 'blocked').length} withoutTraceable=${withoutTraceable} status=${ledger.status} gates=${JSON.stringify(gates)}`,
        evidence: 'tools/audit-eote-all-cards.mjs#gate（everyBehaviorCardHasEvidence 改查可追溯证据）',
      })
    // (6) scenario 账本不再每章塞入全部 264 张 CAMPAIGN_CODES
    const acceptance = scenarioAcceptanceAnalysis()
    ctx.check('[P0-11] audit/eote-scenario-acceptance.json 每章 cardCodes 不再逐章完全相同（264 张污染根因）',
      acceptance != null && acceptance.chapterCount > 1 && acceptance.distinct > 1, {
        expected: '各章 cardCodes 集合不同（distinct > 1）',
        actual: acceptance ? `chapters=${acceptance.chapterCount} distinct=${acceptance.distinct} sizes=${JSON.stringify(acceptance.chapters.map(chapter => `${chapter.id}:${chapter.count}`))}` : '文件缺失',
        evidence: evidence.scenario,
      })
    // (7) 发布账本等效性声明如实降级（旧 P8 verified 不成立）
    if (existsSync(`${MOD}/audit/eote-migration.json`)) {
      try {
        const migration = readJson('audit/eote-migration.json')
        const certified = migration?.releaseAcceptance?.equivalenceCertified
        ctx.check('[P0-11] audit/eote-migration.json 不再声称逐卡行为等价（equivalenceCertified=false）',
          certified === false, {
            expected: 'releaseAcceptance.equivalenceCertified=false',
            actual: `equivalenceCertified=${JSON.stringify(certified)}`,
            evidence: 'audit/eote-migration.json#releaseAcceptance',
          })
      } catch (error) {
        ctx.note('[P0-11] eote-migration.json 读取失败（记录）', error.message, evidence.ledger)
      }
    }
    // (8) 账本 --check 与生成结果一致（真实子进程；可用 --no-ledger-check 跳过）
    if (ctx.skipLedgerCheck) {
      ctx.note('[P0-11] 账本 --check 子进程已按 --no-ledger-check 跳过', 'skipped', evidence.checker)
    } else {
      const result = spawnSync(process.execPath, ['tools/audit-eote-all-cards.mjs', '--check'], {
        cwd: MOD, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024,
      })
      const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
      const tail = output.split(/\r?\n/).slice(-8).join(' | ')
      // 退出码语义：0=一致且 gate 完整；1=复算一致但 gate 不完整（账本如实 pending，可接受）；2=漂移/输入错误（FAIL）。
      const consistent = result.status === 0 || result.status === 1
      ctx.check('[P0-11] node tools/audit-eote-all-cards.mjs --check 与账本一致（非漂移：exit ∈ {0,1}）',
        consistent, {
          expected: 'exit 0（一致且 gate 完整）或 exit 1（复算一致、gate 如实不完整）；exit 2 = 漂移即 FAIL',
          actual: `exit=${result.status}${result.signal ? ` signal=${result.signal}` : ''} tail=${tail.slice(0, 700)}`,
          evidence: evidence.checker,
        })
      ctx.note('[P0-11] --check 完整输出摘要', tail.slice(0, 1200), evidence.checker)
    }
  },
}

export const ledger = [p011]
