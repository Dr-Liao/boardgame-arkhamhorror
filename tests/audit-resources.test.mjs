import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  ROOT, REPORT_PATH, inspectJson, compareSources, scanHaskell, maskHaskellComments,
  inspectManifest, validateExpected, stableStringify, sha256, buildAuditReport, checkReport,
  sourceSnapshot, validateFrozenReport, checkSourceReport,
} from '../tools/audit-resources.mjs'

const parse = value => inspectJson(Buffer.from(value), true)

test('空、BOM、损坏 JSON 与不合规卡表分别报告', () => {
  assert.equal(parse('').status, 'empty')
  assert.equal(parse(' \n ').status, 'empty')
  assert.equal(parse('\uFEFF[{"code":"01001"}]').status, 'valid')
  assert.equal(parse('{').status, 'damaged')
  assert.equal(parse('{}').status, 'invalid-schema')
  assert.equal(parse('[null, 1, {"code":1001}, {"code":""}, {"code":" x "}]').status, 'invalid-schema')
  assert.deepEqual(parse('[null, 1, {"code":1001}, {"code":""}, {"code":" x "}]').invalidRecords, [0, 1, 2, 3, 4])
})

test('编号保持前导零、后缀及命名空间，重复不静默合并', () => {
  const result = parse('[{"code":"01001"},{"code":"01001"},{"code":"01001b"},{"code":":dark-matter:014"}]')
  assert.equal(result.records, 4)
  assert.equal(result.uniqueCodes, 3)
  assert.deepEqual(result.duplicates, [{ code: '01001', indexes: [0, 1] }])
  assert.equal(result.schema.declaredVersion, null)
})

test('schema 指纹与键顺序、具体文字无关，字段类型变化可检测', () => {
  const a = parse('[{"code":"01001","health":1}]')
  const b = parse('[{"health":2,"code":"01002"}]')
  const c = parse('[{"code":"01001","health":"1"}]')
  assert.equal(a.schema.shapeSha256, b.schema.shapeSha256)
  assert.notEqual(a.schema.shapeSha256, c.schema.shapeSha256)
})

test('结构冲突、字段缺失、翻译展示差异分开统计', () => {
  const compared = compareSources([
    { path: 'en', rows: [{ code: '01001', name: 'Name', health: 7, deck_options: [{ level: 1 }], cost: null }] },
    { path: 'zh', rows: [{ code: '01001', name: '名称', health: 8, deck_options: [{ level: 2 }], cost: 0 }] },
    { path: 'legacy', rows: [{ code: '01001', name: 'Name', health: 7 }] },
  ])
  assert.deepEqual(compared.conflicts.map(item => item.field), ['cost', 'deck_options', 'health'])
  assert.equal(compared.conflicts.find(item => item.field === 'health').variants[0].sources.length, 2)
  assert.equal(compared.displayDifferencesByField.name, 1)
  assert.deepEqual(compared.fieldPresenceDifferences.map(item => item.field), ['cost', 'deck_options'])
  assert.ok(compared.conflicts.every(item => item.status === 'unresolved'))
})

test('嵌套对象键顺序不同不形成冲突', () => {
  assert.equal(compareSources([
    { path: 'a', rows: [{ code: '01001', restrictions: { a: 1, b: 2 } }] },
    { path: 'b', rows: [{ code: '01001', restrictions: { b: 2, a: 1 } }] },
  ]).conflicts.length, 0)
})

test('Haskell 注释被屏蔽，保留字符串、行号及嵌套块注释', () => {
  const source = '-- fake :: CardDef\n{- nested {- "99999" -} fake -}\nreal :: CardDef\nreal = enemy "01001" "-- Not a comment" X 1\n'
  assert.equal(maskHaskellComments(source).split('\n').length, source.split('\n').length)
  const result = scanHaskell('Enemy/CardDefs/Core.hs', source)
  assert.equal(result.definitions.length, 1)
  assert.deepEqual(result.definitions[0].codeCandidates, ['01001'])
  assert.equal(result.definitions[0].line, 3)
})

test('Haskell 断行签名、间接定义、多编号与 builder 不冒充规则完成', () => {
  const source = 'a\n  :: CardDef\na = other { cdCardCode = "01001b", cdOtherSide = "01001" }\nb :: CardDef\nb = inherited\nc :: CardDef -> CardDef\nc = id\nx :: EnemyCard X\nx = enemy X Cards.a\ns :: Difficulty -> ScenarioName\ns d = scenario S "01104" d\n'
  const result = scanHaskell('test.hs', source)
  assert.equal(result.definitions.length, 2)
  assert.equal(result.definitions[0].identityStatus, 'multiple-literals-review-required')
  assert.equal(result.definitions[1].identityStatus, 'indirect-or-no-literal')
  assert.equal(result.builders.length, 2)
  assert.deepEqual(result.builders[1].codeCandidates, ['01104'])
})

test('关联卡内部中文不算结构冲突，关联面编号差异必须报告', () => {
  const result = compareSources([
    { path: 'en', rows: [{ code: '01001', linked_card: { code: '01001b', name: 'Back', health: 7 } }] },
    { path: 'zh', rows: [{ code: '01001', linked_card: { code: '01002b', name: '背面', health: 8 } }] },
  ])
  assert.deepEqual(result.conflicts.map(item => item.field), ['linked_card.code', 'linked_card.health'])
  assert.equal(result.displayDifferencesByField['linked_card.name'], 1)
})

test('相邻无签名绑定不能污染 Haskell 定义候选', () => {
  const result = scanHaskell('test.hs', 'a :: CardDef\na = inherited\nhelper = "99999"\n')
  assert.deepEqual(result.definitions[0].codeCandidates, [])
})

test('注释与字符串中的生成指令不形成 discovery 证据', () => {
  const pragma = '{-# OPTIONS_GHC -F -pgmF cards-discover #-}'
  const result = scanHaskell('test.hs', `-- ${pragma}\n{- ${pragma} -}\nx = "${pragma}"\n${pragma}\n`)
  assert.equal(result.discovery.length, 1)
  assert.equal(result.discovery[0].line, 4)
})

test('显式战役与自制注册和生成入口分别保留', () => {
  const source = '{-# OPTIONS_GHC -F -pgmF cards-discover -optF --scenario-builders #-}\nentries = [("01", SomeCampaign nightOfTheZealot), (":dark-matter:014", HomebrewScenario T build)]\n'
  const result = scanHaskell('registry.hs', source)
  assert.equal(result.discovery.length, 1)
  assert.equal(result.registrations.length, 2)
  assert.equal(result.registrations[1].code, ':dark-matter:014')
})

test('媒体清单区分本地与远程，拒绝越界路径并保留重复证据', () => {
  const result = inspectManifest({ cards: ['img/a.avif', 'img/b.avif', 'img/a.avif', '../outside', '/root', 'C:/root', 'img\\c.avif'] }, new Set(['frontend/public/img/a.avif']))
  assert.equal(result.entries, 3)
  assert.equal(result.uniquePaths, 2)
  assert.equal(result.localMatches, 2)
  assert.equal(result.groups[0].remoteOnly.length, 1)
  assert.equal(result.duplicates.length, 1)
  assert.equal(result.invalidEntries.length, 4)
  assert.equal(result.remoteStatus, 'not-probed')
  assert.equal(inspectManifest([], new Set()).invalidEntries.length, 1)
})

test('基线漂移与未知统计键可靠失败', () => {
  assert.deepEqual(validateExpected({ n: 1 }, { n: 1 }), [])
  assert.equal(validateExpected({ n: 2 }, { n: 1 })[0].kind, 'baseline-drift')
  assert.equal(validateExpected({}, { n: 1 })[0].actual, null)
  const baseline = { summary: { n: 1 }, validation: { errors: [] } }
  assert.equal(checkReport(baseline, baseline).ok, true)
  assert.deepEqual(checkReport({ ...baseline, summary: { n: 2 } }, baseline).changedSections, ['summary'])
  assert.equal(checkReport({ ...baseline, validation: { errors: ['failed'] } }, baseline).ok, false)
})

test('CLI 未知参数产生非零退出状态', () => {
  const run = spawnSync(process.execPath, [resolve(ROOT, 'games/arkhamhorror/tools/audit-resources.mjs'), '--write'], { encoding: 'utf8', cwd: ROOT })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /资源审计失败/)
})

test('CLI 帮助明确来源历史与当前目标检查，读取失败则非零退出', () => {
  const entry = resolve(ROOT, 'games/arkhamhorror/tools/audit-resources.mjs')
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8', cwd: ROOT })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /--check-source/)
  assert.match(help.stdout, /--check-current/)
  assert.match(help.stdout, /不验证由 N1 接管的当前目标/)
  if (process.allowedNodeEnvironmentFlags.has('--permission')) {
    const denied = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${resolve(ROOT, 'games')}`, entry, '--check-source'], { encoding: 'utf8', cwd: ROOT })
    assert.notEqual(denied.status, 0)
  }
})

test('冻结 N0 历史保留815/5115，不冒充当前目录或重造运行时字节', () => {
  const frozen = JSON.parse(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'))
  assert.deepEqual(validateFrozenReport(frozen), { ok: true, errors: [] })
  assert.equal(frozen.summary.jsonUnionCodes, 5930)
  assert.equal(frozen.summary.targetCodes, 815)
  assert.equal(frozen.summary.missingTargetCodes, 5115)
  assert.equal(frozen.capabilities.cards.length, 815)
  assert.equal(frozen.capabilities.effects.length, 96)
  assert.equal(frozen.capabilities.investigators.length, 5)
  assert.equal(frozen.capabilities.scenarios.length, 3)
  assert.equal(frozen.capabilities.strictAcceptedCount, 0)
  assert.ok(frozen.capabilities.cards.every(card => !card.availability.strictAccepted))
  assert.equal(frozen.sources.find(source => source.path.endsWith('cards_ja.json')).exceptionId, 'empty-japanese-table')
  assert.deepEqual(frozen.coverage.legacyOnlyVsEnglish, ['60336'])
  assert.equal(frozen.sourceInventory.files.filter(file => file.kind === 'image').length, 299)
  assert.equal(frozen.summary.manifestEntries, frozen.summary.manifestLocalMatches + frozen.summary.manifestRemoteOnlyEntries)
  assert.equal(frozen.supplementaryJson.find(item => item.path.endsWith('sets/theGathering.json')).exceptionId, 'damaged-gathering-skeleton')
})

test('历史报告自身的指纹、计数与能力篡改分别失败', () => {
  const frozen = JSON.parse(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'))
  for (const key of ['reference', 'target', 'policy']) {
    const changed = { ...frozen, fingerprints: { ...frozen.fingerprints, [key]: 'changed' } }
    assert.ok(validateFrozenReport(changed).errors.some(error => error.section === `fingerprints.${key}`))
  }
  const counts = { ...frozen, summary: { ...frozen.summary, targetCodes: 816 } }
  assert.ok(validateFrozenReport(counts).errors.some(error => error.section === 'summary.targetCodes'))
  const files = frozen.target.files.map((file, index) => index ? file : { ...file, bytes: file.bytes + 1 })
  const rewritten = { ...frozen, target: { ...frozen.target, files }, fingerprints: { ...frozen.fingerprints, target: sha256(stableStringify(files)) } }
  const rewrittenCheck = validateFrozenReport(rewritten)
  assert.equal(rewrittenCheck.ok, false)
  assert.ok(rewrittenCheck.errors.some(error => error.section === 'reportSha256'))
  const cards = frozen.capabilities.cards.map((card, index) => index ? card : { ...card, effectStatus: 'falsely-accepted' })
  assert.equal(validateFrozenReport({ ...frozen, capabilities: { ...frozen.capabilities, cards } }).ok, false)
  assert.equal(validateFrozenReport({}).ok, false)
})

test('来源比较不吞掉未知漂移，也不把当前失败投影为历史通过', () => {
  const frozen = JSON.parse(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'))
  const source = sourceSnapshot(frozen)
  assert.equal(Object.hasOwn(source, 'target'), false)
  assert.equal(Object.hasOwn(source, 'capabilities'), false)
  assert.equal(Object.hasOwn(source.summary, 'targetCodes'), false)
  assert.equal(checkSourceReport(source, frozen).ok, true)
  const drift = { ...source, summary: { ...source.summary, sourceFiles: source.summary.sourceFiles + 1 } }
  assert.deepEqual(checkSourceReport(drift, frozen).changedSections, ['summary'])
  assert.equal(checkSourceReport({ ...source, unknownSection: 'unreviewed' }, frozen).ok, false)
  const failed = { ...source, validation: { ...source.validation, errors: [{ kind: 'unknown-drift' }] } }
  assert.equal(checkSourceReport(failed, frozen).ok, false)
  const invalidHistory = { ...frozen, capabilities: { ...frozen.capabilities, strictAcceptedCount: 1 } }
  assert.equal(checkSourceReport(source, invalidHistory).ok, false)
  const changedTarget = { ...frozen, target: { ...frozen.target, unknownRuntimeChange: true } }
  assert.equal(checkReport(changedTarget, frozen).ok, false)
  assert.deepEqual(checkReport(changedTarget, frozen).changedSections, ['target'])
})

test('真实来源只读复核；当前 N1 差异明确失败，冻结报告字节保持不变', () => {
  const before = readFileSync(resolve(ROOT, REPORT_PATH), 'utf8')
  const frozen = JSON.parse(before)
  const current = buildAuditReport()
  assert.equal(current.summary.jsonUnionCodes, 5930)
  assert.equal(current.summary.targetCodes, 5930)
  assert.equal(current.summary.missingTargetCodes, 0)
  assert.equal(current.capabilities.cards.length, 5930)
  assert.equal(current.validation.status, 'failed')
  assert.ok(current.validation.errors.some(error => error.kind === 'baseline-drift' && error.key === 'targetCodes' && error.expected === 815 && error.actual === 5930))
  assert.ok(current.validation.errors.some(error => error.kind === 'baseline-drift' && error.key === 'missingTargetCodes' && error.expected === 5115 && error.actual === 0))
  assert.equal(checkReport(current, frozen).ok, false)
  assert.ok(checkReport(current, frozen).changedSections.includes('target'))
  assert.notEqual(current.fingerprints.target, frozen.fingerprints.target)
  assert.equal(current.fingerprints.reference, frozen.fingerprints.reference)
  assert.equal(checkSourceReport(sourceSnapshot(current), frozen).ok, false)
  const readonly = process.allowedNodeEnvironmentFlags.has('--permission') ? ['--permission', '--allow-fs-read=*'] : []
  const check = spawnSync(process.execPath, [...readonly, resolve(ROOT, 'games/arkhamhorror/tools/audit-resources.mjs'), '--check-source'], { encoding: 'utf8', cwd: ROOT })
  assert.equal(check.status, 0, check.stderr)
  const result = JSON.parse(check.stdout)
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'N0-source-and-frozen-history')
  assert.deepEqual(result.validation.errors, [])
  assert.deepEqual(result.changedSections, [])
  assert.deepEqual(result.historicalTarget.integrity, { ok: true, errors: [] })
  assert.equal(result.historicalTarget.summary.targetCodes, 815)
  assert.equal(result.historicalTarget.summary.missingTargetCodes, 5115)
  assert.equal(result.historicalTarget.runtimeFilesVerified, false)
  assert.equal(result.currentTarget.status, 'superseded-by-N1-not-checked')
  assert.equal(result.sourceSummary.jsonUnionCodes, 5930)
  assert.equal(Object.hasOwn(result.sourceSummary, 'targetCodes'), false)
  assert.equal(readFileSync(resolve(ROOT, REPORT_PATH), 'utf8'), before)
})
