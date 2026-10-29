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
    params: { location: 'location', clues: 'number|null', deckKey: "'encounter'|'encounterDiscard'|'exploration'" },
    api: 'isVeiledLocation / veiledFlipBlockedReason / canFlipVeiledLocation / flipVeiledLocation / shuffleVeiledIntoDeck / normalizeVeiledScenario',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'isVeiledLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'veiledFlipBlockedReason', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'canFlipVeiledLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'flipVeiledLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'shuffleVeiledIntoDeck', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/veiled.js`, name: 'normalizeVeiledScenario', type: 'function' },
      { kind: 'scenario-runtime', name: 'veiled' },
    ],
    files: [`${ENGINE}/veiled.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-veiled.test.mjs', DOC],
    tests: ['tests/tde-primitives-veiled.test.mjs'],
    docs: `${DOC}#p310-掩藏地点`,
    note: '官方 rules.veiled：已揭示面入场、无线索时 [fast] 翻面、翻过一次不能再翻；「翻面出 b 面故事卡」与「B3 洗回牌堆」是两件事（P4 更正 P3 的「翻面前不可调查」口径）。',
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
  // ── 批次 3：其余候选（2026-10-28）────────────────────────────────────────
  {
    id: 'location.placeBondedLocation',
    step: 'P3.13',
    title: '地点型 Bonded（梦境之门）',
    mechanism: ['dreamGate'],
    layer: 'engine',
    params: { hostDef: 'locationDef', spawnLocation: '(def) => location' },
    api: 'bondedCodesOf / placeBondedLocation / bondedPartnerOf / removeBondedLocation / normalizeBondedLocations',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/bonded-location.js`, name: 'bondedCodesOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/bonded-location.js`, name: 'placeBondedLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/bonded-location.js`, name: 'bondedPartnerOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/bonded-location.js`, name: 'removeBondedLocation', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/bonded-location.js`, name: 'normalizeBondedLocations', type: 'function' },
      { kind: 'scenario-runtime', name: 'bondedLocation' },
    ],
    files: [`${ENGINE}/bonded-location.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-bonded-location.test.mjs', DOC],
    tests: ['tests/tde-primitives-bonded-location.test.mjs'],
    docs: `${DOC}#p313-地点型-bonded梦境之门`,
    note: '只负责成对放置/链接/成对移除；地点定义与实体构造由内容层注入（spawnLocation）。',
  },
  {
    id: 'campaign.epilogueMatrix',
    step: 'P3.14',
    title: '双线结局矩阵',
    mechanism: ['epilogueMatrix'],
    layer: 'campaign',
    params: { matrix: '{ a: [{id}], b: [{id}], entries: { "aId|bId": entry } }' },
    api: 'normalizeEpilogueMatrix / epilogueFor / flattenEpilogueMatrix / locateEpilogue',
    checks: [
      { kind: 'module-export', file: `${CAMPAIGN}/epilogue-matrix.js`, name: 'normalizeEpilogueMatrix', type: 'function' },
      { kind: 'module-export', file: `${CAMPAIGN}/epilogue-matrix.js`, name: 'epilogueFor', type: 'function' },
      { kind: 'module-export', file: `${CAMPAIGN}/epilogue-matrix.js`, name: 'flattenEpilogueMatrix', type: 'function' },
      { kind: 'module-export', file: `${CAMPAIGN}/epilogue-matrix.js`, name: 'locateEpilogue', type: 'function' },
    ],
    files: [`${CAMPAIGN}/epilogue-matrix.js`, 'tests/tde-primitives-epilogue-matrix.test.mjs', DOC],
    tests: ['tests/tde-primitives-epilogue-matrix.test.mjs'],
    docs: `${DOC}#p314-双线结局矩阵`,
    note: '4×4=16 段；完整性校验（缺格/多格点名）与查表分开；正文接线属 P8-T。',
  },
  {
    id: 'deck.myriadLimit',
    step: 'P3.15',
    title: '多重构筑限制',
    mechanism: ['myriad'],
    layer: 'engine',
    params: { deck: 'string[]', cardDefs: '(code) => def' },
    api: 'isMyriad / validateMyriadLimit / addCardRespectingMyriad / myriadUsage',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/myriad.js`, name: 'isMyriad', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/myriad.js`, name: 'validateMyriadLimit', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/myriad.js`, name: 'addCardRespectingMyriad', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/myriad.js`, name: 'myriadUsage', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/myriad.js`, name: 'MYRIAD_LIMIT' },
    ],
    files: [`${ENGINE}/myriad.js`, 'tests/tde-primitives-myriad.test.mjs', DOC],
    tests: ['tests/tde-primitives-myriad.test.mjs'],
    docs: `${DOC}#p315-多重构筑限制`,
    note: '按标题共享 3 张额度（跨卡号同名的 Myriad）；只拦 Myriad，普通同名上限属别的校验。',
  },
  {
    id: 'location.doom',
    step: 'P3.16',
    title: '地点上的毁灭',
    mechanism: ['locationDoom'],
    layer: 'engine',
    params: { location: 'location', delta: 'number', amount: 'number' },
    api: 'locationDoomOf / addLocationDoom / removeLocationDoom / totalLocationDoom / highestLocationDoom / normalizeLocationDoom',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'locationDoomOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'addLocationDoom', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'removeLocationDoom', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'totalLocationDoom', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'highestLocationDoom', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/location-doom.js`, name: 'normalizeLocationDoom', type: 'function' },
      { kind: 'scenario-runtime', name: 'locationDoom' },
    ],
    files: [`${ENGINE}/location-doom.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-location-doom.test.mjs', DOC],
    tests: ['tests/tde-primitives-location-doom.test.mjs'],
    docs: `${DOC}#p316-地点上的毁灭`,
    note: '地点上的毁灭是毁灭（计入议程阈值、被 B4 骷髅读取），06 段没有「毁灭地点」规则（P4 更正 P3 的阈值/移除口径）。',
  },
  {
    id: 'scenario.markerCount',
    step: 'P3.17',
    title: '剧本参考卡计数',
    mechanism: ['signsOfTheGods'],
    layer: 'engine',
    params: { id: 'string', delta: 'number' },
    api: 'markerCountOf / addMarker / setMarkerCount / referenceMarkerCount / resetMarkerCount / markerSummary',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/marker-count.js`, name: 'markerCountOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/marker-count.js`, name: 'addMarker', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/marker-count.js`, name: 'referenceMarkerCount', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/marker-count.js`, name: 'resetMarkerCount', type: 'function' },
      { kind: 'scenario-runtime', name: 'markers' },
    ],
    files: [`${ENGINE}/marker-count.js`, `${ENGINE}/scenario-runtime-extras.js`, `${ENGINE}/scenario-runtime.js`, 'tests/tde-primitives-marker-count.test.mjs', DOC],
    tests: ['tests/tde-primitives-marker-count.test.mjs'],
    docs: `${DOC}#p317-剧本参考卡计数`,
    note: '通用命名计数（默认 reference），A2 神迹与 B3 的参考卡 X 共用；只读不建字段。',
  },
  // ── P6：M1 调查员批次（2026-10-29）────────────────────────────────────────
  {
    id: 'assetDefeat',
    step: 'P6-1',
    title: '支援被击败的唯一判定点与 assetDefeated 窗口',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { owner: 'investigator', asset: 'asset', damage: 'number', horror: 'number' },
    api: 'isAssetDefeated / assetHarmCapacity / checkAssetDefeated（窗口 assetDefeated）',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/asset-defeat.js`, name: 'isAssetDefeated', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/asset-defeat.js`, name: 'assetHarmCapacity', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/asset-defeat.js`, name: 'checkAssetDefeated', type: 'function' },
      { kind: 'window', name: 'assetDefeated' },
    ],
    files: [`${ENGINE}/asset-defeat.js`, `${ENGINE}/enemies.js`, `${ENGINE}/windows.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p61-支援被击败的唯一判定点`,
    note: 'applyHarm 与「移动伤害」共用同一判定；窗口上下文带 damage/horror，`shuffledIntoDeck` 是「改为洗回牌库」的通用出口（托米·马尔登）。',
  },
  {
    id: 'harm.moveBetween',
    step: 'P6-2',
    title: '伤害/恐惧在调查员与支援之间移动',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { from: '{ seat, assetId? }', to: '{ seat, assetId? }', amounts: '{ damage, horror }' },
    api: 'harmOf / harmRoom / moveHarm（ctx.api.moveHarm / harmRoomOf）',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/harm-transfer.js`, name: 'harmRoom', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/harm-transfer.js`, name: 'moveHarm', type: 'function' },
      { kind: 'ctx-api', name: 'moveHarm' },
      { kind: 'ctx-api', name: 'harmRoomOf' },
    ],
    files: [`${ENGINE}/harm-transfer.js`, `${ENGINE}/api-misc.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p62-伤害恐惧移动`,
    note: '「移动」不是承受/治疗：不触发受到伤害窗口、不走 soaking；受目标容量限制，支援到上限后由 assetDefeat 判定。',
  },
  {
    id: 'counter.card',
    step: 'P6-3',
    title: '卡牌实例上的具名计数器（赏金）',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { card: 'asset|enemy', id: "'bounty'", amount: 'number', max: 'number|null' },
    api: 'cardCounterOf / addCardCounter / setCardCounter / moveCardCounters / totalCardCounters',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/card-counters.js`, name: 'cardCounterOf', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/card-counters.js`, name: 'addCardCounter', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/card-counters.js`, name: 'moveCardCounters', type: 'function' },
      { kind: 'ctx-api', name: 'addCardCounter' },
      { kind: 'ctx-api', name: 'moveCardCounters' },
    ],
    files: [`${ENGINE}/card-counters.js`, `${ENGINE}/api-misc.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p63-卡牌具名计数器`,
    note: '状态形状 `card.markers[counterId]`；未知 id 在注册期报错。敌人身上的赏金上限 = 敌人生命值，由调用方传入。',
  },
  {
    id: 'investigator.restrictedAction',
    step: 'P6-4',
    title: '受限额外行动（法术 / 赏金）',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { kind: "'spell'|'bounty'", perTurn: 'boolean' },
    api: 'grantRestrictedAction / actionsAvailable / consumeAction / clearRestrictedAction / restrictedActionRule',
    checks: [
      { kind: 'module-export', file: `${ENGINE}/restricted-actions.js`, name: 'grantRestrictedAction', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/restricted-actions.js`, name: 'actionsAvailable', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/restricted-actions.js`, name: 'consumeAction', type: 'function' },
      { kind: 'module-export', file: `${ENGINE}/restricted-actions.js`, name: 'restrictedActionRule', type: 'function' },
      { kind: 'source-pattern', file: `${ENGINE}/table-decisions.js`, pattern: 'restrictedKindOfMove', why: '「哪种行动可以花受限额度」的唯一判定点（交战/攻击带赏金的敌人）' },
    ],
    files: [`${ENGINE}/restricted-actions.js`, `${ENGINE}/spell-actions.js`, `${ENGINE}/turn.js`, `${ENGINE}/moves.js`, `${ENGINE}/dispatch.js`, `${ENGINE}/table-decisions.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p64-受限额外行动`,
    note: '第四循环的法术专用行动改成同一本账（`spellOnlyActions` 字段与函数名保留）；额度是「最后 N 个行动」，普通行动不能花。',
  },
  {
    id: 'search.modify',
    step: 'P6-5',
    title: '查找牌库前的能力窗口',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { zone: 'string', count: 'number', choose: 'number' },
    api: '窗口 searchWouldResolve（context.extraCards / context.extraTargets）',
    checks: [
      { kind: 'window', name: 'searchWouldResolve' },
      { kind: 'source-pattern', file: `${ENGINE}/deck-ops.js`, pattern: 'extraCards', why: '额外张数在 lookAt 适配器里生效（旧实现写死 3 张）' },
    ],
    files: [`${ENGINE}/deck-ops.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p65-查找牌库窗口`,
    note: '曼蒂·汤普森「额外查找 3 张或多结算 1 个目标」；顺带修掉 lookZoneAdapter 只看 3 张的写死上限。',
  },
  {
    id: 'search.cardInPile',
    step: 'P6-6',
    title: '被查找到的牌自身的规则',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { mode: "'reaction'|'forced'", take: 'boolean', discard: 'boolean', cancelSearch: 'boolean', drawEncounter: 'boolean', discoverClue: 'number' },
    api: '条目标 `searchedCardRule`（读点 deck-ops.js 的 searchedCardsWindow）',
    checks: [
      { kind: 'source-pattern', file: `${ENGINE}/deck-ops.js`, pattern: 'searchedCardRule', why: '牌还在牌库里，能力源枚举看不到它，只能读条目级声明' },
      { kind: 'source-pattern', file: `${ENGINE}/ability.js`, pattern: 'searchedCardRule', why: '条目字段注册与冻结' },
    ],
    files: [`${ENGINE}/deck-ops.js`, `${ENGINE}/ability.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p66-被查找到的牌`,
    note: '神秘证据（揭示抽走 + 发现线索）与惊人的发现（弃掉 + 取消查找 + 抽遭遇卡）。',
  },
  {
    id: 'upkeep.replaceDraw',
    step: 'P6-7',
    title: '补给阶段抽牌整段替换',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { discardNonWeakness: 'boolean', handSize: 'number' },
    api: 'investigatorRule(code).upkeepDraw',
    checks: [
      { kind: 'source-pattern', file: `${ENGINE}/phases.js`, pattern: 'upkeepDraw', why: '补给阶段抽牌段的唯一读点' },
    ],
    files: [`${ENGINE}/phases.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p67-补给阶段抽牌替换`,
    note: '派翠丝·海瑟薇「弃掉手牌中全部非弱点卡牌，抽到 5 张」；未声明该键的调查员行为不变。',
  },
  {
    id: 'investigator.cardRules',
    step: 'P6-8',
    title: '调查员卡面的常驻规则键',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { handSizeModifier: 'number', startsWith: 'code', shuffleDiscardAfterTest: '{ keep }' },
    api: 'investigator.handSizeModifier / investigator.startsWith / elderSign.shuffleDiscardAfterTest',
    checks: [
      { kind: 'source-pattern', file: `${ENGINE}/stats.js`, pattern: 'handSizeModifier', why: '手牌上限的唯一读点（派翠丝 -3）' },
      { kind: 'source-pattern', file: `${ENGINE}/setup.js`, pattern: 'startsWith', why: '开局自带支援（门之匣）的既有读点' },
      { kind: 'source-pattern', file: `${ENGINE}/tests.js`, pattern: 'shuffleDiscardAfterTest', why: '旧印「本次检定结束后」的读点（派翠丝旧印）' },
    ],
    files: [`${ENGINE}/stats.js`, `${ENGINE}/setup.js`, `${ENGINE}/tests.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p68-调查员卡面常驻规则`,
    note: '三个读点都已在既有引擎里；本批只补 handSizeModifier 与 shuffleDiscardAfterTest 两个声明键。',
  },
  {
    id: 'play.fromHandFree',
    step: 'P6-9',
    title: '从手牌免费打出另一张同名卡',
    mechanism: ['standardRules'],
    layer: 'engine',
    params: { seat: 'number', code: 'string', discount: 'number|null' },
    api: 'ctx.api.playCardFromHandFree(seat, code, { discount })',
    checks: [
      { kind: 'ctx-api', name: 'playCardFromHandFree' },
      { kind: 'source-pattern', file: `${ENGINE}/api-misc.js`, pattern: 'playCardFromHandFree', why: '免费打出走 doPlay 的 playDiscount 参数（正常入场与反应窗口）' },
    ],
    files: [`${ENGINE}/api-misc.js`, 'tests/tde-investigators.test.mjs', DOC],
    tests: ['tests/tde-investigators.test.mjs'],
    docs: `${DOC}#p69-从手牌免费打出`,
    note: '托尼的 .38「打出后免费从手牌打出另一张同名枪」；与正常支付/入场共用 doPlay。',
  },
])

// ---------------------------------------------------------------------------
// 延后原语（批次 1/2/3 已全部落地；P6 之后仍未落地的候选在此登记）
// ---------------------------------------------------------------------------
export const DEFERRED_PRIMITIVES = Object.freeze([
  {
    id: 'play.asIfAtLocation',
    step: 'P8',
    title: '事件如同位于连接地点打出（卢克·罗宾逊）',
    mechanism: ['standardRules'],
    reason: '需要「虚拟地点」原语：事件结算期间把 inv.location 覆盖为连接地点、并按该地点的敌人建立交战关系。'
      + '引擎里 inv.location 的读点遍布 combat/actions/encounter（没有单一读点），属 P8 章节接线；'
      + 'P6 把 06004 标为 simplified，未实现部分写入 docs/tde-investigators.md。',
  },
  {
    id: 'location.bondedDreamGate',
    step: 'P8',
    title: '梦境之门地点（06015a/b）的放置/翻面/连接',
    mechanism: ['dreamGate'],
    reason: 'P3 已有 `location.placeBondedLocation`，但真实地点实体的构造、「与每个已揭示地点连接」、'
      + '「除卢克外不能进入」与「调查阶段结束时放在一边」需要章节级的 locationRule 与阶段钩子（P8）。'
      + 'P6 只做 disengage 部分，06013/06014 标为 simplified。',
  },
  {
    id: 'enemy.hiddenInHand',
    step: 'P7',
    title: '手牌中的敌人（隐私敌人）',
    mechanism: ['hidden'],
    reason: '06017「秘密加入手牌 / 从手牌攻击躲避 / 牌库耗尽时攻击」需要敌人形态的隐私投影与从手牌建立战斗目标；'
      + 'P4 已将「敌人形态隐私」登记为待接线。P6 的 06017 标为 simplified（按普通弱点敌人生成）。',
  },
  {
    id: 'window.afterAlarmRaised',
    step: 'P8',
    title: '警报等级提升后的窗口',
    mechanism: ['alarmLevel'],
    reason: 'A3 的警报等级已由 `counter.investigator` 承担读数；「提升后」的窗口只在 A3 章节脚本里需要（P8）。',
  },
  {
    id: 'api.bonded.swap',
    step: 'P8',
    title: '绑定卡换面',
    mechanism: ['dreamGate'],
    reason: '06015a/b 的翻面与 06014 的「若已在场上则翻面」属地点型 Bonded（见上一条），随 P8 一起接线。',
  },
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
// 机制覆盖（P2 账本的 type=primitive 机制 → 三批落地的原语）
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
  { mechanism: 'epilogueMatrix', by: ['campaign.epilogueMatrix'] },
  { mechanism: 'dreamGate', by: ['location.placeBondedLocation'] },
])
