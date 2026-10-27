#!/usr/bin/env node
// 食梦者（The Dream Eaters）M0 第 1 步：机制扫描账本（P2）。
//
//   node tools/scan-tde-mechanisms.mjs --write    生成 artifacts/migration/tde/mechanism-scan.json
//   node tools/scan-tde-mechanisms.mjs --check    复算并与磁盘逐字节比对
//   node tools/scan-tde-mechanisms.mjs --review   逐卡复核清单 → artifacts/migration/tde/_review.md
//   node tools/scan-tde-mechanisms.mjs [--print]  打印 / 摘要
//
// 口径（docs/tde-migration-roadmap.md §4）：
//   · 38 条机制 = keyword 7 + primitive 9 + rulebook 6 + scenario 11 + interaction 2 + content 3；
//     另有 1 条 baseline（standardRules）承接「没有命中任何新机制」的卡，不计入 38；
//   · 每条印刷记录至少落进一个条目（章节组 / 共享组 / standardRules 三选一必有）；
//   · type=primitive 的条目全部进入 P3 原语计划；未知机制默认阻断，watchlist 负责证明“同名不同物”；
//   · 三包 / 章节 / 遭遇组卡数必须与 P1 的 scope.json 一致（prerequisites.p1）。
//
// 扫描引擎照 tools/scan-tcu-mechanisms.mjs（分类 / 分级 / 证据文本匹配 / 门禁计算），
// 机制表、章节表、规则来源表、watchlist、crossCheck 全部按 TDE 卡面与参考实现重写。
// 状态不手写：卡面证据来自 src/cards/cards-data.js 的 text/backText/traits/字段；
// 来源锁只读 参考资源/ArkhamHorror-main（缺失时 gate 不因它失败，另记 reference.available=false）。

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const CYCLE = { id: 'tde', campaignId: 'theDreamEaters', name: 'The Dream Eaters', nameZh: '食梦者' }
const REFERENCE_ROOT = new URL('../../../参考资源/ArkhamHorror-main/', import.meta.url)
const SCOPE_FILE = new URL('../artifacts/migration/tde/scope.json', import.meta.url)
const TARGET = new URL('../artifacts/migration/tde/mechanism-scan.json', import.meta.url)
const REVIEW = new URL('../artifacts/migration/tde/_review.md', import.meta.url)
const ROADMAP = 'games/arkhamhorror/docs/tde-migration-roadmap.md'
const MOTHER = '参考资源/ArkhamHorror-main'

// ---------------------------------------------------------------------------
// 数据表 1：8 章（与 content/campaigns/theDreamEaters/shared.js 对齐）
// ---------------------------------------------------------------------------
const CHAPTERS = [
  { id: 'beyondTheGatesOfSleep', code: '06039', name: 'Beyond the Gates of Sleep', nameZh: '梦境门外', part: 'A', pair: 1, group: 'beyond_the_gates_of_sleep', source: 'BeyondTheGatesOfSleep.hs' },
  { id: 'wakingNightmare', code: '06063', name: 'Waking Nightmare', nameZh: '清醒噩梦', part: 'B', pair: 1, group: 'waking_nightmare', source: 'WakingNightmare.hs' },
  { id: 'theSearchForKadath', code: '06119', name: 'The Search for Kadath', nameZh: '寻觅卡达斯', part: 'A', pair: 2, group: 'the_search_for_kadath', source: 'TheSearchForKadath.hs' },
  { id: 'aThousandShapesOfHorror', code: '06168', name: 'A Thousand Shapes of Horror', nameZh: '万千骇形', part: 'B', pair: 2, group: 'a_thousand_shapes_of_horror', source: 'AThousandShapesOfHorror.hs' },
  { id: 'darkSideOfTheMoon', code: '06206', name: 'Dark Side of the Moon', nameZh: '月之暗面', part: 'A', pair: 3, group: 'dark_side_of_the_moon', source: 'DarkSideOfTheMoon.hs' },
  { id: 'pointOfNoReturn', code: '06247', name: 'Point of No Return', nameZh: '无归之地', part: 'B', pair: 3, group: 'point_of_no_return', source: 'PointOfNoReturn.hs' },
  { id: 'whereTheGodsDwell', code: '06286', name: 'Where the Gods Dwell', nameZh: '神居之所', part: 'A', pair: 4, group: 'where_the_gods_dwell', source: 'WhereTheGodsDwell.hs' },
  { id: 'weaverOfTheCosmos', code: '06333', name: 'Weaver of the Cosmos', nameZh: '编织宇宙', part: 'B', pair: 4, group: 'weaver_of_the_cosmos', source: 'WeaverOfTheCosmos.hs' },
]

// 12 个循环共享遭遇组：键是卡池 encounterCode（snake_case），章节归属来自参考实现的
// gather / gatherAndSetAside（P1 scope.json 的 gatherRefs）。内容侧 camelCase id 由 report 派生。
const SHARED_GROUPS = {
  agents_of_atlach_nacha: ['pointOfNoReturn', 'weaverOfTheCosmos'],
  agents_of_nyarlathotep: ['theSearchForKadath', 'whereTheGodsDwell'],
  corsairs: ['theSearchForKadath', 'darkSideOfTheMoon'],
  creatures_of_the_underworld: ['aThousandShapesOfHorror', 'pointOfNoReturn'],
  descent_into_the_pitch: ['pointOfNoReturn'],
  dreamers_curse: ['darkSideOfTheMoon', 'whereTheGodsDwell'],
  dreamlands: ['theSearchForKadath'],
  merging_realities: ['wakingNightmare', 'aThousandShapesOfHorror'],
  spiders: ['weaverOfTheCosmos'],
  terror_of_the_vale: ['pointOfNoReturn'],
  whispers_of_hypnos: ['wakingNightmare', 'theSearchForKadath', 'pointOfNoReturn', 'whereTheGodsDwell'],
  zoogs: ['theSearchForKadath'],
}

const camelize = value => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

// P1 已确认可用的 8 个跨循环通用组（仓库 encounter-entries/shared/ 目录；DarkCult ↔ pentagram）。
const CORE_GROUPS = ['lockedDoors', 'strikingFear', 'chillingCold', 'ghouls', 'rats', 'ancientEvils', 'nightgaunts', 'darkCult']

// ---------------------------------------------------------------------------
// 数据表 2：38 条机制（不含 standardRules；type 分布 keyword 7 / primitive 9 /
// rulebook 6 / scenario 11 / interaction 2 / content 3，scenario 的 8 章在 buildReport 里生成）
// ---------------------------------------------------------------------------
const CYCLE_MECHANISMS = [
  // ── keyword 7 ────────────────────────────────────────────────────────────
  {
    id: 'myriad', type: 'keyword', title: 'Myriad', titleZh: '多重', risk: 'high',
    roadmap: '§4 关键词三档 / §6 tdeMyriad',
    keyword: { id: 'myriad', ruleId: 'tdeMyriad', printed: true },
    evidenceText: '卡面「Myriad.」；卡池 myriad=true 共 14 张（同名至多 3 张的构筑限制）。',
    existing: { status: 'missing', modules: ['src/deck/deckbuilding.js', 'src/engine/setup.js'], note: '卡池有 myriad/deckLimit 字段与卡文，构筑期没有“同名最多 3 张”的读点；06021/06199/06241–06243 还依赖多张同名同时在场的合体结算。' },
    gaps: ['构筑期同名至多 3 张（deck.myriadLimit）', '多张同名同时在场的结算（06021 缟玛瑙→女王吊坠、06199 三张 10 点）', 'deckLimit 字段与构筑规则的关系待确认'],
    candidatePrimitives: ['deck.myriadLimit'],
  },
  {
    id: 'swarming', type: 'keyword', title: 'Swarming X', titleZh: '蜂拥 X', risk: 'high',
    roadmap: '§4 关键词三档 / §5.1 高风险 1 / §6 tdeSwarming',
    keyword: { id: 'swarming', ruleId: 'tdeSwarming', printed: true },
    evidenceText: '卡面「Swarming X / Swarming X [per_investigator]」；11 个敌人（M0 实测）。',
    existing: { status: 'missing', modules: ['src/engine/enemies.js', 'src/engine/combat.js', 'src/engine/setup.js'], note: '引擎没有蜂拥卡区域、头领/蜂群卡关系、清空才可击败与溢出伤害读点；06147 还需要 [per_investigator] 值。' },
    gaps: ['蜂拥卡区域与 host/swarm 关联', '放置蜂拥卡（牌库顶 / 随头领移动交战）', '清空蜂拥卡前不可击败 + 溢出伤害', 'X 的四种口径：固定 2/1、[per_investigator]、警报等级（06228）、剧本参考卡伤害数（06273）'],
    candidatePrimitives: ['enemy.swarmingValue', 'swarm.placeCards'],
  },
  {
    id: 'veiled', type: 'keyword', title: 'Veiled', titleZh: '掩藏', risk: 'high',
    roadmap: '§4 关键词三档 / §5.1 高风险 5 / §6 tdeVeiled',
    keyword: { id: 'veiled', ruleId: 'tdeVeiled', printed: true },
    evidenceText: '地点卡面「Veiled.」；23 个地点（A2 15 + B3 8）。',
    existing: { status: 'missing', modules: ['src/engine/locations.js', 'src/engine/reveal.js', 'src/engine/scenario-runtime.js'], note: '没有未揭示地点的调查/移动限制、翻面触发背面故事卡与记录门控。' },
    gaps: ['未揭示时不能调查/移动的读点', '翻面触发背面故事卡（A2 有 15 张 b 面）', '记录门控（萨尔纳斯需“知道伊布发生了什么”）', 'B3 的 Veiled 地点翻面后洗回牌堆的位置'],
    candidatePrimitives: ['location.veiled'],
  },
  {
    id: 'researched', type: 'keyword', title: 'Researched', titleZh: '研究完成', risk: 'medium',
    roadmap: '§4 关键词三档 / §6 tdeResearched',
    keyword: { id: 'researched', ruleId: 'tdeResearched', printed: true },
    evidenceText: '卡面「Researched.」；3 张梦境日记（06236/06237/06238）。',
    existing: { status: 'missing', modules: ['src/deck/deckbuilding.js', 'src/campaign/campaign-effects.js'], note: '没有“完成研究后解锁升级”的记录门控读点。' },
    gaps: ['升级条件读记录键（Research 完成）', '同名升级链的构筑可用性'],
    candidatePrimitives: [],
  },
  {
    id: 'alert', type: 'keyword', title: 'Alert', titleZh: '警戒', risk: 'medium',
    roadmap: '§6 已有待确认 3 / alert 复用核心条目',
    keyword: { id: 'alert', ruleId: 'alert', printed: true },
    evidenceText: '卡面「Alert.」；5 个敌人（M0 实测）。',
    existing: { status: 'reuse', modules: ['src/engine/combat.js:614', 'src/engine/card-lookup.js:78'], note: '引擎已有 alert 反击读点；TDE 只需确认与 Swarming/Massive 组合时的攻击归属。' },
    gaps: ['Alert + Swarming：蜂群卡是否也触发警戒反击', 'Alert + Massive 的多次攻击顺序'],
    candidatePrimitives: [],
  },
  {
    id: 'hidden', type: 'keyword', title: 'Hidden', titleZh: '隐私', risk: 'high',
    roadmap: '§6 已有待确认 3 / §7.1 交互 6',
    keyword: { id: 'hidden', ruleId: 'hidden', printed: true },
    evidenceText: '卡面「Hidden.」+「Secretly add … to your hand」；18 张（A4 的 5 形态奈亚拉托提普、10 张诡计、06017/06087–06089）。',
    existing: { status: 'partial', modules: ['src/engine/hidden-rules.js', 'src/engine/ability.js:155'], note: 'TCU 已交付 Hidden（威胁区/手牌）；TDE 的敌人形态（06306–06310）要在手牌里可被攻击/躲避，属新语义。' },
    gaps: ['敌人形态 Hidden 在手牌的战斗/躲避入口', 'Hidden 卡的私有投影（其他座位不可见）', 'Hidden + Peril 的组合（本循环 18 张全部带 Peril）'],
    candidatePrimitives: [],
  },
  {
    id: 'bonded', type: 'keyword', title: 'Bonded', titleZh: '绑定', risk: 'medium',
    roadmap: '§6 已有待确认 3 / D5 规则条目复用',
    keyword: { id: 'bonded', ruleId: 'tdeBonded', printed: true },
    evidenceText: '卡面「Bonded (名称)」；27 条记录（14 张 bondedCards + 13 张 bondedTo）。',
    existing: { status: 'partial', modules: ['src/engine/bonded.js', 'src/engine/api-card.js:12'], note: 'TCU 的 Bonded 以玩家卡场外/在场交换为主；TDE 多了地点绑定（06015a/b 梦境之门）与弱点绑定敌人（06025/06283）。' },
    gaps: ['绑定地点（梦境之门）的放置与随牌组移动', '弱点绑定敌人（Guardian of the Crystallizer / Unbound Beast）的场外实体', '同名 Bonded 组的多副本管理'],
    candidatePrimitives: ['location.placeBondedLocation', 'api.bonded.swap'],
  },

  // ── primitive 9 ──────────────────────────────────────────────────────────
  {
    id: 'campaignPart', type: 'primitive', title: 'Campaign Part Switching', titleZh: '双战役 part 切换', risk: 'high',
    roadmap: '§5.1 原语 1 / §7.2 双战役架构',
    keyword: null,
    evidenceText: '开局四种玩法（singleA/singleB/pick/parallel）与切 part；卡面不承载，属战役结构。',
    existing: { status: 'missing', modules: ['src/campaign/campaign.js', 'src/engine/save-migration.js'], note: '状态里没有 mode/currentPart/activeParts；parity 依赖 flow 与 save-migration 一起改。' },
    gaps: ['campaign.mode / currentPart / activeParts 状态与 schema 7→8', '切 part 五步（存快照/载入/带过进度/换玩家）', 'feature gate 与并行容器（D8-C）'],
    candidatePrimitives: ['campaign.setPart'],
    zeroCardJustified: '战役结构原语：四模式与切 part 由开局与 flow 驱动，没有对应的卡面文字。',
  },
  {
    id: 'partRecord', type: 'primitive', title: 'Part-Scoped Records', titleZh: '按线隔离的战役记录', risk: 'high',
    roadmap: '§5.1 原语 2 / §7.2.2 记录隔离',
    keyword: null,
    evidenceText: '卡面「Campaign Log」引用与记录写入（12 张）。',
    existing: { status: 'partial', modules: ['src/campaign/campaign-effects.js', 'src/cards/campaign-view.js'], note: '记录层（record/recordUnion/recordRemove）已存在；缺按 part 隔离与跨线写入（recordInPart/partRecord）。' },
    gaps: ['55 键记录按 part 隔离', '跨线写入/勾销（recordInPart）', 'campaignView 同时脱敏活动线与 parts'],
    candidatePrimitives: ['campaign.recordInPart', 'campaign.partRecord'],
  },
  {
    id: 'seatPartMap', type: 'primitive', title: 'Room Seat to Lane Seat', titleZh: '房间座位↔线内座位映射', risk: 'high',
    roadmap: '§5.1 原语 3 / §7.2.2 映射边界',
    keyword: null,
    evidenceText: '座位映射是运行时契约，卡面无文字；由 seatParts 派生。',
    existing: { status: 'missing', modules: ['src/engine/engine.js', 'src/engine/hub.js'], note: '引擎只接受连续座位；没有 roomSeat↔laneSeat 的边界转换。' },
    gaps: ['seatParts → laneSeat 的确定性派生', '非连续房间座位（room 0/2 → A 线 lane 0/1）', '人数缩放只算本线'],
    candidatePrimitives: ['campaign.seatPartMap'],
    zeroCardJustified: '座位映射是运行时契约（roomSeat↔laneSeat），没有任何卡面证据。',
  },
  {
    id: 'multiPartChaosBag', type: 'primitive', title: 'Two-Lane Chaos Bags', titleZh: '两袋混乱袋', risk: 'high',
    roadmap: '§5.2 chaosBag.multiPart / §7.2.2 混乱袋',
    keyword: null,
    evidenceText: '双线各自一袋混乱袋；卡面「Chaos Bag」引用 7 张。',
    existing: { status: 'partial', modules: ['src/engine/chaos-bag.js', 'src/campaign/campaign-effects.js'], note: '单袋读点齐全；没有两袋互换与跨线同时增删（mutateBothBags）。' },
    gaps: ['parts[part].chaosBag 与 state.chaosBag 互换', '两袋同时增删（AddChaosToken 的跨线等价物）', '逐章符号表按 part 生效'],
    candidatePrimitives: ['chaosBag.multiPart'],
  },
  {
    id: 'epilogueMatrix', type: 'primitive', title: 'Epilogue Matrix', titleZh: '16 段结局矩阵', risk: 'high',
    roadmap: '§5.2 campaign.epilogueMatrix / §3.4 幕间与尾声',
    keyword: null,
    evidenceText: 'A4 的 4 种结果 × B4 的 4 种结果 = 16 段尾声；卡面不承载结局矩阵。',
    existing: { status: 'missing', modules: ['src/campaign/campaign-flow.js', 'src/campaign/story.js'], note: 'endings 只按单条 record 匹配；没有两线记录矩阵。' },
    gaps: ['16 段矩阵数据（正文属 P8-T 自译）', '按两线 8 条记录选 1/16', '特殊尾声（brokeTheLawOfUlthar）'],
    candidatePrimitives: ['campaign.epilogueMatrix'],
    zeroCardJustified: '结局矩阵是战役级数据（A4×B4 两线记录），卡面无证据。',
  },
  {
    id: 'tokenBag', type: 'primitive', title: 'Infestation Token Bag', titleZh: '蛛群滋生袋', risk: 'high',
    roadmap: '§5.1 原语 6 / §7.1 交互 4',
    keyword: null,
    evidenceText: 'B1 蛛群滋生袋：独立 token 袋 + infestation test（10 张卡面引用）。',
    existing: { status: 'missing', modules: ['src/engine/chaos-bag.js', 'src/engine/scenario-runtime.js'], note: '只有混乱袋；没有独立 token 袋容器与 infestation 状态。' },
    gaps: ['独立 token 袋容器（与混乱袋语义不同）', '揭示/放回/计数', 'infested location 状态与遭遇牌库替换（护工→蛛群）'],
    candidatePrimitives: ['tokenBag.create', 'tokenBag.reveal', 'tokenBag.add'],
  },
  {
    id: 'alarmLevel', type: 'primitive', title: 'Alarm Level', titleZh: '警报等级', risk: 'high',
    roadmap: '§5.1 原语 7 / §7.1 交互 5',
    keyword: null,
    evidenceText: 'A3 警报等级 0–5+：卡面 20 处引用（raise/reduce/highest level）。',
    existing: { status: 'missing', modules: ['src/engine/stats.js', 'src/engine/modifiers.js', 'src/cards/campaign-view.js'], note: '没有按调查员的计数值与“5 以上”判定；只有通用 token 计数。' },
    gaps: ['按调查员的计数值（非全桌）', '0–5+ 上限与“5 或更高”判定（06223 白船）', '由警报等级驱动的敌人数值（06227/06228）'],
    candidatePrimitives: ['counter.investigator', 'window.afterAlarmRaised'],
  },
  {
    id: 'verticalChain', type: 'primitive', title: 'Vertical Location Chain', titleZh: '纵向地点链', risk: 'medium',
    roadmap: '§5.2 location.verticalChain / §7.1 交互 9',
    keyword: null,
    evidenceText: 'B2 神秘阶梯 06183–06188 纵向链 + B4 大网地点堆叠。',
    existing: { status: 'missing', modules: ['src/engine/locations.js', 'web/table-layout.js'], note: '布局只有二维连接；没有“上/下”纵向位置与堆叠顺序。' },
    gaps: ['纵向位置链的布局与连接（上/下）', '堆叠顺序改变时的位置编号', '复用既有布局变量，不新增循环专属布局'],
    candidatePrimitives: ['location.verticalChain'],
  },
  {
    id: 'dreamGate', type: 'primitive', title: 'Dream-Gate (Bonded Location)', titleZh: '梦境之门（绑定地点）', risk: 'medium',
    roadmap: '§5.2 location.placeBondedLocation / §6 tdeDreamGate',
    keyword: null,
    evidenceText: '06015a/b 梦境之门 + 06013 门之匣 / 06014 脱离现实（Bonded 地点）。',
    existing: { status: 'missing', modules: ['src/engine/bonded.js', 'src/engine/locations.js'], note: 'Bonded 只处理玩家卡场外实体；没有地点型绑定卡。' },
    gaps: ['绑定地点的放置与随牌组移动', '梦境之门入场与门之匣的联动', '地点型 Bonded 的观察投影'],
    candidatePrimitives: ['location.placeBondedLocation'],
  },

  // ── rulebook 6 ───────────────────────────────────────────────────────────
  {
    id: 'tdeCampaign', type: 'rulebook', title: 'Campaign Structure', titleZh: '战役结构（双战役/四模式）', risk: 'medium',
    roadmap: '§6 规则书 16 条 / tdeCampaign',
    keyword: null,
    evidenceText: '双战役结构、四种开局玩法、每座位一套牌组；规则书条目从战役层取材，卡面不承载。',
    existing: { status: 'missing', modules: ['web/rulebook-data.js'], note: '规则书没有 TDE 条目；正文依赖 P8-T 自译。' },
    gaps: ['tdeCampaign 条目（双战役/四模式/每座位一套）', '与 §1.4.1 的四种开局口径一致'],
    candidatePrimitives: [],
    zeroCardJustified: '战役结构是规则书内容，卡面不承载（16 条规则书条目的入口）。',
  },
  {
    id: 'tdeDreamQuest', type: 'rulebook', title: 'The Dream-Quest', titleZh: '梦寻（A 线）', risk: 'medium',
    roadmap: '§6 规则书 / tdeDreamQuest',
    keyword: null,
    evidenceText: 'A 线 4 章（06039/06119/06206/06286）与逐章符号表。',
    existing: { status: 'missing', modules: ['web/rulebook-data.js'], note: '无 A 线条目。' },
    gaps: ['tdeDreamQuest 条目', 'A 线逐章规则与符号表汇总'],
    candidatePrimitives: [],
  },
  {
    id: 'tdeWebOfDreams', type: 'rulebook', title: 'The Web of Dreams', titleZh: '梦网（B 线）', risk: 'medium',
    roadmap: '§6 规则书 / tdeWebOfDreams',
    keyword: null,
    evidenceText: 'B 线 4 章（06063/06168/06247/06333）与逐章符号表。',
    existing: { status: 'missing', modules: ['web/rulebook-data.js'], note: '无 B 线条目。' },
    gaps: ['tdeWebOfDreams 条目', 'B 线逐章规则与符号表汇总'],
    candidatePrimitives: [],
  },
  {
    id: 'tdeChaos', type: 'rulebook', title: 'Chaos Tokens', titleZh: '混乱符号（两袋）', risk: 'medium',
    roadmap: '§6 规则书 / tdeChaos / §1.4 逐线袋',
    keyword: null,
    evidenceText: '逐章混乱符号表：8 张剧本参考卡的 Easy/Standard 与 Hard/Expert 段落。',
    existing: { status: 'partial', modules: ['src/engine/chaos-bag.js', 'web/rulebook-data.js'], note: '单袋符号表机制在；两袋与逐章符号表未登记。' },
    gaps: ['tdeChaos 条目（两袋 + 逐章符号表）', '符号结算顺序与“黑猫”提示文本'],
    candidatePrimitives: [],
  },
  {
    id: 'tdeRecords', type: 'rulebook', title: 'Campaign Records', titleZh: '战役记录（55 键）', risk: 'medium',
    roadmap: '§6 规则书 / tdeRecords / §7.2.2 记录隔离',
    keyword: null,
    evidenceText: '55 个记录键（参考实现 Campaigns/TheDreamEaters/Key.hs）与中文标签；卡面不承载键名清单。',
    existing: { status: 'missing', modules: ['content/campaigns/theDreamEaters/record-labels.js'], note: '记录键与中文标签属 P8 数据；规则书尚无 tdeRecords 条目。' },
    gaps: ['55 键清单 + 中文标签（P8）', 'recordTypes 类型口径（boolean/number/string[]）'],
    candidatePrimitives: [],
    zeroCardJustified: '记录键清单在参考实现 Key.hs 与 P8 数据文件里，卡面只有零散 Campaign Log 引用（已归 partRecord）。',
  },
  {
    id: 'tdeEpilogue', type: 'rulebook', title: 'Epilogue', titleZh: '尾声（16 段）', risk: 'medium',
    roadmap: '§6 规则书 / tdeEpilogue / §3.4 尾声',
    keyword: null,
    evidenceText: '16 段尾声的判定与叙事；正文属 P8-T 自译，卡面不承载。',
    existing: { status: 'missing', modules: ['content/campaigns/theDreamEaters/dual-story.js'], note: '无尾声数据与条目。' },
    gaps: ['tdeEpilogue 条目', '未触发分支不泄露（投影门禁）'],
    candidatePrimitives: [],
    zeroCardJustified: '尾声是战役结局文本（P8-T 自译），卡面没有对应文字。',
  },

  // ── content 3 ────────────────────────────────────────────────────────────
  {
    id: 'storyAssets', type: 'content', title: 'Story Assets', titleZh: '剧情支援', risk: 'medium',
    roadmap: '§5.2 复用 campaign.awardStoryCard / §8.3 剧情支援入队离场',
    keyword: null,
    evidenceText: '剧情支援入队/离场：8 张带 encounterCode 的资产（06059/06079/06080/06144/06189/06224/06225/06266）+ 3 处「story asset」引用（06210/06223/06251）。',
    existing: { status: 'partial', modules: ['src/engine/setup.js', 'src/campaign/campaign-effects.js'], note: '既有 campaign.awardStoryCard 可复用；跨章携带与牌组外实体未打通。' },
    gaps: ['剧情支援的入队/离场流程', '跨章携带与牌组外实体', '中文名与规则书 tdeStoryAssets 条目'],
    candidatePrimitives: [],
  },
  {
    id: 'achievements', type: 'content', title: 'Achievements', titleZh: '成就', risk: 'low',
    roadmap: '§4 战役级机制 / 决策 D4',
    keyword: null,
    evidenceText: '成就默认 out-of-scope（决策 D4 未改口径）；卡面无成就文字。',
    existing: { status: 'missing', modules: ['audit/tde-migration.json'], note: '未实现，也不在本轮范围（除非 D4 改口径）。' },
    gaps: ['是否纳入本轮（默认不纳入）', '纳入时的账本与浏览器证据'],
    candidatePrimitives: [],
    zeroCardJustified: '成就默认 out-of-scope（D4），没有卡面或规则书证据。',
  },
  {
    id: 'campaignLabels', type: 'content', title: 'Campaign Log Labels', titleZh: '记录与剧情标签', risk: 'medium',
    roadmap: '§8.5 自译批次 00 / record-labels.js',
    keyword: null,
    evidenceText: '55 个记录键的中文标签与剧情段标签（参考 zh campaignLog.json 副本 + 自译术语表）。',
    existing: { status: 'partial', modules: ['content/campaigns/theDreamEaters/record-labels.js'], note: '全局中文副本可用；TDE 专属标签与自译口径未建。' },
    gaps: ['中文标签与自译口径（不得当作官方中文）', '与 recordTypes 一一对应'],
    candidatePrimitives: [],
    zeroCardJustified: '标签是文案数据（P8-T 自译），卡面不承载键名清单。',
  },

  // ── scenario extra 2（8 章由 buildReport 生成）──────────────────────────
  {
    id: 'locationDoom', type: 'scenario', title: 'Location Doom', titleZh: '地点毁灭', risk: 'medium',
    roadmap: '§5.2 location.doom / §7.1 交互 9',
    keyword: null,
    evidenceText: 'B4 大网地点毁灭：大网地点放毁灭、毁灭数驱动剧本参考卡 [skull]（7 张）。',
    existing: { status: 'partial', modules: ['src/engine/act-agenda.js', 'src/engine/locations.js'], note: '毁灭放置与阈值判断可复用（TCU）；地点被毁后的连接与放置未实现。' },
    gaps: ['地点毁灭与 agenda 阈值', '地点被毁后的连接重排与在场卡处理', '观察投影里的地点毁灭计数'],
    candidatePrimitives: ['location.doom'],
  },
  {
    id: 'signsOfTheGods', type: 'scenario', title: 'Signs of the Gods', titleZh: '神迹计数（A2）', risk: 'medium',
    roadmap: '§5.2 scenario.markerCount / §7.1 交互 8',
    keyword: null,
    evidenceText: 'A2 神迹计数：8 张背面故事卡「You have uncovered a Sign of the Gods」。',
    existing: { status: 'missing', modules: ['src/engine/scenario-runtime.js', 'src/cards/campaign-view.js'], note: '没有剧本参考卡旁的计数器与由它驱动的符号（06119 [skull]: -X）。' },
    gaps: ['神迹计数（scenario.markerCount）', '计数驱动剧本参考卡符号与 UI 显示'],
    candidatePrimitives: ['scenario.markerCount'],
  },
]

// 交互（roadmap §7.1 的 10 条里，P2 只登记纯开局交互的 2 条）
const INTERACTIONS = [
  {
    id: 'ui:modeSelection', type: 'interaction', title: 'Mode Selection', titleZh: '开局四选项', risk: 'high',
    roadmap: '§7.1 交互 1 / §1.4.1', related: ['campaignPart', 'seatPartMap'], status: 'missing',
    note: '单线 A / 单线 B / 并行双线 / 分选双线；奇数人数禁用并行并给原因；1 人只保留两个单线。',
  },
  {
    id: 'ui:laneDeckSelection', type: 'interaction', title: 'Lane Deck Selection', titleZh: '按线选人/选牌组', risk: 'high',
    roadmap: '§7.1 交互 2 / §1.4.1', related: ['seatPartMap', 'campaignPart'], status: 'missing',
    note: '每个房间座位只走一次选人/构筑；跨线重复调查员校验；缺牌组阻塞开局并给原因，不静默待机。',
  },
]

// ---------------------------------------------------------------------------
// 卡面规则：先看字段，再看 text/backText（不扫 flavor）；每条都要能对中文复核
// ---------------------------------------------------------------------------
const frontText = card => String(card.text || '').trim()
const enText = card => [card.text, card.backText].filter(Boolean).join('\n')
const zhText = card => [card.textZh, card.backTextZh].filter(Boolean).join('\n')
const anyText = card => `${enText(card)}\n${zhText(card)}`

const RULES = [
  // keyword 7
  ['myriad', card => (card.myriad === true ? 'field:myriad' : null)],
  ['swarming', card => (card.type === 'enemy' && /\bswarming\s*([0-9]|x\b|\[per_investigator\])/i.test(enText(card)) ? 'keyword:swarming' : null)],
  ['veiled', card => (card.type === 'location' && /\bveiled\./i.test(frontText(card)) ? 'keyword:veiled' : null)],
  ['researched', card => (/^researched\./i.test(frontText(card)) ? 'keyword:researched' : null)],
  ['alert', card => (card.type === 'enemy' && /\balert\./i.test(enText(card)) ? 'keyword:alert' : null)],
  ['hidden', card => {
    const en = enText(card)
    // 关键字本体：卡面以「Hidden.」列关键词，且带「Secretly add … to your hand」。
    if (/\bhidden\./i.test(en) && /secretly add .{0,80}to your hand/i.test(en)) return 'keyword:hidden'
    // 引用卡：09293/09299 这类提到 hidden card / hidden keyword 的剧本卡也算（不新增机制，但要有证据）。
    if (/hidden card|hidden keyword/i.test(en)) return 'text:hidden-reference'
    return null
  }],
  ['bonded', card => (/\bbonded\s*\(/i.test(enText(card)) || card.bondedCards || card.bondedTo ? 'keyword:bonded' : null)],
  // primitive 9
  ['partRecord', card => (/campaign log/i.test(enText(card)) ? 'text:campaign-log' : null)],
  ['multiPartChaosBag', card => (/chaos bag/i.test(enText(card)) ? 'text:chaos-bag' : null)],
  ['tokenBag', card => (/infestation/i.test(enText(card)) ? 'text:infestation' : null)],
  ['alarmLevel', card => (/\balarm level\b/i.test(enText(card)) ? 'text:alarm-level' : null)],
  ['verticalChain', card => (/mysterious stairs|great web|above and below/i.test(`${card.name || ''}\n${enText(card)}`) ? 'text:vertical-chain' : null)],
  ['dreamGate', card => (/dream[- ]gate/i.test(enText(card)) ? 'text:dream-gate' : null)],
  // rulebook 6
  ['tdeChaos', card => (card.type === 'scenario' ? 'type:scenario-reference-card' : null)],
  ['tdeDreamQuest', card => (CHAPTERS.some(chapter => chapter.part === 'A' && chapter.code === card.code) ? 'code:dream-quest-chapter' : null)],
  ['tdeWebOfDreams', card => (CHAPTERS.some(chapter => chapter.part === 'B' && chapter.code === card.code) ? 'code:web-of-dreams-chapter' : null)],
  // content 3
  ['storyAssets', card => (card.type === 'asset' && card.encounterCode ? 'type:story-asset-with-encounter-code' : null)],
  ['campaignLabels', card => null],
  // scenario extra 2
  ['locationDoom', card => (/doom on (this|your|that|a) location|doom on .{0,20}location|amount of doom on a location/i.test(enText(card)) ? 'text:location-doom' : null)],
  ['signsOfTheGods', card => (/sign of the gods/i.test(enText(card)) ? 'text:signs-of-the-gods' : null)],
]

// 逐卡例外：正则覆盖不到、但语义上属于某机制的卡（每条都要写理由）。
const OVERRIDES = {
  // 06318「Myriad Forms」是诡计卡名含 Myriad，不是 Myriad 关键字；已由 /^Myriad\./ 排除，这里只登记证据。
  '06210': { storyAssets: '文本提到 story asset（被俘开场携带）' },
  '06223': { storyAssets: '文本提到 story asset（白船上的剧情支援）' },
  '06251': { storyAssets: '文本提到 story asset（漆黑之海的剧情支援）' },
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
    mechanisms.push(`scenario:${chapter.id}`)
    evidence[`scenario:${chapter.id}`] = `encounterCode:${card.encounterCode}`
  } else if (card.encounterCode && SHARED_GROUPS[card.encounterCode]) {
    mechanisms.push('sharedEncounterSets')
    evidence.sharedEncounterSets = `encounterCode:${card.encounterCode}`
  }
  if (!mechanisms.length) { mechanisms.push('standardRules'); evidence.standardRules = 'no-mechanism-token' }
  mechanisms.sort((a, b) => ENTRY_IDS.indexOf(a) - ENTRY_IDS.indexOf(b))
  return { mechanisms, evidence }
}

// ---------------------------------------------------------------------------
// 组装
// ---------------------------------------------------------------------------
const MEASURE = (() => {
  const codes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}[a-z]?$/.test(code)).sort()
  return { codes, main: codes.filter(code => /^06\d{3}$/.test(code)), faces: codes.filter(code => /^06\d{3}[a-z]$/.test(code)) }
})()

const ENTRY_IDS = [
  ...CYCLE_MECHANISMS.map(item => item.id),
  ...CHAPTERS.map(chapter => `scenario:${chapter.id}`),
  'sharedEncounterSets',
  'standardRules',
  ...INTERACTIONS.map(item => item.id),
]

const groupCounts = () => {
  const by = fn => {
    const out = {}
    for (const code of MEASURE.codes) {
      const key = fn(ALL_CARDS[code]) || 'none'
      out[key] = (out[key] || 0) + 1
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
  }
  return { byType: by(card => card.type), byPack: by(card => card.pack), byClass: by(card => card.klass) }
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

async function hashUrl(url) {
  const buffer = await readFile(url)
  return { sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length }
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
  try { await readdir(REFERENCE_ROOT) } catch {
    return {
      root: MOTHER, available: false, files: [], counts: {},
      note: '参考资源不在本机：机制证据只来自 cards-data.js；在有来源的机器上重跑 --write 后 --check 才为绿。',
    }
  }
  const groups = [
    { key: 'cardDefs', dir: 'backend/arkham-api/library/Arkham/', deep: true, match: path => /\/CardDefs\/TheDreamEaters\/[^/]+\.hs$/.test(path) },
    { key: 'scenarios', dir: 'backend/arkham-api/library/Arkham/Scenario/Scenarios/TheDreamEaters/', deep: false, match: path => path.endsWith('.hs') },
    { key: 'campaign', dir: 'backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/', deep: false, match: path => path.endsWith('.hs') },
    { key: 'campaignFlow', dir: 'backend/arkham-api/library/Arkham/Campaign/Campaigns/', deep: false, match: path => path === 'TheDreamEaters.hs' },
    { key: 'localesZh', dir: 'frontend/src/locales/zh/theDreamEaters/', deep: true, match: path => path.endsWith('.json') },
    { key: 'localesEn', dir: 'frontend/src/locales/en/theDreamEaters/', deep: true, match: path => path.endsWith('.json') },
  ]
  const files = []
  const counts = {}
  for (const group of groups) {
    const paths = group.deep
      ? await listFiles(new URL(group.dir, REFERENCE_ROOT), group.match)
      : (await readdir(new URL(group.dir, REFERENCE_ROOT), { withFileTypes: true }))
        .filter(entry => entry.isFile() && group.match(entry.name)).map(entry => entry.name).sort()
    counts[group.key] = paths.length
    for (const path of paths) {
      const url = new URL(`${group.dir}${path}`, REFERENCE_ROOT)
      files.push({ path: `${group.dir}${path}`, ...await hashUrl(url) })
    }
  }
  for (const path of ['frontend/public/cards.json', 'frontend/public/cards_zh-cn.json', 'frontend/public/cards_en.json']) {
    const url = new URL(path, REFERENCE_ROOT)
    counts[path] = 1
    files.push({ path, ...await hashUrl(url) })
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1))
  return { root: MOTHER, available: true, files, counts }
}

// §4 各章额外提示（扫描发现，写进章节条目的 gaps）
const CHAPTER_NOTES = {
  beyondTheGatesOfSleep: ['14 种梦境 setup 与「幕 1–3 神话阶段不抽遭遇卡」要在 definition/layout 里表达。', '参考实现没有 gather Set.*（R8 pending）：遭遇牌库只能用规则书 setup 文本对齐。'],
  wakingNightmare: ['蛛群滋生袋由 tokenBag 条目承接；护工→蛛群替换与 infested location 状态同条目。', 'Stairwell / Basement Door 是被放入的 set-aside 地点，不是普通连接。'],
  theSearchForKadath: ['15 张 Veiled 地点 + 15 张 b 面故事卡由 veiled 条目承接；4 区域切换与神迹计数另见 signsOfTheGods。', '被俘记录（06119 的 Campaign Log 判定）由 partRecord 承接。'],
  aThousandShapesOfHorror: ['183–188 神秘阶梯纵向链由 verticalChain 承接；随机门分组与被送往阁楼属章节脚本。', 'The Unnamable 不可击败、需按条件削弱，属单卡行为。'],
  darkSideOfTheMoon: ['警报等级 0–5+ 由 alarmLevel 条目承接（20 处引用）；5 或更高不能进白船。', '被俘开场与“从储物舱脱身”在 setup 脚本里表达。'],
  pointOfNoReturn: ['漆黑之海 8 张 Veiled 地点翻面后洗回牌堆，由 veiled 条目承接。', '剧本参考卡的伤害数即“桥梁/穿越进度”，由 scenario.markerCount 承接（见 signsOfTheGods 的通用计数）。'],
  whereTheGodsDwell: ['奈亚拉托提普 5 形态是带 Hidden 的敌人卡（06306–06310），由 hidden 条目承接。', '6 塔 × 4 低语与 act 5 真形生命属章节脚本。'],
  weaverOfTheCosmos: ['大网纵向堆叠由 verticalChain 承接；地点毁灭与 [skull] 由 locationDoom 承接。', '阿特拉克·纳克亚旋转、四腿 Massive 与地点毁灭后的连接重排属章节脚本。'],
}

// §3.3 复用清单的逐条复核
const REUSE_CHECKS = [
  { capability: 'parley 行动种类', status: 'verified', evidence: 'src/engine/parley.js、src/engine/actions.js（actionKind parley）', note: 'TDE 的 4 张谈判卡可直接用；地点/剧情资产通道见 storyAssets。' },
  { capability: 'Alert 关键字', status: 'verified', evidence: 'src/engine/combat.js:614、src/engine/card-lookup.js:78', note: '5 个敌人直接复用；只需补与 Swarming 的组合测试。' },
  { capability: 'Hidden 关键字（威胁区/手牌）', status: 'partial', evidence: 'src/engine/hidden-rules.js、src/engine/ability.js:155', note: 'TCU 实现可复用；敌人形态（可交战/躲避的 Hidden 敌人）是新语义。' },
  { capability: 'Bonded（场外/在场交换）', status: 'partial', evidence: 'src/engine/bonded.js、src/engine/api-card.js:12', note: '玩家卡可复用；地点绑定与弱点绑定敌人要扩展。' },
  { capability: '双面卡 front/back 与翻面', status: 'verified', evidence: 'src/engine/locations.js、src/engine/reveal.js、各 definition 的 frontCode/backCode', note: 'Veiled 地点翻面可复用翻面管线，缺的是未揭示态限制。' },
  { capability: '毁灭放置与阈值', status: 'verified', evidence: 'src/engine/act-agenda.js、src/engine/enemies.js', note: '地点毁灭的放置可用；地点被毁后的连接重排要补。' },
  { capability: '记录读写（record/recordUnion/recordRemove）', status: 'verified', evidence: 'src/campaign/campaign-effects.js', note: '记录层能力齐；缺按 part 隔离与跨线写入。' },
  { capability: 'flow branch/record/includes', status: 'verified', evidence: 'content/campaigns/theCircleUndone/manifest.js', note: '章对屏障与 16 排列可用 flow branch 表达（P3）。' },
  { capability: 'permanent / myriad 字段', status: 'partial', evidence: 'src/engine/setup.js（永久卡）、cards-data 的 myriad/deckLimit 字段', note: '字段在，构筑期限制不在（deck.myriadLimit）。' },
  { capability: '8 个跨循环通用遭遇组', status: 'verified', evidence: 'src/cards/encounter-entries/shared/、P1 scope.json 的 crossCycleGroups', note: 'P1 已证实 8/8 可用；DarkCult ↔ pentagram 由卡池 encounterName 证实。' },
  { capability: '独立 token 袋', status: 'missing', evidence: 'src/engine/chaos-bag.js 只有混乱袋', note: '蛛群滋生袋要新容器（tokenBag）。' },
  { capability: '按调查员计数（警报等级）', status: 'missing', evidence: 'src/engine/stats.js、src/engine/modifiers.js', note: '没有 counter.investigator 读点。' },
]

// 外部/后续循环关键词守望表：documented = 同名不同物；absent = 出现即 gate 失败。
const WATCHLIST = [
  { id: 'bless', en: /\bbless(ed)?\b/i, expect: 'absent' },
  { id: 'curse', en: /\bcurse(d)?\b/i, expect: 'documented', note: '06291 是卡文叙述里的 curse，不是诅咒标记（TDE 没有 bless/curse 标记）。' },
  { id: 'concealed', en: /\bconcealed\b/i, expect: 'absent' },
  { id: 'customization', en: /\bcustomization\b/i, expect: 'absent' },
  { id: 'tide', en: /\btide\b/i, expect: 'absent' },
  { id: 'flood', en: /\bflood(ed)?\b/i, expect: 'absent' },
  { id: 'patrol', en: /\bpatrol\b/i, expect: 'existing', note: '06232 Lunar Patrol 的 Patrol 是文本/卡名，不是既有 Patrol 关键词；必要时并入单卡。' },
  { id: 'seal', en: /\bseal(ed|s)?\b/i, expect: 'documented', note: '06069/06297 是动词/叙述用法，不是封印标记；本轮不新增封印原语。' },
  { id: 'explore', en: /\bexplore\b/i, expect: 'documented', note: '06172/06250/06291 是行动叙述，不是探索关键字。' },
  { id: 'supply', en: /\bsupply\b/i, expect: 'documented', note: '06136b 是叙述用法；TDE 没有 Supply 关键字。' },
  { id: 'swarm', en: /\bswarm\b/i, expect: 'documented', note: '22 处都是 swarm card / Swarming 的一部分，不是独立关键词。' },
  { id: 'achievement', en: /\bachievement/i, expect: 'documented', note: '卡面无成就文字；成就是战役元数据（默认 out-of-scope，D4）。' },
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
    candidatePrimitives: mech.candidatePrimitives || [],
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
    entry.sourceEvidence = `${MOTHER}/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheDreamEaters/${chapter.source}`
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

function buildReport(reference, scope) {
  const cards = MEASURE.codes.map(cardRow)
  const byCode = new Map(cards.map(row => [row.code, row]))

  const scenarioEntries = CHAPTERS.map(chapter => buildMechanismEntry({
    id: `scenario:${chapter.id}`,
    type: 'scenario',
    title: chapter.name,
    titleZh: chapter.nameZh,
    risk: 'high',
    roadmap: `§1.2 ${chapter.nameZh} / §8.3 M3 / §13 P8`,
    keyword: null,
    evidenceText: `该章专属内容与脚本（遭遇组 ${chapter.group}，线 ${chapter.part}/章对 ${chapter.pair}）。`,
    existing: { status: 'missing', modules: [], note: '章节只有 M0 目录占位（catalog-only）；definition/layout/behavior 属 P8。' },
    gaps: ['definition/layout/behavior/index 全部待建（P8）', '逐章 12 项验收尚无证据', ...(CHAPTER_NOTES[chapter.id] || [])],
    candidatePrimitives: [],
  }, cards))

  const sharedCodes = cards.filter(row => row.mechanisms.includes('sharedEncounterSets')).map(row => row.code)
  const sharedEntry = {
    id: 'sharedEncounterSets',
    type: 'scenario',
    title: 'Shared TDE Encounter Sets', titleZh: '循环共享遭遇组', scope: 'scenario', risk: 'medium',
    roadmap: '§1.2 共享组 30 张 / §9 分片 / §8.3 逐章 gather',
    keyword: null,
    evidenceText: '12 个共享遭遇组共 30 张：按章节 gather 引用跨章复用，落点由 P8 统一决定（shared/ 或 campaign/_shared/），不按 scope 切分。',
    existingImplementation: { status: 'missing', modules: [], note: '落点尚未建立；本条目只锁定归属与组间映射。' },
    gaps: ['12 个组落点与跨章引用（P8）', '与 8 个跨循环组的区分（后者用 coreGroups）'],
    candidatePrimitives: [],
    records: sharedCodes.length,
    byType: (() => {
      const out = {}
      for (const code of sharedCodes) out[ALL_CARDS[code].type] = (out[ALL_CARDS[code].type] || 0) + 1
      return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
    })(),
    groups: Object.keys(SHARED_GROUPS).map(group => ({
      id: camelize(group),
      encounterCode: group,
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
    roadmap: '§4 门禁 / §5.4 复用',
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
  const measured = Object.fromEntries(mechanisms.filter(item => item.type !== 'interaction').map(item => [item.id, item.records]))
  const watchlist = watchlistAudit()
  const watchlistViolations = watchlist.filter(item => item.expect === 'absent' && item.matches > 0)

  const entry = id => mechanisms.find(item => item.id === id)
  const keywordCount = id => entry(id).records
  const typeOrder = ['keyword', 'primitive', 'rulebook', 'scenario', 'interaction', 'content']
  function typeCounts() {
    return typeOrder.map(type => ({
      type,
      count: mechanisms.filter(item => item.type === type).length,
    }))
  }
  function gateTiers() {
    return {
      mechanism: cards.filter(row => row.tier === 'mechanism').length,
      content: cards.filter(row => row.tier === 'content').length,
      standard: cards.filter(row => row.tier === 'standard').length,
    }
  }
  const crossCheck = [
    { item: 'mechanisms', roadmap: '初勘 38 条（primitive 9 / keyword 7 / rulebook 6 / scenario 11 / interaction 2 / content 3）', measured: `${typeCounts().reduce((sum, item) => sum + item.count, 0)} 条（${typeCounts().map(item => `${item.type} ${item.count}`).join(' / ')}）+ 1 条 baseline`, note: 'baseline（standardRules）与 TCU 口径一致，不计入 38。' },
    { item: 'myriad', roadmap: '14 张', measured: `${keywordCount('myriad')} 张（cards-data myriad=true；卡文命中 15 张，多出 06318「Myriad Forms」是卡名）`, note: '验收以字段为准；中文「多重」词形见 §6。' },
    { item: 'swarming', roadmap: '11 敌（初勘；英文机检 9）', measured: `${keywordCount('swarming')} 个敌人`, note: '英文机检 9 漏掉了 [per_investigator]（06147/06148）与 X 值（06228/06273）的写法；本扫描按类型+关键字行计。' },
    { item: 'veiled', roadmap: '23 地点', measured: `${keywordCount('veiled')} 个地点（A2 15 + B3 8）`, note: '卡文命中 24 张，多出 06264b 是背面故事卡（同一条地点记录的 b 面）。' },
    { item: 'researched', roadmap: '3 张（06236/06237/06238）', measured: `${keywordCount('researched')} 张`, note: '与初勘一致。' },
    { item: 'alert', roadmap: '5 敌', measured: `${keywordCount('alert')} 个敌人`, note: '卡文命中 7 张，多出 06103/06111 是提到 alert 的其他卡（treachery/skill），不算关键字。' },
    { item: 'hidden', roadmap: '18 卡', measured: `${keywordCount('hidden')} 张（关键字本体 16 + 引用 2：06293/06299 提到 hidden card/keyword）`, note: '卡池 hidden 字段是“目录隐藏”不是关键字，已排除。' },
    { item: 'bonded', roadmap: '27 卡', measured: `${keywordCount('bonded')} 条记录（bondedCards 14 + bondedTo 13）`, note: '地点绑定 06015a/b 与弱点绑定敌人 06025/06283 是 TDE 新语义。' },
    { item: 'tiers', roadmap: '初勘 mechanism 182 / content 156 / standard 50', measured: `mechanism ${gateTiers().mechanism} / content ${gateTiers().content} / standard ${gateTiers().standard}`, note: '差额集中在 5 位调查员 + 11 张专属卡：本扫描只把「卡面命中关键词/战役机制」算 mechanism，不预判调查员主能力；这 16 张在 P6 逐人验收时按原语队列登记（candidatePrimitives 见 §8.1）。' },
    { item: 'encounterGroups', roadmap: '20 组 = 8 章 + 12 共享', measured: `${encounterGroups.length} 组（章 ${encounterGroups.filter(group => group.scope === 'chapter').length} / 共享 ${encounterGroups.filter(group => group.scope === 'shared').length}）`, note: '组卡数合计与 scope.json 的 283 一致（gate.scopeConsistent）。' },
    { item: 'storyAssets', roadmap: '剧情支援入队/离场（§4 战役级机制）', measured: `${keywordCount('storyAssets')} 张（8 张带 encounterCode 的资产 + 3 处 story asset 引用）`, note: '复用 campaign.awardStoryCard；跨章携带属 P8。' },
  ]

  const gaps = [
    '11 张 Swarming 敌人的 X 有四种口径（固定值 / [per_investigator] / 警报等级 / 剧本参考卡伤害数），原语必须一次覆盖，不能按卡写分支。',
    'Veiled 的 23 个地点里 B3 的 8 张翻面后要洗回牌堆；「洗回」与「翻面」是两个动作，P3 原语要分开表达。',
    'Hidden 的 18 张全部带 Peril；敌人形态（06306–06310）在手牌里可被攻击/躲避，是与 TCU 的关键差异。',
    'Bonded 27 条里有 2 张地点绑定（06015a/b）与 2 个弱点绑定敌人（06025/06283）；TCU 的 bonded.js 只覆盖玩家卡场外实体。',
    '警报等级是“按调查员”的值（20 处引用），不是全桌共享；06227/06228 会读“最高警报等级”。',
    '蛛群滋生袋与混乱袋语义不同（独立袋 + infestation test + infested location），不能复用 chaosBag 容器。',
    'A2 的神迹计数与 B3 的剧本参考卡伤害数是同一种“剧本计数器”原语的两种用法，P3 按一个原语登记。',
    'B2 神秘阶梯（6 张）与 B4 大网（6 张）都是纵向/堆叠位置，布局变量要复用既有 layout，不得新建循环专属布局。',
    '8 张剧情支援资产带 encounterCode，会落进战役包；它们在牌组外携带，不能按普通资产实现。',
    '标准卡 103 张里的调查员与玩家卡（16 + 87）由 M1/M2 逐卡验收；5 位调查员与 11 张专属卡的主能力（伤害承接/搜索改写/弃牌循环/梦境之门/牌库循环）在 P2 归 standardRules，P6 逐人验收时按原语队列登记（§8.1）。',
    '本扫描只做机制归类，不写卡：P3 原语、P4 关键词/规则书、P5 交互分别按条目推进。',
  ]

  const gate = {
    printedRecords: MEASURE.codes.length,
    mainCodes: MEASURE.main.length,
    linkedFaces: MEASURE.faces.length,
    classified: cards.length - unclassified.length,
    unclassified: unclassified.length,
    everyCardHasEntry: unclassified.length === 0,
    mechanismCount: mechanisms.filter(item => item.type !== 'interaction' && item.type !== 'baseline').length,
    // 路线图口径的 38 = 机制 36 + 交互 2；baseline（standardRules）不计入。
    mechanismEntries: mechanisms.filter(item => item.type !== 'baseline').length,
    mechanismsWithCards: mechanisms.filter(item => item.type !== 'interaction' && item.records > 0).length,
    interactionEntries: mechanisms.filter(item => item.type === 'interaction').length,
    encounterGroupsInData: encounterGroups.length,
    encounterGroupsExpected: 20,
    coreGroupsReferenced: CORE_GROUPS.length,
    unknownMechanismBlocks: watchlistViolations.length,
    watchlistViolations: watchlistViolations.map(item => item.id),
    scopeConsistent: Boolean(scope)
      && scope.counts?.records === MEASURE.codes.length
      && scope.counts?.main === MEASURE.main.length
      && scope.counts?.faces === MEASURE.faces.length
      && scope.counts?.chapters === CHAPTERS.length
      && scope.counts?.encounterGroups === encounterGroups.length,
  }
  gate.tiers = gateTiers()
  gate.zeroCardEntriesJustified = mechanisms
    .filter(item => item.type !== 'interaction' && item.type !== 'baseline' && item.records === 0)
    .every(item => Boolean(item.zeroCardJustified))
  gate.pass = gate.everyCardHasEntry
    && gate.scopeConsistent
    && gate.encounterGroupsInData === gate.encounterGroupsExpected
    && encounterGroups.every(group => group.codes.length > 0)
    && gate.mechanismEntries === 38
    && gate.zeroCardEntriesJustified
    && watchlistViolations.length === 0
    && unclassified.length === 0
  if (!gate.pass) {
    throw new Error(`TDE 机制扫描 gate 未通过：${JSON.stringify({
      gate,
      emptyGroups: encounterGroups.filter(group => group.codes.length === 0).map(group => group.id),
      sharedRecords: sharedEntry.records,
      zeroCardIds: mechanisms.filter(item => item.type !== 'interaction' && item.type !== 'baseline' && item.records === 0).map(item => item.id),
    })}`)
  }

  return {
    schemaVersion: 1,
    cycle: CYCLE.id,
    cycleName: CYCLE.name,
    cycleNameZh: CYCLE.nameZh,
    campaignId: CYCLE.campaignId,
    step: '第 1 步：扫描新增机制',
    milestone: 'P2（扫描新增机制）',
    roadmap: `${ROADMAP} §4`,
    status: 'scanned',
    generatedBy: 'tools/scan-tde-mechanisms.mjs --write',
    prerequisites: {
      p0: '已完成（2026-10-27）：规范勘误、基线重锁（13 局 / 786 步 / 799 指纹）、TDE artifacts 白名单；见 docs/tde-p0-report.md。',
      p1: '已完成（2026-10-27）：scope.json gate.pass=true（388 = 352 + 36，三包 283/18/87，20 组，8 章，43 个来源）；本扫描 gate.scopeConsistent 逐项比对。',
    },
    sourceLock: {
      primary: [{ path: 'games/arkhamhorror/src/cards/cards-data.js', records: MEASURE.codes.length, note: '06 号段唯一事实源；扫描只读它，不读 参考资源/ 的卡面文本。' }],
      generatedFrom: ALL_CARDS && Object.keys(ALL_CARDS).length ? 'src/cards/cards-data.js' : null,
      scope: 'artifacts/migration/tde/scope.json',
    },
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
        return {
          code,
          linkedToCode: card.linkedToCode || null,
          linkedCardCode: card.linkedCardCode || null,
          type: card.type,
          name: card.name,
          nameZh: card.nameZh,
          mechanisms: byCode.get(code).mechanisms,
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
const mode = process.argv[2]
if (mode && !['--write', '--check', '--review', '--print', '--summary'].includes(mode)) {
  throw new Error('用法：node tools/scan-tde-mechanisms.mjs [--write|--check|--review|--print|--summary]')
}

let scope = null
if (existsSync(SCOPE_FILE)) {
  try { scope = JSON.parse(await readFile(SCOPE_FILE, 'utf8')) } catch { scope = null }
}
const reference = await referenceLock()
const report = buildReport(reference, scope)
const serialized = JSON.stringify(report, null, 2) + '\n'

if (mode === '--write') {
  await mkdir(new URL('../artifacts/migration/tde/', import.meta.url), { recursive: true })
  await writeFile(TARGET, serialized)
  console.log(`mechanism-scan: ${report.gate.classified}/${report.gate.printedRecords} classified; `
    + `${report.gate.mechanismCount} mechanisms + ${report.gate.interactionEntries} interactions + 1 baseline; `
    + `tiers ${JSON.stringify(report.gate.tiers)}; gate=${report.gate.pass ? 'pass' : 'FAIL'}; `
    + `reference=${reference.available ? 'locked' : 'missing'}`)
} else if (mode === '--check') {
  const current = await readFile(TARGET, 'utf8')
  if (current !== serialized) throw new Error('TDE 机制扫描已漂移（cards-data 或参考来源变化），请审阅后 --write')
  console.log(`mechanism-scan: check ok (${report.gate.printedRecords} records, ${report.gate.mechanismCount} mechanisms)`)
} else if (mode === '--review') {
  await mkdir(new URL('../artifacts/migration/tde/', import.meta.url), { recursive: true })
  const byTier = { mechanism: [], content: [], standard: [] }
  for (const row of report.cards) byTier[row.tier].push(row)
  const lines = ['# TDE 机制扫描逐卡复核', '', '> 自动生成：`node tools/scan-tde-mechanisms.mjs --review`。按 tier 分组，逐卡列出机制归属与中文卡文摘要。', '']
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
  console.log(`review: ${JSON.stringify({ mechanism: byTier.mechanism.length, content: byTier.content.length, standard: byTier.standard.length })} -> artifacts/migration/tde/_review.md`)
} else if (mode === '--print') {
  process.stdout.write(serialized)
} else {
  const g = report.gate
  console.log(`TDE 机制扫描：${g.printedRecords} 条印刷记录（主码 ${g.mainCodes} + 关联面 ${g.linkedFaces}），`
    + `已分类 ${g.classified}，未分类 ${g.unclassified}；机制 ${g.mechanismCount} + baseline 1 + 交互 ${g.interactionEntries}；`
    + `遭遇组 ${g.encounterGroupsInData}/${g.encounterGroupsExpected}；gate=${g.pass ? 'pass' : 'FAIL'}`)
  for (const item of report.mechanisms.filter(entryItem => entryItem.type !== 'interaction' && entryItem.type !== 'baseline')) {
    console.log(`  ${item.id.padEnd(24)} ${String(item.records).padStart(3)}  ${item.type.padEnd(9)} ${item.existingImplementation.status}`)
  }
  console.log(`artifact: ${mode === '--write' ? 'written' : 'artifacts/migration/tde/mechanism-scan.json'}${reference.available ? '' : '（参考资源缺失）'}`)
}
