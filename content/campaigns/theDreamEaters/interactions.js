// 《食梦者》交互清单（P5 事实源）：路线图 §7.1 的 10 条交互逐条定稿。
//
// 口径：每条交互登记「谁触发、在哪些章节、用哪个机制 id、验收归哪一阶段、证据在哪」。
// 状态只有 `pending` 与 `verified`，由 P9/P10 的账本（`confirmations.interactions`）复算；
// 本文件在 P5 批次 1 只做**定稿与登记**，不写「已实现」——交互 UI 与章节接线分别在
// P5 批次 2（开局四选项 / 按线选人）与 P8（章节面板）落地。
//
// 与第 1 步机制扫描的关系：`ui:modeSelection` / `ui:laneDeckSelection` 是 P2 登记的两条
// interaction 机制；其余 8 条来自场景机制与战役结构（路线图 §7.1 表），这里按同一份清单
// 定稿，避免「边写卡边临时拼面板」。

export const TDE_INTERACTIONS = Object.freeze([
  {
    id: 'campaignOption',
    title: '选择玩法（单线 A / 单线 B / 并行双线 / 分选双线）',
    trigger: '序章（战役台面，进入任一章节之前）',
    scenarioIds: Object.freeze([]),
    mechanismIds: Object.freeze(['ui:modeSelection']),
    hook: 'hub',
    milestone: 'P5',
    status: 'pending',
    blockers: Object.freeze(['hub 模式选择与座位分线接线（P5 批次 2）']),
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
    status: 'pending',
    blockers: Object.freeze(['源清单保持 pending：真实 TDE 章节未注册；演示战役按线选人点击路径见 audit/tde-ui-browser.json']),
    notes: '按 campaign.seatParts 只走一次选人/选牌组；同一调查员不能同时出现在两线；缺牌组时阻塞开局并给原因。',
  },
  {
    id: 'swarmPanel',
    title: '蜂拥卡面板（数量 / 来源 / 溢出伤害）',
    trigger: '带 Swarming X 的敌人入场与受击时',
    scenarioIds: Object.freeze(['theSearchForKadath', 'darkSideOfTheMoon', 'pointOfNoReturn', 'whereTheGodsDwell']),
    mechanismIds: Object.freeze(['swarming']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['章节与卡牌接入（P8）', '面板样式与桌面/移动验收（P5/P9）']),
    notes: '引擎读点见 src/engine/swarming.js 与 swarm.js（P3 已交付）；这里只登记交互形态。',
  },
  {
    id: 'infestationBag',
    title: '蛛群滋生袋（揭示 / 放回 / 蛛巢标记）',
    trigger: '清醒噩梦的滋生检定与议程强制效果',
    scenarioIds: Object.freeze(['wakingNightmare']),
    mechanismIds: Object.freeze(['tokenBag']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['清醒噩梦章节接入（P8）']),
    notes: '独立 7 枚滋生袋（骷髅×1、石板×4、异教徒×2），不是混乱袋；引擎读点 src/engine/token-bag.js。',
  },
  {
    id: 'alarmLevel',
    title: '警报等级（0–5+ 的显示与增减）',
    trigger: '月之暗面的设置、遭遇卡与地点效果',
    scenarioIds: Object.freeze(['darkSideOfTheMoon']),
    mechanismIds: Object.freeze(['alarmLevel']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['月之暗面章节接入（P8）', '按座位计数显示（P9）']),
    notes: '用毁灭标记表示但不计入议程阈值；引擎读点 src/engine/counters.js（P3 已交付）。',
  },
  {
    id: 'hiddenHand',
    title: '隐藏手牌（隐私卡的座位私有投影与敌人形态入口）',
    trigger: '隐私遭遇卡加入手牌；奈亚拉托提普形态在手牌中',
    scenarioIds: Object.freeze(['beyondTheGatesOfSleep', 'theSearchForKadath', 'whereTheGodsDwell']),
    mechanismIds: Object.freeze(['hidden']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['隐私投影按座位过滤（P5/P8）', '敌人形态在手牌中的攻击/躲避入口（P8）']),
    notes: '核心隐私语义已交付（src/engine/hidden-rules.js）；本循环 18 张全部带险境。',
  },
  {
    id: 'veiledFlip',
    title: '掩藏地点翻面（无线索时 [fast] 翻面 + 背面故事卡）',
    trigger: '掩藏地点上的线索被清空后',
    scenarioIds: Object.freeze(['theSearchForKadath', 'pointOfNoReturn']),
    mechanismIds: Object.freeze(['veiled']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['翻面动作接入调查/移动流程（P8）', '故事卡阅读器（P8-T）']),
    notes: '官方 rules.veiled：地点以已揭示面入场、无线索时翻面、翻过一次不能再翻；引擎读点 src/engine/veiled.js（P4 已更正）。',
  },
  {
    id: 'markerProgress',
    title: '神迹 / 桥梁进度计数（参考卡旁显示）',
    trigger: '寻觅卡达斯的背面故事卡；无归之地的剧本参考卡伤害',
    scenarioIds: Object.freeze(['theSearchForKadath', 'pointOfNoReturn']),
    mechanismIds: Object.freeze(['signsOfTheGods']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['章节接入与显示（P8/P9）']),
    notes: '引擎读点 src/engine/marker-count.js（通用命名计数）；符号读数在剧本参考卡。',
  },
  {
    id: 'verticalStack',
    title: '纵向堆叠（神秘阶梯 / 大网）',
    trigger: '万千骇形的 183–188 阶梯；编织宇宙的大网',
    scenarioIds: Object.freeze(['aThousandShapesOfHorror', 'weaverOfTheCosmos']),
    mechanismIds: Object.freeze(['verticalChain']),
    hook: 'table',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['章节接入（P8）', '纵向布局复用既有位置变量（P5/P9）']),
    notes: '引擎读点 src/engine/vertical-chain.js；不新建循环专属布局目录。',
  },
  {
    id: 'dreamGateEpilogue',
    title: '梦境之门与 16 段结局矩阵',
    trigger: '门之匣/脱离现实入场；八章全部结束',
    scenarioIds: Object.freeze(['whereTheGodsDwell', 'weaverOfTheCosmos']),
    mechanismIds: Object.freeze(['dreamGate', 'epilogueMatrix']),
    hook: 'both',
    milestone: 'P8',
    status: 'pending',
    blockers: Object.freeze(['地点实体入场（P8）', '尾声正文与分支（P8-T）']),
    notes: '结局矩阵按 A4/B4 两条记录选 1/16，不得提前泄露未到达分支；引擎读点 src/campaign/epilogue-matrix.js。',
  },
])

export const TDE_INTERACTION_IDS = Object.freeze(TDE_INTERACTIONS.map(entry => entry.id))

export const tdeInteraction = id => TDE_INTERACTIONS.find(entry => entry.id === id) || null

/** 某条线/某章的交互（P8 章节验收按章取清单用）。 */
export const tdeInteractionsForScenario = scenarioId =>
  TDE_INTERACTIONS.filter(entry => entry.scenarioIds.includes(scenarioId))

/**
 * 注册期/审计校验：清单形状与「P2 两条 interaction 机制必须被覆盖」。
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
  }
  const mechanismIds = new Set(TDE_INTERACTIONS.flatMap(entry => entry.mechanismIds))
  for (const id of ['ui:modeSelection', 'ui:laneDeckSelection'])
    if (!mechanismIds.has(id)) problems.push(`P2 登记的交互机制没有被清单覆盖：${id}`)
  return { ok: problems.length === 0, problems }
}
