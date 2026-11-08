// 生成可写入 mod 的精简审计账本（< 20KB）。
import { readFileSync, writeFileSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const j = JSON.parse(readFileSync(`${SCAN}/ledger/eote-full-scan.json`, 'utf8'))
const min = {
  schemaVersion: 1,
  cycle: 'eote',
  campaignId: 'edgeOfTheEarth',
  generatedAt: j.generatedAt,
  status: 'findings-recorded',
  scanner: j.scanner,
  method: '独立全量复核（cards-data 卡面 vs 单卡条目/章节 behavior/引擎读点/真实引擎路径探针/测试断言）+ 机械筛查 + 对抗式复核。本账本只记录结论与关键证据；完整逐卡逐子句数据与运行日志见工作区 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/（bundles/、screen/、各 area findings.json、verify/）。',
  scope: j.scope,
  headline: {
    verdict401: { match: j.issues.length ? undefined : undefined },
    verdicts: j.cards.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {}),
    issues: j.issueTotals,
    ledgerEvidenceDefects: j.ledgerValidity,
    deadContentHooks: j.deadHooks,
  },
  dimensionConclusions: {
    D1: '403 卡独立逐子句复核：match 90 / approximation 111 / gap 202；战役卡（266）是重灾区（8 章每章均有 high）。',
    D2: '选择/日志/隐私投影链路完整（deckTop/crossSeat/tekeli/key 逐观察者过滤；scenarioFlags 白名单）；缺口：动态 label/prompt/info 全中文硬编码（488/491、192/192、286/286），EN locale 无回退；古者之城自动失败原因 lastAutoFailReason 写后无读。',
    D3: '8 章无一一章能在真实引擎路径完整跑通：Ice&Death I/II/III 与 FatalMirage 的 act/agenda reveal 钩子缺失或钩子名不符（直接 throw 或空转）；Heart of Madness Part2 议程 08672 doomThreshold=0 提前清场；City of the Elder Things 钥匙无入口、幕1 目标不可达。P8 的 campaign/browser 验收通过是因为用 finishScenario/直调 behavior 绕过章节内真实游玩。',
    D4: '207 条声明（158 key + 49 调度值）在 src+content 无读点；49 条调度值属「声明了 handler 名但无实现」；引擎卡号字面量全部为注释/availability 表，无行为级分支；R1 直写 0（但工具漏检局部变量直写，如 08008）；primitive-plan.escape 为空但 201 条目含 resolve。',
    D5: '4 簇明显应复用未复用：08535–08543 九份克隆（谈判状态机，0.82–0.89）、08120–08124 五份克隆（资源支付模板 0.926）、08693/08694、08117/08119；三份地点表/连接表/chaos 数据漂移；重印 4 条（08004↔98007、08057↔60379、08058↔60384、08073↔12073）只实现一次，合规。',
  },
  p0: j.issues.filter(i => i.severity === 'high').slice(0, 24).map(i => ({ code: i.code, area: i.area, dimension: i.dimension, summary: i.summary, evidence: (i.evidence || '').slice(0, 200) })),
  p0Verified: [
    { id: 'hook-names-ice-death', summary: 'Ice&Death I/II/III behavior 导出 scenarioActions/performScenarioAction，引擎只调 actions/performAction → 营地撤退/翻底牌等剧本行动不在 legalMoves', evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart{1,2,3}/behavior.js:397-398/396-397/159-160; src/engine/moves.js:222; src/engine/dispatch.js:633', verifiedBy: 'Lead 运行 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_probe2.mjs：legalMoves 无 scenarioAction' },
    { id: 'reveal-hooks-missing', summary: 'Part1 agendaReveal 空函数、Part2/3 无 agendaReveal；三章无 actReveal；fatalMirage 均无 → 引擎 throw「密谋/场景规则尚未迁移」', evidence: 'iceAndDeathPart1/behavior.js:399; src/engine/phases.js:276-278; src/engine/reveal.js:151-176; fatalMirage/definition.js:146-147', verifiedBy: 'Lead 运行 probe：advanceAct THREW「场景规则尚未迁移：08521/08526/08546」; advanceAgenda THREW 08523' },
    { id: 'chaos-token-value-hook-mismatch', summary: 'Ice&Death 导出 chaosTokenValue，引擎读 resolveChaosToken → 三章符号标记修正值按 0 结算', evidence: 'iceAndDeathPart1/behavior.js:368-370,411; src/engine/treachery-tokens.js:349; 对照 toTheForbiddenPeaks/behavior.js:271', verifiedBy: 'campaign-a probe + Lead 代码核对' },
    { id: 'shroud-missing-locations', summary: '冰原 13 地点 shroud 未进入地点数据 → 调查难度 NaN 必失败；未探索地点入场费不收费', evidence: 'content/campaigns/edgeOfTheEarth/card-data.js:23-41; iceAndDeathPart1/definition.js:98-104; src/engine/actions.js:593; src/engine/movement.js:235-249', verifiedBy: 'Lead 运行 probe2：locations shroud=undefined' },
    { id: 'fatal-mirage-core-broken', summary: 'FatalMirage：议程推进即崩/越界、19 地点 clues=0、resolution 记录不闭环、Mirage 关键词缺失、28 关联面死数据 → 可选章节不可完成', evidence: 'fatalMirage/definition.js:66-69,146-147; behavior.js:69-74,276-296; src/engine/phases.js:276-278; src/engine/campaign-flow.js:241-243', verifiedBy: 'campaign-b（含 repro）+ Lead 复核 phases/definition/behavior/evidence' },
    { id: 'city-keys-deadlock', summary: '古者之城数值钥匙 claimKey/giveKeys 未进入 actions → 幕 1 目标不可达；议程 2 背面 R2 未实现', evidence: 'cityOfTheElderThings/behavior.js:180-201,256-293,415-417', verifiedBy: 'campaign-c + Lead 读码' },
    { id: 'heart2-agenda-doom', summary: '08672 无印刷 doom → doomThreshold=0，下一神话阶段立即推进清场，幕 3 失去高塔；R1/R2 记录无写入点 → 结局不可达；08716 成功躲避引用未定义 here → ReferenceError', evidence: 'theHeartOfMadnessPart2/definition.js:53; src/engine/act-agenda.js:435; behavior.js:275-276; expedition_team/08716.js:35', verifiedBy: 'campaign-d（探针复现 agendaIndex 1→2 / ReferenceError）' },
    { id: 'encounter-zero-resolution', summary: 'Peaks/City 8 张专属诡计 treacherous 定义缺 entryRevelation → 真实遭遇零结算；两章遭遇牌库仅 14/20 张本章卡（缺共享组）', evidence: 'toTheForbiddenPeaks/definition.js:110-117,133-139; cityOfTheElderThings/definition.js:121-127,130-137; src/engine/treachery-tokens.js:113-124', verifiedBy: 'campaign-c + Lead 复核 definition/engine' },
    { id: 'player-card-real-path-bugs', summary: '玩家卡真实路径 bug：破冰锥/保护魂灵窗口不出现、08130/31 威胁区治愈不可用、08091 子句缺失、08083 healAsset 参数错、08028/08074/08059 未接线/零实现、08053/08058 非法移动', evidence: '见 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a、player-b findings.json（file:line）', verifiedBy: 'player-a/player-b 真实引擎/探针 + Lead 抽查 08091/08083/08091 代码' },
    { id: 'investigator-bugs', summary: '调查员：08013a 多人局延迟翻面被他人检定吞掉、08006 只封抽牌不封检索、08005 投入牌库顶绕过 commit 规则、08004 牌库顶重 sync 缺口与换牌座位 bug', evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/findings.json + probes.mjs（P1–P8）', verifiedBy: 'inv-auditor（探针）' },
    { id: 'ledger-evidence-invalid', summary: 'P8 逐卡账本 135/403 记录无有效证据：129 条 scenario-ledger 全部指向 tests/eote-scenario-theHeartOfMadnessPart2.test.mjs（该文件不含对应卡号）；60/75 FatalMirage 证据同样无效；17 张 simplified 依赖不存在的 p7-08560/p7-08587 请求文件；eote-investigators.json sha 漂移导致 all-cards --check 真实失败', evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/ledger-validity.json、ledger-evidence-check.json；audit/eote-all-card-acceptance.json；audit/eote-investigators.json', verifiedBy: 'Lead 机械复算 + 复核原始账本' },
  ],
  gates: j.gates,
  priorLedgerConflicts: [
    'audit/eote-all-card-acceptance.json：status=verified 但 135/403 无有效证据（见上）。',
    'audit/eote-migration.json：releaseAcceptance.status=passed 但 FatalMirage/Ice&Death 真实引擎不可玩；P8 campaign/browser 验收用 finishScenario/直调 behavior 绕过章节内游玩。',
    `audit/eote-all-card-acceptance.json：sources.ledgers[1].sha256 与当前 audit/eote-investigators.json 不一致（all-cards --check 失败，tests/eote-all-cards.test.mjs:123）。`,
    'audit/eote-all-card-acceptance.json：simplified 卡的 pendingRequests p7-08560/p7-08587 在 artifacts/migration/eote/primitive-requests/ 不存在。',
    'audit/eote-player-acceptance.json：115 卡全 verified/noSimplified，但条目与审计发现多处 approximation/真实路径失效（见 player-a/player-b notes）。',
    '测试全绿不可作为章节可玩证据：章节测试以 api stub 直调 behavior.*，绕过引擎钩子/legalMoves/advanceAgenda；P8 campaign 用 finishScenario 跳过章节内游玩。',
    'tools/audit-card-entry-compliance.mjs 对局部变量直写有假阴性（08008.js:30 whip.exhausted=true 未被 R1 检出）。',
  ],
  limitations: j.limitations,
  evidenceIndex: {
    workspace: 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/',
    scope: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/cards.json（403 卡权威范围）、bundles/（逐卡审阅包）、chapter-bundles/（章节源码包）',
    mechanical: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/（integrity/keyword-coverage/flags-readpoints/duplication/tests-coverage/perceivability/scenario-integrity/known-deviations/primitive-compliance/ledger-validity/dead-hooks）',
    areas: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/{investigators,player-a,player-b,campaign/{a,b,c,d},scenarios,interactions,primitives}/findings.json',
    verifiers: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/（对抗复核，若存在）',
    full: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/ledger/eote-full-scan.json（全量总账本）、games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/全量扫描报告.md（本报告完整版）',
  },
  reproducibility: j.reproducibility,
}
writeFileSync(`${SCAN}/ledger/eote-full-scan-mod.json`, JSON.stringify(min, null, 1))
console.log('mod ledger bytes:', JSON.stringify(min).length)
