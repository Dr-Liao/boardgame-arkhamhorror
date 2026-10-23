#!/usr/bin/env node
// 万象无终（TCU / 05xxx）第 1 步：扫描新增机制
//
// 用法：
//   node tools/scan-tcu-mechanisms.mjs --write    生成 artifacts/migration/tcu/mechanism-scan.json
//   node tools/scan-tcu-mechanisms.mjs --check    重算并与已生成文件逐字节比较（来源漂移即失败）
//   node tools/scan-tcu-mechanisms.mjs --review   输出逐卡复核清单（artifacts/migration/tcu/_review.md）
//   node tools/scan-tcu-mechanisms.mjs --print    把 JSON 打到 stdout
//   不带参数：打印摘要
//
// 口径（对应 docs/tcu-migration-roadmap.md §3）：
// - 唯一范围事实源是 src/cards/cards-data.js（05 号段 343 主码 + 34 关联面 = 377 条印刷记录）；
// - 每张记录至少归属一个条目：循环级机制、9 章专属条目、跨章遭遇组条目、或标准卡条目；
// - 未知机制默认阻断：守望表出现后续循环关键词、某个机制条目没有落点、或有卡未分类时，gate 不通过；
// - 参考资源只读；本工具只在构建期读 参考资源/，运行时内容不依赖它。
//
// 按 type 分流（§3.4）：primitive → §4 原语；keyword/rulebook → §5 关键词与规则书；
// interaction → §6 交互；scenario → §7.3 剧本；baseline 不是新机制，只是“仅用既有原语”的显式声明。

import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { ALL_CARDS, META } from '../src/cards/cards-data.js'

const CYCLE = { id: 'tcu', campaignId: 'theCircleUndone', name: 'The Circle Undone', nameZh: '万象无终' }
const REFERENCE_ROOT = new URL('../../../参考资源/ArkhamHorror-main/', import.meta.url)

// §2.1：9 章（序章 + 8 章）。group 是 cards-data 的 encounterCode。
const CHAPTERS = [
  { index: 0, id: 'disappearanceAtTheTwilightEstate', code: '05043', group: 'disappearance_at_the_twilight_estate', name: 'Disappearance at the Twilight Estate', nameZh: '暮色庄园失踪事件', pack: 'tcu', source: 'DisappearanceAtTheTwilightEstate.hs' },
  { index: 1, id: 'theWitchingHour', code: '05050', group: 'the_witching_hour', name: 'The Witching Hour', nameZh: '巫异时刻', pack: 'tcu', source: 'TheWitchingHour.hs' },
  { index: 2, id: 'atDeathsDoorstep', code: '05065', group: 'at_deaths_doorstep', name: "At Death's Doorstep", nameZh: '死亡门前', pack: 'tcu', source: 'AtDeathsDoorstep.hs' },
  { index: 3, id: 'theSecretName', code: '05120', group: 'the_secret_name', name: 'The Secret Name', nameZh: '隐秘之名', pack: 'tsn', source: 'TheSecretName.hs' },
  { index: 4, id: 'theWagesOfSin', code: '05161', group: 'the_wages_of_sin', name: 'The Wages of Sin', nameZh: '罪恶报应', pack: 'wos', source: 'TheWagesOfSin.hs' },
  { index: 5, id: 'forTheGreaterGood', code: '05197', group: 'for_the_greater_good', name: 'For the Greater Good', nameZh: '崇高利益', pack: 'fgg', source: 'ForTheGreaterGood.hs' },
  { index: 6, id: 'unionAndDisillusion', code: '05238', group: 'union_and_disillusion', name: 'Union and Disillusion', nameZh: '聚合幻灭', pack: 'uad', source: 'UnionAndDisillusion.hs' },
  { index: 7, id: 'inTheClutchesOfChaos', code: '05284', group: 'in_the_clutches_of_chaos', name: 'In the Clutches of Chaos', nameZh: '混沌魔掌', pack: 'icc', source: 'InTheClutchesOfChaos.hs' },
  { index: 8, id: 'beforeTheBlackThrone', code: '05325', group: 'before_the_black_throne', name: 'Before the Black Throne', nameZh: '黑色王座', pack: 'bbt', source: 'BeforeTheBlackThrone.hs' },
]

// §2.1 / 附录 A：12 个 TCU 跨章遭遇组（有 05 卡），按“出现章”登记。
const SHARED_GROUPS = {
  the_watcher: ['disappearanceAtTheTwilightEstate', 'atDeathsDoorstep', 'theWagesOfSin', 'unionAndDisillusion'],
  agents_of_azathoth: ['inTheClutchesOfChaos', 'beforeTheBlackThrone'],
  anettes_coven: ['theWitchingHour', 'theWagesOfSin', 'unionAndDisillusion', 'inTheClutchesOfChaos'],
  witchcraft: ['theWitchingHour', 'theSecretName', 'theWagesOfSin', 'inTheClutchesOfChaos'],
  silver_twilight_lodge: ['atDeathsDoorstep', 'forTheGreaterGood', 'unionAndDisillusion', 'inTheClutchesOfChaos'],
  city_of_sins: ['theWitchingHour', 'theSecretName', 'theWagesOfSin', 'forTheGreaterGood', 'inTheClutchesOfChaos'],
  spectral_predators: ['disappearanceAtTheTwilightEstate', 'atDeathsDoorstep', 'unionAndDisillusion'],
  trapped_spirits: ['disappearanceAtTheTwilightEstate', 'atDeathsDoorstep', 'theWagesOfSin'],
  realm_of_death: ['disappearanceAtTheTwilightEstate', 'atDeathsDoorstep', 'theSecretName', 'theWagesOfSin', 'unionAndDisillusion'],
  inexorable_fate: ['disappearanceAtTheTwilightEstate', 'atDeathsDoorstep', 'theSecretName', 'theWagesOfSin', 'unionAndDisillusion', 'beforeTheBlackThrone'],
  music_of_the_damned: ['inTheClutchesOfChaos'],
  secrets_of_the_universe: ['inTheClutchesOfChaos'],
}

// §3.3 / 附录 A：被引用但 05 段没有卡的核心/前循环遭遇组；P1 必须登记并映射现有卡号。
const CORE_GROUPS = ['chillingCold', 'ancientEvils', 'darkCult', 'rats', 'strikingFear', 'lockedDoors', 'nightgaunts', 'agentsOfShubNiggurath', 'theMidnightMasks']

const STORY_INVESTIGATORS = ['05046', '05047', '05048', '05049']
const STORY_ASSET_CODES = ['05258', '05259', '05260', '05261']
const FATE_STORY_CODES = ['05262', '05263', '05264', '05265']

// ---------------------------------------------------------------------------
// 循环级机制：证据、现状、缺口、候选原语（§3.1 一行一条，补扫描新发现）
// ---------------------------------------------------------------------------
const CYCLE_MECHANISMS = [
  {
    id: 'haunted', type: 'primitive', title: 'Haunted', titleZh: '闹鬼', risk: 'high',
    roadmap: '§3.1 闹鬼 / §4.1 P2.1 / §5.1 haunted',
    keyword: { id: 'haunted', ruleId: 'tcuHaunted', printed: true },
    evidenceText: '卡面「Haunted -」/「闹鬼 -」关键字，以及「结算你所在地点的每个闹鬼能力」的引用。',
    existing: {
      status: 'missing',
      modules: ['src/engine/windows.js', 'src/engine/locations.js', 'src/engine/tests.js', 'src/cards/encounter-entries/thePathToCarcosa/_shared/hauntings/03094.js'],
      note: 'Carcosa 03094 写过 location.haunted 字段，但引擎没有读点；失败检定后没有通用闹鬼窗口，Carcosa 全靠单卡 resolve。',
    },
    gaps: [
      '地点侧的闹鬼能力声明位与结算顺序（复数能力按地点顺序，不是卡表顺序）',
      '失败检定窗口：调查失败 / 部分剧本的战斗、躲避失败 / 石板标记与剧本触发',
      'resolveHaunted(seat,{locationId,times})，支持 twice 与“取消/替代”“无合法目标”',
      '存档往返与 replay 指纹稳定（自动结算不得依赖随机顺序）',
    ],
    candidatePrimitives: ['resolveHaunted(seat,{locationId,times})', 'locationRule.hauntedAbilities[]', 'window.afterFailedTest'],
  },
  {
    id: 'spectral', type: 'primitive', title: 'Spectral', titleZh: '幽灵界', risk: 'high',
    roadmap: '§3.1 幽灵界 / §4.1 P2.2 + P2.3 / §5.1 spectral',
    keyword: { id: 'spectral', ruleId: 'tcuSpectral', printed: false, trait: 'Spectral' },
    evidenceText: 'Spectral 特性、幽灵遭遇牌堆、双面/单面幽灵地点、非幽灵地点上的交战/伤害限制。',
    existing: {
      status: 'partial',
      modules: ['src/engine/setup.js（cultistDeck 第二牌堆先例）', 'src/engine/deck-ops.js', 'src/engine/encounter.js', 'src/engine/locations.js flipScenarioLocation'],
      note: '有独立 cultistDeck 的第二牌堆先例、地点翻面原语与探索牌库；但没有泛化的 spectral 遭遇牌堆，也没有 Spectral 目标限制。',
    },
    gaps: [
      '第二遭遇牌堆：建堆 / 抽 / 弃 / 洗回 / 公开张数 / 观察投影',
      '双面幽灵地点与单面幽灵地点数据（frontCode/backCode + 幽灵面规则）',
      '非幽灵地点上的「不能交战/不能受伤」限制',
      '牌堆面板与桌面/移动投影；「幽灵遭遇牌库」与标准遭遇牌库的互洗',
    ],
    candidatePrimitives: ['setExtraEncounterDeck(state,id,cards)', 'drawFromDeck("spectral")', 'shuffleInto("spectral")', 'flipLocationToSpectral'],
  },
  {
    id: 'tarotDeck', type: 'primitive', title: 'Tarot Deck', titleZh: '塔罗牌组', risk: 'high',
    roadmap: '§3.1 塔罗牌组 / §4.1 P2.4 / §5.1 tarotDeck / 决策点 D4',
    keyword: { id: 'tarotDeck', ruleId: 'tcuTarot', printed: false },
    zeroCardJustified: '剧本级 22 张牌组，不建 05 卡号（决策点 D4）；本条目只负责把原语与剧本入口排进 P2.4。',
    evidenceText: '序章 22 张大阿卡纳分支（The Fool 0 → The World XXI）与巫异时刻的塔罗占卜；牌组不是 05 卡表。',
    existing: {
      status: 'missing',
      modules: [],
      note: '05 卡表对「塔罗牌组」0 命中，证明它是剧本级牌组；引擎没有剧本级命名牌库，也没有正逆位与结果表。',
    },
    gaps: [
      '22 张大阿卡纳数据与正逆位（tarot.js）',
      '确定性洗牌、抽取、选择、重复抽取与唯一性',
      '序章与巫异时刻两处结果表、结局/记录写入',
      '存档往返与桌面/移动投影',
    ],
    candidatePrimitives: ['drawTarot(seat,{count,mode})', 'chooseTarot', 'scenarioDeck("tarot")'],
  },
  {
    id: 'tarotSlot', type: 'primitive', title: 'Tarot Slot', titleZh: '塔罗槽位', risk: 'medium',
    roadmap: '§3.1 塔罗槽位 / §4.1 P2.9 / §5.1 tarotSlot',
    keyword: { id: 'tarotSlot', ruleId: 'tcuTarotSlot', printed: true },
    evidenceText: '7 张玩家塔罗卡（slots 含 Tarot）、Anna Kaslow 的额外 2 槽、开局入手即入场、The Tower 不能投入。',
    existing: {
      status: 'partial',
      modules: ['src/engine/engine.js:155 SLOT_CAPACITY（tarot: 1）', 'src/engine/modifiers.js add:slot', 'web/game-ui.js 槽位顺序/中文标签'],
      note: '槽位容量、UI 图标已在；modifiers 的 add:slot value=tarot 可以给额外槽（不需要新 kind），但缺卡牌数据、开局入手、构筑合法性、The Tower 限制。',
    },
    gaps: [
      '7 张塔罗卡的槽位与 05042 的「基础弱点 + 塔罗」双身份',
      '开局时若在起始手牌则入场（7 张塔罗 + 05283 安娜）',
      'The Tower 在手牌中不能投入、不能被调度替换',
      '构筑合法性：tarot 槽 1–4 个、超槽提示',
    ],
    candidatePrimitives: ['modifier add:slot value=tarot', 'openingHand.putIntoPlay', 'deckbuilding.slotRule("tarot")'],
  },
  {
    id: 'circle', type: 'primitive', title: 'Circle', titleZh: '阵法', risk: 'high',
    roadmap: '§3.1 阵法 / §4.1 P2.5 / §5.1 circle',
    keyword: { id: 'circle', ruleId: 'tcuCircle', printed: true },
    evidenceText: '《聚合幻灭》以「[action]: Circle.」发起 2–4 项技能相加的检定（05250–05257）。',
    existing: {
      status: 'missing',
      modules: ['src/engine/tests.js:88 performTest(state,seat,skill,difficulty,options)'],
      note: 'performTest 只接受单个技能；没有 actionKind "circle"，也没有地点行动入口。',
    },
    gaps: [
      '2–4 项技能合成检定（最低+次低等写法、技能值合计）',
      'actionKind:"circle" 与借机攻击/行动计数/每轮限制',
      '难度、失败分支与「本次检定属于阵法行动」的判定',
      'AI 与多技能面板',
    ],
    candidatePrimitives: ['performTest(...,{skills:[...]})', 'actionKind:"circle"'],
  },
  {
    id: 'parley', type: 'primitive', title: 'Parley', titleZh: '谈判', risk: 'medium',
    roadmap: '§3.1 通用谈判 / §4.1 P2.7 / §5.1 parley（复用既有规则条目）',
    keyword: { id: 'parley', ruleId: 'parley', printed: true },
    evidenceText: '敌人/地点/剧情资产上的「Parley -」能力，以及构筑里 "cards with parley" 的筛选。',
    existing: {
      status: 'partial',
      modules: ['src/engine/actions.js / moves.js（actionKind parley）', 'src/engine/abilities（enemyRule.parley / assetRule.parley）', 'src/cards/entries/02272.js parleyDifficultyModifier'],
      note: '已有谈判行动种类、敌人/支援上的 parley 规则与难度修正；缺地点/剧情资产上的通用 ability 通道、失败分支模板、构筑筛选。',
    },
    gaps: [
      '把谈判做成 kind:action + actionKind:parley 的通用能力通道（敌人/地点/剧情资产）',
      '目标合法性与失败分支',
      '构筑「cards with parley」筛选（普雷斯顿）',
      '借机攻击豁免与行动计数覆盖',
    ],
    candidatePrimitives: ['ability(kind:action, actionKind:parley)', 'deckbuilding.filter("parley")'],
  },
  {
    id: 'memento', type: 'primitive', title: 'Memento', titleZh: '遗留记忆', risk: 'medium',
    roadmap: '§3.1 遗留记忆 / §4.1 P2.10 / §5.1 memento',
    keyword: { id: 'memento', ruleId: 'tcuMemento', printed: false },
    evidenceText: '10 个 Memento 记录（剧本日志「Mementos Discovered」）、幕间与 ThePathWindsBeforeYou 的按数量计分。',
    existing: {
      status: 'partial',
      modules: ['src/campaign/campaign-effects.js:572 recordUnion', 'src/campaign/campaign-effects.js:579 recordRemove'],
      note: '记录层已支持 string[]/recordUnion/recordRemove；缺 mementosDiscovered 的记录类型、10 个中文名、发现/划掉面板与数量分支。',
    },
    gaps: ['mementosDiscovered: string[] 与中文名（参考实现只有英文枚举）', '发现/划掉与记录面板', '幕间/结局按数量分支'],
    candidatePrimitives: ['recordUnion("mementosDiscovered")', 'recordRemove("mementosDiscovered")'],
  },
  {
    id: 'watcher', type: 'primitive', title: 'Watcher', titleZh: '看守人', risk: 'medium',
    roadmap: '§3.1 看守人 / §4.1 P2.10 / §5.1 watcher',
    keyword: { id: 'watcher', ruleId: 'tcuWatcher', printed: false },
    evidenceText: '13 张卡面提到 Watcher，跨章出现；YouAreBeingHunted 记录；「不因攻击而横置」等修正。',
    existing: {
      status: 'partial',
      modules: ['src/campaign/campaign-effects.js（record 系列）', 'content/campaigns/thePathToCarcosa/manifest.js flow branch'],
      note: '记录与 flow 分支可用；缺「战役敌人跨章追踪」的生成与修正，也没有公开信息投影约定。',
    },
    gaps: ['按记录生成/回收看守人敌人', '「不因攻击而横置」等修正', '战役面板公开提示（不泄露私有分支）'],
    candidatePrimitives: ['generator from record', 'modifier add:keyword'],
  },
  {
    id: 'storyInvestigator', type: 'primitive', title: 'Story Investigator', titleZh: '序章故事调查员', risk: 'high',
    roadmap: '§3.1 序章故事调查员 / §4.1 P2.6 / §5.1 storyInvestigator / 决策点 D3',
    keyword: { id: 'storyInvestigator', ruleId: 'tcuPrologue', printed: false },
    evidenceText: '05046–05049 四位无牌组调查员；每位玩家选 1 位，少于 4 人时划掉未选者；固定属性与专属设置卡。',
    existing: {
      status: 'missing',
      modules: ['src/deck/availability.js PLAYABLE_INVESTIGATOR_CODES', 'src/engine/setup.js buildInvestigatorsDeck'],
      note: '调查员来自静态可玩清单 + 牌组构建；没有无牌组模式、选人/划掉流程与固定属性入口。',
    },
    gaps: ['无牌库/弃牌堆/抽牌的调查员建局', '选人与划掉未选者（1–4 人）', '固定属性 + 专属设置卡（backText 里的 Setup）', '大厅、存档、观察投影、AI'],
    candidatePrimitives: ['campaign effect storyInvestigators', 'setup no-deck mode'],
  },
  {
    id: 'bonded', type: 'primitive', title: 'Bonded', titleZh: '绑定', risk: 'medium',
    roadmap: '§3.1 绑定 / §4.1 P2.8 / §5.1 bonded',
    keyword: { id: 'bonded', ruleId: 'tcuBonded', printed: true },
    evidenceText: '2 组绑定：圣化之镜/舒缓旋律、密教辞典/鲜血仪式；每组 1 主卡 + 3 份绑定副本。',
    existing: {
      status: 'missing',
      modules: ['src/engine/zones.js（注释提到 bonded，CARD_DESTINATIONS 无该区域）'],
      note: '数据字段 bondedCards/bondedCount 已导入；引擎没有场外绑定集合、检索与洗回。',
    },
    gaps: ['场外绑定集合与检索 3 张', '1 张入手、2 张洗回', '离场收回与牌堆计数不入 30 张', 'UI/观察投影'],
    candidatePrimitives: ['zones: bonded', 'searchBonded'],
  },
  {
    id: 'breach', type: 'primitive', title: 'Breach / Incursion', titleZh: '裂口 / 入侵', risk: 'medium',
    roadmap: '§3.1 裂口 / §4.1 P2.11 / §5.1 breach',
    keyword: { id: 'breach', ruleId: 'tcuBreaches', printed: true },
    evidenceText: '《混沌魔掌》地点/幕上的裂口计数，沿连接传播；骷髅值 = 裂口 + 毁灭。',
    existing: {
      status: 'missing',
      modules: ['src/engine/locations.js（地点毁灭/标记）', 'src/engine/rules-state.js'],
      note: '地点毁灭与标记可用；没有裂口计数器、传播与幕/议程阈值。',
    },
    gaps: ['地点 breaches 增减/上限', '沿连接传播与入侵结算', '骷髅值 = 裂口 + 毁灭', '逐地点标记 UI'],
    candidatePrimitives: ['addBreach/removeBreach', 'locationBreachValue'],
  },
  {
    id: 'hereticMultiface', type: 'primitive', title: 'Heretic Multiface / Banish', titleZh: '异端者多面与放逐', risk: 'high',
    roadmap: '§3.1 异端者多面与放逐 / §4.1 P2.12 / §4.3 逃生口',
    keyword: { id: 'heretic', ruleId: 'tcuHeretics', printed: false },
    evidenceText: '《罪恶报应》6 个异端者 × 2 面（05178a–05178l）；Unfinished Business 可翻面；「不能以任何方式被击败」与「放逐」。',
    existing: {
      status: 'missing',
      modules: ['src/engine/locations.js flipScenarioLocation（地点翻面先例）', 'src/engine/enemies.js'],
      note: '地点翻面有原语，敌人翻面没有；「不能以任何方式被击败」与放逐到胜利区需要新读点。',
    },
    gaps: ['敌人多面/sides 与 flip', '「不能以任何方式被击败」', 'banish → 胜利区', '未了之事威胁区与横置/攻击触发', '存档'],
    candidatePrimitives: ['flipEnemy', 'banishEnemy', 'victoryDisplay'],
  },
  {
    id: 'cosmos', type: 'primitive', title: 'Cosmos Deck / Void', titleZh: '宇宙牌库 / 虚空', risk: 'high',
    roadmap: '§3.1 Cosmos 牌库 / §4.1 P2.13',
    keyword: { id: 'cosmos', ruleId: 'tcuCosmos', printed: false },
    evidenceText: '《黑色王座》：面朝下地点牌库（Cosmos），抽 X 选 1，Void 地点可洗回，在场单位一并搬走。',
    existing: {
      status: 'missing',
      modules: ['src/engine/setup.js setupScenarioDecks（cultistDeck 先例）', 'src/cards/campaign-plugin.js explorationDeck'],
      note: '第二牌堆与探索牌库只是先例，都不是地点牌库；虚空（Void）与虚空格子（empty space）必须分开建模。',
    },
    gaps: ['Cosmos 地点牌库（建堆/抽 X/选 1/洗回）', '地点被洗入时搬移在场单位', 'Void 特性与 empty space 的区分', '存档与投影'],
    candidatePrimitives: ['scenarioDeck("cosmos")', 'shuffleLocationIntoDeck'],
  },
  {
    id: 'brazier', type: 'primitive', title: 'Brazier', titleZh: '火盆', risk: 'medium',
    roadmap: '§3.1 火盆 / §4.1 P2.11',
    keyword: { id: 'brazier', ruleId: 'tcuBraziers', printed: false },
    evidenceText: '《聚合幻灭》17 张卡涉及火盆：点燃/熄灭决定推进哪一版幕。',
    existing: { status: 'missing', modules: ['src/engine/locations.js'], note: '地点没有通用布尔量；点燃/熄灭只能写死单卡。' },
    gaps: ['locationFlag("brazier") 读写', '点燃/熄灭行动与目标条件', '幕推进按火盆分叉', '标记 UI'],
    candidatePrimitives: ['locationFlag("brazier")'],
  },
  {
    id: 'campaignAssetDeck', type: 'primitive', title: 'Campaign Assets in Deck', titleZh: '战役资产入牌组', risk: 'medium',
    roadmap: '§3.1 战役资产入牌组 / §4.1 P2.10',
    keyword: { id: 'campaignAsset', ruleId: 'tcuCampaignAssets', printed: false },
    evidenceText: '机关盒、黑书、四把钥匙：进牌组但不占 30 张，团队控制权与钥匙标记要跨章。',
    existing: {
      status: 'partial',
      modules: ['content/packs/*/manifest.js（战役资产）', 'src/campaign/campaign.js（牌组增删/永久卡）'],
      note: '战役资产与牌组编辑已在；缺「战役卡加入牌组但不占 30 张」与钥匙控制权转移。',
    },
    gaps: ['addCampaignCardToDeck（不洗入）', '钥匙控制权转移与标记', '团队控制与跨章持久化'],
    candidatePrimitives: ['addCampaignCardToDeck', 'keyControl'],
  },
  {
    id: 'unknownLocationDeck', type: 'primitive', title: 'Unknown Location Deck', titleZh: '未知地点牌库', risk: 'medium',
    roadmap: '§3.2 隐秘之名「异次元地点」；§3.1 未列，扫描补登',
    keyword: null,
    evidenceText: '《隐秘之名》05133/05136 的「未知地点牌库」：面朝下地点牌库，揭示后放置入场并建立连接。',
    existing: {
      status: 'partial',
      modules: ['src/cards/campaign-plugin.js（explorationDeck 先例）', 'src/engine/setup.js'],
      note: '探索牌库（explorationDeck）是最接近的先例，但它是 pop/unshift 的探索牌库，没有“未知地点牌库”的建堆与未揭示面入场语义。',
    },
    gaps: ['未知地点牌库建堆（按剧本 set-aside 地点）', '抽顶并以未揭示面放置入场', '连接规则与入场后翻面', '存档与投影'],
    candidatePrimitives: ['scenarioDeck("unknownLocations")', 'drawLocationFromDeck'],
  },
  {
    id: 'hunchDeck', type: 'primitive', title: 'Hunch Deck', titleZh: '直觉牌库', risk: 'medium',
    roadmap: '§2.3（乔·戴蒙德）/ §7.1 M1-A；§3.1 未列，扫描补登',
    keyword: null,
    evidenceText: '05002 乔·戴蒙德：40 张牌组里另挑 11 张洞察事件成「直觉牌库」，每调查阶段揭示顶牌、-2 费可打出、未打出洗回。',
    existing: {
      status: 'missing',
      modules: ['src/engine/setup.js buildInvestigatorsDeck', 'src/engine/moves.js（playCost 修正）'],
      note: '引擎没有第二套调查员牌库，也没有「从直觉牌库打出」的窗口与费用修正。',
    },
    gaps: ['直觉牌库建堆（11 张洞察事件，含 05010）', '调查阶段开始的揭示/减费/洗回', '弃牌堆回底的旧印效果', '观察投影不泄露牌序'],
    candidatePrimitives: ['separateInvestigatorDeck("hunch")', 'window.investigationPhaseStart'],
  },
  {
    id: 'cardsBeneath', type: 'primitive', title: 'Cards Beneath (Diana)', titleZh: '卡牌置于调查员下方', risk: 'medium',
    roadmap: '§2.3（黛安娜）/ §7.1 M1-B；§3.1 未列，扫描补登',
    keyword: null,
    evidenceText: '05004/05013/05015：取消/忽略效果后把牌面朝下置于黛安娜下方，最多 5 张；每张 +1 意志；可从下方打出手牌。',
    existing: {
      status: 'partial',
      modules: ['src/engine/zones.js beneath 区域', 'src/engine/table-decisions.js（起始手牌置于下方）', 'src/engine/card-defs.js'],
      note: 'beneath 区域与「起始手牌放下方」的先例已在；缺黛安娜专属的取消效果窗口、置于调查员卡下方（不是支援）、每阶段限一次。',
    },
    gaps: ['取消/忽略效果窗口', '置于调查员卡下方的存读档形状', '从下方打出/投入的合法性', '观察投影'],
    candidatePrimitives: ['assetBeneath(investigator)', 'window.afterCancel'],
  },
  {
    id: 'openingSetup', type: 'primitive', title: 'Opening Hand Rules', titleZh: '开局与起始手牌', risk: 'medium',
    roadmap: '§3.1 塔罗槽位（开局入手）/ §4.1 P2.9；§3.1 未单列，扫描补登',
    keyword: null,
    evidenceText: '7 张塔罗「在起始手牌则入场」、安娜·卡斯洛同理、The Tower 不能被替换且在手不能投入、黛安娜额外一张起始手牌。',
    existing: {
      status: 'partial',
      modules: ['src/engine/setup.js（permanent 卡开局入场）', 'src/engine/table-decisions.js（起始手牌/调度）'],
      note: '调度与永久卡开局入场已有；没有「开局时若在起始手牌则入场的反应窗口」，也没有 The Tower 的调度禁止与在手投入禁止。',
    },
    gaps: ['开局反应窗口（起始手牌 → 入场）', 'The Tower：不能被替换、在手不能投入', '黛安娜额外起始手牌', 'AI/自动开局顺序'],
    candidatePrimitives: ['openingHand.hook', 'mulligan.lock'],
  },
  {
    id: 'campaignRecords', type: 'primitive', title: 'Campaign Records', titleZh: '战役记录', risk: 'medium',
    roadmap: '§7.6 战役流程与记录 / §4.1 P2.10',
    keyword: null,
    evidenceText: '64 个记录键；MissingPersons / PiecesOfEvidenceWereLeftBehind / MementosDiscovered 等 string[] 与 number 记录。',
    existing: {
      status: 'partial',
      modules: ['src/campaign/campaign-effects.js（record / recordUnion / recordRemove / number）'],
      note: '记录层能力齐；缺 TCU 的 recordTypes/recordLabels 与 64 键对账（参考 Key.hs 64，中文 base.json 63）。',
    },
    gaps: ['64 个键的类型与中文名', 'MementosDiscovered/MissingPersons/WasTakenByTheWatcher 等 string[]', 'PiecesOfEvidenceWereLeftBehind/ThePathWindsBeforeYou number', '缺失译名 TheInvestigatorsReversedTheIncantation'],
    candidatePrimitives: ['recordTypes', 'recordLabels'],
  },
  {
    id: 'chaosBag', type: 'rulebook', title: 'Chaos Bag', titleZh: '混乱袋', risk: 'medium',
    roadmap: '§3.1 混乱袋 / §5.2 规则书 tcuChaos / §7.6',
    keyword: { id: 'chaos', ruleId: 'tcuChaos', printed: false },
    evidenceText: '四难度基础袋均 13 枚（仅 skull×2）；cultist/tablet/elder_thing 由剧本与幕间按分支加入。',
    existing: {
      status: 'reuse',
      modules: ['src/engine/chaos-bag.js', 'src/engine/setup.js setupChaosBag', 'content/campaigns/theForgottenAge/shared.js CHAOS_BAGS'],
      note: '四难度袋与运行时增删已支持；TCU 只需写 shared.js 的 13 枚基础袋与每章 tcu-chaos.js，不新增引擎能力。',
    },
    gaps: ['13 枚基础袋数值对账（不要照静态 16 枚表）', '每章符号取值与增删（含“sealed”只作防御性表述）'],
    candidatePrimitives: [],
  },
]

// ---------------------------------------------------------------------------
// 第 4 步交互（type=interaction → §6）；不拥有卡牌，只登记 UI 缺口
// ---------------------------------------------------------------------------
const INTERACTIONS = [
  { id: 'ui:tarotPick', type: 'interaction', title: '塔罗抽牌/选择', titleZh: '塔罗抽牌/选择', risk: 'high', roadmap: '§6 塔罗抽牌/选择', related: ['tarotDeck'], status: 'missing', note: '新增 pickTarot choice kind；复用 pendingChoice 与 supply-picker 样式；正/逆位、已抽集合、确认/取消。' },
  { id: 'ui:storyInvestigatorPick', type: 'interaction', title: '序章选调查员', titleZh: '序章选调查员', risk: 'high', roadmap: '§6 序章选调查员', related: ['storyInvestigator'], status: 'missing', note: '复用 expeditionLeader/pickSupplies 面板；1–4 人、划掉未选者、无牌组提示。' },
  { id: 'ui:hauntedPrompt', type: 'interaction', title: '闹鬼结算提示', titleZh: '闹鬼结算提示', risk: 'high', roadmap: '§6 闹鬼结算', related: ['haunted'], status: 'missing', note: '复用 choice/pendingChoice；新增「地点闹鬼」提示与来源高亮；单个/多个、顺序、取消、两次、无合法目标。' },
  { id: 'ui:spectralDeck', type: 'interaction', title: '幽灵界面板', titleZh: '幽灵界面板', risk: 'high', roadmap: '§6 幽灵界', related: ['spectral'], status: 'missing', note: '复用 revealLocation 翻面动画与 table-regions；新增第二牌堆面板/幽灵标记；张数、弃牌、翻面、非幽灵地点限制。' },
  { id: 'ui:circleTest', type: 'interaction', title: '阵法检定面板', titleZh: '阵法检定面板', risk: 'high', roadmap: '§6 阵法', related: ['circle'], status: 'missing', note: '复用 legalMoves 动作按钮；新增 2–4 个技能值 + 合计的检定面板。' },
  { id: 'ui:parleyTarget', type: 'interaction', title: '谈判目标', titleZh: '谈判目标', risk: 'medium', roadmap: '§6 谈判', related: ['parley'], status: 'reuse', note: '复用 entityMoves/targetMoves 与 actionKind；补目标/失败/借机攻击提示。' },
  { id: 'ui:campaignRecordPanel', type: 'interaction', title: '记录与标记面板', titleZh: '记录与标记面板', risk: 'medium', roadmap: '§6 遗留记忆/记录、看守人、裂口', related: ['memento', 'watcher', 'breach', 'campaignRecords'], status: 'partial', note: '复用 campaign-records.js（string[] 已能显示）与 placedCardMarkers/doomClockLabel；补中文名、数量分支、裂口标记。' },
  { id: 'ui:tarotSlot', type: 'interaction', title: '塔罗槽位', titleZh: '塔罗槽位', risk: 'low', roadmap: '§6 塔罗槽位', related: ['tarotSlot', 'openingSetup'], status: 'reuse', note: '现有槽位 UI 直接复用；补 1–4 个槽、超槽提示、开局入场。' },
]

// ---------------------------------------------------------------------------
// 卡面规则：英文 + 中文（只扫 text/backText/traits/slots/字段，不扫 flavor）
// ---------------------------------------------------------------------------
const enText = card => [card.text, card.backText].filter(Boolean).join('\n')
const zhText = card => [card.textZh, card.backTextZh].filter(Boolean).join('\n')

const RULES = [
  ['haunted', card => {
    const en = enText(card); const zh = zhText(card)
    if (/haunted\s*[-–—:]/i.test(en) || /闹鬼\s*[-–—:：]/.test(zh)) return 'text:haunted-ability'
    if (/(resolve|trigger)[^.]{0,80}haunted/i.test(en) || /(结算|触发)[^。]{0,40}闹鬼能力/.test(zh)) return 'text:haunted-resolve'
    if (/location is haunted|haunted location/i.test(en) || /地点(是|为)?闹鬼|闹鬼的地点/.test(zh)) return 'text:haunted-state'
    return null
  }],
  ['spectral', card => {
    if ((card.traits || []).includes('Spectral')) return 'trait:Spectral'
    // 英文 spectral/specter/specters 无歧义；中文只认特性写入与「幽灵 + 名词」，
    // 避免把剧情正文里的「那幽灵」「鬼魂」误判成幽灵界机制。
    if (/\bspect(ral|er|ers)\b/i.test(enText(card))) return 'text:spectral'
    if (/\[\[幽灵\]\]|幽灵(地点|遭遇|牌堆|面|敌人|国度|界)/.test(zhText(card))) return 'text:spectral'
    return null
  }],
  ['tarotDeck', card => {
    if (/tarot deck|tarot reading/i.test(enText(card)) || /塔罗牌组|塔罗占卜/.test(zhText(card))) return 'text:tarot-deck'
    return null
  }],
  ['tarotSlot', card => {
    if ((card.slots || []).some(slot => /tarot/i.test(slot))) return 'slots:Tarot'
    if ((card.traits || []).includes('Tarot')) return 'trait:Tarot'
    if (/tarot slots?|additional tarot|extra tarot/i.test(enText(card)) || /额外\s*\d*\s*个?塔罗/.test(zhText(card))) return 'text:extra-tarot-slot'
    return null
  }],
  ['circle', card => {
    const en = enText(card); const zh = zhText(card)
    if (/\[action\][^\n]{0,24}circle\./i.test(en) || /\[行动\][^。]{0,24}阵法/.test(zh)) return 'action:circle'
    if (/circle action|during a circle|阵法行动/i.test(`${en}\n${zh}`)) return 'text:circle-action'
    return null
  }],
  ['parley', card => {
    if (/\bparley/i.test(enText(card)) || /谈判/.test(zhText(card))) return 'text:parley'
    return null
  }],
  ['memento', card => {
    if (/mementos?\b/i.test(enText(card)) || /遗留记忆/.test(zhText(card))) return 'text:memento'
    return null
  }],
  ['watcher', card => {
    if (/watcher/i.test(enText(card)) || /看守人/.test(zhText(card))) return 'text:watcher'
    if (/being hunted|are hunted/i.test(enText(card)) || /被追捕/.test(zhText(card))) return 'text:hunted-record'
    return null
  }],
  ['storyInvestigator', card => {
    if (STORY_INVESTIGATORS.includes(card.code)) return 'code:story-investigator'
    if (STORY_ASSET_CODES.includes(card.code)) return 'code:story-asset-card'
    if (FATE_STORY_CODES.includes(card.code)) return 'code:fate-story'
    // 序章/聚合幻灭四人的专属设置卡与命运卡都按卡号锁定；不再用泛化的 “story asset”
    // 匹配，否则会把机关盒这类剧情支援也算进无牌组调查员机制。
    return null
  }],
  ['bonded', card => {
    if (card.bondedCards || card.bondedTo) return 'field:bonded'
    if (/\bbonded\b/i.test(enText(card)) || /绑定/.test(zhText(card))) return 'text:bonded'
    return null
  }],
  ['breach', card => {
    if (/\bbreach/i.test(enText(card)) || /裂口/.test(zhText(card))) return 'text:breach'
    if (/\bincursion/i.test(enText(card)) || /入侵/.test(zhText(card))) return 'text:incursion'
    return null
  }],
  ['hereticMultiface', card => {
    if (/^05178[a-l]$/.test(card.code)) return 'code:heretic-face'
    // 「异端者的墓地 / Heretics' Graves」是地点名，不是异端者机制；先剔除再匹配。
    const en = enText(card).replace(/Heretics['’] Graves/gi, '')
    const zh = zhText(card).replace(/异端者的墓地/g, '')
    if (/\bheretics?\b/i.test(en) || /异端者/.test(zh)) return 'text:heretic'
    if (/unfinished business/i.test(en) || /未了之事/.test(zh)) return 'text:unfinished-business'
    if (/\bbanish/i.test(en)) return 'text:banish'
    if (card.encounterCode === 'the_wages_of_sin' && /cannot be defeated/i.test(en)) return 'text:invulnerable'
    return null
  }],
  ['cosmos', card => {
    // 中文「宇宙」还要区分「宇宙之秘 / 吞食宇宙」这类剧情与记录名：只认带引号的“宇宙”与「宇宙 -」。
    if (/\bcosmos\b/i.test(enText(card))) return 'text:cosmos'
    if (/[“”‘’"']宇宙[“”‘’"']|宇宙\s*[-–—]|宇宙牌库/.test(zhText(card))) return 'text:cosmos'
    if ((card.traits || []).includes('Void') || /\[\[Void\]\]/i.test(enText(card))) return 'trait:Void'
    return null
  }],
  ['brazier', card => {
    if (/brazier/i.test(enText(card)) || /火盆/.test(zhText(card))) return 'text:brazier'
    return null
  }],
  ['campaignAssetDeck', card => {
    const en = enText(card); const zh = zhText(card)
    if (/puzzle box/i.test(en) || /机关盒/.test(zh)) return 'text:puzzle-box'
    if (/black book/i.test(en) || /黑书/.test(zh)) return 'text:black-book'
    if (/\[skull\][^.]{0,40}key|set-aside key|control[s]? (the|its|1) .{0,20}key/i.test(en) || /钥匙/.test(zh)) return 'text:keys'
    return null
  }],
  ['unknownLocationDeck', card => {
    if (/unknown location/i.test(enText(card)) || /未知地点/.test(zhText(card))) return 'text:unknown-location-deck'
    return null
  }],
  ['hunchDeck', card => {
    if (/hunch deck/i.test(enText(card)) || /直觉牌库/.test(zhText(card))) return 'text:hunch-deck'
    return null
  }],
  ['cardsBeneath', card => {
    if (/beneath (Diana|her)/i.test(enText(card)) || /黛安娜·史丹利(底下|下方)/.test(zhText(card))) return 'text:beneath-diana'
    return null
  }],
  ['openingSetup', card => {
    if (/opening hand/i.test(enText(card)) || /起始手牌/.test(zhText(card))) return 'text:opening-hand'
    return null
  }],
  ['campaignRecords', card => {
    const en = enText(card); const zh = zhText(card)
    if (/campaign log/i.test(en) || /剧本日志/.test(zh)) return 'text:campaign-log'
    if (/missing persons/i.test(en) || /失踪人口/.test(zh)) return 'text:missing-persons'
    if (/pieces? of evidence/i.test(en) || /(遗漏|留下)[^。]{0,12}证据/.test(zh)) return 'text:pieces-of-evidence'
    return null
  }],
  ['chaosBag', card => {
    if (card.type === 'scenario') return 'type:scenario-card'
    if (/chaos bag/i.test(enText(card)) || /混乱袋/.test(zhText(card))) return 'text:chaos-bag'
    return null
  }],
]

// 逐卡例外：正则覆盖不到、但语义上属于某机制的卡（每条都要写理由）。
const OVERRIDES = {
  // 05042 高塔：基础弱点 + 塔罗卡，clues 数据不写 Tarot 槽但语义是塔罗槽位规则的一部分（§2.3）。
  '05042': { tarotSlot: 'weakness+trait:Tarot（§2.3 明确不能排除塔罗槽规则）' },
}

function classify(card) {
  const mechanisms = []
  const evidence = {}
  for (const [id, rule] of RULES) {
    const why = rule(card)
    if (why) { mechanisms.push(id); evidence[id] = why }
  }
  for (const [id, why] of Object.entries(OVERRIDES[card.code] || {})) {
    if (!mechanisms.includes(id)) mechanisms.push(id)
    evidence[id] = `override:${why}`
  }
  const chapter = CHAPTERS.find(item => item.group === card.encounterCode)
  if (chapter) {
    const id = `scenario:${chapter.id}`
    mechanisms.push(id)
    evidence[id] = `encounterCode:${card.encounterCode}`
  } else if (card.encounterCode && SHARED_GROUPS[card.encounterCode]) {
    mechanisms.push('sharedEncounterSets')
    evidence.sharedEncounterSets = `encounterCode:${card.encounterCode}`
  }
  if (!mechanisms.length) { mechanisms.push('standardRules'); evidence.standardRules = 'no-mechanism-token' }
  const entryOrder = ENTRY_IDS
  mechanisms.sort((a, b) => entryOrder.indexOf(a) - entryOrder.indexOf(b))
  return { mechanisms, evidence }
}

// ---------------------------------------------------------------------------
// 组装
// ---------------------------------------------------------------------------
const MEASURE = (() => {
  const codes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}[a-z]?$/.test(code)).sort()
  const main = codes.filter(code => /^05\d{3}$/.test(code))
  const faces = codes.filter(code => /^05\d{3}[a-z]$/.test(code))
  return { codes, main, faces }
})()

const TAROT_SLOT_CODES = MEASURE.codes.filter(code => (ALL_CARDS[code].slots || []).some(slot => /tarot/i.test(slot)))

const ENTRY_IDS = [
  ...CYCLE_MECHANISMS.map(item => item.id),
  ...CHAPTERS.map(chapter => `scenario:${chapter.id}`),
  'sharedEncounterSets',
  'standardRules',
  ...INTERACTIONS.map(item => item.id),
]

const groupCounts = () => {
  const by = (fn) => {
    const out = {}
    for (const code of MEASURE.codes) {
      const key = fn(ALL_CARDS[code])
      out[key] = (out[key] || 0) + 1
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
  }
  return {
    byType: by(card => card.type),
    byPack: by(card => card.pack),
    byClass: by(card => card.klass),
  }
}

function cardRow(code) {
  const card = ALL_CARDS[code]
  const { mechanisms, evidence } = classify(card)
  const special = mechanisms.filter(id => !id.startsWith('scenario:') && id !== 'sharedEncounterSets' && id !== 'standardRules')
  const tier = special.length ? 'mechanism' : mechanisms.includes('standardRules') ? 'standard' : 'content'
  return {
    code,
    face: /[a-z]$/.test(code),
    type: card.type,
    pack: card.pack,
    klass: card.klass,
    name: card.name,
    nameZh: card.nameZh,
    encounterCode: card.encounterCode || null,
    tier,
    mechanisms,
    evidence,
  }
}

async function hashFile(url) {
  return createHash('sha256').update(await readFile(url)).digest('hex')
}

async function listFiles(dirUrl, filter = () => true, prefix = '') {
  const entries = await readdir(dirUrl, { withFileTypes: true })
  const out = []
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await listFiles(new URL(`${entry.name}/`, dirUrl), filter, path))
    else if (entry.isFile() && filter(path)) out.push(path)
  }
  return out
}

async function referenceLock() {
  let available = true
  try { await readdir(REFERENCE_ROOT) } catch { available = false }
  if (!available) {
    return { root: '参考资源/ArkhamHorror-main', available: false, files: [], counts: {}, note: '参考资源不在本机；机制证据只来自 cards-data.js，P1 必须在有来源的机器上补锁。' }
  }
  const groups = [
    { key: 'cardDefs', dir: 'backend/arkham-api/library/Arkham/', deep: true, match: path => /\/CardDefs\/TheCircleUndone\/[^/]+\.hs$/.test(path) },
    { key: 'scenarios', dir: 'backend/arkham-api/library/Arkham/Scenario/Scenarios/TheCircleUndone/', deep: false, match: path => path.endsWith('.hs') },
    { key: 'campaign', dir: 'backend/arkham-api/library/Arkham/Campaigns/TheCircleUndone/', deep: false, match: path => path.endsWith('.hs') },
    { key: 'locales', dir: 'frontend/src/locales/zh/theCircleUndone/', deep: true, match: path => path.endsWith('.json') },
  ]
  const files = []
  const counts = {}
  for (const group of groups) {
    const paths = group.deep
      ? await listFiles(new URL(group.dir, REFERENCE_ROOT), group.match)
      : (await readdir(new URL(group.dir, REFERENCE_ROOT), { withFileTypes: true }))
        .filter(entry => entry.isFile() && group.match(entry.name))
        .map(entry => entry.name).sort()
    counts[group.key] = paths.length
    for (const path of paths) {
      const url = new URL(`${group.dir}${path}`, REFERENCE_ROOT)
      files.push({ path: `${group.dir}${path}`, sha256: await hashFile(url), bytes: (await readFile(url)).length })
    }
  }
  const single = ['frontend/src/arkham/data/theCircleUndone.json', 'frontend/public/cards.json', 'frontend/public/cards_zh-cn.json']
  for (const path of single) {
    const url = new URL(path, REFERENCE_ROOT)
    const buffer = await readFile(url)
    counts[path] = 1
    files.push({ path, sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length })
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1))
  return { root: '参考资源/ArkhamHorror-main', available: true, files, counts }
}

function sourceLock(totalRecords, cardDataSources) {
  return {
    primary: [{
      path: 'games/arkhamhorror/src/cards/cards-data.js',
      records: totalRecords,
      note: '05 号段唯一事实源；扫描只读它，不读 参考资源/ 的卡面文本。',
    }],
    generatedFrom: META.source,
    resourceVersion: META.resourceVersion || null,
    cardDataSources,
  }
}

async function cardDataVerification() {
  const out = []
  for (const source of META.sources || []) {
    try {
      const buffer = await readFile(new URL(source.path, REFERENCE_ROOT))
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      out.push({
        path: source.path,
        records: source.records,
        bytes: buffer.length,
        expectedSha256: source.sha256,
        sha256,
        verified: sha256 === source.sha256,
      })
    } catch (error) {
      out.push({ path: source.path, records: source.records, expectedSha256: source.sha256, verified: false, error: String(error?.message || error) })
    }
  }
  return out
}

// §3.2 里各章的额外提示（扫描新发现，写进对应章节条目的 gaps）。
const CHAPTER_NOTES = {
  disappearanceAtTheTwilightEstate: ['22 张塔罗牌组与塔罗占卜入口由 tarotDeck 条目承接；序章还要保留 4 位调查员的独立引言与塔罗结果文本（§7.5）。'],
  theSecretName: ['未知地点牌库（05133/05136）由 unknownLocationDeck 条目承接，不要当成普通地点。'],
  theWagesOfSin: ['幽灵遭遇牌堆、双面幽灵地点与 6 个异端者由 spectral / hereticMultiface 条目承接。'],
  forTheGreaterGood: ['机关盒、四把钥匙、黑书都由 campaignAssetDeck 条目承接；四把钥匙的团队控制权要跨章。'],
  unionAndDisillusion: ['阵法（05250–05257）由 circle 条目承接；火盆由 brazier 条目承接；4 张命运故事卡由 storyInvestigator 条目承接。'],
  inTheClutchesOfChaos: ['裂口/入侵由 breach 条目承接；双变体子剧本（受诅咒的歌声/宇宙之秘）共用 05286a/05288a，归属 sharedEncounterSets。'],
  beforeTheBlackThrone: ['Cosmos 地点牌库与 Void 地点由 cosmos 条目承接；阿撒托斯终局允许 resolve 逃生口并登记（§4.3）。'],
}

// §3.3「复用清单」的逐条复核：路线图说“已支持”的，这里给出当前代码读点。
const REUSE_CHECKS = [
  { capability: 'parley 行动种类与借机攻击豁免', status: 'partial', evidence: 'src/engine/actions.js、src/engine/moves.js（actionKind parley）；enemyRule.parley / assetRule.parley', note: '行动种类与敌人/支援通道已在；地点/剧情资产通道与构筑筛选未打通（见 parley 条目）。' },
  { capability: '地点/敌人毁灭标记', status: 'verified', evidence: 'src/engine/act-agenda.js、src/engine/enemies.js、doomCards/placeDoomOnCard', note: 'TCU 的毁灭放置、移动、阈值判断可直接复用。' },
  { capability: 'string[] 记录 + recordUnion/recordRemove', status: 'verified', evidence: 'src/campaign/campaign-effects.js:572 recordUnion、:579 recordRemove', note: '记录层能力齐；缺 TCU 的 recordTypes/recordLabels。' },
  { capability: '双面地点 frontCode/backCode + flipScenarioLocation', status: 'verified', evidence: 'src/engine/locations.js:113 flipScenarioLocation；各战役 definition 的 frontCode/backCode', note: '幽灵地点翻面可用；单面幽灵地点仍要在定义里表达。' },
  { capability: 'flow branch/record/includes', status: 'verified', evidence: 'content/campaigns/thePathToCarcosa/manifest.js:75 起', note: '看守人/阵营/结局分支可直接写 flow。' },
  { capability: 'permanent / exceptional / exile', status: 'verified', evidence: 'src/engine/setup.js:202（永久卡开局入场）、src/deck/deckbuilding.js:227（卓越双倍经验）、src/engine/effects.js:250（exileCards）', note: '05011/05320/05196/05236/05237 的静态字段都有读点，但单卡行为仍要 M2 验收。' },
  { capability: 'tarot 槽位容量与额外槽位', status: 'partial', evidence: 'src/engine/engine.js:155 SLOT_CAPACITY；src/engine/modifiers.js:393 slotBonus / add:slot', note: 'add:slot value=tarot 可给额外槽；缺开局入场与构筑合法性。' },
  { capability: '核心/前循环遭遇组', status: 'verified', evidence: 'content/packs/manifests.js:32；content/packs/shared-identities.js；各战役 definition 的 requiredEncounterGroupIds', note: 'chillingCold/ancientEvils/darkCult/rats/strikingFear/lockedDoors/nightgaunts/agentsOfShubNiggurath/theMidnightMasks 均在项目中，TCU 只引用。' },
  { capability: '技能值等于难度即失败（05041 第十三幻象）', status: 'unverified', evidence: 'src/engine/tests.js:764/775 用 `value >= difficulty`；未找到 tie-fail 读点', note: '不在 §3.3 清单内；M2 要么补 modifier，要么在 primitive-plan 登记 escape。' },
]

// 外部/后续循环关键词守望表：出现即说明 05 段混入了本扫描没建模的机制。
// documented = 已核实是“同名不同物”，写入 note；absent = 必须不出现，出现即 gate 失败。
const WATCHLIST = [
  { id: 'swarm', en: /\bswarm\b/i, expect: 'documented', note: 'TCU 只有卡名「鼠群 Swarm of Rats」，不是梦境循环的虫群关键词。' },
  { id: 'seal', en: /\bseal(ed|ing)?\b/i, expect: 'documented', note: '只有 05244 防御性提及「即使被封在卡上」；本轮不新增封印原语。' },
  { id: 'bless', en: /\bblessed\b/i, expect: 'documented', note: '[[Blessed]] 是特性（05130 的查找条件、05237 幸运或是注定的特性），不是祝福标记。' },
  { id: 'curse', en: /\bcurse\b/i, expect: 'documented', note: '[[Curse]] 是特性（05052/05099），不是诅咒标记。' },
  { id: 'myriad', en: /\bmyriad\b/i, expect: 'absent' },
  { id: 'customization', en: /\bcustomization\b/i, expect: 'absent' },
  { id: 'tide', en: /\btide\b/i, expect: 'absent' },
  { id: 'flood', en: /\bflood(ed)?\b/i, expect: 'absent' },
  { id: 'concealed', en: /\bconcealed\b/i, expect: 'absent' },
  { id: 'patrol', en: /\bpatrol\b/i, expect: 'existing', note: '既有 Patrol 关键词。' },
  { id: 'peril', en: /\bperil\b/i, expect: 'existing', note: '既有 Peril 关键词。' },
]

function watchlistAudit() {
  return WATCHLIST.map(item => {
    const codes = MEASURE.codes.filter(code => item.en.test(enText(ALL_CARDS[code])))
    return { id: item.id, expect: item.expect, matches: codes.length, codes: codes.slice(0, 12), note: item.note || null }
  })
}

function buildMechanismEntry(mech, cards) {
  const codes = cards.filter(row => row.mechanisms.includes(mech.id)).map(row => row.code)
  const byType = {}
  for (const code of codes) byType[ALL_CARDS[code].type] = (byType[ALL_CARDS[code].type] || 0) + 1
  const entry = {
    id: mech.id,
    type: mech.type,
    title: mech.title,
    titleZh: mech.titleZh,
    scope: mech.id.startsWith('scenario:') || mech.id === 'sharedEncounterSets' ? 'scenario' : 'cycle',
    risk: mech.risk,
    roadmap: mech.roadmap,
    keyword: mech.keyword || null,
    evidenceText: mech.evidenceText,
    existingImplementation: mech.existing,
    gaps: mech.gaps,
    candidatePrimitives: mech.candidatePrimitives,
    escapeAllowed: mech.type === 'scenario',
    records: codes.length,
    ...(mech.zeroCardJustified ? { zeroCardJustified: mech.zeroCardJustified } : {}),
    byType: Object.fromEntries(Object.entries(byType).sort(([a], [b]) => (a < b ? -1 : 1))),
    codes,
    representativeCodes: codes.slice(0, 8),
  }
  if (mech.id.startsWith('scenario:')) {
    const chapter = CHAPTERS.find(item => `scenario:${item.id}` === mech.id)
    entry.chapter = chapter.id
    entry.chapterCode = chapter.code
    entry.encounterCode = chapter.group
    entry.sourceEvidence = `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheCircleUndone/${chapter.source}`
    entry.mechanismCodes = cards.filter(row => row.mechanisms.includes(mech.id)
      && row.mechanisms.some(id => CYCLE_MECHANISMS.some(item => item.id === id))).map(row => row.code)
  }
  return entry
}

function buildInteractions() {
  return INTERACTIONS.map(interaction => ({
    id: interaction.id,
    type: 'interaction',
    title: interaction.title,
    titleZh: interaction.titleZh,
    scope: 'cycle',
    risk: interaction.risk,
    roadmap: interaction.roadmap,
    related: interaction.related,
    status: interaction.status,
    note: interaction.note,
    records: 0,
    codes: [],
  }))
}

function buildReport(reference, cardSources) {
  const cards = MEASURE.codes.map(cardRow)
  const byCode = new Map(cards.map(row => [row.code, row]))

  const scenarioEntries = CHAPTERS.map(chapter => buildMechanismEntry({
    id: `scenario:${chapter.id}`,
    type: 'scenario',
    title: chapter.name,
    titleZh: chapter.nameZh,
    risk: 'high',
    roadmap: `§3.2 ${chapter.nameZh} / §7.3 M3`,
    keyword: null,
    evidenceText: `该章专属内容与脚本（遭遇组 ${chapter.group}）。`,
    existing: { status: 'missing', modules: [], note: '章节尚未建立（P1 只建占位，P8 实现）；本节只锁定卡牌归属与机制清单。' },
    gaps: ['definition/layout/behavior/index 全部待建（P8）', '逐章 12 项验收（sourceLocked … browserAcceptance）尚无证据', ...(CHAPTER_NOTES[chapter.id] || [])],
    candidatePrimitives: [],
  }, cards))

  const sharedCodes = cards.filter(row => row.mechanisms.includes('sharedEncounterSets')).map(row => row.code)
  const sharedEntry = {
    id: 'sharedEncounterSets',
    type: 'scenario',
    title: 'Shared TCU Encounter Sets', titleZh: '跨章遭遇组', scope: 'scenario', risk: 'medium',
    roadmap: '§3.2 共享机制 / §7.4 分片 / 附录 A',
    keyword: null,
    evidenceText: '12 个 TCU 跨章遭遇组：按 §7.4 由主进程统一落点（shared/ 或 campaign/_shared/），不按 scope 切分。',
    existingImplementation: { status: 'missing', modules: [], note: '落点尚未建立；本条目只锁定归属与组间映射。' },
    gaps: ['21 个 encounterGroupIds 的登记与核心组映射（P1）', '共享组落点与跨章引用（P8）'],
    candidatePrimitives: [],
    records: sharedCodes.length,
    byType: (() => {
      const out = {}
      for (const code of sharedCodes) out[ALL_CARDS[code].type] = (out[ALL_CARDS[code].type] || 0) + 1
      return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
    })(),
    groups: Object.keys(SHARED_GROUPS).map(group => ({
      id: group,
      chapters: SHARED_GROUPS[group],
      codes: sharedCodes.filter(code => ALL_CARDS[code].encounterCode === group),
    })).sort((a, b) => (a.id < b.id ? -1 : 1)),
    codes: sharedCodes,
  }

  const standardCodes = cards.filter(row => row.tier === 'standard').map(row => row.code)
  const standardEntry = {
    id: 'standardRules',
    type: 'baseline',
    title: 'Standard Rules', titleZh: '标准卡（仅用既有原语）', scope: 'cycle', risk: 'low',
    roadmap: '§3.3 复用清单',
    keyword: null,
    evidenceText: '未命中任何新增机制词，且没有章节/遭遇组归属的卡：卡面效果应由既有原语覆盖。',
    existingImplementation: { status: 'reuse', modules: ['src/engine/**', 'src/cards/entries/**'], note: '不是新机制；这里是“已逐卡过文本规则、无新增机制”的显式声明，避免漏卡被静默跳过。' },
    gaps: ['M1/M2 逐卡验收时仍需按单卡实现，不得用本条代替行为验收'],
    candidatePrimitives: [],
    records: standardCodes.length,
    byType: (() => {
      const out = {}
      for (const code of standardCodes) out[ALL_CARDS[code].type] = (out[ALL_CARDS[code].type] || 0) + 1
      return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
    })(),
    codes: standardCodes,
  }

  const mechanisms = [
    ...CYCLE_MECHANISMS.map(mech => buildMechanismEntry(mech, cards)),
    ...scenarioEntries,
    sharedEntry,
    standardEntry,
    ...buildInteractions(),
  ]

  const encounterGroups = Object.keys(SHARED_GROUPS).map(group => ({
    id: group,
    scope: 'shared',
    chapters: SHARED_GROUPS[group],
    codes: MEASURE.codes.filter(code => ALL_CARDS[code].encounterCode === group),
  })).concat(CHAPTERS.map(chapter => ({
    id: chapter.group,
    scope: 'chapter',
    chapter: chapter.id,
    chapters: [chapter.id],
    codes: MEASURE.codes.filter(code => ALL_CARDS[code].encounterCode === chapter.group),
  }))).sort((a, b) => (a.id < b.id ? -1 : 1))

  const unclassified = cards.filter(row => !row.mechanisms.length).map(row => row.code)
  const measured = Object.fromEntries(mechanisms.filter(item => item.type !== 'interaction')
    .map(item => [item.id, item.records]))
  const watchlist = watchlistAudit()
  const watchlistViolations = watchlist.filter(item => item.expect === 'absent' && item.matches > 0)

  const hauntedKeywordCodes = MEASURE.codes.filter(code => /haunted\s*[-–—:]/i.test(enText(ALL_CARDS[code]))
    || /闹鬼\s*[-–—:：]/.test(zhText(ALL_CARDS[code])))
  const hauntedEntry = mechanisms.find(m => m.id === 'haunted')
  const spectralEntry = mechanisms.find(m => m.id === 'spectral')
  const cosmosEntry = mechanisms.find(m => m.id === 'cosmos')
  const crossCheck = [
    { item: 'haunted', roadmap: '中文 40 张 / 英文 54 张卡面含 Haunted/闹鬼', measured: `关键字 ${hauntedKeywordCodes.length} 张 + 仅引用 ${hauntedEntry.records - hauntedKeywordCodes.length} 张 = ${hauntedEntry.records} 张`, note: '英文 54 把地点/敌人名字（Haunted Fields、Witch-Haunted Woods）也算进去了；关键字写法只有 39 张，验收以本扫描的 codes 为准。' },
    { item: 'spectral', roadmap: '70 张卡面/特性命中', measured: `${spectralEntry.records} 张（Spectral 特性 ${MEASURE.codes.filter(code => (ALL_CARDS[code].traits || []).includes('Spectral')).length} 张 + 文本命中）`, note: '中文只认「[[幽灵]] / 幽灵 + 地点·遭遇·牌堆·面·敌人·国度·界」，避免把剧情里的「那幽灵/鬼魂」算进来。' },
    { item: 'tarotDeck', roadmap: '22 张大阿卡纳', measured: '05 卡表 0 张（本条目 codes 为空）', note: '证明塔罗牌组是剧本级牌组，不是 05 卡；数据来源与结果表须进 tarot.js。' },
    { item: 'tarotSlot', roadmap: '7 张玩家卡（05023/05027/05031/05035/05039/05040/05042）', measured: `slots 含 Tarot：${TAROT_SLOT_CODES.length} 张；条目共 ${mechanisms.find(m => m.id === 'tarotSlot').records} 张（多出 05283 安娜的额外槽）`, note: '05042 同时是基础弱点与塔罗；额外槽位来自 05283。' },
    { item: 'circle', roadmap: '15 张中文 / 8 张英文命中（05250–05257）', measured: `${mechanisms.find(m => m.id === 'circle').records} 张，其中「[action]: Circle.」${MEASURE.codes.filter(code => /\[action\][^\n]{0,24}circle\./i.test(enText(ALL_CARDS[code]))).length} 张（05250–05257）`, note: '路线图的 15/8 是关键词命中数，本扫描只把真正发起或引用阵法检定的卡计入。' },
    { item: 'parley', roadmap: '16 张英文 / 19 张中文卡面', measured: `${mechanisms.find(m => m.id === 'parley').records} 张`, note: '含「不能谈判 / 谈判难度修正」等引用卡。' },
    { item: 'memento', roadmap: '10 个 Memento', measured: `05 卡表提到 Memento 的卡 ${mechanisms.find(m => m.id === 'memento').records} 张；10 个 Memento 本身不在 05 卡表`, note: 'Memento 是战役记录集合（参考 Campaigns/TheCircleUndone/Memento.hs），不是卡。' },
    { item: 'watcher', roadmap: '13 张卡面', measured: `${mechanisms.find(m => m.id === 'watcher').records} 张`, note: '含 The Spectral Watcher 敌人与记录引用。' },
    { item: 'bonded', roadmap: '2 组（1 主卡 + 3 副本）', measured: `${mechanisms.find(m => m.id === 'bonded').records} 条卡记录（05313/05314/05316/05317）`, note: '绑定副本不单独成 05 记录，数量由 bondedCount 表达。' },
    { item: 'breach', roadmap: '《混沌魔掌》30 张', measured: `${mechanisms.find(m => m.id === 'breach').records} 张（路线图 30 张 + 05312 的“入侵”引用）`, note: '与路线图口径一致。' },
    { item: 'cosmos', roadmap: '《黑色王座》11 张', measured: `${cosmosEntry.records} 张`, note: '中文只认带引号的“宇宙”与「宇宙 -」，排除「宇宙之秘 / 吞食宇宙」这类剧情与记录名。' },
    { item: 'brazier', roadmap: '《聚合幻灭》17 张', measured: `${mechanisms.find(m => m.id === 'brazier').records} 张`, note: '与路线图一致。' },
    { item: 'unknownLocationDeck', roadmap: '§3.2 隐秘之名「异次元地点」（未给出张数）', measured: `${mechanisms.find(m => m.id === 'unknownLocationDeck').records} 张（05133/05136）`, note: '§3.1 的循环级清单漏了这一套面朝下地点牌库；扫描补登。' },
    { item: 'hereticMultiface', roadmap: '6 个异端者、12 个面', measured: `${mechanisms.find(m => m.id === 'hereticMultiface').records} 张（05178a–l 12 条记录）`, note: '6 个敌人面 + 6 个未了之事面；「Heretics\' Graves」是地点名，已从匹配里剔除。' },
    { item: 'chaosBag', roadmap: '四难度 13 枚基础袋', measured: `${mechanisms.find(m => m.id === 'chaosBag').records} 张（9 张剧本参考卡 + 混乱袋引用）`, note: '袋内数值须由 P1 对参考 ChaosBag.hs 逐档核对，本扫描不解析 Haskell。' },
  ]

  const gaps = [
    '塔罗牌组 22 张不在 05 卡表：需在 tarot.js 数据化，并在剧本 setup 里与 05 章节卡关联（P1/P2.4）。',
    '10 个 Memento 只有英文枚举：中文名须在 P1 补译并写入 recordLabels（§7.6），不得直接显示英文。',
    '中文译名不一致：wos「恶罪报应」vs 遭遇组「罪恶报应」、tsn「隐密之名」vs「隐秘之名」、05326 议程无译名；本扫描保留卡面原文，统一在 P1 决策。',
    '05217 正面缺英文卡图（§1.3）；21 个 b 面在 catalog 标 unresolved 但文件存在——M0 逐卡确认回退，不得手工改名。',
    '9 个核心遭遇组（chillingCold/ancientEvils/darkCult/rats/strikingFear/lockedDoors/nightgaunts/agentsOfShubNiggurath/theMidnightMasks）被引用但 05 段没有卡；P1 必须登记 encounterGroupIds 并映射现有卡号。',
    '「seal（封印标记）」只在 05244 以防御性表述出现（移除混乱袋标记时即使被封在卡上）；本轮不新增封印原语，但 P2 必须确认没有其他卡需要它。',
    '「swarm」只是卡名（鼠群 Swarm of Rats），不是 Swarm 关键词；「bless/curse」在 05 段是特性（[[Blessed]]/[[Curse]]），不是祝福/诅咒标记——不新增机制。',
    '中文「虚空」同时指 Void 特性与 empty space（虚空格子）；Cosmos 机制只按 [[Void]]/Void 特性识别，empty space 归《黑色王座》章节条目。',
    '05042 高塔：clues 卡面没有 Tarot 槽，但 §2.3 要求它留在塔罗槽规则内；已用 override 登记理由，M1/M2 须复核双身份。',
    '05041 第十三幻象的「技能值等于难度即失败」没有确认的既有读点；§3.3 清单未列，扫描标记为 unverified，M2 须补 modifier 或在 primitive-plan 登记 escape。',
    '34 个关联面（b/c/… 码）的「建行为文件 vs 用 card-identity 别名解析」留给 P1 的 scope.json 逐卡决定；本扫描只锁定它们的机制归属，不预建空文件。',
    '6 位正式调查员（05001/05003/05005/05006 等）的主能力暂归 standardRules：文本没有命中 TCU 新机制词，但 M1 逐人验收时若需要新窗口，按 §4.6.3 补原语队列；已单列的只有乔的直觉牌库与黛安娜的下方卡牌。',
    '本扫描只做机制归类，不写卡；M0 的 scope.json、三个 catalog-only 包与审计骨架仍未建立（P1）。',
  ]

  const gate = {
    printedRecords: MEASURE.codes.length,
    mainCodes: MEASURE.main.length,
    linkedFaces: MEASURE.faces.length,
    classified: cards.length - unclassified.length,
    unclassified: unclassified.length,
    everyCardHasEntry: unclassified.length === 0,
    mechanismsWithCards: mechanisms.filter(item => item.type !== 'interaction' && item.records > 0).length,
    interactionEntries: mechanisms.filter(item => item.type === 'interaction').length,
    encounterGroupsInData: encounterGroups.length,
    encounterGroupsExpected: 21,
    coreGroupsReferenced: CORE_GROUPS.length,
    unknownMechanismBlocks: watchlistViolations.length,
    watchlistViolations: watchlistViolations.map(item => item.id),
  }
  gate.tiers = {
    mechanism: cards.filter(row => row.tier === 'mechanism').length,
    content: cards.filter(row => row.tier === 'content').length,
    standard: cards.filter(row => row.tier === 'standard').length,
  }
  gate.zeroCardEntriesJustified = mechanisms.filter(item => item.type !== 'interaction' && item.records === 0)
    .every(item => Boolean(item.zeroCardJustified))
  gate.pass = gate.everyCardHasEntry
    && gate.encounterGroupsInData === gate.encounterGroupsExpected
    && encounterGroups.every(group => group.codes.length > 0)
    && gate.zeroCardEntriesJustified
    && watchlistViolations.length === 0
    && unclassified.length === 0
  if (!gate.pass) throw new Error(`TCU 机制扫描 gate 未通过：${JSON.stringify({
    unclassified, zeroCard: mechanisms.filter(item => item.type !== 'interaction' && item.records === 0).map(item => item.id),
    watchlist: gate.watchlistViolations,
  })}`)

  return {
    schemaVersion: 1,
    cycle: CYCLE.id,
    cycleName: CYCLE.name,
    cycleNameZh: CYCLE.nameZh,
    campaignId: CYCLE.campaignId,
    step: '第 1 步：扫描新增机制',
    milestone: 'P2（扫描新增机制）',
    roadmap: 'games/arkhamhorror/docs/tcu-migration-roadmap.md §3',
    status: 'scanned',
    generatedBy: 'tools/scan-tcu-mechanisms.mjs --write',
    prerequisites: {
      p0: '已完成（2026-10-23）：TFA audit-tfa-scenarios 与 audit-tfa 均退出 0；文档链接体检 0 失效；P0 基线固化在 audit/baseline.json（npm run baseline:check）。',
      p1: '未执行：scope.json / 3 个 catalog-only 包 / 9 章占位 / 审计骨架均不存在；本文件用 cards-data.js 现有 377 条记录做范围，P1 建立后须复核 codes 不漂移。',
    },
    sourceLock: sourceLock(Object.keys(ALL_CARDS).length, cardSources),
    reference,
    scope: {
      printedRecords: MEASURE.codes.length,
      mainCodes: MEASURE.main.length,
      linkedFaces: MEASURE.faces.length,
      ...groupCounts(),
      encounterGroups: encounterGroups.length,
      coreGroups: CORE_GROUPS,
      faces: MEASURE.faces.map(code => {
        const card = ALL_CARDS[code]
        const row = byCode.get(code)
        return {
          code,
          linkedCardCode: card.linkedCardCode || null,
          linkedToCode: card.linkedToCode || null,
          linkedName: card.linkedToName || null,
          type: card.type,
          name: card.name,
          nameZh: card.nameZh,
          mechanisms: row.mechanisms,
        }
      }),
    },
    mechanisms,
    cards,
    encounterGroups,
    measured,
    watchlist,
    reuseChecks: REUSE_CHECKS,
    crossCheck,
    gaps,
    gate,
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const TARGET = new URL('../artifacts/migration/tcu/mechanism-scan.json', import.meta.url)
const REVIEW = new URL('../artifacts/migration/tcu/_review.md', import.meta.url)
const mode = process.argv[2]

if (mode && !['--write', '--check', '--review', '--print', '--summary'].includes(mode)) {
  throw new Error('用法：node tools/scan-tcu-mechanisms.mjs [--write|--check|--review|--print|--summary]')
}

const reference = await referenceLock()
const cardSources = await cardDataVerification()
const report = buildReport(reference, cardSources)
const serialized = JSON.stringify(report, null, 2) + '\n'

if (mode === '--write') {
  await mkdir(new URL('../artifacts/migration/tcu/', import.meta.url), { recursive: true })
  await writeFile(TARGET, serialized)
  console.log(`mechanism-scan: ${report.gate.classified}/${report.gate.printedRecords} classified; `
    + `${report.mechanisms.filter(item => item.type !== 'interaction').length} mechanisms + `
    + `${report.mechanisms.filter(item => item.type === 'interaction').length} interactions; `
    + `gate=${report.gate.pass ? 'pass' : 'FAIL'}; reference=${reference.available ? 'locked' : 'missing'}`)
} else if (mode === '--check') {
  const current = await readFile(TARGET, 'utf8')
  if (current !== serialized) throw new Error('TCU 机制扫描已漂移（cards-data 或参考来源变化），请审阅后 --write')
  console.log(`mechanism-scan: check ok (${report.gate.printedRecords} records)`)
} else if (mode === '--review') {
  await mkdir(new URL('../artifacts/migration/tcu/', import.meta.url), { recursive: true })
  const byTier = { mechanism: [], content: [], standard: [] }
  for (const row of report.cards) byTier[row.tier].push(row)
  const lines = ['# TCU 机制扫描逐卡复核', '']
  for (const tier of ['standard', 'content', 'mechanism']) {
    lines.push(`## ${tier}（${byTier[tier].length}）`, '')
    for (const row of byTier[tier]) {
      const card = ALL_CARDS[row.code]
      const text = zhText(card).replace(/\s+/g, ' ').slice(0, 150)
      lines.push(`- \`${row.code}\` ${row.type} · ${row.pack}${row.encounterCode ? ` · ${row.encounterCode}` : ''} · ${row.nameZh} — **${row.mechanisms.join(', ')}**`)
      if (text) lines.push(`  ${text}`)
    }
    lines.push('')
  }
  await writeFile(REVIEW, lines.join('\n') + '\n')
  console.log(`review: ${JSON.stringify({ mechanism: byTier.mechanism.length, content: byTier.content.length, standard: byTier.standard.length })} -> artifacts/migration/tcu/_review.md`)
} else if (mode === '--print') {
  process.stdout.write(serialized)
} else {
  const g = report.gate
  console.log(`TCU 机制扫描：${g.printedRecords} 条印刷记录（主码 ${g.mainCodes} + 关联面 ${g.linkedFaces}），`
    + `已分类 ${g.classified}，未分类 ${g.unclassified}；机制条目 ${report.mechanisms.filter(item => item.type !== 'interaction').length}，`
    + `交互 ${g.interactionEntries}，遭遇组 ${g.encounterGroupsInData}/${g.encounterGroupsExpected}；gate=${g.pass ? 'pass' : 'FAIL'}`)
  for (const item of report.mechanisms.filter(entry => entry.type !== 'interaction')) {
    console.log(`  ${item.id.padEnd(22)} ${String(item.records).padStart(3)}  ${item.type.padEnd(9)} ${item.existingImplementation.status}`)
  }
  console.log(`artifact: ${mode === '--write' ? 'written' : 'artifacts/migration/tcu/mechanism-scan.json'}${reference.available ? '' : '（参考资源缺失）'}`)
}
