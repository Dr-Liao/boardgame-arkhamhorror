// 《沉没之城》（The Drowned City）· 战役流程图组装与 manifest 片段（P7）。
//
// 输入（均已按参考实现锁定，见各文件头）：
//   shared.js（战役身份/章节表/四档混乱袋/遭遇组）、records.js（§4 记录键）、
//   parts.js（场景单元、西/东路线、Sepulchre 门槛、Epilogue 分支、条件构造器）、
//   prologue.js（战役准备）、interludes.js（Interlude I–IV + Finale）、epilogue.js（多结局）。
// 输出：
//   · `TDC_FLOW`：可序列化的 `{ start, nodes }`，直接合入 `manifest.flow`；
//   · `campaignFlowExtras`：供 `manifest.js` 展开的片段（flow / 记录 schema / 路线 / 门槛 / 升级窗）；
//   · `validateTdcFlow(flow, opts)`：构建期自检（`validateCampaignGraph` 的注册期口径）。
//
// 流程形状（参考 `TheDrownedCity.hs#nextStep` 逐条镜像）：
//
//   prologue（PrologueStep：题词 + 附加规则 + 新关键词 + 序言）
//     → oneLastJob（ScenarioStep 11501）
//     → interludeOne（InterludeStep 1：逐人领任务）→ taskChoice → interludeOneDecision
//        ├ refuse → anOfferRefused → campaignLostEnd（gameOver，战役失败）
//        └ accept → anOfferAccepted → expeditionChoice（InterludeStep 2）
//             ├ west：记录 theExpeditionHeadedWest + Andy +（-1 tablet / +1 cultist）→ theWesternWall
//             └ east：记录 theExpeditionHeadedEast + Ruby → obsidianCanyons
//     → 西线：theWesternWall → theDrownedQuarter → theApiary → theGrandVault
//             → courtOfTheAncients → obsidianCanyons
//     → 东线：obsidianCanyons → courtOfTheAncients → theGrandVault → theApiary
//             → theDrownedQuarter → theWesternWall
//       每关结束 → expeditionPrep（整备停点/购牌窗）→ routeRouter（按路线 + 已完成关卡 + 结局跳章路由）
//       结局跳章：TheWesternWall 结局 3 → 选 theDrownedQuarter / theApiary；
//                 TheApiary 结局 4 → 选 theDrownedQuarter / theWesternWall。
//     → sepulchreGate（Sepulchre of the Sleeper 第一道门：≥1 文物且 ≥10 字形）
//        ├ 满足 → sepulchreGateStep2（第二道门：5 文物 + 26 字形 + 内殿解封）
//        │    ├ 满足 → sepulchreDecision（knowBetter / layItToRest）
//        │    │    ├ knowBetter：任务进度各 +1、记录 theInvestigatorsDidNotConfrontTheNightmare → theAwakening
//        │    │    └ layItToRest → sepulchreOfTheSleeper → sepulchreAftermath
//        │    │         ├ resolution1 → epilogue（战役胜利）
//        │    │         └ noResolution → campaignLostEnd（gameOver）
//        │    └ 不满足 → sepulchreAddZero（混乱袋加 0 标记）→ theAwakening
//        └ 不满足 → theAwakening（跳过剧本）
//     → theAwakening（InterludeStep 3：符号族混乱标记替换）
//     → theAwakeningConclusion → returnToArkhamBranch → returnToArkham*（InterludeStep 4：任务结算）
//     → nplhTraumaChoice（No Place Like Home 失败二选一创伤）→ finale（CampaignSpecificStep）
//     → theDoomOfArkhamPartI → theDoomOfArkhamPartII → doomAftermath
//        ├ noResolution → campaignLostEnd
//        └ 其余 → epilogue → epilogueRouter → epilogue1..4 / end
//
// 与参考实现的差异（P7 approximation，逐条在 worker 报告披露）：
//   1. 参考实现各章 `ScenarioResolution` 还会按结局把下一步指向「回退/绕行」的另一章
//      （如 TheGrandVault 结局 2 → TheApiary、CourtOfTheAncients 结局 2 → TheGrandVault、
//      ObsidianCanyons 结局 2 → CourtOfTheAncients）；本层按任务口径的西/东线性路线推进，
//      只逐条镜像两条明确跳章（WesternWall 结局 3 / Apiary 结局 4）。
//   2. TheWesternWall 结局 1 / noResolution（西线）在参考实现里也走同一个「跳章选择」；
//      本层把该选择绑定在结局 3（任务口径），其余结局按路线的下一关推进。
import { validateCampaignGraph } from '../../../src/campaign/campaign-flow.js'
import { preloadTdcStory } from './shared.js'
import {
  TDC_RECORD_DEFAULTS, TDC_RECORD_LABELS, TDC_RECORD_TYPES, TDC_RLYEH_ARTIFACT_RECORD_KEYS,
  TDC_RECORD_KEYS, TDC_GLYPH_GATE,
} from './records.js'
import {
  TDC_EAST_ROUTE, TDC_EPILOGUE_BRANCHES, TDC_EPILOGUE_STEP, TDC_END_STEP, TDC_EXPEDITION_PREP_STEP,
  TDC_EXPEDITION_SCENARIO_IDS, TDC_NO_UPGRADE_INTERLUDES, TDC_PROLOGUE_STEP, TDC_ROUTES, TDC_UPGRADE_INTERLUDES,
  TDC_WEST_ROUTE, allOf, allRlyehArtifacts, anyRlyehArtifact, atLeastGlyphs, completedScenario, hasRecord,
  headedEast, headedWest, localizeTdcNodes, notOf, resolvedAs, scenarioUnitOf,
} from './parts.js'
import { TDC_PROLOGUE_NODES, PROLOGUE_HANDLER_ID } from './prologue.js'
import { INTERLUDE_HANDLER_ID, interludeNodes } from './interludes.js'
import { EPILOGUE_HANDLER_ID, epilogueNodes } from './epilogue.js'
import { SCENARIO_IDS } from './shared.js'

export const TDC_FLOW_HANDLER_ID = INTERLUDE_HANDLER_ID

// ---------------------------------------------------------------------------
// 1. 记录 schema 投影（引擎口径）
// ---------------------------------------------------------------------------
export const TDC_FLOW_RECORD_SCHEMA = TDC_RECORD_TYPES
export const TDC_FLOW_RECORD_DEFAULTS = TDC_RECORD_DEFAULTS
export const TDC_FLOW_RECORD_LABELS = TDC_RECORD_LABELS

// ---------------------------------------------------------------------------
// 2. 效果/条件小工具
// ---------------------------------------------------------------------------
const registered = (handler, event, payload) => ({
  type: 'registered', handler, event, ...(payload ? { payload } : {}),
})
const recordEffect = (key, value) => ({ type: 'record', key, value })
const chaosEffect = (token, amount = 1) => ({ type: 'chaos', token, amount })

const clone = value => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)))

// 路线上的场景节点（打完统一回 `expeditionPrep` 整备停点，再由 `routeRouter` 决定下一关）。
function expeditionScenarioNodes () {
  const nodes = {}
  for (const scenarioId of TDC_EXPEDITION_SCENARIO_IDS) {
    const unit = scenarioUnitOf(scenarioId)
    nodes[scenarioId] = {
      type: 'scenario',
      scenarioId,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.code,
      kind: 'expedition',
      next: TDC_EXPEDITION_PREP_STEP,
    }
  }
  return nodes
}

// 不在路线环上的场景节点：开场 / 墓穴 / 终章上下。
function fixedScenarioNodes () {
  const make = (scenarioId, next, kind) => {
    const unit = scenarioUnitOf(scenarioId)
    return {
      type: 'scenario',
      scenarioId,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.code,
      kind,
      next,
    }
  }
  return {
    oneLastJob: make('oneLastJob', 'interludeOne', 'opening'),
    sepulchreOfTheSleeper: make('sepulchreOfTheSleeper', 'sepulchreAftermath', 'sepulchre'),
    theDoomOfArkhamPartI: make('theDoomOfArkhamPartI', 'theDoomOfArkhamPartII', 'doom1'),
    theDoomOfArkhamPartII: make('theDoomOfArkhamPartII', 'doomAftermath', 'doom2'),
  }
}

// ---------------------------------------------------------------------------
// 3. 路线路由（`stepReturn`）：按路线记录 + 已完成关卡 + 两条结局跳章选下一关
// ---------------------------------------------------------------------------
export const ROUTE_ROUTER_ID = 'routeRouter'

function shortcutRules () {
  return [
    {
      id: 'westernWallShortcut',
      when: allOf(
        headedWest(),
        resolvedAs('theWesternWall', 'resolution3'),
        notOf(completedScenario('theDrownedQuarter')),
        notOf(completedScenario('theApiary')),
      ),
      next: 'westernWallShortcut',
    },
    {
      id: 'apiaryShortcut',
      when: allOf(
        resolvedAs('theApiary', 'resolution4'),
        notOf(completedScenario('theDrownedQuarter')),
        notOf(completedScenario('theWesternWall')),
      ),
      next: 'apiaryShortcut',
    },
  ]
}

/** 有序规则链：先两条结局跳章，再按西/东路线的下一关，全部完成 → Sepulchre 门。 */
export const ROUTE_ROUTER_RULES = Object.freeze([
  ...shortcutRules(),
  ...TDC_WEST_ROUTE.map(scenarioId => ({
    id: `west:${scenarioId}`,
    when: allOf(headedWest(), notOf(completedScenario(scenarioId))),
    next: scenarioId,
  })),
  ...TDC_EAST_ROUTE.map(scenarioId => ({
    id: `east:${scenarioId}`,
    when: allOf(headedEast(), notOf(completedScenario(scenarioId))),
    next: scenarioId,
  })),
])

function routeRouterNode () {
  return {
    type: 'stepReturn',
    titleKey: 'expeditionToRlyeh.title',
    rules: clone(ROUTE_ROUTER_RULES),
    // 六条远征路线关卡都已完成 → Sepulchre of the Sleeper 的第一道门。
    next: 'sepulchreGate',
  }
}

// 两条结局跳章的选择节点（印刷文面在章节 locale 的 resolutions 下）。
function shortcutNodes () {
  return {
    westernWallShortcut: {
      type: 'choice',
      titleKey: 'theWesternWall::resolutions.resolution3.title',
      textKey: 'theWesternWall::resolutions.resolution3.body',
      options: [
        {
          id: 'drownedQuarter',
          label: '前往淹没城区（The Drowned Quarter）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'routeShortcut', { from: 'theWesternWall', to: 'theDrownedQuarter' })],
          next: 'theDrownedQuarter',
        },
        {
          id: 'apiary',
          label: '前往养育场（The Apiary）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'routeShortcut', { from: 'theWesternWall', to: 'theApiary' })],
          next: 'theApiary',
        },
      ],
    },
    apiaryShortcut: {
      type: 'choice',
      titleKey: 'theApiary::resolutions.resolution4.title',
      textKey: 'theApiary::resolutions.resolution4.body',
      options: [
        {
          id: 'drownedQuarter',
          label: '探索海床穹顶：前往淹没城区（The Drowned Quarter）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'routeShortcut', { from: 'theApiary', to: 'theDrownedQuarter' })],
          next: 'theDrownedQuarter',
        },
        {
          id: 'westernWall',
          label: '攀墙返回营地：前往西墙（The Western Wall）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'routeShortcut', { from: 'theApiary', to: 'theWesternWall' })],
          next: 'theWesternWall',
        },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// 4. Sepulchre of the Sleeper 门槛 / 决策 / 剧本回场
// ---------------------------------------------------------------------------
const sepulchreKey = path => `sepulchreOfTheSleeper::${path}`

const SEPULCHRE_GATE_ONE = allOf(anyRlyehArtifact(), atLeastGlyphs(TDC_GLYPH_GATE.basic))
const SEPULCHRE_GATE_TWO = allOf(
  allRlyehArtifacts(),
  atLeastGlyphs(TDC_GLYPH_GATE.full),
  hasRecord('theInnerSanctumWasUnsealed'),
)

function sepulchreNodes () {
  return {
    sepulchreGate: {
      type: 'interlude',
      upgrades: false,
      titleKey: sepulchreKey('intro.title'),
      textKeys: [sepulchreKey('intro.sepulchreOfTheSleeper1'), sepulchreKey('intro.checkCampaignLog')],
      next: 'sepulchreGateRouter',
    },
    sepulchreGateRouter: {
      type: 'stepReturn',
      titleKey: sepulchreKey('intro.title'),
      rules: [
        { id: 'prepared', when: SEPULCHRE_GATE_ONE, next: 'sepulchreGateStep2' },
        { id: 'unprepared', when: notOf(SEPULCHRE_GATE_ONE), next: 'theAwakening' },
      ],
      next: 'theAwakening',
    },
    sepulchreGateStep2: {
      type: 'interlude',
      upgrades: false,
      titleKey: sepulchreKey('intro.title'),
      textKeys: [sepulchreKey('intro.sepulchreOfTheSleeper2'), sepulchreKey('intro.checkCampaignLog')],
      next: 'sepulchreGateStep2Router',
    },
    sepulchreGateStep2Router: {
      type: 'stepReturn',
      titleKey: sepulchreKey('intro.title'),
      rules: [
        { id: 'fullyPrepared', when: SEPULCHRE_GATE_TWO, next: 'sepulchreDecision' },
        { id: 'addZeroToken', when: notOf(SEPULCHRE_GATE_TWO), next: 'sepulchreAddZero' },
      ],
      next: 'sepulchreAddZero',
    },
    // 「否则，给战役混乱袋永久加入 1 个 0 标记」——引擎已支持 `{type:'chaos', token:'0'}`。
    sepulchreAddZero: {
      type: 'interlude',
      upgrades: false,
      titleKey: sepulchreKey('intro.title'),
      textKeys: [sepulchreKey('intro.addZeroToken'), sepulchreKey('intro.proceedToTheAwakening')],
      effects: [
        chaosEffect('0', 1),
        registered(INTERLUDE_HANDLER_ID, 'addZeroToken'),
      ],
      next: 'theAwakening',
    },
    sepulchreDecision: {
      type: 'choice',
      titleKey: sepulchreKey('intro.title'),
      textKeys: [sepulchreKey('intro.sepulchreOfTheSleeper3'), sepulchreKey('intro.mustDecide')],
      options: [
        {
          id: 'knowBetter',
          label: '更清楚地知道（不直面梦魇）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'sepulchreKnowBetter')],
          next: 'theAwakening',
        },
        {
          id: 'layItToRest',
          label: '让它安息（进入《沉睡者墓穴》）',
          effects: [registered(INTERLUDE_HANDLER_ID, 'layItToRest')],
          next: 'sepulchreOfTheSleeper',
        },
      ],
    },
    sepulchreAftermath: {
      type: 'stepReturn',
      titleKey: sepulchreKey('resolutions.resolution1.title'),
      rules: [
        { id: 'haltedAwakening', when: resolvedAs('sepulchreOfTheSleeper', 'resolution1'), next: 'epilogue' },
        { id: 'campaignLost', when: resolvedAs('sepulchreOfTheSleeper', 'noResolution'), next: 'campaignLostEnd' },
      ],
      next: 'theAwakening',
    },
  }
}

// ---------------------------------------------------------------------------
// 5. 终章收口（Doom of Arkham Part II → 尾声 / 战役失败）
// ---------------------------------------------------------------------------
function doomNodes () {
  return {
    doomAftermath: {
      type: 'stepReturn',
      titleKey: 'finale.title',
      rules: [
        {
          id: 'campaignLost',
          when: resolvedAs('theDoomOfArkhamPartII', 'noResolution'),
          next: 'campaignLostEnd',
        },
        {
          id: 'epilogue',
          when: {
            any: ['resolution1', 'resolution2', 'resolution3']
              .map(value => resolvedAs('theDoomOfArkhamPartII', value)),
          },
          next: 'epilogue',
        },
      ],
      next: 'epilogue',
    },
  }
}

// ---------------------------------------------------------------------------
// 6. 节点表组装 + 正文绑定
// ---------------------------------------------------------------------------
/** 未经正文绑定的原始节点表（测试/审计可重复生成同一份数据）。 */
export function rawTdcFlowNodes () {
  return {
    ...clone(TDC_PROLOGUE_NODES),
    ...fixedScenarioNodes(),
    ...expeditionScenarioNodes(),
    ...clone(interludeNodes()),
    ...shortcutNodes(),
    ...sepulchreNodes(),
    ...doomNodes(),
    ...clone(epilogueNodes()),
    [ROUTE_ROUTER_ID]: routeRouterNode(),
    campaignLostEnd: { type: 'end', outcome: 'campaignLost' },
    [TDC_END_STEP]: { type: 'end', outcome: 'campaignComplete' },
  }
}

/** P7 交付的完整 flow：`{ start: 'prologue', nodes }`，可序列化纯数据（节点正文按需刷新）。 */
export const TDC_FLOW = Object.freeze({
  start: TDC_PROLOGUE_STEP,
  nodes: localizeTdcNodes(rawTdcFlowNodes()),
})

/** 流程图节点清单（构建顺序；供账本/测试断言节点集合稳定）。 */
export const TDC_FLOW_NODE_ORDER = Object.freeze(Object.keys(TDC_FLOW.nodes))

/** 叙事预载完成后刷新节点正文（幂等；story-text.js 未落盘时保持空文本）。 */
export function refreshTdcFlowText (flow = TDC_FLOW) {
  localizeTdcNodes(flow.nodes)
  return flow
}

// 模块加载后异步补齐正文（narrative-guides 的 story-text.js 可能晚于本文件落盘）。
void preloadTdcStory().then(() => refreshTdcFlowText())

// ---------------------------------------------------------------------------
// 7. manifest 片段
// ---------------------------------------------------------------------------
// 主线步骤顺序（叙事顺序；不是 manifest.scenarioIds 的 CampaignSteps 顺序）。
export const TDC_STEP_ORDER = Object.freeze([
  TDC_PROLOGUE_STEP,
  'oneLastJob',
  'interludeOne', 'taskChoice', 'interludeOneDecision',
  'anOfferAccepted', 'anOfferRefused',
  'expeditionChoice',
  ...TDC_EXPEDITION_SCENARIO_IDS,
  TDC_EXPEDITION_PREP_STEP,
  'sepulchreGate', 'sepulchreGateStep2', 'sepulchreAddZero', 'sepulchreDecision',
  'sepulchreOfTheSleeper',
  'theAwakening', 'theAwakeningConclusion',
  'returnToArkhamBranch', 'nplhTraumaChoice',
  'finale',
  'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII',
  TDC_EPILOGUE_STEP,
  TDC_END_STEP,
])

export const campaignFlowExtras = Object.freeze({
  // 引擎读点：`campaignGraph(manifest)` 直接返回 manifest.flow。
  flow: TDC_FLOW,
  // 记录 schema（引擎口径类型映射）、默认值、印刷/中文标签。
  recordSchema: TDC_RECORD_TYPES,
  recordDefaults: TDC_RECORD_DEFAULTS,
  recordLabels: TDC_RECORD_LABELS,
  recordKeys: TDC_RECORD_KEYS,
  // 场景步顺序（CampaignSteps.hs 顺序）与主线步骤顺序。
  scenarioOrder: SCENARIO_IDS,
  mainlineScenarioOrder: SCENARIO_IDS,
  stepOrder: TDC_STEP_ORDER,
  flowNodeOrder: TDC_FLOW_NODE_ORDER,
  skippableScenarioIds: Object.freeze([]),
  // 西/东远征路线（同一环的两个方向；由 routeRouter 按 headedWest/East 路由）。
  routeOrder: Object.freeze({ west: TDC_WEST_ROUTE, east: TDC_EAST_ROUTE }),
  routeRouterNodeId: ROUTE_ROUTER_ID,
  routeRouterRules: ROUTE_ROUTER_RULES,
  routeRecordKeys: Object.freeze({ west: 'theExpeditionHeadedWest', east: 'theExpeditionHeadedEast' }),
  // 整备停点（唯一开购牌窗的 interlude 节点；参考 campaignStepEdit_ 的 allowOptions）。
  expeditionPrepNodeId: TDC_EXPEDITION_PREP_STEP,
  upgradeWindows: Object.freeze({ interlude: true, checkpoint: false, scenario: false, map: false }),
  upgradeWindowNodes: Object.freeze([...TDC_UPGRADE_INTERLUDES, TDC_EXPEDITION_PREP_STEP]),
  noUpgradeWindows: TDC_NO_UPGRADE_INTERLUDES,
  // Sepulchre 门槛（DoStep 1/2）与 Interlude III 的符号替换表。
  sepulchreScenarios: Object.freeze(['sepulchreOfTheSleeper']),
  sepulchreGateNodeIds: Object.freeze({ gateOne: 'sepulchreGate', gateTwo: 'sepulchreGateStep2', decision: 'sepulchreDecision' }),
  sepulchreGateThresholds: Object.freeze({ artifacts: 1, glyphsBasic: TDC_GLYPH_GATE.basic, artifactsFull: TDC_RLYEH_ARTIFACT_RECORD_KEYS.length, glyphsFull: TDC_GLYPH_GATE.full }),
  // 多结局分支（EpilogueStep 的 Campaign Log 检查顺序）。
  epilogueStep: TDC_EPILOGUE_STEP,
  epilogueBranches: TDC_EPILOGUE_BRANCHES,
  // 战役层处理器 id（pack manifest behaviorIds 同源）。
  handlers: Object.freeze({
    prologue: PROLOGUE_HANDLER_ID,
    interlude: INTERLUDE_HANDLER_ID,
    epilogue: EPILOGUE_HANDLER_ID,
  }),
})

// ---------------------------------------------------------------------------
// 8. 构建期自检
// ---------------------------------------------------------------------------
/** 构建期自检：flow 必须通过战役图注册期校验（失败即抛，内容注册时 fail closed）。 */
export function validateTdcFlow (flow = TDC_FLOW, { scenarioIds = SCENARIO_IDS, recordSchema = TDC_RECORD_TYPES } = {}) {
  return validateCampaignGraph({ id: 'theDrownedCity', scenarioIds, recordSchema, flow })
}

validateTdcFlow()

// 反查表：节点 id → 所属战役步骤（账本/测试用；不参与引擎读点）。
export const TDC_STEP_OF_NODE = Object.freeze({
  ...Object.fromEntries(SCENARIO_IDS.map(id => [id, id])),
  [TDC_PROLOGUE_STEP]: TDC_PROLOGUE_STEP,
  [TDC_EPILOGUE_STEP]: TDC_EPILOGUE_STEP,
  [TDC_END_STEP]: TDC_END_STEP,
  [TDC_EXPEDITION_PREP_STEP]: TDC_EXPEDITION_PREP_STEP,
  [ROUTE_ROUTER_ID]: 'router',
  westernWallShortcut: 'expedition',
  apiaryShortcut: 'expedition',
  ...Object.fromEntries(['interludeOne', 'taskChoice', 'interludeOneDecision', 'anOfferAccepted', 'anOfferRefused']
    .map(id => [id, 'interludeOne'])),
  expeditionChoice: 'expeditionToRlyeh',
  ...Object.fromEntries(['theAwakening', 'theAwakeningBranch', 'theAwakeningArtifact', 'theAwakeningNoArtifact', 'theAwakeningConclusion']
    .map(id => [id, 'theAwakening'])),
  ...Object.fromEntries(['returnToArkhamBranch', 'returnToArkhamWithArtifact', 'returnToArkhamWithoutArtifact']
    .map(id => [id, 'returnToArkham'])),
  nplhTraumaChoice: 'returnToArkham',
  finale: 'finale',
  ...Object.fromEntries(['sepulchreGate', 'sepulchreGateRouter', 'sepulchreGateStep2', 'sepulchreGateStep2Router',
    'sepulchreAddZero', 'sepulchreDecision', 'sepulchreAftermath']
    .map(id => [id, 'sepulchreOfTheSleeper'])),
  doomAftermath: 'theDoomOfArkhamPartII',
  epilogueRouter: 'epilogue',
  ...Object.fromEntries(TDC_EPILOGUE_BRANCHES.map(branch => [branch.id, 'epilogue'])),
  campaignLostEnd: TDC_END_STEP,
})

export { recordEffect }
