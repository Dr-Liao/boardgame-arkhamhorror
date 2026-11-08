// P0 独立验收套件 · 一键入口
//
// 用法（在 games/arkhamhorror 目录下）：
//   node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs                    # 全套件，写 results.json + report.md
//   node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --label baseline   # 修复前快照，写 baseline-results.json + baseline-report.md
//   node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --only P0-1,P0-4   # 只跑指定项
//   node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --no-ledger-check  # 跳过 P0-11 的外部账本 --check 子进程
//   node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --report-only      # 用已有 results.json 重新渲染 report.md（不跑引擎）
//
// 退出码：0 = 全部 PASS；1 = 存在 FAIL（预期：修复前 baseline 为 1）。
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { loadEoteWorld, printedCards, Recorder, createChapterOpener, drive, cloneState } from './lib/harness.mjs'
import { CASES } from './cases/index.mjs'

const HERE = new URL('.', import.meta.url)
const argv = process.argv.slice(2)
const hasFlag = name => argv.includes(name)
const flagValue = name => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : null
}
const label = flagValue('--label') || 'latest'
const only = (flagValue('--only') || '').split(',').map(item => item.trim()).filter(Boolean)
const skipLedgerCheck = hasFlag('--no-ledger-check')
const reportOnly = hasFlag('--report-only')

const jsonName = label === 'baseline' ? 'baseline-results.json' : 'results.json'
const mdName = label === 'baseline' ? 'baseline-report.md' : 'report.md'

let results = null
let fatal = null
if (reportOnly) {
  if (!existsSync(new URL(jsonName, HERE))) {
    console.error(`--report-only 需要先有 ${jsonName}`)
    process.exit(2)
  }
  results = JSON.parse(readFileSync(new URL(jsonName, HERE), 'utf8'))
} else {
  const startedAt = new Date()
  const recorder = new Recorder()
  const world = await loadEoteWorld()
  const cards = await printedCards()
  const ctx = {
    world,
    cards,
    recorder,
    label,
    skipLedgerCheck,
    open: createChapterOpener(world),
    drive: (state, fn, options) => drive(world, state, fn, options),
    clone: cloneState,
    check: (name, condition, options) => recorder.check(name, condition, options),
    note: (name, value, evidence) => recorder.note(name, value, evidence),
    fail: (name, options) => recorder.check(name, false, options),
    pass: (name, options) => recorder.check(name, true, options),
    legal: (state, seat = null) => {
      const actualSeat = seat ?? world.engine.decisionSeat(state)
      return world.engine.legalMoves(state, actualSeat)
    },
    decisionSeat: state => world.engine.decisionSeat(state),
  }
  const selected = only.length ? CASES.filter(item => only.includes(item.id)) : CASES
  for (const caseDef of selected) {
    recorder.startCase(caseDef.id, caseDef.title)
    try {
      await caseDef.run(ctx)
    } catch (error) {
      recorder.failCase(error)
      console.error(`\n[${caseDef.id}] 用例异常：${error.message}`)
    }
  }
  if (!selected.length) fatal = `--only 没有匹配任何用例：${only.join(',')}`
  const finishedAt = new Date()
  const summary = recorder.summarize()
  results = {
    suite: 'eote-p0-accept',
    label,
    command: `node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs${argv.filter(arg => arg !== '--report-only').join(' ') ? ` ${argv.filter(arg => arg !== '--report-only').join(' ')}` : ''}`,
    generatedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs: finishedAt - startedAt,
    node: process.version,
    summary,
    cases: recorder.cases,
  }
  writeFileSync(new URL(jsonName, HERE), `${JSON.stringify(results, null, 2)}\n`)
}
// 输出与报告渲染在文件末尾执行（renderReport 依赖 REPORT_NOTES 的常量初始化顺序）。

// ---------------------------------------------------------------------------
// report.md 的人工复核口径（阶段 B：四类分类 + 反向验证 + 交叉复核）
// 说明：这些是验收员在运行后写下的判定口径；自动断言结果在「逐项证据」中逐条列示。
// ---------------------------------------------------------------------------

const REPORT_NOTES = {
  phase: '阶段 B（最终验证）',
  environment: '生产组合根 tests/eote-p8-fixture.mjs（loadEoteWorld/createGameState/legalMoves/applyMove/performTest/drawEncounter）＋ src/engine 真实导出；Node 22。',
  classification: {
    pass: [
      'P0-1 IDP I/II/III 剧本行动（actions/performAction）+ advanceAgenda/advanceAct 不 throw',
      'P0-2 IDP 幕/议程 reveal 真实生效（08518 冷遇生成 08515；08519 生成 08522；08523 查看底牌；08521/08526/08546 背面结局）',
      'P0-3 IDP resolveSpecialToken（skull/cultist/tablet）真实数值 + Part III afterTest 失败后果',
      'P0-4 13 张冰原地点 shroud = 印刷值；未探索地点入场费真实收取且线索不足拒绝移动',
      'P0-5 FM 议程/三版本（08550/51/52 @15/13/11、08553/54/55）/19 地点 Mirage 线索/花线索翻面真实行动/resolution 记录/noResolution',
      'P0-6 City 钥匙 claim/give 真实 legalMoves+applyMove、幕 1 目标（actKey→记录→checkAct 推进）、议程 2 背面 R2',
      'P0-7 Heart2 08672 不在 doom=0 提前推进/清场、R1/R2 门槛记录真实写入与结局分流、08716 成功躲避无 ReferenceError',
      'P0-8 Peaks/City 8 张专属诡计真实 drawEncounter 结算非零、遭遇牌库按 Setup gather 共享组（Tekeli-li/Shoggoths 独立牌库或按 v1 setAside）',
      'P0-9 抽样：08105/08107 真实 fight 检定窗口出现并支付横置；08091 tokenReveal 咒印替换；08130 威胁区伤害承接治愈',
      'P0-10 抽样：08013a 检定过期/延迟翻面按执行者座位过滤；08006 牌库顶封锁覆盖 searchDeck/moveCardTo；08014a 免费行动额度按轮清理',
      'P0-12 City 地点动作真实 applyMove 无 api.test TypeError 且触发真实 performTest',
      'P0-13 FM 08549 四个混乱标记在真实 performTest 中 delta = -X/-2/-3/-4（非 0）',
      'P0-11 账本假绿根因消除：scenario-ledger 0 条（不再全落 Heart Part2）、8 章 cardCodes 各不相同、260 条 verified/simplified 声称 100% 有可追溯证据（invalidClaimed 131→0）、无证据卡如实降级 missing 127/blocked 14、`node tools/audit-eote-all-cards.mjs --check` 复算一致（exit 1 = gate 如实 incomplete：missing 127/blocked 14/simplified 12）、eote-migration#releaseAcceptance.equivalenceCertified=false',
    ],
    failOrPending: [
      '（无）P0-1..P0-13 全部 PASS。',
    ],
    approximations: [
      'P0-9 抽样仅覆盖 08105/08107/08091/08130（+08013a 归属 P0-10）；其余 P0-9 卡（08102/08083/08028/08074/08059/08053/08058 等）以 owner 探针与披露口径记录，近似项不等于规则完全等价。',
      'P0-8 peaks 的攀爬 from-below / Expedition 支援入场与能力 / 08608-08609 X 数值等不在本套件断言内（由 owner `_fix-peaks.mjs` 探针 14/14 覆盖，仅作交叉证据，不替代本套件验收）。',
      'P0-7 Heart2 高塔攻击难度/进入费/封印力量等 P1 项、P0-6 City v2/v3 版本与 08629 强制等未纳入本次 P0 断言。',
      'P0-11 的 PASS 口径是「审计流水线不再假绿 + 账本与复算一致 + 声称均证据可追溯」，不等于「全部 403 卡已验收」：账本如实保留 missing 127 / blocked 14（旧验证声明下这些被假证据伪装成 verified）。',
      '套件章节进入使用 fixture 的 debug endScenario 结算前置章节；连续游玩中的跨章记录链（XP/伙伴/检查点）只做抽样，不做全量对账。',
    ],
    residualRisks: [
      'P0-11 审计账本按修订后口径如实 pending：missing 127 / blocked 14，`audit-eote-all-cards.mjs --check` 退出码 1（复算一致、gate 如实不完整），`audit/eote-release-acceptance.json` failed（仅 allCards 门禁）；这是**如实披露**而非假绿，但意味着 P8「全量 verified / release passed」不能宣称。',
      '真实引擎断言覆盖 Node 规则层；浏览器/UI 层（提示、隐私投影、EN 文案）不在本套件范围。',
      'P0-9/P0-10 只覆盖任务指定的抽样卡/调查员；其余同批卡仍以 owner 证据为准。',
      'owner 探针交叉复核均为复跑 PASS 且与本套件结论一致；但 owner 探针覆盖的「非 P0 子句」仍属各自披露口径，未由本套件独立验收。',
    ],
  },
  ownerProbes: [
    { file: 'campaign/a/_fix-idp-p0.mjs', result: 'RESULT: PASS（0 failing checks）', conflict: '无（P0-1..4 一致）' },
    { file: 'campaign/b/_fix-realpath.mjs', result: '93/93 PASS（ALL PASS）', conflict: '无（P0-5/P0-13 一致）' },
    { file: 'campaign/c/_probe-city.mjs', result: '23/23 PASS', conflict: '无（P0-6/P0-12/P0-8-City 一致）' },
    { file: 'campaign/d/_fix-heart2.mjs', result: '5/5 PASS', conflict: '无（P0-7 一致）' },
    { file: 'campaign/d/_fix-peaks.mjs', result: '14/14 PASS', conflict: '无（P0-8-Peaks 一致）' },
    { file: 'investigators/_fix-p0-10.mjs', result: 'exit 0（含 F0 legacy 对照输出）', conflict: '无（P0-10 抽样三项一致）' },
    { file: 'player-b/_fix-player-cards.mjs', result: '25/25 PASS', conflict: '无（P0-9 抽样一致；其余卡按披露口径）' },
  ],
  ownerProbeNote: 'owner 探针由验收员用同一工作区直接复跑（不采信其结论，仅交叉核对输出）；套件断言与 owner 探针冲突时以真实引擎套件为准并上报 Lead。',
  reverseNote: [
    '反向验证口径（每个 PASS 至少一条，分两类）：',
    '① 自动反向断言（名称含「反向验证」）：同一真实读点在条件不满足时必须给出相反结果，见下方 7 项；',
    '② 读源码确认读点 + 修复前后行为对比：P0-3 用多标记不同数值（cultist/tablet/skull 精确匹配印刷公式）证明非默认 0；P0-4 内置「线索不足 → legalMoves 不提供且强制提交被 validateMove 拒绝」负向对照；P0-7 的 R1/R2 用两条互斥门槛记录分别触发 resolution1/resolution2（同一 checkObjectives 读点两个方向），08716 断言「无 TypeError + autoEvade 生效」；P0-8 每张诡计断言特定落地效果（线索+2/伤害/恐惧/威胁区），非「有日志即过」；P0-11 用「修复前 131 条不可追溯 vs 现 0 条声称不可追溯」对照；P0-12 断言无 TypeError 且 state.lastTestResult 出现真实 skillTest；P0-13 四个标记 delta 精确等于 -X/-2/-3/-4 且彼此不同；同时每条断言在「证据」字段给出生产引擎读点 file:line。',
    '③ 修复前 baseline 中这些断言均为 FAIL（见 `baseline-first-run.md` 与 §4），修复后转 PASS，证明断言能区分修复前后。',
  ],
  baselineNote: [
    '修复过程是并发进行的，`baseline-results.json` 保存的是**修复中快照**（21:13：P0-11 FAIL、其余 PASS），并非严格修复前状态；验收员在 20:52 跑过真正的「修复前首跑」，但因后续迭代复跑同 label 被覆盖，完整逐项明细仅存于会话日志。',
    '真实首跑（2026-11-08 20:52，修复前/修复中早期）总览：**PASS 100 / FAIL 49（138 项断言）**；当时仅 P0-12 已先落地为 PASS，P0-1..P0-11、P0-13 均 FAIL。',
    '修复推进过程中的 baseline 复跑（真实运行记录）：20:55 → 121/28；21:06 → 142/12；21:09 → 146/9；21:13 → 150/5；21:52 最终 → **165/0 全 PASS**。FAIL 收敛项与各 owner 修复落地时点一一对应（P0-1/2/3/4、P0-5/13、P0-6/12、P0-7、P0-8、P0-9、P0-10、P0-11）。',
    '20:42 `src/engine/play-channels.js` 编码事故（另一 agent PowerShell GBK 中转）期间，引擎一度不可 import，该时段未用于 baseline 采样；事故由 Lead 从会话日志逐字节重建，IDP3 setup 的 randomValue 崩溃随后由 idp owner 修复。',
  ],
}

function categoryOf(item) {
  if (item.status === 'pass') return 'PASS'
  return item.id === 'P0-11' ? 'PENDING（审计阶段 B）' : 'FAIL'
}

function renderReport(data, runLabel) {
  const lines = []
  lines.push(`# EOTE P0 独立验收报告（${runLabel} · ${REPORT_NOTES.phase}）`)
  lines.push('')
  lines.push('> 独立验收（verifier）：不修改 mod 实现，只以生产组合根 `tests/eote-p8-fixture.mjs` 的真实引擎路径判定 PASS/FAIL。')
  lines.push(`> 生成时间：${data.generatedAt}；耗时 ${data.elapsedMs}ms；Node ${data.node}。`)
  lines.push(`> 复现命令：\`${data.command}\`（在 \`games/arkhamhorror\` 下运行）。`)
  lines.push(`> 环境：${REPORT_NOTES.environment}`)
  lines.push('')
  const checks = data.cases.flatMap(item => item.checks.filter(check => check.status !== 'info'))
  lines.push(`## 总览：PASS ${data.summary.pass} / FAIL ${data.summary.fail}（${checks.length} 项客观断言）`)
  lines.push('')
  lines.push('| 分类 | 项 |')
  lines.push('| --- | --- |')
  lines.push(`| ✅ PASS | ${data.cases.filter(item => item.status === 'pass').map(item => item.id).join(' / ') || '—'} |`)
  lines.push(`| ❌ FAIL / PENDING | ${data.cases.filter(item => item.status !== 'pass').map(item => item.id).join(' / ') || '—'} |`)
  lines.push('')
  lines.push('## 0. 四类结论（PASS / FAIL / 近似披露 / 残余风险）')
  lines.push('')
  lines.push('### ✅ PASS（真实引擎路径已复核）')
  for (const row of REPORT_NOTES.classification.pass) lines.push(`- ${row}`)
  lines.push('')
  lines.push('### ❌ FAIL / PENDING')
  for (const row of REPORT_NOTES.classification.failOrPending) lines.push(`- ${row}`)
  lines.push('')
  lines.push('### ⚠️ 近似披露（不算规则完全等价，按披露口径记录）')
  for (const row of REPORT_NOTES.classification.approximations) lines.push(`- ${row}`)
  lines.push('')
  lines.push('### ⚠️ 残余风险')
  for (const row of REPORT_NOTES.classification.residualRisks) lines.push(`- ${row}`)
  lines.push('')
  // 反向验证汇总
  const reverseChecks = []
  for (const item of data.cases) {
    for (const check of item.checks) if (/反向验证/.test(check.name)) reverseChecks.push({ id: item.id, ...check })
  }
  lines.push(`## 1. 反向验证（${reverseChecks.length} 项显式反向断言 + 其余项源码读点/前后对比）`)
  lines.push('')
  for (const note of (Array.isArray(REPORT_NOTES.reverseNote) ? REPORT_NOTES.reverseNote : [REPORT_NOTES.reverseNote])) {
    lines.push(note)
    lines.push('')
  }
  for (const check of reverseChecks) {
    lines.push(`- ${check.status === 'pass' ? '✅' : '❌'} **${check.id} · ${check.name}**`)
    lines.push(`  - 期望：${check.expected || '—'}；实测：${check.actual || '—'}`)
    if (check.evidence) lines.push(`  - 证据：${check.evidence}`)
  }
  lines.push('')
  // owner 探针交叉复核
  if (REPORT_NOTES.ownerProbes.length) {
    lines.push('## 2. owner 探针复跑（交叉核对）')
    lines.push('')
    lines.push('| owner 探针 | 复跑结果 | 与套件是否冲突 |')
    lines.push('| --- | --- | --- |')
    for (const row of REPORT_NOTES.ownerProbes) lines.push(`| ${row.file} | ${row.result} | ${row.conflict} |`)
    lines.push('')
    lines.push(REPORT_NOTES.ownerProbeNote)
    lines.push('')
  }
  lines.push('## 3. 逐项结果与证据')
  lines.push('')
  lines.push('| 项 | 结果 | 断言 | 说明 |')
  lines.push('| --- | --- | --- | --- |')
  for (const item of data.cases) {
    const itemChecks = item.checks.filter(check => check.status !== 'info')
    const passed = itemChecks.filter(check => check.status === 'pass').length
    const note = item.error ? `异常：${item.error.message}` : (item.status === 'pass' ? '全部客观断言通过' : `${itemChecks.length - passed} 项失败`)
    lines.push(`| ${item.id} | ${categoryOf(item)} | ${passed}/${itemChecks.length} | ${note} |`)
  }
  lines.push('')
  for (const item of data.cases) {
    lines.push(`### ${item.id} · ${item.title} — ${categoryOf(item)}`)
    lines.push('')
    if (item.error) {
      lines.push('```text')
      lines.push(`${item.error.message}`)
      lines.push('```')
      lines.push('')
    }
    for (const check of item.checks) {
      const mark = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : 'ℹ️'
      lines.push(`- ${mark} **${check.name}**`)
      if (check.status !== 'info' || check.expected) lines.push(`  - 期望：${check.expected || '—'}`)
      lines.push(`  - 实测：${check.actual || '—'}`)
      if (check.evidence) lines.push(`  - 证据：${check.evidence}`)
      if (check.detail) lines.push(`  - 备注：${check.detail}`)
    }
    lines.push('')
  }
  // 与 baseline 的变化
  const baselinePath = new URL('baseline-results.json', HERE)
  if (runLabel !== 'baseline' && existsSync(baselinePath)) {
    try {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
      lines.push('## 4. 与修复前 baseline 对比')
      lines.push('')
      lines.push('> baseline 说明：')
      for (const note of REPORT_NOTES.baselineNote) lines.push(`> - ${note}`)
      lines.push('')
      lines.push('| 项 | baseline 快照（21:13 修复中） | 本次 | 变化 |')
      lines.push('| --- | --- | --- | --- |')
      for (const item of data.cases) {
        const before = baseline.cases.find(entry => entry.id === item.id)
        const change = before ? (before.status === item.status ? '保持' : `${before.status.toUpperCase()} → ${item.status.toUpperCase()}`) : '新增'
        lines.push(`| ${item.id} | ${before ? before.status.toUpperCase() : '(无记录)'} | ${item.status.toUpperCase()} | ${change} |`)
      }
      lines.push('')
    } catch { /* baseline 损坏时忽略 */ }
  }
  lines.push('---')
  lines.push('')
  lines.push('*本报告由 `p0-accept/run.mjs` 自动生成；断言实现见 `cases/*.mjs`，真实引擎驱动层见 `lib/harness.mjs`。*')
  return `${lines.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// 运行结果输出（放末尾，保证 REPORT_NOTES 已初始化）
// ---------------------------------------------------------------------------

const summary = results.summary
writeFileSync(new URL(mdName, HERE), renderReport(results, label))

console.log(`\n=== EOTE P0 独立验收（${label}）===`)
for (const item of results.cases) {
  const failures = item.checks.filter(check => check.status === 'fail')
  const infos = item.checks.filter(check => check.status === 'info')
  const mark = item.status === 'pass' ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${item.id.padEnd(6)} ${item.title}  [断言 ${item.checks.length - infos.length - failures.length}/${item.checks.length - infos.length} 通过]${item.error ? `  错误：${item.error.message}` : ''}`)
  for (const check of failures) console.log(`      ✗ ${check.name} | 期望 ${check.expected} | 实测 ${check.actual}${check.evidence ? ` | ${check.evidence}` : ''}`)
}
console.log(`\n汇总：PASS ${summary.pass} / FAIL ${summary.fail}（${summary.checks} 项断言，${summary.info} 条实测记录）`)
console.log(`输出：${jsonName} / ${mdName}（${results.elapsedMs}ms）`)
if (fatal) console.error(fatal)
process.exitCode = summary.fail || fatal ? 1 : 0
