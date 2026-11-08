// 生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/findings.json（91 卡 + 场景 + unread triage + D5）
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const codes = JSON.parse(fs.readFileSync(`${ROOT}/scope/shards.json`, 'utf8'))['campaign-auditor-d'].codes
const anchors = JSON.parse(fs.readFileSync(`${ROOT}/campaign/d/_work/anchors.json`, 'utf8'))
const testsCoverage = JSON.parse(fs.readFileSync(`${ROOT}/screen/tests-coverage.json`, 'utf8'))
const flagsScreen = JSON.parse(fs.readFileSync(`${ROOT}/screen/flags-readpoints.json`, 'utf8'))

function parseBundle(code) {
  const raw = fs.readFileSync(`${ROOT}/bundles/${code}.md`, 'utf8')
  const parts = raw.split(/^## /m)
  const head = parts[0]
  const lines = head.split('\n')
  const title = lines[0].replace(/^# /, '')
  const meta = lines.filter(l => l.startsWith('- ')).join('\n')
  const out = { title, meta, en: '', backEn: '', nums: '', entry: '', testsText: '' }
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n'); const name = part.slice(0, nl).trim(); const body = part.slice(nl + 1)
    const m = body.match(/```(?:js|json)?\n([\s\S]*?)```/); const content = m ? m[1] : body
    if (name.includes('英文')) { if (name.includes('背面')) out.backEn = content.trim(); else out.en = content.trim() }
    else if (name.includes('数值字段')) out.nums = content.trim()
    else if (name.includes('条目源码')) out.entry = content.trim()
    else if (name.includes('相关测试')) out.testsText = content.trim()
  }
  const titleParts = title.replace(/^[0-9]+ /, '').split(' / ')
  out.nameZh = titleParts.length > 1 ? titleParts[0] : titleParts[0]
  out.name = titleParts.length > 1 ? titleParts[1] : titleParts[0]
  return out
}

const CODE_SPLIT_ORDER = codes
const entryFile = code => anchors.entries[code]?.file || ''
const entryLine = (code, key) => anchors.entries[code]?.anchors?.[key] || 1

// 每卡判定与问题
const CARD = {}
const setCard = (code, verdict, issues = [], extraClauses = [], clauseStatuses = null) => { CARD[code] = { verdict, issues, extraClauses, clauseStatuses } }

// ---- 疯狂之心共享组 ----
setCard('08648', 'match', [
  ['low', 'primitive', 'flags.sealAwareToken / towerAwareToken 无任何读点；实际行为在章节 chaos.js#cultistCountsAsFrost 实现，两条 flag 为死声明', `${entryFile('08648')}:${entryLine('08648', 'flags:')}`, '删除死声明或改为 chaos.js 的声明式读点'],
])
setCard('08649', 'approximation', [
  ['medium', 'impl-vs-text', '背面「调查员与敌人不能进入伊夸之门、不能拥有附属」未实现（note 披露 primitive-requests/p7-08649.json，请求仍 pending）；Part2 中该门以未揭示面进场，玩家可直接进入并翻面', `${entryFile('08649')}:31`, '接线 locationRule 背面进入禁令/禁附属读点'],
  ['low', 'primitive', 'flags.claimedSealsKeptOnResign 无读点；api.resign 不清封印记录（自然保留），属死声明', `${entryFile('08649')}:${entryLine('08649', 'flags:')}`, '删除死声明'],
])
setCard('08650', 'match', [
  ['medium', 'primitive', 'flags.roomSeal 无读点；definition.ACTIVATE_LOCATION_CODES 亦无读点（封印种类由条目常量与 rule 字符串承接）', `${entryFile('08650')}:${entryLine('08650', 'flags:')}`, '以数据表统一接线或删除'],
])
setCard('08651', 'approximation', [
  ['medium', 'impl-vs-text', '「查看同一辐条上所有未揭示地点的已揭示面」只输出一条日志，未向玩家提供可见信息', `${entryFile('08651')}:46`, '通过 api.lookAt/投影提供地点面信息'],
  ['medium', 'primitive', 'flags.roomSeal 无读点（同组 5 张重复死声明）', `${entryFile('08651')}:${entryLine('08651', 'flags:')}`, '删除死声明'],
])
setCard('08652', 'approximation', [
  ['medium', 'impl-vs-text', '「查看同一环形上所有未揭示地点的已揭示面」只输出日志，无实际信息投影', `${entryFile('08652')}:46`, '同 08651'],
  ['medium', 'primitive', 'flags.roomSeal 无读点', `${entryFile('08652')}:${entryLine('08652', 'flags:')}`, '删除死声明'],
])
setCard('08653', 'match', [['medium', 'primitive', 'flags.roomSeal 无读点', `${entryFile('08653')}:${entryLine('08653', 'flags:')}`, '删除死声明']])
setCard('08654', 'match', [
  ['medium', 'primitive', 'flags.roomSeal 无读点', `${entryFile('08654')}:${entryLine('08654', 'flags:')}`, '删除死声明'],
  ['low', 'impl-vs-text', '「团队弃 2×人数手牌」实现为每位本地调查员各弃 2 张；若某人手牌不足总量会少于卡面', `${entryFile('08654')}:37`, '按团队总量校验后分配'],
])
setCard('08655', 'match', [
  ['medium', 'duplication', '同一句「第一个 frost 修正视为 -3」由地点条目 forced 能力与 Part1 behavior.applyTokenEffect 各写一份；后者返回值无人消费、flags.frostTreatRound 无第二读点，且 behavior 内写死卡号 08655', `${entryFile('08655')}:${entryLine('08655', 'abilities:')} / content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:250-258`, '删除 behavior 重复实现，只留单卡 forced 能力'],
  ['low', 'primitive', 'flags.firstFrostModifier 无读点（死声明）', `${entryFile('08655')}:${entryLine('08655', 'flags:')}`, '删除死声明'],
])
setCard('08656', 'match')
setCard('08657', 'match', [['low', 'docs', 'import 了未使用的 ALL_CARDS', `${entryFile('08657')}:7`, '移除未使用 import']])
setCard('08658', 'match')
// ---- Part1 ----
setCard('08659', 'match')
setCard('08660', 'gap', [
  ['high', 'impl-vs-text', '背面 seal_d/seal_e 效果与卡面不符：卡面「D 控制者失去 1 行动（激活 2）」「E 控制者失去 3 资源（激活 6）」，条目写成 D 获得 1 线索、E 获得 2 资源', `${entryFile('08660')}:21-24`, '改为 api.loseActions / api.loseResources，激活时翻倍'],
  ['low', 'primitive', 'agendaRule.forced.anyWindow 返回 undefined 的空壳声明', `${entryFile('08660')}:10`, '删除空壳或接入 doomWouldBePlaced 窗口'],
], [{ text: '[seal_d] 控制者失去 1 行动（激活则 2）；[seal_e] 控制者失去 3 资源（激活则 6）', status: 'missing', evidence: `${entryFile('08660')}:21-24`, note: '条目实现成了得线索/得资源' }])
setCard('08661', 'approximation', [
  ['medium', 'impl-vs-text', '背面「每名剩余调查员被击败，并必须选择：承受 1 精神创伤 或 将忒咳哩-哩牌库顶 3 张洗入牌库」被固定执行为受 1 精神创伤，无选择、无洗入分支', `${entryFile('08661')}:10-14`, '加 api.choice 二选一 + tekeli 原语'],
], [{ text: 'Each remaining investigator is defeated and must either suffer 1 mental trauma or shuffle the top 3 cards of the Tekeli-li deck into their deck.', status: 'approximation', evidence: `${entryFile('08661')}:10-14`, note: '选择被省略' }])
setCard('08662', 'gap', [
  ['high', 'impl-vs-text', '背面按「刚放上门的激活封印种类」结算的治疗/抽牌/额外行动/资源完全未实现（onLeave 仅打日志）；08649 的放封印动作也不记录最后放置种类', `${entryFile('08662')}:10-12`, 'place 封印时记录 kind，onLeave 按 kind 结算'],
], [{ text: 'If it was the [seal_a] seal, the investigator who placed it heals 1 damage. … [seal_e] gains 3 resources.', status: 'missing', evidence: `${entryFile('08662')}:10-12`, note: '只有日志' }])
setCard('08663', 'match')
for (const code of ['08664', '08665', '08666', '08667', '08668']) {
  setCard(code, 'match', [
    ['medium', 'runtime', '动作在「封印已不在原地/已被控制」时仍可发起：behavior 先扣团队线索再调用 recoverSeal，失败时线索不退且无提示', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:146-161`, '先校验 recoverSeal 可执行再扣费'],
    ['medium', 'primitive', 'flags.sealRecover 无读点（封印种类硬编码在 move.rule 字符串里）', `${entryFile(code)}:${entryLine(code, 'flags:')}`, '由 flags.sealRecover 驱动 rule 生成'],
  ])
}
setCard('08669', 'gap', [
  ['high', 'impl-vs-text', 'Spawn「外环离你最远的地点」与 Prey「最近的持封印调查员」完全未接线：flags.spawnFarthestOuterRing / flags.prey(nearestSealHolder) 无读点，enemyScript.onSpawn 只打日志；Part1 definition 也未按卡文派生 prey', `${entryFile('08669')}:8-16 / content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js:142`, '补 spawn rule 与 preyRank 读点'],
  ['medium', 'impl-vs-text', '「重整并再次结算敌人阶段」只实现重整（behavior 近似，已披露），第二次敌人阶段未结算', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:262-270`, '按卡面重跑敌人阶段或显式披露'],
], [
  { text: 'Spawn - Location farthest from you on the outer ring.', status: 'missing', evidence: `${entryFile('08669')}:10`, note: '' },
  { text: 'Prey - Nearest investigator with a seal only.', status: 'missing', evidence: `${entryFile('08669')}:9`, note: '' },
])
setCard('08670', 'gap', [
  ['high', 'impl-vs-text', '整段揭示效果未接线：Part1 definition 只给 entryRevelation/surge（无 effect:campaingRule），条目也无 encounterResolve/treacheryRule.test，引擎 entryRevelation 分支落空；behavior.resolveEncounter 仅在 t.effect.kind===\"campaignRule\" 时调用，正常抽牌不会走到', `${entryFile('08670')}:8-13 / content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js:151 / src/engine/treachery-tokens.js:119,124`, '在条目实现 encounterResolve（或 definition 声明 effect:{kind:\"campaignRule\"}）'],
  ['high', 'impl-vs-text', '即使接通，behavior.resolveEncounter 只对抽牌者本人结算，卡面要求「与封印同地点的每名调查员」', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:172-181`, '遍历所有与封印同地点的调查员'],
], [{ text: 'Revelation - Each investigator at the same location as a seal takes 1 horror, and 1 damage if that seal is activated.', status: 'missing', evidence: `${entryFile('08670')}:8-13`, note: '引擎路径不可达' }])
// ---- Part2 ----
setCard('08671', 'approximation', [
  ['medium', 'impl-vs-text', '背面「检查战役日志；如真相未明 → 各调查员搜索牌库中每张 Tekeli-li 并逐张结算」未实现（只生成无名的疯狂）', `${entryFile('08671')}:8-15`, '补记录分支与 Tekeli-li 搜索/结算'],
])
setCard('08672', 'gap', [
  ['high', 'impl-vs-text', '强制「当 1+ 毁灭将被放置时，改为生成放一边的无名的疯狂」未实现：条目 forced.doomWouldBePlaced 只打日志，behavior 无 doomPlacementReplacement（引擎已有该读点且注释称留待 P8）', `${entryFile('08672')}:13-17 / content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:12 / src/engine/turn.js:125`, '实现 behavior.doomPlacementReplacement'],
  ['high', 'impl-vs-text', '目标「15 份无名疯狂在场且并非所有迷雾高塔坍塌时推进」未实现：agendaRule.objective.namelessInPlay 无读点，definition 也未给 objective', `${entryFile('08672')}:9-18`, '在 behavior.checkObjectives 增加议程目标判定（回合结束）'],
  ['high', 'runtime', '议程 08672 无印刷 doom 值 → doomThreshold=0；引擎 checkAgenda 在下一神话阶段立即推进（探针：agendaIndex 1→2 且触发坡道清场），幕 3 目标随即失去全部高塔地点 → 场景流程被提前打乱/卡死', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:53 / src/engine/act-agenda.js:435`, '无毁灭阈值的议程用 doomThreshold:null + 自定义 objective 推进'],
], [{ text: 'Forced - When 1 or more doom would be put into play… Instead, spawn 1 set-aside copy of The Nameless Madness…', status: 'missing', evidence: `${entryFile('08672')}:13-17`, note: '' }])
setCard('08673', 'gap', [
  ['high', 'runtime', '攻击迷雾高塔时检定难度用了「高塔生命（线索值）」而非战斗值（帷幕）：behavior 传 tower.health；探针 08677 帷幕 3 → 实际难度 4', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:235`, '难度改用 location.shroud'],
  ['high', 'impl-vs-text', '「[reaction] 在高塔发现线索后花费线索造成等量伤害」未实现：actRule.clueReactionDamage 无读点', `${entryFile('08673')}:13`, '补 clueDiscovered 反应'],
  ['medium', 'runtime', '目标应在「回合结束时」检查，behavior.checkObjectives 在每次行动后立即检查（提前推进）', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:256-270`, '改为 roundEnd 窗口'],
], [{ text: '[reaction] When you discover 1 or more clues at a Mist-Pylon, spend those clues: Deal that much damage to that Mist-Pylon.', status: 'missing', evidence: `${entryFile('08673')}:13`, note: '' }])
const pylonExtras = {
  '08674': { power: 'For the remainder of the game, each time you deal damage to a Mist-Pylon, deal 1 additional damage.', powerStatus: 'implemented', powerNote: 'behavior.pylonDamageBonus', powerLine: 242 },
  '08675': { power: 'For the remainder of the game, reduce the shroud value of each Mist-Pylon by 2.', powerStatus: 'missing', powerNote: '真实规则未接：flags.pylonPowers 只写不读', powerLine: 241 },
  '08676': { power: 'For the remainder of the game, each investigator gets +1 to each of their skills while they are at a Mist-Pylon.', powerStatus: 'missing', powerNote: 'flags.pylonPowers 只写不读', powerLine: 241 },
  '08677': { power: 'For the remainder of the game, whenever an investigator at a Mist-Pylon would be dealt 1 or more damage and/or horror, cancel 1 of that damage or horror.', powerStatus: 'missing', powerNote: 'flags.pylonPowers 只写不读', powerLine: 241 },
  '08678': { power: 'For the remainder of the game, each enemy gets -2 fight and -2 evade while it is at a Mist-Pylon.', powerStatus: 'missing', powerNote: 'flags.pylonPowers 只写不读', powerLine: 241 },
}
for (const code of Object.keys(pylonExtras)) {
  const extra = pylonExtras[code]
  const issues = [
    ['high', 'impl-vs-text', '背面进入附加费「本地调查员团队花费 1×人数线索」未接线：locationRule.enterCostCluePerInvestigator 无任何读点', `${entryFile(code)}:11`, '在进入地点流程加团队线索附加费'],
    ['high', 'impl-vs-text', '「[fast] 若你控制已激活的 seal_X」前置条件未检查：fastActions 无条件提供，performAction 在无控制/未激活时也返回 handled（探针确认无效点击被吞）', `${entryFile(code)}:12-18 / content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:238-242`, 'fastActions 按 entryFlags 与 seals 状态过滤'],
    ['medium', 'primitive', `flags.pylonKind 无读点（种类由 move.rule 字符串承接）`, `${entryFile(code)}:${entryLine(code, 'flags:')}`, '删除死声明'],
  ]
  if (extra.powerStatus === 'missing') issues.push(['high', 'impl-vs-text', `释放封印的持续效果未实现：${extra.power}（behavior 只把 kind 记进 flags.pylonPowers，全仓无读点）`, `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:${extra.powerLine}`, '为每种 pylonKind 声明 modifiers/读点'])
  setCard(code, 'gap', issues, [{ text: extra.power, status: extra.powerStatus, evidence: `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:${extra.powerLine}`, note: extra.powerNote }])
}
setCard('08679', 'gap', [
  ['high', 'impl-vs-text', '「The Nameless Madness cannot take damage」未实现（flags.cannotTakeDamage 无读点）', `${entryFile('08679')}:10`, '在伤害管线读取该标志'],
  ['high', 'impl-vs-text', '强制方向写反：卡面「按成功差值横置最近的已重整副本」，behavior 把最近的已横置副本改回重整（探针：exhausted=true 的副本变成 false）', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:323-327`, '改为将 ready 副本 exhausted=true，次数=successBy'],
  ['high', 'impl-vs-text', 'Alert / Massive / Retaliate 印刷关键词在 Part2 定义中丢失（ALL_ENEMIES 合并结果为空对象 {}），战斗/躲避/重整行为不符', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:105-118 / src/engine/card-lookup.js:26`, 'Part2 enemyDefinitions 按卡文派生关键词或改用 card-data.encounterDefinitions'],
], [{ text: 'Alert. Massive. Retaliate.', status: 'missing', evidence: `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:105-118`, note: '合并后 ALL_ENEMIES 无这些字段' }])
setCard('08680', 'gap', [
  ['high', 'impl-vs-text', 'Spawn「最近的未坍塌迷雾高塔（没有则你的地点）」未实现（flags.spawnNearestStandingPylon 无读点）', `${entryFile('08680')}:9`, '补 spawn rule'],
  ['high', 'impl-vs-text', '「已重整且在迷雾高塔时，该高塔不能受到伤害」未实现（flags.protectsReadyPylon 无读点）', `${entryFile('08680')}:9`, '在 damageTower 入口加保护读点'],
  ['medium', 'impl-vs-text', '敌人阶段结束移动用「槽位顺序下一格」，不是「朝最近的未坍塌高塔」，且未检查 ready', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:305-313`, '按连接图 BFS 最近高塔并检查 ready'],
], [{ text: 'While Unsealed Phantasm is ready and at a Mist-Pylon, damage cannot be dealt to that Mist-Pylon.', status: 'missing', evidence: `${entryFile('08680')}:9`, note: '' }])
setCard('08681', 'gap', [
  ['high', 'impl-vs-text', '「The Nameless Madness gains hunter」未接线：actRule.namelessGainsHunter 无读点，而引擎已有 actRule.enemiesGainHunter 原语（turn.js#enemyHasHunter）未复用', `${entryFile('08681')}:12 / src/engine/turn.js:182-186`, '改用 actRule.enemiesGainHunter:true（或专用读点）'],
  ['high', 'impl-vs-text', '强制「毁灭将被放置时改为在左侧调查员地点生成 1 份无名疯狂」未实现（同 08672：behavior 无 doomPlacementReplacement）', `${entryFile('08681')}:9-14`, '实现 doomPlacementReplacement'],
  ['high', 'runtime', '背面 R1/R2 分支依赖记录 drKenslerHasAPlan / theTruthOfTheMirageEludesYou，但全仓只有读取（behavior）与 schema 声明，没有任何写入点 → 正式战役永远走 R3', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:275-276 / content/campaigns/edgeOfTheEarth/records.js:227,239`, '在幕间/致命幻景结算写入这两项记录'],
], [{ text: 'The Nameless Madness gains hunter.', status: 'missing', evidence: `${entryFile('08681')}:12`, note: '' }])
for (const code of ['08682', '08683', '08684', '08685']) {
  setCard(code, 'approximation', [
    ['medium', 'impl-vs-text', '「你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功」未接线：behavior 返回 spendClueAutoSucceed，但 src/engine/movement.js:306-311 完全不消费该字段', `${entryFile(code)}:11 / src/engine/movement.js:306-311`, '在离开检定中提供花线索自动成功选项'],
  ])
}
setCard('08686', 'match', [
  ['low', 'primitive', 'flags.objectiveRun / locationRule.objectiveRun 无读点；目标实际由 08681 的 behavior.checkObjectives 承接', `${entryFile('08686')}:8-11`, '删除死声明或改由地点 objective 读点承接'],
])
// ---- 其它共享组 ----
setCard('08687', 'gap', [
  ['high', 'impl-vs-text', '印刷关键词 Hunter / Retaliate 丢失：Part2 definition 不按卡文派生关键词，注册顺序在最后覆盖了其他章节定义，ALL_ENEMIES["08687"] 合并结果为空对象（探针确认）；影响 fatalMirage 与 Part2 两章', `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:105-118 / src/engine/card-lookup.js:26`, 'Part2 enemyDefinitions 派生关键词（同 Part1/card-data 的写法）'],
], [{ text: 'Hunter. Retaliate.', status: 'missing', evidence: `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:105-118`, note: 'ALL_ENEMIES 合并后 hunter/retaliate 均缺失' }])
setCard('08688', 'match')
setCard('08689', 'match', [['low', 'impl-vs-text', '「该次攻击 +1 伤害/+1 恐惧」在攻击结算之后另行 api.damage/api.horror，不是本次攻击的伤害（可能导致先被击败再吃追加）', `${entryFile('08689')}:17-25`, '改为攻击伤害修正']])
setCard('08690', 'match')
setCard('08691', 'approximation', [
  ['medium', 'impl-vs-text', '「在附属地点，忒咳哩-哩将被洗入你牌库时改为抽到并放你的牌库底」未实现（披露 primitive-requests/p7-08691.json，pending）', `${entryFile('08691')}:30`, '补地点附属强制窗口'],
  ['low', 'primitive', 'flags.replacesTekeliShuffleAtLocation 无读点', `${entryFile('08691')}:14`, '随原语接线'],
])
setCard('08692', 'approximation', [
  ['medium', 'impl-vs-text', '「附属地点的调查员不能打出卡牌或从牌库抽牌」未实现（披露 p7-08692.json）', `${entryFile('08692')}:40`, '补地点附属限制原语'],
  ['low', 'code-quality', 'encounterResolve 内保留 if (true)/else 死分支与未使用的 nearestLocation 帮助函数', `${entryFile('08692')}:23-38`, '清理死代码'],
])
setCard('08693', 'approximation', [
  ['medium', 'impl-vs-text', '「附属地点每位调查员四项技能 -1」未实现（披露 p7-08693.json）', `${entryFile('08693')}:40`, '补地点附属技能修正原语'],
  ['low', 'code-quality', 'if (false) 死分支 + 未使用的 nearestLocation 帮助函数（复制自 08692）', `${entryFile('08693')}:23-38`, '清理死代码'],
])
setCard('08694', 'approximation', [
  ['medium', 'impl-vs-text', '「你在附属地点结束回合时，你控制的每张有生命值的卡（含调查员）受 1 点直接伤害」未实现（披露 p7-08694.json）', `${entryFile('08694')}:40`, '补地点附属回合结束原语'],
  ['low', 'code-quality', 'if (false) 死分支 + 未使用的 nearestLocation 帮助函数', `${entryFile('08694')}:23-38`, '清理死代码'],
])
for (const code of ['08695', '08696', '08697']) {
  setCard(code, 'gap', [
    ['high', 'runtime', 'elder_things 组未被任何章节遭遇牌库实际包含（探针：toTheForbiddenPeaks/cityOfTheElderThings deck 尺寸 14/20，共享卡 0 张；ALL_ENEMIES 也没有 08695/08696），一旦被抽取会命中 encounter.js:274「未知遭遇卡」直接抛错；本卡在当前内容中不可达', `src/engine/encounter.js:198,274 / content/campaigns/edgeOfTheEarth/shared-encounters.js:112-135`, '章节 definition 纳入共享组定义或统一共享遭遇池'],
  ])
}
setCard('08698', 'match')
setCard('08699', 'approximation', [
  ['medium', 'impl-vs-text', '「进入/离开附属地点的额外敏捷(2)检定（失败取消移动+1伤+1恐惧+弃本卡）」未实现（披露 p7-08699.json）', `${entryFile('08699')}:26`, '补地点附属移动检定原语'],
])
setCard('08700', 'approximation', [
  ['medium', 'impl-vs-text', 'Spawn「任意地点（如可能，则生成在无人地点）」未声明（enemySpawnRule 只有 doomOnSpawn，无 spawnAnyEmpty）', `${entryFile('08700')}:7`, '补 enemyRule.spawnAnyEmpty'],
])
setCard('08701', 'match')
setCard('08702', 'approximation', [
  ['medium', 'impl-vs-text', '「与附属敌人的攻击/躲避/谈判难度 +1」未实现（披露 p7-08702.json）', `${entryFile('08702')}:55`, '补附属难度修正原语'],
  ['low', 'primitive', 'flags.attachToPossessedEnemy / flags.difficultyBonus 无读点（附属与毁灭已由 encounterResolve 实现）', `${entryFile('08702')}:31`, '删除死声明'],
])
setCard('08703', 'approximation', [
  ['medium', 'impl-vs-text', '「你抽取的每张忒咳哩-哩弱点的效果额外结算一次」未实现（披露 p7-08703.json）', `${entryFile('08703')}:30`, '补弱点重复结算原语'],
])
setCard('08704', 'approximation', [
  ['medium', 'impl-vs-text', '「抽取后立即结算该弱点效果」未实现（披露 p7-08704.json）；抽牌与去向已接', `${entryFile('08704')}:26`, '补按卡号结算弱点读点'],
])
setCard('08705', 'match')
setCard('08706', 'approximation', [
  ['medium', 'impl-vs-text', '「被附属支援不能重整 / 回合结束受到 1 伤害或 1 恐惧 / 行动摆脱」未实现（披露 p7-08706.json）', `${entryFile('08706')}:32`, '补支援附属强制窗口'],
  ['medium', 'impl-vs-text', '伙伴支援在战役中没有入场路径（见 08714–08722 的 high 问题），因此本卡实际总是获得涌动', `${entryFile('08706')}:17-21`, '接通伙伴选派/入场'],
])
setCard('08707', 'approximation', [
  ['medium', 'impl-vs-text', '「你在附属地点结束回合时，你控制的每张有神智值的卡（含调查员）受 1 点直接恐惧」未实现（披露 p7-08707.json）', `${entryFile('08707')}:18`, '补地点附属强制窗口'],
])
setCard('08708', 'approximation', [
  ['medium', 'impl-vs-text', '「进入/离开本敌人所在地点须额外花费 1 行动」未实现（披露 p7-08708.json）；Aloof 由印刷文本定义提供', `${entryFile('08708')}:8`, '补地点移动附加费原语'],
])
setCard('08709', 'match')
setCard('08710', 'approximation', [
  ['medium', 'impl-vs-text', '「抽到后按弱点立即结算」未实现（披露 p7-08710.json），当前只从忒咳哩-哩牌库取出并打日志', `${entryFile('08710')}:24-30`, '补按卡号结算弱点读点'],
])
setCard('08711', 'match')
setCard('08712', 'approximation', [
  ['medium', 'impl-vs-text', '「发现/控制附属地点线索后弃掉手中所有非弱点牌并弃本卡」未实现（披露 p7-08712.json）', `${entryFile('08712')}:29`, '补地点附属强制窗口'],
])
setCard('08713', 'match')
// ---- 远征队伙伴 ----
const partnerEntryIssue = ['high', 'runtime', '伙伴支援整场战役没有入场路径：官方规则「每章开局每名调查员可选择一名伙伴支援并置入战场」；引擎 interaction.partners.setup 无调用方，任何章节 storyAssets/牌组都不含 08714–08722，PARTNER_ASSET_RULES/partnerRosterSpec 无读点', 'src/engine/eote-interactions.js:109-130 / content/campaigns/edgeOfTheEarth/shared-encounters.js:183-226', '在每章 setup 调用 partnerSetup 并按名册把所选伙伴置入该调查员资产区']
const partnerRulesDead = ['low', 'primitive', 'flags.partnerRules 及其 rule-value 字符串（heal2Horror 等）全仓无读点；能力由 abilities 描述子另行实现', 'src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08714.js:14', '删除死声明']
setCard('08714', 'gap', [partnerEntryIssue, partnerRulesDead])
setCard('08715', 'gap', [partnerEntryIssue,
  ['high', 'impl-vs-text', '[reaction]「同地点调查员结算忒咳哩-哩弱点后横置并花 1 秘密：该调查员抽 2 张」整条未实现（abilities 缺失，note 承认读点待接）；披露请求 p7-08715.json 仍 pending', `${entryFile('08715')}:9-11`, '实现弱点结算后窗口'],
  ['medium', 'primitive', 'flags.partnerRules 无读点且能力为空 → 声明即未实现', `${entryFile('08715')}:9`, '删除死声明'],
])
setCard('08716', 'gap', [partnerEntryIssue,
  ['high', 'runtime', '成功躲避后引用未定义变量 here → ReferenceError（探针复现：autoEvade 后抛错），能力每次成功都会崩溃', `${entryFile('08716')}:35`, '先取 const here = state.locations.find(...)'],
  partnerRulesDead,
])
setCard('08717', 'gap', [partnerEntryIssue, partnerRulesDead])
setCard('08718', 'gap', [partnerEntryIssue, partnerRulesDead])
setCard('08719', 'gap', [partnerEntryIssue,
  ['medium', 'impl-vs-text', '「成功且非精英 → 直到本轮结束不能攻击」未实现，只输出「数据已声明，读点待接」日志', `${entryFile('08719')}:30-31`, '补敌人临时攻击禁用读点'],
  partnerRulesDead,
])
setCard('08720', 'gap', [partnerEntryIssue, partnerRulesDead])
setCard('08721', 'gap', [partnerEntryIssue,
  ['high', 'impl-vs-text', '[fast]「选择一张附属到地点的诡计，其文本框视为空白直到回合结束」整条未实现（abilities: []，integrity 也标记 empty-behavior high）；披露请求 p7-08721.json pending', `${entryFile('08721')}:9-12`, '实现临时文本空白读点'],
  partnerRulesDead,
])
setCard('08722', 'gap', [partnerEntryIssue, partnerRulesDead])
// ---- Tekeli-li ----
const tekeliliDead = ['low', 'primitive', 'flags.returnToTekeliliDeckBottom 无读点（回底在 weakness resolve 里经 api.mechanics.tekeli.return 完成）', 'src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08723.js:11', '删除死声明']
for (const code of ['08723', '08724', '08725', '08726', '08728', '08729']) setCard(code, 'match', [tekeliliDead])
setCard('08727', 'approximation', [tekeliliDead,
  ['medium', 'impl-vs-text', '「否则你的下一个回合期间失去 1 个行动」未实现（条目自己写「读点待接」；披露请求 p7-08727.json pending）', `${entryFile('08727')}:17-18`, '补延迟失去行动读点'],
])
// ---- 纪念逝者 ----
const memorialAwardIssue = ['high', 'runtime', '纪念逝者领取流程未接线：initializeMemorials / memorialsSpec 全仓无调用方，幕间不会把遗物加入调查员牌组，因此 08730–08738 在正式战役中不可获得（官方：伙伴划去/存活幕间可领取对应遗物）', 'content/campaigns/edgeOfTheEarth/shared-encounters.js:227 / src/engine/api-mechanics.js:249 / content/campaigns/edgeOfTheEarth/interludes.js', '在幕间结算调用 claimAllAtInterlude 并把 relicCode 加入牌组']
const memorialDead = ['low', 'primitive', 'flags.memorial 无读点（遗物身份只靠 encounterCode 归组）', 'src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08730.js:11', '删除死声明或改身份读点']
setCard('08730', 'gap', [memorialAwardIssue, memorialDead])
setCard('08731', 'gap', [memorialAwardIssue, memorialDead,
  ['high', 'impl-vs-text', '[action]「查找牌库顶 6 张，把其中每张 Tekeli-li 放到忒咳哩-哩牌库底，洗牌后抽 1」整条未实现（只有 uses 数据 + note；披露 p7-08731.json pending）', `${entryFile('08731')}:8-10`, '实现查找顶牌→剧本牌库底读点'],
])
setCard('08732', 'gap', [memorialAwardIssue, memorialDead])
setCard('08733', 'gap', [memorialAwardIssue, memorialDead,
  ['high', 'impl-vs-text', '事件卡无 played 生命周期实现；note 声称由 src/cards/entries/08733.js 承接，但该文件不存在（src/cards/entries/087*.js = 0）', `${entryFile('08733')}:7-8`, '补玩家侧 played 条目并接线'],
  ['high', 'primitive', 'flags.eventCard / flags.draw3AnyFreeWindow 无读点', `${entryFile('08733')}:7`, '删除死声明并实现打出'],
])
setCard('08734', 'gap', [memorialAwardIssue, memorialDead,
  ['medium', 'impl-vs-text', '「每位调查员仅限 1 张[[鞋子]]」未实现（flags.footwear 无读点）', `${entryFile('08734')}:9`, '补 Footwear 限制读点'],
])
setCard('08735', 'gap', [memorialAwardIssue, memorialDead])
setCard('08736', 'gap', [memorialAwardIssue, memorialDead])
setCard('08737', 'gap', [memorialAwardIssue, memorialDead,
  ['high', 'impl-vs-text', '事件卡无 played 生命周期实现；note 指向的 src/cards/entries/08737.js 不存在', `${entryFile('08737')}:7-8`, '补玩家侧 played 条目'],
  ['high', 'primitive', 'flags.eventCard / flags.gain3ResourcesDraw1RemoveFromGame 无读点', `${entryFile('08737')}:7`, '删除死声明并实现打出'],
])
setCard('08738', 'gap', [memorialAwardIssue, memorialDead,
  ['medium', 'impl-vs-text', '「或弃掉安雨以选择最多三项（任意顺序）」整条未实现：条目只实现三选一', `${entryFile('08738')}:12-34`, '实现弃置与多选模式'],
])

// ---- 组装 cards ----
const cards = []
for (const code of CODE_SPLIT_ORDER) {
  const b = parseBundle(code)
  const c = CARD[code] || { verdict: 'match', issues: [], extraClauses: [], clauseStatuses: null }
  const enLines = (b.en || '').split('\n').map(s => s.trim()).filter(Boolean)
  const clauses = []
  for (let i = 0; i < enLines.length; i++) {
    let status = 'implemented'
    if (c.clauseStatuses && c.clauseStatuses[i]) status = c.clauseStatuses[i]
    clauses.push({ text: enLines[i], status, evidence: `${entryFile(code)}:${entryLine(code, 'abilities:') || entryLine(code, 'locationRule') || entryLine(code, 'agendaRule') || entryLine(code, 'actRule') || entryLine(code, 'encounterResolve') || entryLine(code, 'flags:')}`, note: '' })
  }
  const doubleSided = /doubleSided: true/.test(b.meta)
  const anyHighIssue = (c.issues || []).some(([severity]) => severity === 'high')
  if (doubleSided && b.backEn && !anyHighIssue && !(c.extraClauses || []).length) {
    for (const line of b.backEn.split('\n').map(s => s.trim()).filter(Boolean)) {
      clauses.push({ text: '[背面] ' + line, status: 'implemented', evidence: `${entryFile(code)}:${entryLine(code, 'agendaRule') || entryLine(code, 'actRule') || entryLine(code, 'locationRule') || entryLine(code, 'abilities:') || 1}`, note: '' })
    }
  }
  for (const extra of c.extraClauses || []) clauses.push(extra)

  if (!clauses.length) clauses.push({ text: (b.backEn || '(无正面文本)').split('\n').filter(Boolean)[0] || '(无正面文本)', status: 'implemented', evidence: `${entryFile(code)}:1`, note: '' })
  const tc = testsCoverage.cards.find(x => x.code === code) || {}
  const strong = (tc.strongTitles || []).map(t => `${t.file}:${t.line}`)
  const issues = (c.issues || []).map(([severity, dimension, summary, evidence, suggestion]) => ({ severity, dimension, summary, evidence, suggestion }))
  const hasHigh = issues.some(i => i.severity === 'high')
  const accepted = c.verdict === 'match' && !hasHigh
  cards.push({
    code, name: b.name, nameZh: b.nameZh,
    verdict: c.verdict, accepted,
    clauses,
    perceivability: { status: issues.some(i => i.dimension === 'perceivability') ? 'partial' : 'perceivable', evidence: '', note: '' },
    tests: { status: strong.length ? 'strong' : (tc.level === 'file-only' ? 'file-only' : 'none'), evidence: strong.slice(0, 3).join(' / ') || (tc.files || []).slice(0, 2).join(' / ') || '(无命中)', note: '' },
    issues,
  })
}

// ---- unread triage ----
const TOKEN_TRIAGE = {
  sealAwareToken: ['dead-declaration', 'low', '行为已由章节 chaos.js#cultistCountsAsFrost 承接，此 flag 纯元数据'],
  towerAwareToken: ['dead-declaration', 'low', '行为已由章节 chaos.js#isMistPylon 承接，此 flag 纯元数据'],
  claimedSealsKeptOnResign: ['dead-declaration', 'low', 'api.resign 不清理封印记录，规则自然满足；无读点'],
  roomSeal: ['dead-declaration', 'medium', '08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量'],
  sealRecover: ['dead-declaration', 'medium', '08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点'],
  spawnFarthestOuterRing: ['unwired', 'high', '生成规则整条缺失，无读点'],
  enemyPhaseEndReadyIfActivatedSeal: ['partial', 'medium', 'behavior.enemyPhaseEnd 只实现重整（近似已披露），字段未读'],
  nearestSealHolder: ['unwired', 'high', 'Prey 规则未接：场景定义也未从卡文派生 prey'],
  finalMirageDoomReplacement: ['unwired', 'high', '毁灭替换未实现（引擎已有 doomPlacementReplacement 读点）'],
  namelessInPlay: ['unwired', 'high', '议程目标未实现，导致 doomThreshold=0 时会提前推进'],
  pylonAttackable: ['partial', 'medium', '行为层用「当前幕卡号 + 高塔原语」另路实现，本字段无读点'],
  clueReactionDamage: ['unwired', 'high', '发现线索打高塔的反应缺失'],
  pylonKind: ['dead-declaration', 'medium', '5 张死声明；种类由 move.rule 字符串承接'],
  enterCostCluePerInvestigator: ['unwired', 'high', '进入高塔的团队线索附加费缺失'],
  cannotTakeDamage: ['unwired', 'high', '「不能受到伤害」缺失'],
  exhaustNearestOnSuccess: ['unwired', 'high', '强制实现了但方向相反（把已横置改回重整）'],
  spawnNearestStandingPylon: ['unwired', 'high', '生成规则缺失'],
  protectsReadyPylon: ['unwired', 'high', '高塔免伤缺失'],
  moveTowardPylonAtEnemyPhaseEnd: ['partial', 'medium', 'behavior 用槽位顺序近似，非最近且不检查 ready'],
  finalMirage: ['dead-declaration', 'low', '身份元数据，无行为依赖'],
  resolutionByRecords: ['partial', 'medium', '行为在 checkObjectives 里近似实现；且记录无写入点'],
  namelessGainsHunter: ['unwired', 'high', '未复用引擎既有 actRule.enemiesGainHunter 原语'],
  finalMirageOutcome: ['dead-declaration', 'low', '结局分支在 behavior.checkObjectives 内实现，rule-value 未读'],
  objectiveRun: ['dead-declaration', 'low', '目标由 08681 的 behavior 承接'],
  replacesTekeliShuffleAtLocation: ['unwired', 'medium', '披露于 p7-08691.json（pending）'],
  moveEntryTest: ['unwired', 'medium', '披露于 p7-08699.json（pending）'],
  attachToPossessedEnemy: ['partial', 'medium', '附属与毁灭已由 encounterResolve 实现；字段未读'],
  difficultyBonus: ['unwired', 'medium', '难度 +1 未实现，披露于 p7-08702.json'],
  memorial: ['dead-declaration', 'medium', '字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题）'],
  eventCard: ['unwired', 'high', '事件卡无 played 条目，无法打出'],
  draw3AnyFreeWindow: ['unwired', 'high', '同 eventCard'],
  footwear: ['unwired', 'medium', 'Footwear 限制未实现'],
  gain3ResourcesDraw1RemoveFromGame: ['unwired', 'high', '同 eventCard'],
  attachToPartnerAsset: ['partial', 'medium', '附属已由 encounterResolve 实现；伙伴支援无入场路径'],
  turnEndDirectHorror: ['unwired', 'medium', '披露于 p7-08707.json'],
  tekeliliDoubleResolution: ['unwired', 'medium', '披露于 p7-08703.json'],
  drawTekeliliAndResolveThenShuffle: ['unwired', 'medium', '披露于 p7-08704.json（抽牌/去向已接，立即结算缺）'],
  moveSurchargeAtEnemyLocation: ['unwired', 'medium', '披露于 p7-08708.json'],
  clueDiscoveryDiscardNonWeakness: ['unwired', 'medium', '披露于 p7-08712.json'],
  returnToTekeliliDeckBottom: ['dead-declaration', 'low', '行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成'],
  partnerRules: ['dead-declaration', 'low', '字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题）'],
  firstFrostModifier: ['dead-declaration', 'low', '行为在地点 forced 能力内实现；behavior.applyTokenEffect 为重复死代码'],
  heal2Horror: ['dead-declaration', 'low', '能力由 abilities 实现，元数据字符串无读点'],
  draw2AfterTekeliliResolved: ['unwired', 'medium', '08715 的整条反应未实现'],
  evadeBase5ThenMayMove: ['dead-declaration', 'low', '能力已实现但成功路径 ReferenceError（见卡片 high）'],
  heal2Damage: ['dead-declaration', 'low', '能力由 abilities 实现'],
  cancelFrostRevealNewToken: ['dead-declaration', 'low', '能力由 tokenReveal 反应实现（context.when 已核对有效）'],
  fightBase5NonEliteCannotAttackThisRound: ['partial', 'medium', '攻击已实现，「本轮不能攻击」只打日志'],
  investigateBase5LookTopCard: ['dead-declaration', 'low', '能力由 abilities 实现'],
  blankNonWeaknessTreacheryText: ['unwired', 'medium', '08721 的整条 free 能力未实现'],
  gain1ResourceMoveUpTo3: ['dead-declaration', 'low', '能力由 abilities 实现'],
}
const unreadTriage = []
for (const row of flagsScreen.unread) {
  if (!codes.includes(row.code)) continue
  const triage = TOKEN_TRIAGE[row.key] || ['unwired', 'medium', '未找到读点']
  const entry = anchors.entries[row.code]
  unreadTriage.push({
    code: row.code, name: row.name, block: row.block, key: row.key, kind: row.kind || 'key',
    grepReadpoints: row.engineReadpointCount === 0 ? '全仓（src+content+web+tests）无字面读点' : `读点 ${row.engineReadpointCount} 处`,
    verdict: triage[0], severity: triage[1], note: triage[2],
    evidence: `${entry?.file || ''}:${entry?.anchors?.[`${row.block}${row.key ? '.' + row.key : ''}`] || entry?.anchors?.flags || 1}`,
  })
}

// ---- simplified 复核 ----
const simplifiedReview = [
  { code: '08587', ledgerStatus: 'simplified', disclosure: 'p7-08587（引用文件 artifacts/migration/eote/primitive-requests/p7-08587.json 不存在）', currentState: 'abilities: []，[fast] 治愈 2 恐惧只有 uses 数据，未实现', stillSimplified: true, severity: 'medium' },
  { code: '08588', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: 'abilities: []，[reaction] 抽 3 弃弱点未实现', stillSimplified: true, severity: 'medium' },
  { code: '08589', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: '敏捷 6 躲避 + 移动已实现（api.evade/testResult/moveDestinations）', stillSimplified: false, severity: 'low' },
  { code: '08590', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: 'abilities: []，治愈 2 伤害未实现', stillSimplified: true, severity: 'medium' },
  { code: '08591', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: 'abilities: []，取消 frost 二选一未实现', stillSimplified: true, severity: 'medium' },
  { code: '08592', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: '战斗 6 + addEffect 已实现，「不能攻击」用空 modifiers 的 addEffect 装饰（无实际禁攻读点）', stillSimplified: true, severity: 'medium' },
  { code: '08593', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: '调查 6 + lookAt 已实现，但「可弃掉该牌」缺失', stillSimplified: true, severity: 'medium' },
  { code: '08594', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: 'abilities: []，文本空白能力未实现', stillSimplified: true, severity: 'medium' },
  { code: '08595', ledgerStatus: 'simplified', disclosure: 'p7-08587（文件不存在）', currentState: 'abilities: []，获得 1 资源 + 移动最多 3 资源未实现', stillSimplified: true, severity: 'medium' },
  { code: '08673', ledgerStatus: 'simplified', disclosure: 'p7-08673（引用文件不存在）', currentState: '攻击高塔已实现但难度取错值（health 而非 shroud）；线索反应未实现；「近似已披露」不足以覆盖规则错误', stillSimplified: true, severity: 'high' },
  { code: '08679', ledgerStatus: 'simplified', disclosure: 'p7-08679（引用文件不存在）', currentState: '不能受伤未实现、横置方向写反、关键词丢失——属可立即修复的规则错误，不应记为「已披露近似」', stillSimplified: true, severity: 'high' },
  { code: '08681', ledgerStatus: 'simplified', disclosure: 'p7-08681（引用文件不存在）', currentState: '获得猎手/毁灭替换未实现，R1/R2 记录无写入点', stillSimplified: true, severity: 'high' },
  { code: '08682', ledgerStatus: 'simplified', disclosure: 'p7-08682（引用文件不存在）', currentState: '离开检定已接线，仅「花 1 线索自动成功」缺失', stillSimplified: true, severity: 'medium' },
  { code: '08683', ledgerStatus: 'simplified', disclosure: 'p7-08682（文件不存在）', currentState: '同 08682（难度 3）', stillSimplified: true, severity: 'medium' },
  { code: '08684', ledgerStatus: 'simplified', disclosure: 'p7-08682（文件不存在）', currentState: '同 08682（难度 2）', stillSimplified: true, severity: 'medium' },
  { code: '08685', ledgerStatus: 'simplified', disclosure: 'p7-08682（文件不存在）', currentState: '同 08682（难度 1）', stillSimplified: true, severity: 'medium' },
]

// ---- 场景 D3 ----
const scenarios = [
  {
    id: 'theHeartOfMadnessPart1',
    setup: { status: 'runnable', evidence: 'tests/eote-scenario-theHeartOfMadnessPart1.test.mjs:122-148（16 地点/随机槽位/5 封印休眠）；探针确认 setup 后无 Tekeli-li 牌库' },
    rules: { status: 'partial', evidence: 'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:70-282', issues: ['08670 揭示效果不可达', '08662 背面未实现', '08660 D/E 背面数值错', '08669 spawn/prey 缺失'] },
    flow: { status: 'runnable-with-gaps', evidence: '幕 08662→08663 由 behavior.checkObjectives 推进；议程 5/6/6 毁灭阈值正常；结局 R1/R2/R3 与记录经 resolution 落账' },
    runthrough: { status: 'deadlock-risk-low', evidence: '封印取回→激活→放门链路可跑（含测试）；但 Tekeli-li 牌库从未初始化，石板标记恒无效果（behavior.afterTest:229-243）；R3 爆炸检测由 behavior.checkDetonation:70-82 覆盖' },
    guides: { status: 'present', evidence: 'story-text key theHeartOfMadnessPart1；章节测试断言 sectionCount=79' },
    issues: ['未初始化 Tekeli-li 牌库 → 08648 [tablet] 抽牌恒为空', '08670 抽到无效果', '08662/08660 背面结算缺失/错值', '08651/08652 查看未揭示地点仅日志'],
  },
  {
    id: 'theHeartOfMadnessPart2',
    setup: { status: 'runnable', evidence: 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs:101-113（10 设施+5 高塔随机、门翻面、内环约束）' },
    rules: { status: 'broken', evidence: 'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:221-256,287-313', issues: ['高塔攻击难度取 health 而非 shroud', 'pylon 力量只记录不生效', '进入高塔附加费缺失', '08680 spawn/保护缺失', '08679 不能受伤/横置方向/关键词'] },
    flow: { status: 'broken', evidence: '探针：agendaIndex 1（08672 doomThreshold=0）→ checkAgenda 立即推进到 2 并触发坡道清场；幕 3 目标失去全部高塔地点（content/.../definition.js:53 + src/engine/act-agenda.js:435）' },
    runthrough: { status: 'deadlock-risk-high', evidence: 'R1/R2 记录 drKenslerHasAPlan / theTruthOfTheMirageEludesYou 无写入点（records.js:227,239）；仅 R3 可达；Tekeli-li 牌库未初始化' },
    guides: { status: 'present', evidence: 'story-text theHeartOfMadnessPart2；测试断言 sectionCount=53' },
    issues: ['议程 08672 无毁灭阈值 → 下一神话阶段自动推进并提前进入坡道场景，幕 3 无法完成（流程损坏）', 'R1/R2 分支永久不可达', 'Tekeli-li 牌库未初始化，[tablet] 仅写日志（behavior.js:319）', '高塔攻击难度错误 + 封印力量未接线'],
  },
]

const d5 = [
  { id: 'D5-1', dimension: 'duplication', severity: 'medium', summary: '08650–08654 五张「取回封印→团队线索→激活封印」地点条目各写 ~55 行几乎相同逻辑（仅技能/封印/额外效果不同）；definition 里 ACTIVATE_LOCATION_CODES 数据无读点，应上收为共享 locationRule 工厂或原语', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08650.js:17-41 等 5 份 / content/.../definition.js:105-107' },
  { id: 'D5-2', dimension: 'duplication', severity: 'medium', summary: '08664–08668 五张取回封印地点条目同样复制 5 份，仅 rule 字符串/label/flags 不同；封印种类可走数据表', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08664.js:8-15 等 5 份' },
  { id: 'D5-3', dimension: 'duplication', severity: 'medium', summary: '「附属到最近且没有同名附属的地点」在 08691/08692/08699/08712 复制 4 份（含未使用的 nearestLocation 帮助函数与 if(true)/if(false) 死分支），应上收为 locationAttachment 原语', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08691.js:15-30 / deadly_weather/08692.js:23-45 / hazards_of_antarctica/08699.js:20-40 / silence_and_mystery/08712.js:13-29' },
  { id: 'D5-4', dimension: 'duplication', severity: 'medium', summary: '「地点附属强制窗口」被拆成 7 份独立 primitive-request（08691/08692/08693/08694/08699/08702/08707/08712），同一句规则分散排队；应合并为一个原语再逐卡接线', evidence: 'artifacts/migration/eote/primitive-requests/p7-08691.json … p7-08712.json' },
  { id: 'D5-5', dimension: 'duplication', severity: 'high', summary: 'Tekeli-li 牌库初始化在 iceAndDeathPart1/behavior.js:114 与 iceAndDeathPart2/behavior.js:91 各写一遍，且 7 卡面/份数常量在两者 definition 各抄一份；HeartOfMadness I/II 则完全没初始化 → 同一战役资源没有统一初始化原语（应放战役序章/统一 setup）', evidence: 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:114 / iceAndDeathPart2/behavior.js:91 / scenarios/theHeartOfMadnessPart1/behavior.js:87-96（无 tekeli）' },
  { id: 'D5-6', dimension: 'duplication', severity: 'medium', summary: '伙伴/遗物数据存在三份来源：records.js#PARTNERS（含 resolute 映射）、shared-encounters.js#PARTNER_ASSET_RULES/RESOLUTE_PARTNER_FORMS/MEMORIAL_FOR_PARTNER（从未被读取）、条目 flags；数据漂移风险高', evidence: 'content/campaigns/edgeOfTheEarth/records.js:150-170 / content/campaigns/edgeOfTheEarth/shared-encounters.js:183-228' },
  { id: 'D5-7', dimension: 'duplication', severity: 'medium', summary: '同一句「frost 首次揭示视为 -3」在 08655 单卡 forced 与 Part1 behavior.applyTokenEffect（写死卡号 08655，返回值无人消费）各实现一份', evidence: 'src/cards/encounter-entries/.../08655.js:12-30 / content/.../theHeartOfMadnessPart1/behavior.js:250-258' },
  { id: 'D5-8', dimension: 'duplication', severity: 'low', summary: '08692/08693/08694 三张 deadly_weather 诡计是同一模板的三份拷贝（仅附属目标/标签不同），可共享 helper', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08692.js, 08693.js, 08694.js' },
]

const priorLedger = [
  { code: '08660', ledger: 'verified', finding: 'high：背面 D/E 效果与卡面不符', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08660.js:21-24' },
  { code: '08662', ledger: 'verified', finding: 'high：背面整段未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08662.js:10-12' },
  { code: '08669', ledger: 'verified', finding: 'high：Spawn/Prey 未接线；再结算敌人阶段只近似', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08669.js:8-16' },
  { code: '08670', ledger: 'verified', finding: 'high：揭示效果在引擎路径上不可达', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08670.js:8-13 + content/.../definition.js:151' },
  { code: '08672', ledger: 'verified', finding: 'high：议程目标/毁灭替换未实现且 doomThreshold=0 自动推进', evidence: 'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:53' },
  { code: '08674', ledger: 'verified', finding: 'high：进入附加费+前置条件缺失（仅 A 力量生效）', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08674.js:11-18' },
  { code: '08675', ledger: 'verified', finding: 'high：进入附加费+前置条件缺失+B 力量未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08675.js:11-18' },
  { code: '08676', ledger: 'verified', finding: 'high：进入附加费+前置条件缺失+C 力量未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08676.js:11-18' },
  { code: '08677', ledger: 'verified', finding: 'high：进入附加费+前置条件缺失+D 力量未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08677.js:11-18' },
  { code: '08678', ledger: 'verified', finding: 'high：进入附加费+前置条件缺失+E 力量未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08678.js:11-18' },
  { code: '08680', ledger: 'verified', finding: 'high：Spawn/高塔免伤未实现；移动非最近', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08680.js:9-14' },
  { code: '08687', ledger: 'verified', finding: 'high：Hunter/Retaliate 关键词在合并表中丢失', evidence: 'src/engine/card-lookup.js:26 + content/.../theHeartOfMadnessPart2/definition.js:105-118' },
  { code: '08714', ledger: 'verified', finding: 'high：伙伴支援无入场路径（9 张同）', evidence: 'src/engine/eote-interactions.js:109-130（无调用方）' },
  { code: '08716', ledger: 'verified', finding: 'high：成功躲避后 ReferenceError', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js:35' },
  { code: '08721', ledger: 'verified', finding: 'high：整条 free 能力未实现（integrity empty-behavior）', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08721.js:9-12' },
  { code: '08731', ledger: 'verified', finding: 'high：整条 action 未实现', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08731.js:8-10' },
  { code: '08733', ledger: 'verified', finding: 'high：事件卡无 played 实现（引用的玩家条目文件不存在）', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08733.js:7-8' },
  { code: '08737', ledger: 'verified', finding: 'high：事件卡无 played 实现（引用的玩家条目文件不存在）', evidence: 'src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08737.js:7-8' },
]

const summary = {
  cards: cards.length,
  match: cards.filter(c => c.verdict === 'match').length,
  approximation: cards.filter(c => c.verdict === 'approximation').length,
  gap: cards.filter(c => c.verdict === 'gap').length,
  blocked: 0,
  notApplicable: 0,
  issuesBySeverity: {
    high: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'high').length, 0),
    medium: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'medium').length, 0),
    low: cards.reduce((n, c) => n + c.issues.filter(i => i.severity === 'low').length, 0),
  },
  unreadTriage: { total: unreadTriage.length, unwired: unreadTriage.filter(u => u.verdict === 'unwired').length, partial: unreadTriage.filter(u => u.verdict === 'partial').length, deadDeclaration: unreadTriage.filter(u => u.verdict === 'dead-declaration').length },
}

const out = {
  area: 'campaign/d',
  auditor: 'campaign-auditor-d',
  method: '逐卡逐子句核对 cards-data 卡面 vs 单卡条目 + 章节 behavior/引擎读点 + 真实引擎探针 + 测试断言强度；D4 对 screen/flags-readpoints 的本分片 91 条 unread 声明逐条全仓 grep 判定；D5 复核共享组与复制逻辑',
  generatedAt: '2026-11-08',
  scope: { codes, count: 91 },
  summary,
  testRun: {
    command: 'cd games/arkhamhorror && node tests/eote-scenario-theHeartOfMadnessPart1.test.mjs / Part2 / shared 分别 in-process 运行',
    result: 'Part1 7/7 pass；Part2 7/7 pass；shared 19/19 pass（共 33/33，exit 0）',
    assertionStrength: [
      'Part1：混乱标记用例（tests/eote-scenario-theHeartOfMadnessPart1.test.mjs:223-235）只断言 chaos helper 返回值，未初始化 Tekeli-li 牌库，未覆盖“实际抽牌”路径',
      'Part2：结局用例（:178-192）直接伪造 campaign.records.drKenslerHasAPlan=true，未验证记录写入路径；议程/毁灭/高塔攻击难度/pylon 力量/进入费用均无用例（:115-152 的 test stub 恒成功）',
      'shared：伙伴用例（tests/eote-scenario-shared.test.mjs:326-345）手工把 08714 塞进资产区，未验证“每章开局选派并置入战场”；纪念用例（:402-414）只在原语层 claim，未验证幕间接线',
      '08716 成功躲避路径、08679 横置方向、08673 难度取值均无断言',
    ],
  },
  scenarios,
  cards,
  unreadTriage,
  simplifiedReview,
  duplication: d5,
  priorLedger,
}
fs.writeFileSync(`${ROOT}/campaign/d/findings.json`, JSON.stringify(out, null, 1), 'utf8')
console.log('cards', summary.cards, 'match', summary.match, 'approx', summary.approximation, 'gap', summary.gap)
console.log('issues', JSON.stringify(summary.issuesBySeverity), 'unread', JSON.stringify(summary.unreadTriage))
console.log('bytes', fs.statSync(`${ROOT}/campaign/d/findings.json`).size)
