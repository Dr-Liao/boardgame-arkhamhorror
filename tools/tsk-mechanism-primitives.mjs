// 八循环《绯红密钥》（The Scarlet Keys）P1-A/B：引擎能力清单、原语目录与 §5 八个重点机制分类。
//
// 纯数据模块（无时间戳、无副作用），被 tools/scan-tsk-mechanisms.mjs 与 tests/tsk-migration.test.mjs 引用：
//   · ENGINE_INVENTORY：逐文件读取当前引擎后的真实能力（EFFECT_PRIMITIVES / ctx.api 各模块 / kind / 窗口 /
//     matcher / target / play channels / 关键词读点 / 可参考的既有模块），不是猜测；
//   · PRIMITIVE_CATALOG：本循环机制拆到最小原语的复用结论。kind='reuse' 只用于「现有引擎已经能表达、
//     不需要新状态或新读点」的能力；'extend' 表示已有邻近原语但要补字段/读点；'new' 表示没有等价能力。
//     无法用源码证据确认的条目必须 kind='new' + blocked=true + 理由，留给 P2 裁决；
//   · KEY_MECHANISMS：README §5 的 8 个重点机制，patterns 对 name+subname+text+backText+customization*
//     +traits 匹配得到代表卡，每项给出 reuse/extend/new 分类、缺口与 P4 交互缺口。
//
// 口径：docs/campaign/theScarletKeys/README.md §5、docs/arkham-content-migration.md §4.2 第 1 步。
// 本文件只登记「能力与缺口」，不写卡、不改引擎；P2 的原语计划从 primitiveGaps 出发。
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'
import { ABILITY_KINDS, ABILITY_SCOPES } from '../src/engine/ability.js'
import { windows } from '../src/engine/windows.js'
import * as matcherModule from '../src/engine/matcher.js'
import { TARGET_KINDS } from '../src/engine/targets.js'
import { PLAY_CHANNEL_ORDER } from '../src/engine/play-channels.js'
import { createCardApi } from '../src/engine/api-card.js'
import { createClueApi } from '../src/engine/api-clue.js'
import { createEnemyApi } from '../src/engine/api-enemy.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { createMiscApi } from '../src/engine/api-misc.js'
import { createTestApi } from '../src/engine/api-test.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { INVESTIGATOR_CODES, KEY_IDS, CUSTOMIZABLE_CODES } from '../content/campaigns/theScarletKeys/shared.js'

const WINDOW_IDS = windows().map(window => window.id).sort()
const MATCHER_NAMES = Object.keys(matcherModule).filter(name => typeof matcherModule[name] === 'function').sort()

// ctx.api 各模块的「顶点键」：用空状态 + 惰性 deps 调一次工厂函数，取真实返回对象的键。
// 这样清单随代码自动更新，不手抄会漂移的动词表（P2 盘点 ctx.api 时直接复用）。
const API_STUB_STATE = { investigators: [], locations: [], enemies: [], assets: [], encounterDeck: [], encounterDiscard: [] }
const API_STUB_DEPS = new Proxy({}, { get: () => () => ({}) })
function apiModule(module, exportName, factory) {
  try {
    const api = factory(structuredClone(API_STUB_STATE), [], API_STUB_DEPS)
    const verbs = Object.keys(api).sort()
    return Object.freeze({ module, exportName, topLevelCount: verbs.length, verbs: Object.freeze(verbs) })
  } catch (error) {
    return Object.freeze({ module, exportName, topLevelCount: 0, verbs: Object.freeze([]), error: String(error?.message || error).slice(0, 200) })
  }
}

// 关键词读点核对：supported 只能是 true / 'partial' / false；files 必须真实存在（门禁按文件存在性）。
// 证据来自逐文件检索（2026-11-10 P1），新增/回归时按实际代码复核后再改本表。
const keywordSupport = Object.freeze({
  hunter: Object.freeze({ supported: true, files: Object.freeze(['src/engine/card-lookup.js', 'src/engine/enemies.js', 'src/engine/movement.js']), evidence: 'card-lookup 敌人附加 hunter；enemies.js 敌人阶段按 hunter 移动' }),
  aloof: Object.freeze({ supported: true, files: Object.freeze(['src/engine/enemy-aloof.js', 'src/engine/card-lookup.js']), evidence: 'enemyIsAloof(state, enemy)；交战/攻击入口判定' }),
  massive: Object.freeze({ supported: true, files: Object.freeze(['src/engine/combat.js', 'src/engine/enemies.js']), evidence: 'combat/enemies 读取 enemy.massive（交战与躲避目标判定）' }),
  retaliate: Object.freeze({ supported: true, files: Object.freeze(['src/engine/combat.js', 'src/engine/combat-odds.js']), evidence: '攻击失败触发反击；ignore:retaliate 读点' }),
  alert: Object.freeze({ supported: true, files: Object.freeze(['src/engine/combat.js', 'src/engine/combat-odds.js']), evidence: '躲避失败触发警戒；ignore:alert 读点' }),
  surge: Object.freeze({ supported: true, files: Object.freeze(['src/engine/encounter.js']), evidence: '遭遇结算后按 surge 再抽一张（suppressSurge 读点）' }),
  peril: Object.freeze({ supported: true, files: Object.freeze(['src/engine/api-misc.js', 'src/engine/encounter.js']), evidence: 'encounter.js options.peril / perilOverride 进入揭示上下文' }),
  hidden: Object.freeze({ supported: true, files: Object.freeze(['src/engine/hidden-rules.js', 'src/engine/hidden-enemy.js']), evidence: 'hidden-rules.js#hiddenDefinition / hidden-enemy.js 手中隐藏敌人' }),
  revelation: Object.freeze({ supported: true, files: Object.freeze(['src/engine/encounter.js', 'src/engine/ability.js']), evidence: 'encounter.js 揭示结算链 + 条目 revelation 描述子' }),
  victory: Object.freeze({ supported: true, files: Object.freeze(['src/engine/actions.js', 'src/engine/api-enemy.js', 'src/engine/campaign-flow.js']), evidence: 'state.victoryDisplay 与 campaign-flow.js#state.victory 汇总' }),
  objective: Object.freeze({ supported: 'partial', files: Object.freeze(['src/engine/act-agenda.js', 'src/engine/ability.js']), evidence: '幕/议程目标与 objective 描述子读点；跨幕目标文本仍由章节定义承担' }),
  prey: Object.freeze({ supported: true, files: Object.freeze(['src/engine/card-lookup.js', 'src/engine/enemies.js']), evidence: 'card-lookup 附加 prey；enemies.js hunter 目标选择读取' }),
  spawn: Object.freeze({ supported: true, files: Object.freeze(['src/engine/actions-extra.js', 'src/engine/encounter.js']), evidence: 'spawnEnemyAt / 遭遇生成入口' }),
  parley: Object.freeze({ supported: true, files: Object.freeze(['src/engine/parley.js', 'src/engine/moves.js']), evidence: 'parley.js 谈判行动与目标选择' }),
  resign: Object.freeze({ supported: true, files: Object.freeze(['src/engine/api-misc.js', 'src/engine/moves.js']), evidence: 'api.resign / moves 撤退行动' }),
  fast: Object.freeze({ supported: true, files: Object.freeze(['src/engine/ability.js', 'src/engine/play-timing.js']), evidence: 'kind=free（快速）与 play-timing 时机判定' }),
  permanent: Object.freeze({ supported: true, files: Object.freeze(['src/engine/assets.js', 'src/engine/deck-ops.js']), evidence: 'permanent 卡不入牌库、开局在场' }),
  exceptional: Object.freeze({ supported: true, files: Object.freeze(['src/engine/deck-ops.js', 'src/engine/encounter.js']), evidence: '构筑牌数惩罚（exceptional）' }),
  elite: Object.freeze({ supported: true, files: Object.freeze(['src/engine/card-lookup.js', 'src/engine/ability-exec.js']), evidence: 'card-lookup 附加 elite；非精英限定效果过滤' }),
  bonded: Object.freeze({ supported: true, files: Object.freeze(['src/engine/bonded.js', 'src/engine/api-card.js']), evidence: 'bonded.js 绑定卡取出/回收' }),
  uses: Object.freeze({ supported: true, files: Object.freeze(['src/engine/uses.js', 'src/engine/ability.js']), evidence: 'uses.js 使用次数与补充' }),
  doom: Object.freeze({ supported: true, files: Object.freeze(['src/engine/api-clue.js', 'src/engine/act-agenda.js']), evidence: '毁灭放置与议程推进' }),
  patrol: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '引擎无 patrol 读点（2026-11-10 检索 0 命中）；敌人阶段移动只认 hunter' }),
  concealed: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '引擎无 concealed 读点；隐匿迷你卡/诱饵实体不存在' }),
  customizable: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '引擎无 customization 读点；只有卡表 customizationText 数据字段' }),
  shift: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '引擎无 Shift 关键字读点；双面密钥实体不存在（scenario-keys.js 只有彩色钥匙/数值钥匙）' }),
  hollow: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '引擎无 hollow 读点；空洞区/存在抹除不存在' }),
  stable: Object.freeze({ supported: false, files: Object.freeze([]), evidence: '稳定面/动荡面只是卡表 traits，无实体或翻面读点' }),
  otherworld: Object.freeze({ supported: false, files: Object.freeze([]), evidence: 'Otherworld 只是卡表 trait；异界牌库需 P2 新增（scenario-decks 可扩展）' }),
  coterie: Object.freeze({ supported: false, files: Object.freeze([]), evidence: 'Coterie 只是卡表 trait；同志会敌人池与遭遇注入无引擎支持' }),
})

// ---------------------------------------------------------------------------
// 1) ENGINE_INVENTORY：当前引擎能力事实（P1 快照）
// ---------------------------------------------------------------------------
export const ENGINE_INVENTORY = Object.freeze({
  rulesVersion: RULES_VERSION,
  stateSchemaVersion: STATE_SCHEMA_VERSION,
  effectPrimitives: Object.freeze({
    count: EFFECT_PRIMITIVES.length,
    list: Object.freeze([...EFFECT_PRIMITIVES]),
    readPoint: 'src/engine/effects.js#EFFECT_PRIMITIVES',
    note: 'EFFECTS 条目的 type 枚举；新增牌面效果先在这里登记，再由 ability-exec.js#resolveEffect 分派。',
  }),
  apiModules: Object.freeze([
    apiModule('src/engine/api-card.js', 'createCardApi', createCardApi),
    apiModule('src/engine/api-clue.js', 'createClueApi', createClueApi),
    apiModule('src/engine/api-enemy.js', 'createEnemyApi', createEnemyApi),
    apiModule('src/engine/api-mechanics.js', 'createMechanicsApi', createMechanicsApi),
    apiModule('src/engine/api-misc.js', 'createMiscApi', createMiscApi),
    apiModule('src/engine/api-test.js', 'createTestApi', createTestApi),
  ]),
  abilityKinds: Object.freeze([...ABILITY_KINDS]),
  abilityScopes: Object.freeze([...ABILITY_SCOPES]),
  windows: Object.freeze({ count: WINDOW_IDS.length, list: Object.freeze(WINDOW_IDS), readPoint: 'src/engine/windows.js#windows' }),
  matchers: Object.freeze({ count: MATCHER_NAMES.length, list: Object.freeze(MATCHER_NAMES), readPoint: 'src/engine/matcher.js' }),
  targets: Object.freeze({ kinds: Object.freeze([...TARGET_KINDS]), readPoint: 'src/engine/targets.js#TARGET_KINDS' }),
  playChannels: Object.freeze({
    channels: Object.freeze([...PLAY_CHANNEL_ORDER]),
    readPoint: 'src/engine/play-channels.js#PLAY_CHANNEL_ORDER',
    note: '「如同手牌」通道：hand 为基准，其余为跨区域通道（P2 自定义勾选面板/密钥卡面复用）。',
  }),
  keywordSupport,
  precedentModules: Object.freeze({
    'src/engine/map-graph.js': '通用图查询：shortestPaths(locations, from, to, canEnter)（世界地图最短路径/耗时计算可复用，P2 只补 0 代价绿地节点）',
    'src/engine/scenario-keys.js': '彩色钥匙/数值钥匙实体：holder（investigator/location/enemy/setAside/removed）、revealed、claim/transfer/spend（绯红密钥的持有/夺取/绑定的最近先例）',
    'src/engine/physical-faces.js': '在场实体换印刷面：planPhysicalFace/applyPhysicalFace/normalizedFace（双面密钥翻面可参考，但密钥不在场上，需扩展）',
    'src/engine/scenario-decks.js': '通用隐藏剧本牌库：initialize/take/put/peek/revealChooseDraw/discardTop（异界牌库 Otherworld deck 可扩展）',
    'src/engine/zones.js': '区域目标表：hand/deckTop/discard/play/threat/attached/beneath/setAside/removedFromGame/victoryDisplay（空洞「置于一边/移出游戏」复用）',
    'src/engine/marker-count.js': '剧本参考卡命名计数 state.markerCounts（时间/空洞计数的最近先例，P2 评估复用或专用状态）',
    'src/engine/card-counters.js': '卡实例命名计数器 card.markers（目前只允许 bounty；Darrell 证据标记需扩展 counter id）',
    'src/engine/hidden-rules.js': '隐藏信息定义与投影读点（隐匿迷你卡/未解锁密档的隐私投影可扩展）',
    'src/engine/veiled.js': 'Veiled 地点翻面与「读故事」流程（阴影地点/揭露后翻面场景的最近先例）',
    'src/engine/campaign-flow.js': '战役流程执行器：节点类型 scenario/story/choice/branch/interlude/checkpoint/end',
    'src/campaign/campaign-flow.js': '战役图：validateCampaignGraph/walkCampaign/flowCondition（世界地图航线的流程图可复用）',
    'src/campaign/campaign-effects.js': '战役效果层：recordCount / recordSet / campaignWeakness 等（时间计数与同志会池可复用）',
    'src/campaign/campaign.js': '战役结局匹配 manifest.endings（尾声 trust/deception 分支可复用）',
    'src/engine/parley.js': '谈判行动与目标选择（Dancing Mad 谈判/敌对切换复用）',
    'src/engine/enemy-zones.js': '敌人分区/宿主关系（同志会敌人与密钥绑定敌人可参考）',
  }),
})

// ---------------------------------------------------------------------------
// 2) PRIMITIVE_CATALOG：本循环机制到最小原语的复用结论
// 每个条目：kind ∈ reuse | extend | new；modules / names 是读点或候选实现位置；
// blocked=true 表示规则边界未确认，P1 不放行、P2 前必须裁决。
// ---------------------------------------------------------------------------
const primitive = (kind, modules, names, note, extra = {}) => Object.freeze({
  kind, modules: Object.freeze(modules), names: Object.freeze(names), note, ...extra,
})

export const PRIMITIVE_CATALOG = Object.freeze({
  // ── 现有引擎能力（reuse）：机制只复用，不需要新状态或新读点 ─────────────────────────
  'core.effects': primitive('reuse', ['src/engine/effects.js', 'src/engine/ability-exec.js'], ['EFFECT_PRIMITIVES', 'resolveEffect'], '效果 DSL 与原语注册表'),
  'core.test': primitive('reuse', ['src/engine/tests.js', 'src/engine/combat.js'], ['startTest', 'skillTest'], '技能检定与难度/成功失败结算'),
  'core.actions': primitive('reuse', ['src/engine/moves.js', 'src/engine/actions.js'], ['gainAction', 'grantExtraActionNextTurn'], '行动类型、额外行动与快速时机'),
  'core.uses': primitive('reuse', ['src/engine/uses.js', 'src/engine/ability.js'], ['addUses', 'spendUses'], '支援使用次数（充能/秘密/弹药/物资）'),
  'core.tokens': primitive('reuse', ['src/engine/chaos-bag.js', 'src/engine/chaos-token-effects.js'], ['addChaosToken', 'removeChaosToken', 'setSymbolEffect'], '混乱标记揭示、增删与符号效果（状况报告追 cultist 复用）'),
  'core.modifiers': primitive('reuse', ['src/engine/modifiers.js', 'src/engine/ability.js'], ['modifiers', 'addTestValue'], '持续修正与检定加值'),
  'core.damageHorror': primitive('reuse', ['src/engine/api-misc.js', 'src/engine/harm-threat.js'], ['damage', 'horror', 'healDamage', 'healHorror'], '伤害/恐惧/治疗'),
  'core.clues': primitive('reuse', ['src/engine/api-clue.js', 'src/engine/locations.js'], ['discoverClue', 'placeClues', 'moveClueToEnemy'], '线索发现/移动/放置'),
  'core.deck': primitive('reuse', ['src/engine/deck-ops.js', 'src/engine/assets.js'], ['drawCards', 'discardFromHand', 'shuffleDeck'], '抽牌/弃牌/洗牌/牌库操作'),
  'core.enemy': primitive('reuse', ['src/engine/enemies.js', 'src/engine/combat.js'], ['spawnEnemyAt', 'moveEnemy', 'enemyFight'], '敌人生成/移动/交战/攻击'),
  'core.encounter': primitive('reuse', ['src/engine/encounter.js'], ['drawEncounter', 'resolveEncounter'], '遭遇牌库与遭遇结算（surge/peril/revelation 读点）'),
  'core.victory': primitive('reuse', ['src/engine/actions.js', 'src/engine/api-enemy.js'], ['state.victoryDisplay', 'addToVictory'], '胜利展示区与胜利点'),
  'core.windows': primitive('reuse', ['src/engine/windows.js'], ['registerWindow', 'checkedWindow'], '时机窗口注册与触发（exposed 窗口可注册）'),
  'core.choices': primitive('reuse', ['src/engine/resolution.js', 'src/engine/table-decisions.js'], ['requestChoice', 'legalMoves'], '玩家选择/合法动作投影'),
  'core.records': primitive('reuse', ['src/campaign/record-sets.js', 'src/campaign/campaign-effects.js'], ['recordSet', 'recordCount'], '战役记录/记录集合（同志会池、抹除名单、trust/deception 计数）'),
  'core.recordCount': primitive('reuse', ['src/campaign/campaign-effects.js'], ['recordCount'], '战役记录计数（时间 Time 计数器复用）'),
  'core.campaignFlow': primitive('reuse', ['src/campaign/campaign-flow.js', 'src/engine/campaign-flow.js'], ['walkCampaign', 'progressCampaign'], '战役流程节点执行器（世界地图启程循环扩展点）'),
  'core.scenarioDecks': primitive('reuse', ['src/engine/scenario-decks.js'], ['initializeScenarioDeck', 'take', 'peek', 'revealChooseDraw'], '通用隐藏牌库（异界牌库复用）'),
  'core.hiddenInfo': primitive('reuse', ['src/engine/hidden-rules.js', 'src/engine/hidden-enemy.js'], ['hiddenDefinition', 'hiddenRule'], '隐藏信息定义与手牌隐藏实体'),
  'core.physicalFaces': primitive('reuse', ['src/engine/physical-faces.js'], ['planPhysicalFace', 'applyPhysicalFace', 'normalizedFace'], '印刷面切换记录（双面密钥/双面敌人参考）'),
  'core.zones': primitive('reuse', ['src/engine/zones.js'], ['CARD_DESTINATIONS', 'moveCardTo'], '卡牌去向（setAside/removedFromGame/victoryDisplay）'),
  'core.markerCount': primitive('reuse', ['src/engine/marker-count.js'], ['markerCountOf', 'setMarkerCount', 'addMarker'], '命名计数（时间/空洞等可评估复用）'),
  'core.playChannels': primitive('reuse', ['src/engine/play-channels.js'], ['PLAY_CHANNEL_ORDER'], '「如同手牌」跨区域通道'),
  'core.mapGraph': primitive('reuse', ['src/engine/map-graph.js'], ['shortestPaths'], '通用最短路径（世界地图 36 节点距离）'),
  'core.parley': primitive('reuse', ['src/engine/parley.js'], ['parleyAction'], '谈判行动（Dancing Mad 谈判模式复用）'),
  'core.bonded': primitive('reuse', ['src/engine/bonded.js'], ['bonded'], '绑定卡进出场（剧情资产参考）'),
  'core.investigatorAbility': primitive('reuse', ['src/engine/ability.js', 'src/engine/actions-extra.js'], ['ABILITY_KINDS', 'elderSign'], '调查员能力/旧印/额外行动授权基础设施'),
  'core.assetSlots': primitive('reuse', ['src/engine/assets.js'], ['slotCapacity', 'canEquip'], '支援槽位与装备校验（查理·凯恩盟友槽可评估扩展）'),

  // ── 扩展现有邻近原语（extend）────────────────────────────────────────────────────
  'extend.cardCounters': primitive('extend', ['src/engine/card-counters.js'], ['CARD_COUNTER_IDS', 'addCardCounter'], '卡实例计数器目前只允许 bounty；证据(evidence)/空洞(hollow)需要新 counter id 与读写点'),
  'extend.campaignFlow': primitive('extend', ['src/engine/campaign-flow.js', 'src/campaign/campaign-flow.js'], ['walkCampaign', 'progressCampaign'], '世界地图启程循环/旅行/时间消耗不是线性战役图能表达的，需要在流程执行器补「地图步骤 + travel 窗口」'),
  'extend.hiddenInfo': primitive('extend', ['src/engine/hidden-rules.js', 'src/integration/observation.js'], ['hiddenDefinition'], '隐匿迷你卡/未解锁密档需要按地点与座位投影（真身/诱饵身份不可泄露），现有 hidden 定义不够'),
  'extend.modifiers': primitive('extend', ['src/engine/modifiers.js', 'src/engine/ability.js'], ['modifiers'], '证据降低难度 / 空洞计数修正 / 密钥面被动需要扩修正读点'),
  'extend.costDiscount': primitive('extend', ['src/engine/cost.js', 'src/engine/play-attempt.js'], ['playCost', 'discount'], '阿米娜支援减费与定制卡「半费构筑/费用变更」需要扩费用修正表达式'),
  'extend.assetSlots': primitive('extend', ['src/engine/assets.js'], ['slotCapacity'], '查理·凯恩额外 3 个盟友槽需要扩槽位计数读点'),
  'extend.scenarioDecks': primitive('extend', ['src/engine/scenario-decks.js'], ['peek', 'revealChooseDraw'], '异界牌库需要「牌库顶顺序条件可见性 + 揭露后入场地点」，现有剧本牌库只支持基本取放'),
  'extend.physicalFaces': primitive('extend', ['src/engine/physical-faces.js'], ['normalizedFace'], '密钥不在场上（在调查员牌组/敌人附属），翻面需要支持非场实体'),
  'extend.records': primitive('extend', ['src/campaign/campaign-effects.js', 'src/campaign/record-sets.js'], ['recordSet', 'recordCount'], '同志会三池（恩怨未了/盟友/已击败）与 ErasedFromExistence 永久禁用需要扩记录集合语义'),
  'extend.choices': primitive('extend', ['src/engine/table-decisions.js', 'src/engine/resolution.js'], ['requestChoice'], '地图目的地/揭露目标/定制勾选/密钥转移需要扩结构化 choice payload 与合法动作'),

  // ── 新增原语（new）：P2 实现 ─────────────────────────────────────────────────────
  'new.concealedEntity': primitive('new', ['src/engine/'], ['concealed mini-card entity'], '隐匿迷你卡/诱饵虚拟实体：身份未知、可被揭露、带位置（地点/阴影位置）'),
  'new.concealedDistribution': primitive('new', ['src/engine/'], ['distribute concealed cards'], '进入阴影时按 X×调查员数拿取诱饵、正面朝下混洗并分配到指定地点'),
  'new.concealedExpose': primitive('new', ['src/engine/'], ['expose action'], '调查/攻击/躲避/卡牌效果揭露（Expose）与真身入场触发'),
  'new.concealedExposeRange': primitive('new', ['src/engine/'], ['expose range'], '揭露/攻防的「同地点 vs 相邻阴影位置」精确范围需按规则书裁决', { blocked: true, blockedReason: '参考实现允许相邻阴影位置的攻防，规则书措辞需 P2 前逐句裁决' }),
  'new.shadowPositions': primitive('new', ['src/engine/'], ['locations in the shadows'], '地点进入阴影与左/中/右三位置阴影区域（In the Shadows）'),
  'new.concealedRoundEnd': primitive('new', ['src/engine/'], ['reshuffle concealed'], '轮末/效果重新混洗隐匿迷你卡位置'),
  'new.windowExposed': primitive('new', ['src/engine/'], ['exposed window'], '揭露真身/诱饵后的 exposed 窗口（before/after）'),
  'new.concealedIdentityProjection': primitive('new', ['src/engine/', 'src/integration/'], ['concealed projection'], '未揭露迷你卡只向合法观察者投影「有卡/数量」，不泄露真身身份'),
  'new.hollowZone': primitive('new', ['src/engine/'], ['hollowed card zone'], '空洞区：手牌/牌库顶/投入卡/场上非弱点卡移出场外记为 hollowed'),
  'new.hollowCount': primitive('new', ['src/engine/'], ['hollow count'], '个人/全队空洞计数与按数量修正'),
  'new.hollowCountModifierScope': primitive('new', ['src/engine/'], ['hollow modifier scope'], '按个人还是全队空洞计数的口径需逐卡裁决', { blocked: true, blockedReason: '不同卡面用「you/your team」两套口径，P2 前对照规则书与逐卡文本裁决' }),
  'new.erasedFromExistence': primitive('new', ['src/engine/', 'src/campaign/'], ['ErasedFromExistence'], '终局/结局把空洞卡永久抹除并写入战役禁用名单（含 02310）'),
  'new.hollowRecall': primitive('new', ['src/engine/'], ['recall hollow'], '空洞卡回收洗回牌库/手牌的效果'),
  'new.scarletKeyEntity': primitive('new', ['src/engine/'], ['scarlet key entity'], '绯红密钥实体：物理卡号、稳定/动荡面、持有者（调查员/敌人）、可被夺取与转移'),
  'new.keyShift': primitive('new', ['src/engine/'], ['shift'], 'Shift 结算：结算当前面效果并翻面，每轮一次/强制触发'),
  'new.keyBinding': primitive('new', ['src/engine/'], ['key bearer'], '密钥绑定/夺取/转移（调查员牌组内、敌人附属）与旧印/变换窗口'),
  'new.keySteal': primitive('new', ['src/engine/'], ['steal key'], '状况报告 ζ 盗走密钥与圣所追回（剧本流程效果）'),
  'new.worldMap': primitive('new', ['src/engine/', 'content/campaigns/theScarletKeys/'], ['world map state'], '36 节点地图状态：当前位置、已访问、已解锁、最短路径耗时（复用 core.mapGraph）'),
  'new.travelTime': primitive('new', ['src/engine/'], ['time'], '时间累计：普通节点 1、绿地 0、跨洲 +1、快捷旅票 1；时间轴显示'),
  'new.embarkChoice': primitive('new', ['src/engine/'], ['embark'], '启程选择窗口：可选目的地/耗时/快捷旅票，时间满 35 强制通古斯卡'),
  'new.statusReports': primitive('new', ['src/engine/'], ['status report'], '状况报告 α–ω：按时间阈值触发、追 cultist、解锁节点、偷密钥、加诡计'),
  'new.expeditedTicket': primitive('new', ['src/engine/'], ['expedited ticket'], '快捷旅票 09765：放逐、记 1 时间、直达任意目的地'),
  'new.mapNodeUnlocks': primitive('new', ['src/engine/'], ['unlock location'], '剧情解锁地图节点（状况报告/幕间效果）'),
  'new.customizableCard': primitive('new', ['src/engine/', 'src/deck/'], ['customization options'], '定制升级卡：勾选项定义、经验折半（向上取整）计入等级、关间升级累积'),
  'new.customizationUpgrade': primitive('new', ['src/engine/'], ['customization panel'], '构筑与关间升级的勾选面板/校验与运行时按已选条目应用费用/槽位/图标/能力'),
  'new.patrolKeyword': primitive('new', ['src/engine/'], ['patrol'], '巡逻关键字：敌人阶段按最短路径向指定目标地点移动（hunter 之外的新移动规则）'),
  'new.redCoterie': primitive('new', ['src/', 'content/'], ['red coterie pools'], '红色同志会三池（恩怨未了/盟友/已击败）与首领名单'),
  'new.coterieEncounterInjection': primitive('new', ['src/engine/'], ['coterie injection'], '状况报告 ε 后每关按池随机抽 1 名「恩怨未了」同志会敌人洗入遭遇牌库'),
  'new.crossSeatAction': primitive('new', ['src/engine/'], ['cross-seat action'], '卡森：同地点另一调查员立即执行一次行动（每轮每人限一次）'),
  'new.crossSeatActionWindow': primitive('new', ['src/engine/'], ['cross-seat window'], '跨座位即时行动的时机/结算顺序窗口规则需裁决', { blocked: true, blockedReason: '「立即执行一次行动」的嵌套时机与轮末限一次需 P2 对照规则书裁决' }),
  'new.healTrigger': primitive('new', ['src/engine/'], ['heal trigger'], '文森特：「治愈伤害后」发放术后恢复的触发读点（现有 heal 无 after-heal 窗口）'),
  'new.evadeDiscard': primitive('new', ['src/engine/'], ['evade discard'], '基玛尼：躲避已横置非精英敌人时加智力并按剩余生命值直接弃置'),
  'new.doomDiscount': primitive('new', ['src/engine/'], ['doom entry discount'], '阿米娜：每轮一次支援减 3 费并带 1 毁灭入场'),
  'new.evidence': primitive('new', ['src/engine/'], ['evidence counters'], '达雷尔：地点/敌人/诡计上的证据收集与花费（每次检定限一次降难度 2）'),
  'new.allySlotBonus': primitive('new', ['src/engine/'], ['ally slot bonus'], '查理·凯恩额外 3 个盟友槽位'),
  'new.allyReadyBonus': primitive('new', ['src/engine/'], ['ally ready bonus'], '查理·凯恩：检定期间横置受控盟友按基础 +1 与匹配图标加成'),
  'new.sideStories': primitive('new', ['src/engine/', 'content/'], ['side story'], '绿地节点触发的独立冒险（战役流程跳转与时间消耗），内容不在本循环卡包'),
  'new.invalidCards': primitive('new', ['src/engine/', 'src/deck/'], ['invalid cards'], '战役禁用卡：02310 全程禁用 + ErasedFromExistence 记录卡永久禁用，构筑/选人/升级都要过滤'),
  'new.dossierReading': primitive('new', ['src/engine/', 'src/integration/'], ['dossier reading'], '战役地图密档：按时间/到达解锁阅读，未解锁内容不投影给客户端'),
})

// 无法用源码证据确认的条目统一登记进 pending（由扫描器并入）。
export const BLOCKED_PRIMITIVES = Object.freeze(Object.entries(PRIMITIVE_CATALOG)
  .filter(([, entry]) => entry.blocked === true)
  .map(([id]) => id))

// ---------------------------------------------------------------------------
// 3) KEY_MECHANISMS：README §5 的 8 个重点机制
// patterns 命中 name+subname+text+backText+customizationText+customizationChange+traits；
// explicitCodes 用于「卡文里没有关键词、但机制由数据字段承载」的卡（定制卡、调查员）。
// classification 由 PRIMITIVE_CATALOG 的 kind 派生（扫描器重算，不手写）。
// ---------------------------------------------------------------------------
const keyMechanism = (id, title, patterns, primitiveIds, note, extra = {}) => Object.freeze({
  id, title, patterns: Object.freeze(patterns), primitiveIds: Object.freeze(primitiveIds), note, ...extra,
})

export const KEY_MECHANISMS = Object.freeze([
  keyMechanism('concealedAndShadows', '阴影区域（In the Shadows）与隐匿迷你卡（Concealed X）', [
    '\\bConcealed \\d', 'mini-card', '\\bexpose\\b', 'in the shadows', 'concealed keyword',
  ], [
    'new.concealedEntity', 'new.concealedDistribution', 'new.concealedExpose', 'new.concealedExposeRange',
    'new.shadowPositions', 'new.concealedRoundEnd', 'new.windowExposed', 'new.concealedIdentityProjection',
    'extend.hiddenInfo', 'core.choices', 'core.windows', 'core.zones',
  ], '敌人/阴影地点进入阴影时拿 X×调查员数张诱饵混洗分配；揭露真身时敌人入场并触发 exposed 窗口；P4 需要阴影区、三位置摆放与目标选择交互。'),
  keyMechanism('hollowAndErased', '空洞（Hollow）与存在抹除（Erased from Existence）', [
    '\\bhollow', 'Erased from Existence', 'set-aside hollows',
  ], [
    'new.hollowZone', 'new.hollowCount', 'new.hollowCountModifierScope', 'new.hollowRecall', 'new.erasedFromExistence',
    'extend.cardCounters', 'extend.records', 'core.zones', 'core.records', 'core.physicalFaces',
  ], '手牌/牌库顶/投入卡/场上非弱点卡移出场外记为空洞；按个人或全队空洞数修正；终局把空洞卡写入 ErasedFromExistence 永久禁用（含 02310）。P4 需要空洞区查看与回收交互。'),
  keyMechanism('scarletKeysAndShift', '绯红密钥（Scarlet Keys）与变换（Shift）', [
    '\\bShift\\b', 'Flip this key', '\\[\\[Stable\\]\\]', '\\[\\[Unstable\\]\\]', 'this key', 'each key',
  ], [
    'new.scarletKeyEntity', 'new.keyShift', 'new.keyBinding', 'new.keySteal', 'extend.physicalFaces', 'core.records', 'core.enemy',
  ], '10 把双面密钥在调查员与敌人之间绑定/转移/夺取；每轮一次或强制触发 Shift 结算当前面并翻面；状况报告 ζ 盗走密钥、圣所追回。P4 需要密钥持有/夺取/翻面交互。'),
  keyMechanism('worldMapAndTime', '世界地图启程（Embark）、时间轴（Time）与状况报告', [
    '\\bembark\\b', 'status report', 'world map', '\\[fast\\].*travel', 'destination', '\\btime\\b',
  ], [
    'new.worldMap', 'new.travelTime', 'new.embarkChoice', 'new.statusReports', 'new.expeditedTicket',
    'new.mapNodeUnlocks', 'new.sideStories', 'core.mapGraph', 'extend.campaignFlow', 'core.records', 'core.recordCount',
    'extend.choices',
  ], '36 节点邻接图、跨区航线耗时、已访问/已解锁状态、快捷旅票放逐直达、时间阈值触发状况报告 α/ε/β/ζ/γ/θ/ψ/ω、时间满 35 强制跳转通古斯卡。代表卡很少（09765 是唯一直接写 travel 的玩家卡）：本机制主体在指南规则与战役流程层，P4 需要世界地图目的地选择与快捷旅票交互。', { explicitCodes: ['09765'] }),
  keyMechanism('customizableCards', '定制（Customizable）升级卡', [
    '□', '\\bCustomizable\\b',
  ], [
    'new.customizableCard', 'new.customizationUpgrade', 'extend.costDiscount', 'extend.modifiers', 'core.deck', 'core.uses',
  ], '16 张定制卡的勾选项定义（格数/名称/解锁效果）、构筑经验折半（向上取整）、关间升级累积、运行时按已选条目动态改变费用/槽位/特性/图标/能力。P4 需要定制勾选面板。', { explicitCodes: CUSTOMIZABLE_CODES }),
  keyMechanism('redCoterieAndPatrol', '红色同志会（Red Coterie）与巡逻（Patrol）', [
    '\\bPatrol\\b', '\\[\\[Coterie\\]\\]', '\\bCoterie\\b', 'red coterie', 'coterie',
  ], [
    'new.patrolKeyword', 'new.redCoterie', 'new.coterieEncounterInjection', 'core.enemy', 'core.encounter',
    'core.records', 'extend.records',
  ], '同志会核心成员在「恩怨未了」池/盟友池/已击败池之间转换，状况报告 ε 后每关随机抽 1 名洗入遭遇牌库；Patrol 敌人在敌人阶段按最短路径向指定目标地点移动。'),
  keyMechanism('investigatorAbilities', '调查员特殊能力', [
    '\\bCarson Sinclair\\b|\\bVincent Lee\\b|\\bKymani Jones\\b|\\bAmina Zidane\\b|\\bDarrell Simmons\\b|\\bCharlie Kane\\b',
  ], [
    'new.crossSeatAction', 'new.crossSeatActionWindow', 'new.healTrigger', 'new.evadeDiscard', 'new.doomDiscount',
    'new.evidence', 'new.allySlotBonus', 'new.allyReadyBonus', 'core.investigatorAbility', 'extend.assetSlots', 'extend.modifiers',
  ], '六位调查员：卡森跨座位即时行动授权、文森特「治愈伤害」构筑匹配与术后恢复、基玛尼智力躲避直接弃置、阿米娜带毁灭减费入场与毁灭搬移、达雷尔证据生成与花费、凯恩多盟友槽与横置盟友加成。', { explicitCodes: INVESTIGATOR_CODES }),
  keyMechanism('existingKeywords', '已有关键词及模板', [
    '\\bHunter\\b', '\\bAloof\\b', '\\bRetaliate\\b', '\\bAlert\\b', '\\bSurge\\b', '\\bPeril\\b', '\\bMassive\\b',
    '\\bVictory\\b', '\\bObjective\\b', '\\bPrey\\b', '\\bSpawn\\b', '\\bParley\\b', '\\bResign\\b', '\\[fast\\]',
    '\\bPermanent\\b', '\\bExceptional\\b', '\\bElite\\b', '\\bRevelation\\b', '\\bHidden\\b', '\\bBonded\\b',
  ], [
    'core.enemy', 'core.encounter', 'core.effects', 'core.actions', 'core.choices', 'core.windows',
  ], '猎手/冷漠/反击/警戒/险境/涌动/流放/隐藏/显现/胜利/目标/猎物/生成/谈判/撤退/快速/永久/卓越/精英/绑定等已有实现，P2 只验证本循环所需时机与交互，不重写。'),
])

// 关键机制 id 固定 8 项（README §5），供扫描器与测试做门禁。
export const KEY_MECHANISM_IDS = Object.freeze(KEY_MECHANISMS.map(mechanism => mechanism.id))

// 机制词表引用这些卡号时应能覆盖（P1 数据事实核对用；卡数来自卡表）。
export const KEY_CARD_CODE_FACTS = Object.freeze({
  investigators: Object.freeze([...INVESTIGATOR_CODES]),
  keys: Object.freeze([...KEY_IDS]),
  customizable: Object.freeze([...CUSTOMIZABLE_CODES]),
  allCards: Object.keys(ALL_CARDS).filter(code => code >= '09001' && code <= '09999').length,
})
