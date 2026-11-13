// 绯红密钥（The Scarlet Keys）P8：全卡逐卡验收账本守卫。
//
// 账本由 tools/audit-tsk-all-cards.mjs **实跑**证据测试后生成；本测试不猜结论，只做「单一事实源」对账：
//   1. 同一构建器两次复算深相等、与磁盘 audit/tsk-all-card-acceptance.json 逐字节一致
//      （不一致说明测试覆盖/条目声明/既有账本/scope 变了，需重跑 --write）；
//   2. summary gate：gateComplete / missing=0 / total=439，且分区与 audit/tsk-scope.json 独立复算一致；
//   3. 逐章：每章 ≥1 张 verified/simplified、恰好 1 张 scenario-reference（= 章 referenceCode）、
//      章内状态全部落在 P9 消费的词表内（verified/simplified/scenario-data/scenario-reference）；
//   4. 抽样：deadHeat 09520（参考卡）与 09544a/09544b（末绽之花稳定/动荡面）等必须有章证据或测试证据；
//      多张共享组行为卡必须有实跑测试证据；
//   5. 数据型条目：note 全部以 approximation: 开头并声明「数据型」，且每条都挂到章账本 verified +
//      章测试文件级通过的证据上（逐卡 literalNote 说明）；
//   6. 近似披露完整性：simplified 必有 disclosures，战役 verified 不得带 approximation: 前缀 note；
//   7. 证据形状：来源只允许 test / chapter / player-ledger / investigator-ledger，测试证据指向真实测试文件，
//      快照里每个测试文件的 sha256 与磁盘一致、0 失败；
//   8. 玩家 108 / 调查员 20（6 人 + 14 依赖）复用既有账本，不重复实跑。
//
// 不启动浏览器；两次构建各实跑一次证据集（约 12s/次），整体控制在 120s 内。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  buildAllCardsLedger, ALL_CARDS_LEDGER_PATH, ALL_CARDS_TOOL_PATH, ALL_CARDS_TEST_PATH,
} from '../tools/audit-tsk-all-cards.mjs'

const modRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => JSON.parse(fs.readFileSync(path.join(modRoot, relative), 'utf8'))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const STATUSES = ['verified', 'simplified', 'scenario-data', 'scenario-reference', 'missing']
const PASSING_STATUSES = ['verified', 'simplified', 'scenario-data', 'scenario-reference']

test('P8 TSK 逐卡账本', async t => {
  const scope = readJson('audit/tsk-scope.json')
  const scenarioLedger = readJson('audit/tsk-scenario-acceptance.json')
  const playerLedger = readJson('audit/tsk-player-acceptance.json')
  const investigatorLedger = readJson('audit/tsk-investigators.json')

  // 两次独立构建：证据必须完全来自可复跑的输入，不能有任何时间戳/耗时/本机路径。
  const first = await buildAllCardsLedger()
  const second = await buildAllCardsLedger()
  const ledger = first.ledger
  const { summary } = ledger
  const cards = ledger.cards
  const byCode = new Map(cards.map(card => [card.code, card]))
  const inChapter = chapterId => cards.filter(card => card.scenarioId === chapterId)

  await t.test('复算两次深相等，且不含时间戳/耗时/本机绝对路径', () => {
    if (second.json !== first.json) {
      assert.fail(`同一构建器两次复算不一致（长度 ${first.json.length} / ${second.json.length}）；`
        + `summary ${JSON.stringify(first.summary)} vs ${JSON.stringify(second.summary)}`)
    }
    assert.deepEqual(second.ledger, ledger, '同一构建器两次复算不一致（存在非确定性输入）')
    assert.ok(ledger.generatedBy === ALL_CARDS_TOOL_PATH)
    assert.equal(ledger.profile.testFile, ALL_CARDS_TEST_PATH)
    assert.doesNotMatch(first.json, /\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/, '账本含 ISO 时间戳')
    assert.doesNotMatch(first.json, /"[A-Za-z]:\\\\[A-Za-z]/, '账本含 Windows 绝对路径')
    assert.doesNotMatch(first.json, /generatedAt|elapsedMs|durationMs/, '账本含时间/耗时字段')
    assert.notEqual(sha256(first.json), '', 'sha256 计算失败')
  })

  await t.test('与磁盘账本逐字节一致（不一致需重跑 --write）', () => {
    const disk = fs.readFileSync(path.join(modRoot, ALL_CARDS_LEDGER_PATH), 'utf8')
    if (disk !== first.json) {
      assert.fail(`账本漂移：磁盘 ${disk.length} 字节 / 复算 ${first.json.length} 字节；`
        + `重跑 node ${ALL_CARDS_TOOL_PATH} --write（测试覆盖、条目声明、既有账本或 scope 变了）`)
    }
    assert.equal(sha256(disk), sha256(first.json))
  })

  await t.test('summary gate 完整：439 条、missing=0、分区与 scope 独立复算一致', () => {
    assert.equal(cards.length, 439)
    assert.equal(new Set(cards.map(card => card.code)).size, 439, '账本存在重复卡号')
    assert.equal(summary.total, 439)
    assert.equal(summary.missing, 0)
    assert.equal(summary.blocked, 0)
    assert.equal(summary.gateComplete, true)
    assert.equal(summary.gateComplete, summary.missing === 0 && summary.total === 439)
    assert.equal(summary.strictComplete, false, 'strictComplete 预期 false（已有公开披露近似）')
    assert.equal(summary.strictComplete, summary.verified + summary.scenarioReference === 439)

    // 分区与 scope 独立复算（不读账本自己的 partitions）
    assert.equal(scope.partitions.tskCampaign.length, 311)
    assert.equal(scope.partitions.tskInvestigators.length, 20)
    assert.equal(scope.partitions.tskPlayer.length, 108)
    assert.equal(scope.cards.length, 439)
    for (const [partition, codes] of Object.entries(scope.partitions)) {
      assert.deepEqual(
        cards.filter(card => card.partition === partition).map(card => card.code).sort(),
        [...codes].sort(), `${partition} 分区与 scope 不一致`)
    }
    assert.equal(summary.verified + summary.simplified + summary.scenarioData
      + summary.scenarioReference + summary.missing, 439)
    assert.equal(summary.campaignScenarioData, summary.scenarioData)
    assert.equal(summary.scenarioData, cards.filter(card => card.status === 'scenario-data').length)
    assert.equal(summary.simplified, cards.filter(card => card.status === 'simplified').length)
    assert.equal(summary.scenarioReference, 10)

    // 每张卡都被真实判定过（没有既不在 missing 也没有证据的漏网状态）
    for (const card of cards) {
      assert.ok(STATUSES.includes(card.status), `${card.code} 状态越界：${card.status}`)
      if (card.status === 'missing') assert.ok(card.reason, `${card.code} missing 必须有 reason`)
    }
    assert.deepEqual(ledger.missing, [])
  })

  await t.test('每章 ≥1 张 verified/simplified，10 张剧本参考卡为 scenario-reference', () => {
    assert.equal(ledger.chapters.length, 10)
    assert.equal(scenarioLedger.chapters.length, 10)
    const references = cards.filter(card => card.status === 'scenario-reference')
    assert.equal(references.length, 10)
    assert.deepEqual(references.map(card => card.code).sort(),
      ledger.chapters.map(chapter => chapter.referenceCode).sort())
    for (const chapter of ledger.chapters) {
      const rows = inChapter(chapter.id)
      assert.ok(rows.length > 0, `${chapter.id} 没有逐卡记录`)
      assert.ok(rows.every(row => PASSING_STATUSES.includes(row.status)),
        `${chapter.id} 存在未通过状态：${rows.filter(row => !PASSING_STATUSES.includes(row.status)).map(row => row.code)}`)
      const passing = rows.filter(row => row.status === 'verified' || row.status === 'simplified')
      assert.ok(passing.length >= 1, `${chapter.id} 没有 verified/simplified 行为卡`)
      const chapterReferences = rows.filter(row => row.status === 'scenario-reference')
      assert.equal(chapterReferences.length, 1, `${chapter.id} 的剧本参考卡不是 1 张`)
      const reference = chapterReferences[0]
      assert.equal(reference.code, chapter.referenceCode)
      assert.equal(reference.type, 'scenario')
      assert.equal(reference.entryPath, null, '剧本参考卡没有单卡条目')
      const evidence = reference.evidence.find(row => row.source === 'chapter')
      assert.ok(evidence, `${reference.code} 缺章证据`)
      assert.equal(evidence.chapterId, chapter.id)
      assert.equal(evidence.scenarioStatus, 'verified')
      assert.equal(evidence.testFilePassed, true)
      assert.ok(evidence.guide && fs.existsSync(path.join(modRoot, evidence.guide)), `${chapter.id} 指南缺失`)
      assert.match(reference.literalNote, /剧本参考卡/)
      // 章账本与章测试必须真实存在且通过
      const scenarioRow = scenarioLedger.chapters.find(row => row.id === chapter.id)
      assert.equal(scenarioRow.status, 'verified')
      assert.ok(fs.existsSync(path.join(modRoot, 'tests', `tsk-scenario-${chapter.id}.test.mjs`)))
    }
  })

  await t.test('deadHeat 09520/09544a/09544b 等有强证据或文件级/章证据', () => {
    // 09520 是 deadHeat 的剧本参考卡：章账本 verified + 章测试文件级通过。
    const reference = byCode.get('09520')
    assert.equal(reference.status, 'scenario-reference')
    assert.equal(reference.scenarioId, 'deadHeat')
    const referenceEvidence = reference.evidence.find(row => row.source === 'chapter')
    assert.ok(referenceEvidence && referenceEvidence.chapterId === 'deadHeat')
    assert.equal(referenceEvidence.testFile, 'tests/tsk-scenario-deadHeat.test.mjs')
    assert.equal(referenceEvidence.scenarioStatus, 'verified')
    assert.equal(referenceEvidence.testFilePassed, true)
    assert.ok(['strong', 'file-level', 'chapter'].includes(reference.evidenceLevel))

    // 末日之花稳定面/动荡面：有行为条目 + 实跑测试证据（文件级即可），并公开披露近似。
    for (const code of ['09544a', '09544b']) {
      const row = byCode.get(code)
      assert.equal(row.scenarioId, 'deadHeat')
      assert.equal(row.entryFlags.dataType, false)
      assert.deepEqual(row.entryFlags.behaviorKeys, ['flags'])
      assert.equal(row.status, 'simplified')
      assert.ok(row.evidence.some(evidence => evidence.source === 'test'
        && evidence.file === 'games/arkhamhorror/tests/tsk-scenario-deadHeat.test.mjs'))
      assert.ok(row.disclosures.length > 0)
    }

    // 抽样：每章至少一张带实跑测试证据的行为卡；共享组行为卡必须有标题级强证据。
    for (const chapter of ledger.chapters) {
      const behavior = inChapter(chapter.id).filter(row => row.status === 'verified' || row.status === 'simplified')
      assert.ok(behavior.some(row => row.evidence.some(evidence => evidence.source === 'test')),
        `${chapter.id} 没有带实跑测试证据的行为卡`)
    }
    for (const code of ['09752', '09753', '09754', '09755', '09756', '09757', '09758', '09759', '09760', '09761']) {
      const row = byCode.get(code)
      assert.ok(row.evidence.some(evidence => evidence.source === 'test' && evidence.level === 'title'
        && evidence.titleMatched === true && new RegExp(`(?:^|[^0-9A-Za-z])${code}(?![0-9A-Za-z])`).test(evidence.test)),
      `${code} 缺标题级强证据`)
    }
  })

  await t.test('数据型条目 note 全部以 approximation: 开头且指向章 behavior', () => {
    const dataRows = cards.filter(card => card.status === 'scenario-data')
    assert.equal(dataRows.length, summary.scenarioData)
    assert.ok(dataRows.length > 0)
    for (const row of dataRows) {
      assert.equal(row.partition, 'tskCampaign', `${row.code} 数据型条目不在战役分区`)
      assert.equal(row.entryFlags.dataType, true)
      assert.equal(row.entryFlags.abilities, 0, `${row.code} 数据型条目应 abilities:[]`)
      assert.match(row.note, /^approximation:/, `${row.code} note 不以 approximation: 开头`)
      assert.match(row.note, /数据型/, `${row.code} note 未声明数据型`)
      assert.ok(row.disclosures.length > 0, `${row.code} 披露字段丢失`)
      assert.ok(row.scenarioId, `${row.code} 数据型条目缺章归属`)
      const chapterEvidence = row.evidence.find(evidence => evidence.source === 'chapter')
      assert.ok(chapterEvidence, `${row.code} 缺章证据`)
      assert.equal(chapterEvidence.chapterId, row.scenarioId)
      assert.equal(chapterEvidence.scenarioStatus, 'verified')
      assert.equal(chapterEvidence.testFilePassed, true)
      assert.ok(chapterEvidence.passingTests > 0)
      assert.match(row.literalNote, /definition 与 behavior/, `${row.code} literalNote 未指向章 behavior`)
      assert.match(row.literalNote, /逐卡/, `${row.code} literalNote 未说明逐卡字面待补`)
    }
    // 反向：战役里 abilities:[] + 数据型 note 的条目必须全部判 scenario-data，不能漏成 verified。
    const dataCodes = new Set(dataRows.map(row => row.code))
    for (const card of cards) {
      if (card.partition !== 'tskCampaign') continue
      if (!card.entryFlags.dataType) continue
      assert.ok(dataCodes.has(card.code), `${card.code} 是数据型条目却不是 scenario-data`)
    }
  })

  await t.test('近似披露完整：simplified 必有 disclosures，战役 verified 不得带近似前缀', () => {
    const simplifiedRows = cards.filter(card => card.status === 'simplified')
    assert.equal(simplifiedRows.length, summary.simplified)
    assert.ok(simplifiedRows.length > 0)
    for (const row of simplifiedRows) {
      assert.equal(row.partition, 'tskCampaign')
      assert.equal(row.entryFlags.dataType, false, `${row.code} 数据型条目不应记 simplified`)
      assert.ok((row.disclosures || []).length > 0, `${row.code} simplified 缺披露字段`)
      assert.ok(['entry-note', 'entry-simplified-flag'].includes(row.entryFlags.disclosure),
        `${row.code} disclosure 来源异常：${row.entryFlags.disclosure}`)
      assert.match(row.disclosures[0], /^(approximation|近似)\s*[:：]/, `${row.code} 披露原文未保留`)
      assert.ok(row.evidence.length > 0)
    }
    for (const row of cards.filter(card => card.partition === 'tskCampaign' && card.status === 'verified')) {
      assert.equal(row.entryFlags.disclosure, null, `${row.code} 有披露却记 verified`)
      assert.ok(!/^(approximation|近似)\s*[:：]/.test(row.note || ''), `${row.code} note 披露近似却记 verified`)
      assert.ok(row.entryFlags.implemented === true, `${row.code} verified 必须 implemented`)
    }
    // 玩家侧：按既有账本记 verified，但 P6/P7 披露必须随卡保留（不隐藏近似）。
    const playerRows = cards.filter(card => card.partition === 'tskPlayer')
    assert.equal(playerRows.length, 108)
    assert.ok(playerRows.every(row => row.status === 'verified'))
    assert.ok(playerRows.every(row => row.evidence.length > 0))
    assert.ok(playerRows.every(row => row.evidence[0].source === 'player-ledger'))
    assert.ok(playerRows.every(row => row.evidence[0].titleMatched === true))
    assert.equal(playerRows.filter(row => (row.disclosures || []).length > 0).length,
      summary.playerDisclosedApproximations)
    assert.equal(summary.playerDisclosedApproximations, 61)
    assert.equal(playerLedger.summary.verified, 108)
  })

  await t.test('证据形状与快照：来源可追溯、测试文件 sha256 与磁盘一致、0 失败', () => {
    const sources = new Set(['test', 'chapter', 'player-ledger', 'investigator-ledger'])
    const testFileSet = new Set(ledger.snapshot.testFiles.map(row => `games/arkhamhorror/${row.file}`))
    for (const card of cards) {
      if (card.status !== 'missing') assert.ok(card.evidence.length > 0, `${card.code} 缺证据`)
      assert.ok(card.entryPath === null || fs.existsSync(path.join(modRoot, card.entryPath)), `${card.code} 条目路径不存在`)
      if (card.entryPath) {
        assert.equal(card.entrySha256, sha256(fs.readFileSync(path.join(modRoot, card.entryPath))), `${card.code} 条目 sha 过期`)
      }
      for (const evidence of card.evidence) {
        assert.ok(sources.has(evidence.source), `${card.code} 证据来源越界：${evidence.source}`)
        if (evidence.source !== 'test') continue
        assert.match(evidence.file, /^games\/arkhamhorror\/tests\//, `${card.code} 测试证据不是 tests/ 文件`)
        assert.ok(testFileSet.has(evidence.file), `${card.code} 证据文件不在实跑快照里：${evidence.file}`)
        if (evidence.level === 'title') {
          assert.equal(evidence.titleMatched, true)
          assert.ok(evidence.test)
        } else {
          assert.equal(evidence.level, 'file')
          assert.equal(evidence.titleMatched, false)
          assert.ok(evidence.passingTests > 0)
        }
      }
      if (card.partition === 'tskInvestigators') {
        const evidence = card.evidence[0]
        assert.equal(evidence.source, 'investigator-ledger')
        assert.equal(evidence.evidenceFile, 'audit/tsk-investigators.json')
        assert.ok(evidence.passingTests > 0)
      }
    }
    assert.equal(summary.staleEntryHashes, 0, '有卡的实现 sha 与既有账本不一致')
    assert.equal(summary.testsFailed, 0)
    assert.equal(summary.spawnExit, 0)
    assert.deepEqual(ledger.snapshot.failedEvidence, [])
    assert.ok(ledger.snapshot.testFiles.length >= 20)
    // 另一 worker 的战役 E2E 只登记存在性、不进逐卡证据（避免并行编写造成漂移）。
    assert.ok(ledger.snapshot.adjacentTestFiles.every(row => row.countedAsEvidence === false))
    assert.ok(!ledger.snapshot.testFiles.some(row => row.file === 'tests/tsk-p8-campaign.test.mjs'))
    for (const row of ledger.snapshot.testFiles) {
      const absolute = path.join(modRoot, row.file)
      assert.ok(fs.existsSync(absolute), `证据文件缺失：${row.file}`)
      assert.equal(row.sha256, sha256(fs.readFileSync(absolute)), `证据文件 sha256 过期：${row.file}`)
      assert.ok(row.passed > 0, `证据文件没有通过用例：${row.file}`)
      assert.equal(row.failed, 0, `证据文件有失败用例：${row.file}`)
      assert.equal(row.spawnExit, 0)
    }
    // 快照里的输入账本 sha256 也必须与磁盘一致（账本不读过期输入）。
    for (const input of ledger.snapshot.inputs) {
      assert.equal(input.sha256, sha256(fs.readFileSync(path.join(modRoot, input.file))), `输入过期：${input.file}`)
    }
  })

  await t.test('玩家 108 / 调查员 20（6 人 + 14 依赖）复用既有账本', () => {
    assert.equal(investigatorLedger.items.length, 6)
    const dependencies = cards.filter(card => card.partition === 'tskInvestigators' && card.entryFlags.dependencyOnly)
    assert.equal(dependencies.length, 14)
    assert.equal(cards.filter(card => card.partition === 'tskInvestigators').length - dependencies.length, 6)
    for (const card of cards.filter(candidate => candidate.partition === 'tskInvestigators')) {
      assert.equal(card.status, 'verified')
      assert.ok(card.entryFlags.behaviorKeys.length > 0, `${card.code} 调查员条目没有行为键`)
      if (card.entryFlags.dependencyOnly) {
        assert.ok(card.entryFlags.signatureOf, `${card.code} 依赖卡缺所属调查员`)
        assert.ok(investigatorLedger.items.some(item => item.signatures.some(sig => sig.code === card.code)))
      }
    }
    // 玩家卡证据必须与既有玩家账本逐条对齐（file/line/test 三元不篡改）。
    for (const card of cards.filter(candidate => candidate.partition === 'tskPlayer')) {
      const item = playerLedger.entries.find(entry => entry.code === card.code)
      assert.ok(item, `${card.code} 不在玩家账本`)
      assert.equal(card.status, 'verified')
      assert.deepEqual(
        card.evidence.filter(evidence => evidence.source === 'player-ledger')
          .map(evidence => `${evidence.file}|${evidence.line}|${evidence.test}`).sort(),
        item.evidence.map(evidence => `games/arkhamhorror/tests/${evidence.file}|${evidence.line}|${evidence.test}`).sort(),
        `${card.code} 玩家证据与既有账本不一致`)
    }
  })
})
