// 《食梦者》交互清单（P5 事实源；P9 转 verified）：路线图 §7.1 的 10 条交互逐条定稿。
//
// 口径：每条交互登记「谁触发、在哪些章节、用哪个机制 id、验收归哪一阶段、证据在哪」。
// 状态只有 `pending` 与 `verified`，由 P10 发布账本复算；`verified` 必须带 `evidence`
// （浏览器证据账本 + spec + 桌面/移动用例 + 截图），`pending` 必须带非空 `blockers`。
// `validateInteractionInventory` 同时守这两条，避免「只改状态不交证据」。
//
// P9（2026-11-01）：交互 1–2 沿用 P5 的演示战役浏览器证据（audit/tde-ui-browser.json），
// 交互 3–10 由 tests/tde-interactions.browser.mjs 在真实章节上验收（桌面 1440×950 /
// 移动 390×844，截图 artifacts/tde-migration/p9-interaction-<id>-<viewport>.png，
// 汇总进 audit/tde-browser-acceptance.json）。真实章节里自然产生 vs 显式 seed 的区分
// 写在每条 evidence.note 里；seed 只用于把真实引擎状态摆到面板会出现的条件，不伪造数据。
//
// 与第 1 步机制扫描的关系：`ui:modeSelection` / `ui:laneDeckSelection` 是 P2 登记的两条
// interaction 机制；其余 8 条来自场景机制与战役结构（路线图 §7.1 表），这里按同一份清单
// 定稿，避免「边写卡边临时拼面板」。

const browserEvidence = (ledger, spec, tests, screenshots, note) => Object.freeze({
  ledger, spec, tests: Object.freeze(tests), screenshots: Object.freeze(screenshots), note,
})
const p9Evidence = (id, note) => browserEvidence(
  'audit/tde-browser-acceptance.json',
  'tests/tde-interactions.browser.mjs',
  [
    `P9 交互 ${id.number} ${id.caseId}（${id.label}）在desktop端真实章节面板可读、可操作、可截图`,
    `P9 交互 ${id.number} ${id.caseId}（${id.label}）在mobile端真实章节面板可读、可操作、可截图`,
  ],
  [`artifacts/tde-migration/p9-interaction-${id.caseId}-desktop.png`,
    `artifacts/tde-migration/p9-interaction-${id.caseId}-mobile.png`],
  note,
)

export const TDE_INTERACTIONS = Object.freeze([
  {
    id: 'campaignOption',
    title: '选择玩法（单线 A / 单线 B / 并行双线 / 分选双线）',
    trigger: '序章（战役台面，进入任一章节之前）',
    scenarioIds: Object.freeze([]),
    mechanismIds: Object.freeze(['ui:modeSelection']),
    hook: 'hub',
    milestone: 'P5',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: browserEvidence(
      'audit/tde-ui-browser.json',
      'tests/tde-modes.browser.mjs',
      ['M5 食梦者开局模式面板与座位分线在desktop端可用', 'M5 食梦者开局模式面板与座位分线在mobile端可用'],
      ['artifacts/tde-migration/modes-desktop.png', 'artifacts/tde-migration/modes-mobile.png'],
      'P5 双线演示战役（ARKHAM_BROWSER_DEMO=dualHub）上的模式门/座位分线；真实食梦者章节启动属 P10。',
    ),
    notes: '奇数人数时「并行双线」置灰并给出「需要两组人数相等」的原因；1 人只保留两个单线选项（路线图 §1.4.1）。',
  },
  {
    id: 'laneSelection',
    title: '按线选人 / 选牌组（每座位一套）',
    trigger: '开局准备（每条线第一次进入前）',
    scenarioIds: Object.freeze([]),
    mechanismIds: Object.freeze(['ui:laneDeckSelection']),
    hook: 'hub',
    milestone: 'P5',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: browserEvidence(
      'audit/tde-ui-browser.json',
      'tests/tde-modes.browser.mjs',
      ['M5 并行按线选人与自动牌组在desktop端可用', 'M5 并行按线选人与自动牌组在mobile端可用'],
      ['artifacts/tde-migration/lane-deck-desktop.png', 'artifacts/tde-migration/lane-deck-mobile.png'],
      'P5 双线演示战役上的按线选人/自动构筑/本线牌组投影；真实食梦者章节启动属 P10。',
    ),
    notes: '按 campaign.seatParts 只走一次选人/选牌组；同一调查员不能同时出现在两线；缺牌组时阻塞开局并给原因。',
  },
  {
    id: 'swarmPanel',
    title: '蜂拥卡面板（数量 / 来源 / 溢出伤害）',
    trigger: '带 Swarming X 的敌人入场与受击时',
    scenarioIds: Object.freeze(['theSearchForKadath', 'darkSideOfTheMoon', 'pointOfNoReturn', 'whereTheGodsDwell']),
    mechanismIds: Object.freeze(['swarming']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 3, caseId: 'swarmPanel', label: '蜂拥' },
      'A2 开局的「一群乌尼斯」由真实引擎在 afterDeckSetup 自然放置 1 张蜂拥卡（无 seed）；断言头领名/张数与「清空前不能被击败」原因。',
    ),
    notes: '引擎读点见 src/engine/swarming.js 与 swarm.js（P3 已交付）；UI 只呈现引擎候选，不做规则判断。',
  },
  {
    id: 'infestationBag',
    title: '蛛群滋生袋（揭示 / 放回 / 蛛巢标记）',
    trigger: '清醒噩梦的滋生检定与议程强制效果',
    scenarioIds: Object.freeze(['wakingNightmare']),
    mechanismIds: Object.freeze(['tokenBag']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 4, caseId: 'infestationBag', label: '蛛群滋生袋' },
      'B1 开局的空滋生袋是自然状态（scenarios spec 另断言「袋是空的」）；张数/已揭示/蛛巢数用 token-bag 原语显式 seed（来源见 tests/tde-interactions.browser.mjs CASES[].seedSource）。',
    ),
    notes: '独立 7 枚滋生袋（骷髅×1、石板×4、异教徒×2），不是混乱袋；引擎读点 src/engine/token-bag.js。',
  },
  {
    id: 'alarmLevel',
    title: '警报等级（0–5+ 的显示与增减）',
    trigger: '月之暗面的设置、遭遇卡与地点效果',
    scenarioIds: Object.freeze(['darkSideOfTheMoon']),
    mechanismIds: Object.freeze(['alarmLevel']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 5, caseId: 'alarmLevel', label: '警报等级' },
      'A3 被俘开场自然给出座位 0 的警报 1/5；第二座位 3/5 用 counters 原语显式 seed（与章节写点同一原语）。',
    ),
    notes: '用毁灭标记表示但不计入议程阈值；引擎读点 src/engine/counters.js（P3 已交付）。',
  },
  {
    id: 'hiddenHand',
    title: '隐藏手牌（隐私卡的座位私有投影与敌人形态入口）',
    trigger: '隐私遭遇卡加入手牌；奈亚拉托提普形态在手牌中',
    scenarioIds: Object.freeze(['beyondTheGatesOfSleep', 'theSearchForKadath', 'whereTheGodsDwell']),
    mechanismIds: Object.freeze(['hidden']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 6, caseId: 'hiddenHand', label: '隐藏手牌' },
      'A4 真实状态 + 真实调查员 06005；显式 seed：placeHiddenCard 放专属弱点 06017 与 A4 隐藏形态 06306。断言 06017 有引擎派生攻击/躲避入口、06306 被章节规则关闭后不泄露按钮。',
    ),
    notes: '核心隐私语义已交付（src/engine/hidden-rules.js）；A4 五个形态的通用手牌攻击/躲避按参考实现关闭（故事 gap 已登记）。',
  },
  {
    id: 'veiledFlip',
    title: '掩藏地点翻面（无线索时 [fast] 翻面 + 背面故事卡）',
    trigger: '掩藏地点上的线索被清空后',
    scenarioIds: Object.freeze(['theSearchForKadath', 'pointOfNoReturn']),
    mechanismIds: Object.freeze(['veiled']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 7, caseId: 'veiledFlip', label: '掩藏地点翻面' },
      'B3 真实掩藏地点（辛之墓穴）；seed 只把所在地点 clues 置 0 以满足引擎翻面门槛。点击真实按钮 → /api/move flipVeiled → 面板出现背面故事卡号，另一掩藏地点显示不可用原因。',
    ),
    notes: '官方 rules.veiled：地点以已揭示面入场、无线索时翻面、翻过一次不能再翻；引擎读点 src/engine/veiled.js（P4 已更正，无洗回）。',
  },
  {
    id: 'markerProgress',
    title: '神迹 / 桥梁进度计数（参考卡旁显示）',
    trigger: '寻觅卡达斯的背面故事卡；无归之地的剧本参考卡伤害',
    scenarioIds: Object.freeze(['theSearchForKadath', 'pointOfNoReturn']),
    mechanismIds: Object.freeze(['signsOfTheGods']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 8, caseId: 'markerProgress', label: '参考计数' },
      'B3 桥梁进度在章节 behavior 里用 api.markers.add 写同一 state.markerCounts.reference；本条用 marker-count 原语显式 seed 3（同一写点）。',
    ),
    notes: '引擎读点 src/engine/marker-count.js（通用命名计数）；符号读数在剧本参考卡。',
  },
  {
    id: 'verticalStack',
    title: '纵向堆叠（神秘阶梯 / 大网）',
    trigger: '万千骇形的 183–188 阶梯；编织宇宙的大网',
    scenarioIds: Object.freeze(['aThousandShapesOfHorror', 'weaverOfTheCosmos']),
    mechanismIds: Object.freeze(['verticalChain']),
    hook: 'table',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 9, caseId: 'verticalStack', label: '纵向堆叠' },
      'B2 真实 6 张神秘阶梯 + linkVerticalChain（章节幕 1 背面同一原语；显式 seed 入场）；断言 6 个 li、data-vertical 0..5 有序。B4 大网是 layout 静态纵向坐标、没有 verticalChain 状态面板，其纵向布局证据在 scenarios spec 的 B4 实机截图。',
    ),
    notes: '引擎读点 src/engine/vertical-chain.js；不新建循环专属布局目录。',
  },
  {
    id: 'dreamGateEpilogue',
    title: '梦境之门与 16 段结局矩阵',
    trigger: '门之匣/脱离现实入场；八章全部结束',
    scenarioIds: Object.freeze(['whereTheGodsDwell', 'weaverOfTheCosmos']),
    mechanismIds: Object.freeze(['dreamGate', 'epilogueMatrix']),
    hook: 'both',
    milestone: 'P9',
    status: 'verified',
    blockers: Object.freeze([]),
    evidence: p9Evidence(
      { number: 10, caseId: 'dreamGateEpilogue', label: '梦境之门与结局' },
      '真实卡 06015a 梦境之门 + 真实 TDE 16 段矩阵；epilogueResolved 指向已到达格。断言只显示已到达格，其余 15 格标题/正文不出现在整页文本与投影里。',
    ),
    notes: '结局矩阵按 A4/B4 两条记录选 1/16，不得提前泄露未到达分支；引擎读点 src/campaign/epilogue-matrix.js。',
  },
])

export const TDE_INTERACTION_IDS = Object.freeze(TDE_INTERACTIONS.map(entry => entry.id))

export const tdeInteraction = id => TDE_INTERACTIONS.find(entry => entry.id === id) || null

/** 某条线/某章的交互（P8 章节验收按章取清单用）。 */
export const tdeInteractionsForScenario = scenarioId =>
  TDE_INTERACTIONS.filter(entry => entry.scenarioIds.includes(scenarioId))

/**
 * 注册期/审计校验：清单形状、「P2 两条 interaction 机制必须被覆盖」，
 * 以及「verified 必须有浏览器证据 / pending 必须写 blockers」。
 * 返回 `{ ok, problems }`，不抛错。
 */
export function validateInteractionInventory() {
  const problems = []
  if (TDE_INTERACTIONS.length !== 10) problems.push(`交互清单应为 10 条，实际 ${TDE_INTERACTIONS.length}`)
  const ids = new Set()
  for (const entry of TDE_INTERACTIONS) {
    if (ids.has(entry.id)) problems.push(`交互 id 重复：${entry.id}`)
    ids.add(entry.id)
    if (!entry.title || !entry.trigger) problems.push(`${entry.id} 缺少标题或触发时机`)
    if (!['hub', 'table', 'both'].includes(entry.hook)) problems.push(`${entry.id} 的 hook 非法：${entry.hook}`)
    if (!['P5', 'P8', 'P8-T', 'P9'].includes(entry.milestone)) problems.push(`${entry.id} 的 milestone 非法：${entry.milestone}`)
    if (!['pending', 'verified'].includes(entry.status)) problems.push(`${entry.id} 的 status 非法：${entry.status}`)
    if (!Array.isArray(entry.mechanismIds) || !entry.mechanismIds.length) problems.push(`${entry.id} 缺少机制 id`)
    if (!Array.isArray(entry.blockers)) problems.push(`${entry.id} 缺少 blockers（未完成原因必须显式）`)
    if (entry.status === 'pending' && !entry.blockers.length) problems.push(`${entry.id} 是 pending，必须写清未完成原因`)
    if (entry.status === 'verified') {
      const evidence = entry.evidence
      const valid = evidence
        && typeof evidence.ledger === 'string' && typeof evidence.spec === 'string'
        && Array.isArray(evidence.tests) && evidence.tests.length >= 2
        && Array.isArray(evidence.screenshots) && evidence.screenshots.length >= 2
      if (!valid) problems.push(`${entry.id} 标 verified 但没有可复算的浏览器证据（ledger/spec/tests/screenshots）`)
      if (entry.blockers.length) problems.push(`${entry.id} 已 verified，blockers 必须清空`)
    }
  }
  const mechanismIds = new Set(TDE_INTERACTIONS.flatMap(entry => entry.mechanismIds))
  for (const id of ['ui:modeSelection', 'ui:laneDeckSelection'])
    if (!mechanismIds.has(id)) problems.push(`P2 登记的交互机制没有被清单覆盖：${id}`)
  return { ok: problems.length === 0, problems }
}
