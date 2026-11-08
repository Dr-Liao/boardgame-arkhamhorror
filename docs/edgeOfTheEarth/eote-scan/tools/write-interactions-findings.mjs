import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const read = p => readFileSync(`${MODS}/${p}`, 'utf8')
const lead = JSON.parse(readFileSync(`${SCAN}/ledger/lead-analysis.json`, 'utf8'))
const flagsAudit = JSON.parse(readFileSync(`${SCAN}/screen/scenario-flags-write-read.json`, 'utf8'))
// EOTE 专属 label 统计（内联复算，避免依赖未保存脚本输出）
const cards = JSON.parse(readFileSync(`${SCAN}/scope/cards.json`, 'utf8')).cards
const cjk = /[\u4e00-\u9fff]/
let filesWithLabels = 0, labels = 0, cjkLabels = 0, prompts = 0, cjkPrompts = 0, infos = 0, cjkInfos = 0
for (const c of cards) {
  if (!c.entryPath || !existsSync(`${MODS}/${c.entryPath}`)) continue
  const src = read(c.entryPath).replace(/^\/\/.*$/gm, '')
  const L = [...src.matchAll(/label\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  const P = [...src.matchAll(/prompt\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  const I = [...src.matchAll(/api\.info(?:To)?\s*\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  if (L.length || P.length) filesWithLabels += 1
  labels += L.length; cjkLabels += L.filter(x => cjk.test(x)).length
  prompts += P.length; cjkPrompts += P.filter(x => cjk.test(x)).length
  infos += I.length; cjkInfos += I.filter(x => cjk.test(x)).length
}
const enLocale = ['en.core.js', 'en.gameui.js', 'en.hub.js', 'en.lore.js', 'en.misc.js', 'en.panels.js', 'en.table.js'].map(f => read(`web/locales/${f}`)).join('\n')
const findings = {
  area: 'interactions',
  auditor: 'lead',
  method: '静态链路核对（engine 事务 / integration 投影 / web 渲染 / locales）+ 浏览器账本与 spec 断言的证据存在性核验 + Node 交互测试阅读 + EOTE 动态文案语言统计 + 写后无读的 scenarioFlags 扫描',
  generatedAt: new Date().toISOString(),
  summary: {
    dynamicText: { filesWithLabelsAndPrompts: filesWithLabels, labels, cjkLabels, prompts, cjkPrompts, infos, cjkInfos },
    browserLedgers: Object.fromEntries(Object.entries(lead.browser).map(([k, v]) => [k, { status: v.status, screenshots: v.screenshotPaths, screenshotsExisting: v.screenshotPathsExisting }])),
    writeOnlyScenarioFlags: flagsAudit.unreadCount,
  },
  contractVerified: {
    choiceTransaction: '卡条目 api.choice 走服务端选择事务（src/engine/mechanic-choices.js / table-decisions.js / ability-exec.js），前端只提交 requestChoice；web/mechanic-ui.js 渲染选项 label/prompt（:85-113）。',
    actionLabels: '普通行动/反应候选由 legalMoves 生成，web/game-ui.js:1178、:1306、:2455 直接渲染 label/prompt，无可感知性缺口（但语言见 issues）。',
    privacy: 'src/integration/mechanic-view.js eoteView 明确：deckTop 只投给本人或 public；crossSeat 只给被授权者；tekeli 只投数量；keys 仅公开持有者；supplies 只投携带数量/掉落地点；src/integration/observation.js:44 PUBLIC_SCENARIO_FLAGS 白名单（depthLevel/pillars/deepDark）不泄漏其他 scenarioFlags。',
    guides: 'web/scenario-guides/*.json 含 chineseStatus/chineseGaps，中文缺口有结构化标记（已披露口径）。',
  },
  issues: [
    {
      severity: 'medium', dimension: 'perceivability',
      summary: 'EOTE 卡牌动态文案全部中文硬编码：491 个 label 中 488 个、192 个 prompt 全部、281 条 api.info 全部为中文；EN locale 无对应键，英文玩家在英文界面会看到中文行动标签/选择提示/日志。',
      evidence: `src/cards/entries/08001.js:30-46（label/prompt 中文字面量）；web/i18n.js:49-56（缺 key 回退 zh-CN）；web/game-ui.js:1178、1306、2455（直接渲染 label/prompt）；web/locales/en.*.js 无动态文案键（enLocale 覆盖 CJK label 数 = 0）`,
      suggestion: '在 i18n 层为动态 label/prompt 引入按条目 code+ability id 的英文字典（或条目提供 labelEn/promptEn），web 渲染时 t() 转换；至少在 EN locale 下用卡面英文文本替代动态文案。',
    },
    {
      severity: 'medium', dimension: 'perceivability',
      summary: '古者之城「石板+霜冻自动失败」原因只写入 state.scenarioFlags.lastAutoFailReason，但全仓无任何读取点：玩家看到自动失败却看不到原因（卡面规则要求解释）。',
      evidence: 'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:381、384（写 lastAutoFailReason）；src/**、web/**、content/** 无读取（grep lastAutoFailReason 仅此两处）；observation.js:44 allowlist 未含该键',
      suggestion: '把自动失败原因写入测试日志/牌桌提示（例如在 testAutoFail 时 api.info 或投影到 chaos 面板），或加入受控公开投影。',
    },
    {
      severity: 'low', dimension: 'perceivability',
      summary: 'frostRevealedThisTest 写后无读（死状态），若用于 UI 提示则未生效；否则建议删除。',
      evidence: 'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:387；全仓无读取点',
      suggestion: '删除死写或接到 frost 面板提示。',
    },
    {
      severity: 'low', dimension: 'perceivability',
      summary: '浏览器验收账本（6 份，passed；截图 200 张路径全部存在）覆盖的是 8 类机制面板 + 代表性卡牌/章节，并非全部 403 卡的可感知性逐卡验证；账本中未见「英文 locale 下动态文案语言」断言。',
      evidence: 'audit/eote-interactions-browser.json / eote-investigators-browser.json / eote-player-browser.json / eote-scenarios-browser.json / eote-release-browser.json / eote-browser-acceptance.json；tests/eote-*.browser.mjs 断言集中在真实 API/表格/选择存在性（如 eote-investigators.browser.mjs:107 横向溢出、eote-player.browser.mjs:65 pendingChoice）',
      suggestion: '补 EN locale 动态文案断言（至少 5 张代表性卡 + 1 章特殊规则），并把 D2 抽检纳入浏览器账本声明范围。',
    },
    {
      severity: 'low', dimension: 'perceivability',
      summary: '自动扫描出的 29 张「无 choice/info 的 ability」经人工核对为误报：这些是玩家主动行动，label 会出现在行动列表中（如 08002 扳手、08006 预示者、08120–08124 资源卡）；无需修复，但说明机械感知扫描需结合 UI 通路判定。',
      evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/perceivability.json；src/cards/entries/08002.js、08006.js、08120.js（label 均在 action 列表渲染路径）',
      suggestion: '无（记录为方法学结论）。',
    },
  ],
  browserCoverage: Object.fromEntries(Object.entries(lead.browser).map(([k, v]) => [k, {
    status: v.status, screenshots: v.screenshotPaths, screenshotsExisting: v.screenshotPathsExisting,
    specs: v.testSpecsMentioned, booleansTrue: v.booleansTrue, booleansFalse: v.booleansFalse,
  }])),
  writeOnlyScenarioFlags: flagsAudit.contentOnly,
}
writeFileSync(`${SCAN}/interactions/findings.json`, JSON.stringify(findings, null, 1))
const md = []
md.push('# EOTE D2 交互可感知性审计（Lead）')
md.push('')
md.push('## 结论')
md.push(`- 交互事务链路与隐私投影**实现完整**：choice/prompt 走服务端选择事务、UI 直接渲染；deckTop/crossSeat/tekeli/key/supplies 有明确逐观察者过滤（src/integration/mechanic-view.js eoteView）；scenarioFlags 走白名单（observation.js:44）。`)
md.push(`- 浏览器证据**真实存在**：6 份账本 passed、截图路径 ${Object.values(lead.browser).reduce((n, v) => n + v.screenshotPathsExisting, 0)} 张全部存在；spec 断言覆盖真实 API/牌桌/选择，不是纯“无报错”。`)
md.push(`- **主要缺口 1（medium）**：EOTE 动态文案（label 488/491、prompt 192/192、info 281/281 为中文）在 EN locale 无翻译回退；英文玩家会看到中文按钮/选择/日志。`)
md.push(`- **主要缺口 2（medium）**：古者之城 tablet+frost 自动失败原因 lastAutoFailReason 写后无读，玩家不可见自动失败原因。`)
md.push(`- 低：frostRevealedThisTest 死写；浏览器账本未覆盖 EN 动态文案与逐卡感知；机械 silent-ability 候选为误报。`)
md.push('')
md.push('## 证据')
md.push('')
md.push('| 项 | 值 |')
md.push('| --- | --- |')
md.push(`| EOTE 动态 label | ${labels}（中文 ${cjkLabels}） |`)
md.push(`| EOTE 动态 prompt | ${prompts}（中文 ${cjkPrompts}） |`)
md.push(`| EOTE api.info 日志 | ${infos}（中文 ${cjkInfos}） |`)
md.push(`| 浏览器账本 | 6 份 passed / 截图 ${Object.values(lead.browser).reduce((n, v) => n + v.screenshotPathsExisting, 0)} 张存在 |`)
md.push('')
md.push('## 复现')
md.push('')
md.push('```bash')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/eote-label-stats.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-analysis.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/scenario-flags-audit.mjs')
md.push('```')
writeFileSync(`${SCAN}/interactions/notes.md`, md.join('\n'))
console.log(JSON.stringify({ issues: findings.issues.length, labels, cjkLabels, prompts, cjkPrompts, infos, cjkInfos, writeOnlyFlags: findings.writeOnlyScenarioFlags.length }, null, 1))
