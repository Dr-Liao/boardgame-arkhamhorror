// 《食梦者》第 2 步「拆分原语」的声明式规格（P3 批次 1：双战役骨架）。
//
// 这里只是**计划**（人写的意图）：每个原语属于哪一步、落在哪、提供什么 API、由哪条测试与文档证明。
// 它不含「是否已完成」——状态由 `tools/audit-tde-primitives.mjs` 从代码读点、测试结果与文件哈希重新计算，
// 因此不会出现「规格里写 done、代码里没有」的坏账（路线图 §8.3 证据规则）。
//
// 依据：docs/tde-migration-roadmap.md §5（§5.1 高风险 7 项 / §5.2 其余候选 / §5.3 escape / §5.4 五件套 / §5.5 骨架），
// 机制来源：artifacts/migration/tde/mechanism-scan.json（P2）。
//
// 读点 `checks` 的 kind：
//   module-export   模块具名导出存在（并核对 typeof）
//   factory-keys    工厂函数返回对象上有该键（用 Proxy 依赖枚举，不执行方法）
//   scenario-runtime scenarioRuntime 的键（内容层唯一窄接口）
//   ctx-api         ctx.api 的键（能力描述子可用的窄接口）
//   window          windows.js 注册表里的窗口 id
//   modifier-target modifiers.js 的 MODIFIER_TARGETS / GRANT_TARGETS 成员
//   effect-primitive effects.js 的 EFFECT_PRIMITIVES 成员
//   ability-kind    ability.js 的 ABILITY_KINDS 成员
//   source-pattern  源码正则（只用于无法枚举的接线点，且必须给出原因）
//
// 批次 1 只覆盖 **双战役数据模型**（P3 骨架）；其余原语以 `DEFERRED_PRIMITIVES` 显式登记，
// 在 P3 批次 2/3 与 P5 落地，不允许用「看起来实现了」跳过。

const ENGINE = 'src/engine'
const CAMPAIGN = 'src/campaign'
const PARTS_FILE = `${CAMPAIGN}/campaign-parts.js`
const PARTS_TEST = 'tests/tde-campaign-parts.test.mjs'
const DOC = 'docs/tde-primitives.md'

export const CYCLE = Object.freeze({
  id: 'tde',
  name: 'The Dream Eaters',
  nameZh: '食梦者',
  campaignId: 'theDreamEaters',
})

export const DOC_PATH = DOC

// ---------------------------------------------------------------------------
// 批次 1：双战役数据模型（6 个原语）
// ---------------------------------------------------------------------------
export const PRIMITIVES = Object.freeze([
  {
    id: 'campaignPart',
    step: 'P3.1',
    title: '双 part 状态与切换',
    mechanism: ['campaignPart'],
    layer: 'campaign',
    params: {
      mode: "'singleA'|'singleB'|'pick'|'parallel'",
      seatParts: 'string[]',
      activeParts: 'string[]',
      currentPart: "'A'|'B'|null",
    },
    api: 'createPartsState({ mode, seatParts, activeParts, currentPart }) / setPart(state, part)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'createPartsState', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'setPart', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'validateModeSeats', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'MODES' },
      { kind: 'module-export', file: PARTS_FILE, name: 'PARTS' },
      { kind: 'module-export', file: PARTS_FILE, name: 'PART_SCOPED_FIELDS' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC, 'docs/tde-migration-roadmap.md'],
    tests: [PARTS_TEST],
    docs: `${DOC}#p31-双-part-状态与切换`,
    note: 'schema 仍为 7：parts 是可选字段，非 TDE 状态字节不变（schema 7→8 推迟到 P5，见路线图 R12 与 P3 报告）。',
  },
  {
    id: 'recordInPart',
    step: 'P3.2',
    title: '按线隔离的记录读写与勾销',
    mechanism: ['partRecord'],
    layer: 'campaign',
    params: {
      part: "'A'|'B'",
      key: 'string',
      value: 'boolean|number|string|string[]|null',
    },
    api: 'partRecord(campaign, part, key) / recordInPart(campaign, part, key, value) / crossOutInPart(campaign, part, key)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'partRecord', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'recordInPart', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'crossOutInPart', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'partScope', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'ensurePartSnapshot', type: 'function' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC],
    tests: [PARTS_TEST],
    docs: `${DOC}#p32-按线隔离的记录读写与勾销`,
    note: '记录是存在性语义（值假 = 未记录），与 campaign-effects 的读法一致；勾销 = 删除键并返回旧值。',
  },
  {
    id: 'seatPartMap',
    step: 'P3.3',
    title: '房间座位↔线内连续座位映射',
    mechanism: ['seatPartMap'],
    layer: 'campaign',
    params: {
      seatParts: 'string[]',
      roomSeat: 'number',
      lane: "'A'|'B'",
      laneSeat: 'number',
    },
    api: 'seatPartMap(seatParts) / laneSeatOf(seatParts, roomSeat) / roomSeatOf(seatParts, lane, laneSeat)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'seatPartMap', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'laneSeatOf', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'roomSeatOf', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'seatsOfLane', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'laneCounts', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'normalizeSeatParts', type: 'function' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC],
    tests: [PARTS_TEST],
    docs: `${DOC}#p33-房间座位线内连续座位映射`,
    note: '映射由 seatParts 确定性派生，不持久化第二份真相；越界线内座位返回 null，不做静默截断。',
  },
  {
    id: 'chaosBag.multiPart',
    step: 'P3.4',
    title: '两袋混乱袋',
    mechanism: ['multiPartChaosBag'],
    layer: 'campaign',
    params: { part: "'A'|'B'", bag: 'string[]' },
    api: 'partChaosBag(state, part) / mutateBothBags(state, mutate)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'partChaosBag', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'mutateBothBags', type: 'function' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC],
    tests: [PARTS_TEST],
    docs: `${DOC}#p34-两袋混乱袋`,
    note: '活动线读 campaign.chaosBag 并与 state.chaosBag 同步；非活动线落 parts 快照；逐章符号表属 P8。',
  },
  {
    id: 'inPart',
    step: 'P3.5',
    title: '数据作用域绑定（不换运行时）',
    mechanism: ['partRecord'],
    layer: 'campaign',
    params: { part: "'A'|'B'", fn: '(state) => value' },
    api: 'inPart(state, part, fn)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'inPart', type: 'function' },
      { kind: 'module-export', file: PARTS_FILE, name: 'defaultPartScope', type: 'function' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC],
    tests: [PARTS_TEST],
    docs: `${DOC}#p35-数据作用域绑定`,
    note: '只绑定 records/chaosBag 等逐线数据，不换 currentPart、不换 state.investigators（运行时重建属 P5 lane adapter）。',
  },
  {
    id: 'partFlowCondition',
    step: 'P3.6',
    title: 'Flow 的 part 条件',
    mechanism: ['campaignPart'],
    layer: 'campaign',
    params: { condition: "{ part, parts, mode, modeIn, activeParts }" },
    api: 'partFlowCondition(campaign, condition)',
    checks: [
      { kind: 'module-export', file: PARTS_FILE, name: 'partFlowCondition', type: 'function' },
    ],
    files: [PARTS_FILE, PARTS_TEST, DOC],
    tests: [PARTS_TEST],
    docs: `${DOC}#p36-flow-的-part-条件`,
    note: '未知条件键返回 false，由 P5 的 flow 加载期校验拒绝；本批不接 campaign-flow（P5 接线）。',
  },
  // ── 批次 2：高风险机制原语（2026-10-27）──────────────────────────────────
  {
    id: 'counter.investigator',
    step: 'P3-7',
    title: '按调查员的计数器',
    mechanism: ['alarmLevel'],
    layer: 'engine',
    params: { seat: 'number', id: 'string', delta: 'number=1', max: 'number|null' },
    api: 'counterOf / addCounter / setCounter / setCounterMax / highestCounter / counterAtLeast / counterSummary',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/counters.js`, name: 'counterOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/counters.js`, name: 'addCounter', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/counters.js`, name: 'setCounterMax', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/counters.js`, name: 'highestCounter', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/counters.js`, name: 'counterAtLeast', type: 'function' },
      { kind: 'scenario-runtime', name: 'counters' },
    ],
    files: [`${ENGINE}/counters.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-counters.test.mjs', DOC],
    tests: ['tests/tde-primitives-counters.test.mjs'],
    docs: `${DOC}#p37-按调查员的计数器`,
    note: '警报等级 0–5+（按调查员、非全桌）与赏金共用；只读函数不建字段。',
  },
  {
    id: 'enemy.swarmingValue',
    step: 'P3-8',
    title: 'Swarming X 求值',
    mechanism: ['swarming'],
    layer: 'engine',
    params: { text: 'string', numInvestigators: 'number', x: 'number|null' },
    api: 'swarmingSpec(text) / swarmingCount(spec, { numInvestigators, x }) / swarmingCountForText(state, text, options)',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/swarming.js`, name: 'swarmingSpec', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/swarming.js`, name: 'swarmingCount', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/swarming.js`, name: 'swarmingCountForText', type: 'function' },
      { kind: 'scenario-runtime', name: 'swarming' },
    ],
    files: [`${ENGINE}/swarming.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-swarming.test.mjs', DOC],
    tests: ['tests/tde-primitives-swarming.test.mjs'],
    docs: `${DOC}#p38-swarming-x-求值`,
    note: '四种 X 口径（固定 / [per_investigator] / 警报等级 / 剧本参考卡伤害数）；未知 X 拒绝静默按 0。',
  },
  {
    id: 'swarm.placeCards',
    step: 'P3-9',
    title: '蜂拥卡放置与击败判定',
    mechanism: ['swarming'],
    layer: 'engine',
    params: { host: 'enemy', count: 'number', draw: '() => code' },
    api: 'placeSwarmCards / swarmCardsOf / removeSwarmCard / clearSwarmCards / swarmCanBeDefeated / splitSwarmingDamage / swarmHostOf',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/swarm.js`, name: 'placeSwarmCards', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/swarm.js`, name: 'swarmCanBeDefeated', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/swarm.js`, name: 'splitSwarmingDamage', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/swarm.js`, name: 'swarmHostOf', type: 'function' },
      { kind: 'scenario-runtime', name: 'swarm' },
    ],
    files: [`${ENGINE}/swarm.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-swarm.test.mjs', DOC],
    tests: ['tests/tde-primitives-swarm.test.mjs'],
    docs: `${DOC}#p39-蜂拥卡放置与击败判定`,
    note: '蜂拥卡是独立实体（hostId 反查）；抽不够抛错；溢出伤害逐张扣蜂拥卡。真实实体生成与攻击接线属 P8。',
  },
  {
    id: 'location.veiled',
    step: 'P3-10',
    title: '掩藏地点',
    mechanism: ['veiled'],
    layer: 'engine',
    params: { location: 'location', deckKey: "'encounter'|'encounterDiscard'|'exploration'" },
    api: 'isVeiledLocation / veiledBlocksInvestigation / revealVeiledLocation / shuffleVeiledIntoDeck / normalizeVeiledScenario',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'isVeiledLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'veiledBlocksInvestigation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'revealVeiledLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'shuffleVeiledIntoDeck', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'normalizeVeiledScenario', type: 'function' },
      { kind: 'scenario-runtime', name: 'veiled' },
    ],
    files: [`${ENGINE}/veiled.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-veiled.test.mjs', DOC],
    tests: ['tests/tde-primitives-veiled.test.mjs'],
    docs: `${DOC}#p310-掩藏地点`,
    note: '「未揭示限制」「翻面出 b 面故事卡」「B3 洗回牌堆」三件事分开表达；调查动作接线属 P8。',
  },
  {
    id: 'tokenBag',
    step: 'P3-11',
    title: '蛛群滋生袋',
    mechanism: ['tokenBag'],
    layer: 'engine',
    params: { id: 'string', tokens: 'string[]' },
    api: 'createTokenBag / revealTokenFromBag / addTokenToBag / returnTokenToBag / tokenBagInfo / markInfested / infestedCount',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/token-bag.js`, name: 'createTokenBag', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/token-bag.js`, name: 'revealTokenFromBag', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/token-bag.js`, name: 'addTokenToBag', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/token-bag.js`, name: 'markInfested', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/token-bag.js`, name: 'isInfestedLocation', type: 'function' },
      { kind: 'scenario-runtime', name: 'tokenBag' },
    ],
    files: [`${ENGINE}/token-bag.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-token-bag.test.mjs', DOC],
    tests: ['tests/tde-primitives-token-bag.test.mjs'],
    docs: `${DOC}#p311-蛛群滋生袋`,
    note: '独立 token 袋（与混乱袋语义不同）；infestation test 与护工替换属 P8 章节脚本。',
  },
  {
    id: 'location.verticalChain',
    step: 'P3-12',
    title: '纵向地点链',
    mechanism: ['verticalChain'],
    layer: 'engine',
    params: { ids: 'string[]', delta: 'number' },
    api: 'linkVerticalChain / orderVerticalChain / chainNeighbors / moveAlongChain / normalizeVerticalChain',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/vertical-chain.js`, name: 'linkVerticalChain', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/vertical-chain.js`, name: 'orderVerticalChain', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/vertical-chain.js`, name: 'chainNeighbors', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/vertical-chain.js`, name: 'moveAlongChain', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/vertical-chain.js`, name: 'normalizeVerticalChain', type: 'function' },
      { kind: 'scenario-runtime', name: 'verticalChain' },
    ],
    files: [`${ENGINE}/vertical-chain.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-vertical-chain.test.mjs', DOC],
    tests: ['tests/tde-primitives-vertical-chain.test.mjs'],
    docs: `${DOC}#p312-纵向地点链`,
    note: '用 verticalIndex + 既有 connections 表达上下层，不新建循环专属布局；布局渲染属 P5。',
  },
])

// ---------------------------------------------------------------------------
// 批次 1/2 之后再落地的原语（显式登记，避免「漏了没人知道」）
// ---------------------------------------------------------------------------
export const DEFERRED_PRIMITIVES = Object.freeze([
  { id: 'location.placeBondedLocation', mechanism: 'dreamGate', cards: 4, batch: 'P3-3', note: '地点型 Bonded（06015a/b 梦境之门）' },
  { id: 'campaign.epilogueMatrix', mechanism: 'epilogueMatrix', cards: 0, batch: 'P3-3', note: 'A4×B4 16 段结局矩阵' },
  { id: 'deck.myriadLimit', mechanism: 'myriad', cards: 14, batch: 'P3-3', note: '构筑期同名至多 3 张' },
  { id: 'location.doom', mechanism: 'locationDoom', cards: 7, batch: 'P3-3', note: 'B4 地点毁灭与 agenda 阈值' },
  { id: 'scenario.markerCount', mechanism: 'signsOfTheGods', cards: 8, batch: 'P3-3', note: 'A2 神迹 / B3 剧本参考卡伤害数' },
])

// ---------------------------------------------------------------------------
// 复用（已存在于通用层）
// ---------------------------------------------------------------------------
export const REUSE = Object.freeze([
  {
    primitive: 'campaign.awardStoryCard',
    api: 'awardStoryCard(state, code, reason)',
    mechanisms: ['storyAssets'],
    checks: [
      { kind: 'module-export', file: `${CAMPAIGN}/campaign-effects.js`, name: 'awardStoryCard', type: 'function' },
    ],
  },
  {
    primitive: 'campaign.recordUnion',
    api: 'campaign.records[key] 的并集写入（content 侧 effect.records / recordUnion）',
    mechanisms: ['partRecord'],
    checks: [
      { kind: 'source-pattern', file: `${CAMPAIGN}/campaign-effects.js`, pattern: 'campaign\\.records\\[key\\]', why: '记录写入是 campaign-effects 的公共路径，不是可枚举注册表' },
    ],
  },
])

// ---------------------------------------------------------------------------
// escape（§5.3；单卡逻辑，必须在账本登记理由）
// ---------------------------------------------------------------------------
export const ESCAPE = Object.freeze([
  { card: '06164', title: '飘渺灵体', reason: '「无形」是全新状态位（不能交战/攻击/伤害），只服务 1 张卡；若 M2 出现同类再提升为通用条件。' },
  { card: '06329', title: '闪耀的偏方三八面体', reason: '费用替代管线的一次性特例（支付法术费用改为 willpower 检定）。' },
  { card: '06331', title: '梦境寄生物', reason: '负技能图标 + 手牌强制投入；若本轮决定做通用「负图标」原语则移出 escape。' },
])

// ---------------------------------------------------------------------------
// 机制覆盖（P2 账本的 type=primitive 机制 → 批次 1 的原语）
// ---------------------------------------------------------------------------
export const COVERAGE = Object.freeze([
  { mechanism: 'campaignPart', by: ['campaignPart', 'partFlowCondition'] },
  { mechanism: 'partRecord', by: ['recordInPart', 'inPart'] },
  { mechanism: 'seatPartMap', by: ['seatPartMap'] },
  { mechanism: 'multiPartChaosBag', by: ['chaosBag.multiPart'] },
  { mechanism: 'tokenBag', by: ['tokenBag'] },
  { mechanism: 'alarmLevel', by: ['counter.investigator'] },
  { mechanism: 'verticalChain', by: ['location.verticalChain'] },
  { mechanism: 'swarming', by: ['enemy.swarmingValue', 'swarm.placeCards'] },
  { mechanism: 'veiled', by: ['location.veiled'] },
  { mechanism: 'epilogueMatrix', by: [], deferredTo: 'P3-3', reason: 'A4×B4 16 段结局矩阵依赖 P8-T 自译正文。' },
  { mechanism: 'dreamGate', by: [], deferredTo: 'P3-3', reason: '地点型 Bonded 与门之匣联动，属 M1（Luke）批次。' },
])
