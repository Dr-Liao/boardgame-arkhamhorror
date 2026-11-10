// 八循环《绯红密钥》（The Scarlet Keys）P1 机制扫描词表。
//
// 本文件只描述“扫描口径”，不声明任何卡牌行为已实现：匹配只用于分类，绝不代表逐卡验收
// （P1 阶段所有卡 behaviorStatus 仍为 pending，字面行为在 P5–P7 验收）。
//
// 条目口径（与 docs/campaign/theScarletKeys/README.md §5 对齐）：
//   · type ∈ primitive | keyword | rulebook | interaction | scenario | content；
//   · patterns 是大小写不敏感的正则字符串，扫描语料为
//     `name + subname + text + backText + customizationText + customizationChange + traits`；
//   · 内容型兜底机制用可选谓词字段代替正则（types / owners / faces / fields / codes），
//     保证 439 条记录至少归入一个机制（unclassified = 0），不靠“猜关键词”覆盖；
//   · candidatePrimitives 只能引用 tools/tsk-mechanism-primitives.mjs#PRIMITIVE_CATALOG 里已登记的 id，
//     未知 id 会让 primitiveCandidatesKnown 门禁失败。
import { INVESTIGATOR_CODES } from '../content/campaigns/theScarletKeys/shared.js'

export const MECHANISM_TYPES = Object.freeze(['primitive', 'keyword', 'rulebook', 'interaction', 'scenario', 'content'])

const define = (id, type, title, patterns, candidatePrimitives, extra = {}) => Object.freeze({
  id, type, title, patterns: Object.freeze(patterns), candidatePrimitives: Object.freeze(candidatePrimitives), ...extra,
})

export const MECHANISMS = Object.freeze([
  // ── 已有关键词（本循环复用，不新增能力；existing 由原语目录判定）────────────────────────
  define('hunter', 'keyword', '猎手（Hunter）', ['\\bHunter\\b'], ['core.enemy']),
  define('aloof', 'keyword', '冷漠（Aloof）', ['\\bAloof\\b'], ['core.enemy']),
  define('massive', 'keyword', '庞大（Massive）', ['\\bMassive\\b'], ['core.enemy']),
  define('retaliate', 'keyword', '反击（Retaliate）', ['\\bRetaliate\\b'], ['core.enemy']),
  define('alert', 'keyword', '警戒（Alert）', ['\\bAlert\\b'], ['core.enemy']),
  define('surge', 'keyword', '涌动（Surge）', ['\\bSurge\\b'], ['core.encounter']),
  define('peril', 'keyword', '险境（Peril）', ['\\bPeril\\b'], ['core.encounter']),
  define('hidden', 'keyword', '隐藏（Hidden）', ['\\bHidden\\b'], ['core.hiddenInfo']),
  define('revelation', 'keyword', '显现（Revelation）', ['\\bRevelation\\b'], ['core.encounter']),
  define('victoryKeyword', 'keyword', '胜利（Victory）', ['\\bVictory\\b'], ['core.victory']),
  define('objective', 'keyword', '目标（Objective）', ['\\bObjective\\b'], ['core.effects']),
  define('prey', 'keyword', '猎物（Prey）', ['\\bPrey\\b'], ['core.enemy']),
  define('spawn', 'keyword', '生成（Spawn）', ['\\bSpawn\\b'], ['core.enemy']),
  define('parley', 'keyword', '谈判（Parley）', ['\\bParley\\b'], ['core.parley', 'core.choices']),
  define('resign', 'keyword', '撤退（Resign）', ['\\bResign\\b'], ['core.effects', 'core.actions']),
  define('fast', 'keyword', '快速（Fast）', ['\\[fast\\]', '\\bFast\\b'], ['core.actions']),
  define('permanent', 'keyword', '永久（Permanent）', ['\\bPermanent\\b'], ['core.deck']),
  define('exceptional', 'keyword', '卓越（Exceptional）', ['\\bExceptional\\b'], ['core.deck']),
  define('elite', 'keyword', '精英（Elite）', ['\\bElite\\b'], ['core.enemy']),
  define('bonded', 'keyword', '绑定（Bonded）', ['\\bBonded\\b'], ['core.bonded']),
  define('usesKeyword', 'keyword', '使用次数（Uses X）', ['\\bUses \\('], ['core.uses']),
  define('doomToken', 'keyword', '毁灭（Doom）', ['\\bdoom\\b'], ['core.effects', 'core.enemy']),

  // ── 本循环新规则 / 新标记（README §5）──────────────────────────────────────────────
  define('concealed', 'keyword', '隐匿（Concealed X）', ['\\bConcealed \\d', 'concealed keyword'], [
    'new.concealedEntity', 'new.concealedDistribution', 'new.concealedIdentityProjection', 'extend.hiddenInfo',
  ]),
  define('shift', 'keyword', '变换（Shift）与双面密钥', ['\\bShift\\b', 'Flip this key'], [
    'new.scarletKeyEntity', 'new.keyShift', 'new.keyBinding', 'extend.physicalFaces',
  ]),
  define('hollow', 'keyword', '空洞（Hollow）', ['\\bhollow', 'set-aside hollows'], [
    'new.hollowZone', 'new.hollowCount', 'new.hollowRecall', 'extend.cardCounters',
  ]),
  define('customizable', 'keyword', '定制升级（Customizable）', [], [
    'new.customizableCard', 'new.customizationUpgrade', 'extend.costDiscount',
  ], { fields: ['customizationText'] }),
  define('patrol', 'keyword', '巡逻（Patrol）', ['\\bPatrol\\b'], ['new.patrolKeyword', 'core.enemy']),
  define('otherworld', 'keyword', '异界（Otherworld）', ['\\[\\[Otherworld\\]\\]', 'Otherworld'], [
    'extend.scenarioDecks', 'core.scenarioDecks', 'core.hiddenInfo',
  ]),
  define('stableUnstable', 'keyword', '稳定面／动荡面（Stable / Unstable）', ['\\[\\[Stable\\]\\]', '\\[\\[Unstable\\]\\]'], [
    'new.scarletKeyEntity', 'extend.physicalFaces',
  ]),

  // ── 通用原语：引擎已有能力的复用点（P2 先盘点再决定 extend/new）──────────────────────
  define('tokenResolution', 'primitive', '混乱标记揭示与符号结算', ['\\[(?:skull|cultist|tablet|elder_thing|elder_sign|auto_fail)\\]'], ['core.tokens', 'core.effects']),
  define('tokenPool', 'primitive', '混乱袋构成、增删与状况报告追加标记', ['chaos bag|add .*token|remove .*token', 'status report'], ['core.tokens', 'new.statusReports']),
  define('uses', 'primitive', '支援使用次数（uses）与充能／秘密／弹药／物资', ['\\bUses \\(', 'charges?\\b', '\\bsecrets?\\b', '\\bammo\\b'], ['core.uses']),
  define('testResolution', 'primitive', '技能检定、难度与成功／失败结算', ['skill test', '\\b(?:Fight|Evade|Investigate|Parley)\\b\\.'], ['core.test']),
  define('damageHorror', 'primitive', '伤害／恐惧与治愈', ['\\bdamage\\b|\\bhorror\\b', '\\bheal\\b'], ['core.damageHorror', 'core.modifiers']),
  define('cardFlow', 'primitive', '抽牌、弃牌、洗牌与检索牌库', ['\\bdraw\\b|\\bdiscard\\b|\\bshuffle\\b|search your deck'], ['core.deck']),
  define('actionEconomy', 'primitive', '行动类型、快速时机与额外行动', ['\\[action\\]|\\[reaction\\]|\\[free\\]|additional action'], ['core.actions']),
  define('doomClock', 'primitive', '毁灭／议程推进时钟', ['\\bdoom\\b'], ['core.effects', 'core.records']),
  define('enemyAttack', 'primitive', '敌人交战、攻击与趁乱攻击', ['\\battack(?:s|ed)?\\b|\\bengaged\\b|\\bengage\\b'], ['core.enemy']),
  define('movement', 'primitive', '移动、地点连接与航路', ['\\bmove\\b|\\badjacent\\b|\\bconnected\\b|\\bpath\\b'], ['core.enemy', 'core.mapGraph']),
  define('clueDiscovery', 'primitive', '线索发现与调查', ['\\bclue\\b'], ['core.clues', 'core.test']),
  define('resourceEconomy', 'primitive', '资源、费用与支付', ['\\bresource\\b|\\bcost\\b'], ['core.effects', 'extend.costDiscount']),
  define('victoryPoints', 'primitive', '胜利点与胜利展示区', ['Victory \\d'], ['core.victory']),
  define('encounterDeck', 'primitive', '遭遇牌库、涌动与遭遇结算', ['encounter deck|encounter card|draw .*encounter'], ['core.encounter', 'core.scenarioDecks']),
  define('setAsideRemoval', 'primitive', '置于一边、移出游戏与离场记录', ['set aside|out of play|remove (?:it |this card |the )?from the game'], ['core.zones', 'new.hollowZone']),
  define('cardFlip', 'primitive', '双面卡翻面与面切换', ['\\bflip\\b|other side|reverse side'], ['core.physicalFaces', 'extend.physicalFaces']),
  define('hiddenInformation', 'primitive', '隐藏信息与观察投影', ['facedown|face-down|hidden|secret|unknown'], ['core.hiddenInfo', 'extend.hiddenInfo']),
  define('namedCounters', 'primitive', '命名计数（时间／空洞／证据）', ['\\btime\\b|hollow|evidence'], ['core.markerCount', 'extend.cardCounters']),
  define('recordCounters', 'primitive', '战役记录与计数', ['Campaign Log|\\brecord\\b|campaign log'], ['core.records', 'core.recordCount', 'extend.records']),
  define('choiceProjection', 'primitive', '选择、合法动作与面板投影', ['\\bchoose\\b|\\bchoose one\\b|as a group'], ['core.choices', 'extend.choices']),
  define('mapGraph', 'primitive', '图结构最短路径与节点距离', ['\\bpath\\b|\\broute\\b|\\bdistance\\b'], ['core.mapGraph', 'new.worldMap']),

  // ── 规则书条目：本循环需要补写的规则页（P3 才写规则文本，这里只登记缺口）──────────────
  define('rules.chaosBag', 'rulebook', '混乱袋：四档符号与状况报告追加标记', ['chaos bag|\\[skull\\]|\\[cultist\\]|\\[tablet\\]'], ['core.tokens', 'new.statusReports']),
  define('rules.concealed', 'rulebook', '隐匿规则：阴影区域、迷你卡、诱饵与揭露', ['Concealed \\d|mini-card|in the shadows|\\bexpose\\b'], ['new.concealedEntity', 'new.concealedExpose', 'new.shadowPositions']),
  define('rules.hollow', 'rulebook', '空洞规则：移出场外、计数与回收', ['\\bhollow', 'set-aside hollows'], ['new.hollowZone', 'new.hollowRecall']),
  define('rules.scarletKeys', 'rulebook', '绯红密钥规则：稳定/动荡面、绑定与变换', ['\\bShift\\b|this key|each key'], ['new.scarletKeyEntity', 'new.keyShift', 'new.keyBinding']),
  define('rules.embark', 'rulebook', '世界地图启程与旅行耗时', ['embark|travel|world map'], ['new.worldMap', 'new.travelTime', 'new.embarkChoice']),
  define('rules.time', 'rulebook', '时间轴与状况报告 α–ω', ['\\btime\\b|status report'], ['new.travelTime', 'new.statusReports']),
  define('rules.customizable', 'rulebook', '定制升级规则：勾选、经验与运行时变化', ['□'], ['new.customizableCard', 'new.customizationUpgrade']),
  define('rules.coterie', 'rulebook', '红色同志会：三池、遭遇注入与首领', ['\\bCoterie\\b|red coterie'], ['new.redCoterie', 'new.coterieEncounterInjection']),
  define('rules.patrol', 'rulebook', '巡逻关键字移动规则', ['\\bPatrol\\b'], ['new.patrolKeyword']),
  define('rules.investigators', 'rulebook', '六位调查员的构筑与能力规则', [], ['core.investigatorAbility', 'new.invalidCards'], { codes: INVESTIGATOR_CODES }),
  define('rules.keywords', 'rulebook', '已有关键词在本循环的适用范围', ['\\bHunter\\b|\\bAloof\\b|\\bRetaliate\\b|\\bAlert\\b|\\bSurge\\b|\\bPeril\\b'], ['core.enemy', 'core.encounter']),
  define('rules.investigatorAbilities', 'rulebook', '调查员特殊能力：跨座位授权、治愈触发、证据、盟友槽', ['cross-seat|immediately perform|evidence'], [
    'new.crossSeatAction', 'new.crossSeatActionWindow', 'new.healTrigger', 'new.evadeDiscard', 'new.doomDiscount',
    'new.evidence', 'new.allySlotBonus', 'new.allyReadyBonus', 'core.investigatorAbility',
  ]),
  define('rules.epilogue', 'rulebook', '尾声 trust/deception 分支与结局', ['trust|deception|epilogue|permanent position|dismantled'], ['core.records', 'core.recordCount', 'extend.campaignFlow']),
  define('rules.invalidCards', 'rulebook', '战役禁用卡与存在抹除构筑限制', ['cannot be included|Erased from Existence'], ['new.invalidCards', 'new.erasedFromExistence']),
  define('rules.sideStories', 'rulebook', '绿地 side story 与时间消耗', ['side story|Venice|Cairo|Monte Carlo|New Orleans|Arkham'], ['new.sideStories', 'extend.campaignFlow']),
  define('rules.otherworld', 'rulebook', '异界牌库与异界地点', ['Otherworld'], ['extend.scenarioDecks', 'core.scenarioDecks']),
  define('rules.dossier', 'rulebook', '战役地图密档与到达/时间解锁', ['dossier|File #'], ['new.dossierReading', 'extend.hiddenInfo']),

  // ── 交互：P4 需要新增／复用的界面与选择流程 ─────────────────────────────────────────
  define('choices', 'interaction', '选择、分配、目标与可选分支', ['\\bchoose\\b|\\bchoice\\b|\\beither\\b|as a group'], ['core.choices', 'extend.choices']),
  define('concealSetup', 'interaction', '进入阴影时的迷你卡/诱饵混洗分配', ['mini-card|\\bdecoy\\b|shuffle them facedown'], ['new.concealedDistribution', 'new.shadowPositions']),
  define('exposeFlow', 'interaction', '揭露（Expose）选择与真假身结算', ['\\bexpose\\b|reveal .*mini-card'], ['new.concealedExpose', 'new.windowExposed', 'core.choices']),
  define('shadowPlacement', 'interaction', '三位置阴影地点（左／中／右）摆放与移动', ['in the shadows|left position|middle position|right position'], ['new.shadowPositions', 'extend.choices']),
  define('shiftFlow', 'interaction', '密钥变换结算与翻面交互', ['\\bShift\\b|Flip this key'], ['new.keyShift', 'new.windowExposed']),
  define('keyTransfer', 'interaction', '密钥夺取／绑定／转移交互', ['this key|each key|take control of .*key'], ['new.keyBinding', 'new.keySteal', 'extend.choices']),
  define('hollowRecallFlow', 'interaction', '空洞区查看与回收交互', ['\\bhollow|Erased from Existence'], ['new.hollowZone', 'new.hollowRecall', 'core.choices']),
  define('embarkChoice', 'interaction', '世界地图目的地选择与耗时预览', ['embark|travel|destination'], ['new.embarkChoice', 'extend.choices']),
  define('travelTicket', 'interaction', '快捷旅票放逐直达交互', ['expedited ticket|while embark'], ['new.expeditedTicket', 'new.travelTime']),
  define('statusReportPrompt', 'interaction', '状况报告触发与叙事展示', ['status report'], ['new.statusReports', 'new.dossierReading']),
  define('customizationPanel', 'interaction', '构筑/关间升级的定制勾选面板', ['□'], ['new.customizationUpgrade', 'extend.choices']),
  define('crossSeatAction', 'interaction', '跨座位即时行动授权交互', ['immediately perform|another investigator'], ['new.crossSeatAction', 'new.crossSeatActionWindow', 'core.actions']),
  define('evidenceSpend', 'interaction', '证据花费降低难度交互', ['\\bevidence\\b'], ['new.evidence', 'extend.modifiers']),
  define('allyReady', 'interaction', '横置盟友发动图标加成的选择', ['ally|allies'], ['new.allyReadyBonus', 'extend.assetSlots']),
  define('mapNodeSelection', 'interaction', '地图节点选择、已访问/已解锁展示', ['world map|destination'], ['new.worldMap', 'new.mapNodeUnlocks', 'core.choices']),
  define('sideStoryPick', 'interaction', '绿地 side story 选择', ['side story'], ['new.sideStories', 'extend.campaignFlow']),
  define('dossierReveal', 'interaction', '密档按条件解锁阅读（剧透边界）', ['dossier'], ['new.dossierReading', 'extend.hiddenInfo']),
  define('otherworldDeckFlow', 'interaction', '异界牌库查看/放置/揭露交互', ['Otherworld'], ['extend.scenarioDecks', 'new.shadowPositions']),
  define('parleyNegotiation', 'interaction', '谈判/潜入模式与敌对切换', ['parley|negotiat|hostile|allied'], ['core.parley', 'core.choices']),

  // ── 内容结构兜底：按类型 / 归属 / 关联面覆盖全部 439 条记录，保证 unclassified = 0 ──────
  define('content.investigators', 'content', '调查员身份与专属依赖', [], ['core.investigatorAbility', 'core.deck'], { types: ['investigator'] }),
  define('content.playerCards', 'content', '一般玩家卡（支援／事件／技能）', [], ['core.effects', 'core.playChannels', 'core.modifiers'], { owners: ['tskPlayer', 'tskInvestigators'], types: ['asset', 'event', 'skill'] }),
  define('content.enemies', 'content', '非玩家敌人身份与战斗数据', [], ['core.enemy'], { types: ['enemy'] }),
  define('content.treacheries', 'content', '非玩家诡计身份与显现', [], ['core.encounter'], { types: ['treachery'] }),
  define('content.locations', 'content', '地点正反面、连接与阴影属性', [], ['core.clues', 'new.shadowPositions'], { types: ['location'] }),
  define('content.storyCards', 'content', '剧情资产与故事卡', [], ['core.scenarioDecks'], { types: ['story'] }),
  define('content.scenarioPromptCards', 'content', '十张印刷提示卡（四档混乱符号参考卡）', [], ['core.tokens', 'core.effects'], { types: ['scenario'] }),
  define('content.actsAgendas', 'content', '幕／议程正反面与推进', [], ['core.effects', 'core.records', 'core.physicalFaces'], { types: ['act', 'agenda'] }),
  define('content.keys', 'content', '十把双面绯红密钥记录', [], ['new.scarletKeyEntity', 'new.keyShift'], { types: ['key'] }),
  define('content.faces', 'content', '双面／关联面（a/b/c/d 面）记录', [], ['core.physicalFaces', 'new.scarletKeyEntity'], { faces: true }),
  define('content.traits', 'content', '特质词表（[[trait]] 标记）', ['\\[\\[[^\\]]+\\]\\]'], ['core.effects']),
  define('content.customizationText', 'content', '定制卡勾选项文本数据', [], ['new.customizableCard'], { fields: ['customizationText'] }),
  define('content.records', 'content', '战役记录键与记录集合', ['Campaign Log|\\brecord\\b|campaign log'], ['core.records', 'extend.records']),
])

export const MECHANISM_BY_ID = Object.freeze(Object.fromEntries(MECHANISMS.map(mechanism => [mechanism.id, mechanism])))
