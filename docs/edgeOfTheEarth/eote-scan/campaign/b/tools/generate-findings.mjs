// 生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json（75 条战役卡）。
import fs from 'node:fs'

const DATA = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/data.json', 'utf8'))
const cardsByCode = Object.fromEntries(DATA.cards.map(record => [record.code, record]))
const coverageByCode = Object.fromEntries(DATA.screen.tests.cards.map(entry => [entry.code, entry]))
const readpoints = DATA.screen.readpoints.ourEntries
const unreadByCode = {}
for (const entry of DATA.screen.readpoints.ourUnread) (unreadByCode[entry.code] ||= []).push(entry.block + '.' + entry.key)

const B = 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js'
const D = 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
const C = 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js'
const I = 'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
const E = code => `src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/${code}.js`
const dev = code => {
  const record = cardsByCode[code]
  const entry = record?.entrySource || ''
  const flagsLine = entry.split('\n').findIndex(line => /flags:|agendaRule:|actRule:|enemyRule:|treacheryRule:/.test(line))
  return flagsLine >= 0 ? `${E(code)}:${flagsLine + 1}` : `${E(code)}:1`
}
const cardName = code => cardsByCode[code]?.card?.nameZh || cardsByCode[code]?.card?.name || code
const cardNameEn = code => cardsByCode[code]?.card?.name || code

const issue = (severity, dimension, summary, evidence, suggestion) => ({ severity, dimension, summary, evidence, suggestion })

// —— 共用问题（场景级）——
const SCENARIO_ISSUES = [
  issue('high', 'runtime',
    '致命幻景缺少议程/幕揭示钩子：定义声明 reveal.type=campaignRule，但 behavior 未导出 agendaReveal / actReveal；引擎 runAgendaReveal 在 campaignRule 且无钩子时直接 throw「密谋规则尚未迁移：08550」（已 in-process 复现），版本 1 的议程一推进就崩。',
    `${D}:146-147 / ${B}:302-323 / src/engine/phases.js:268-283 / src/engine/reveal.js:151-162`,
    '为 behavior 补 agendaReveal（结算 agenda 背面：其余调查员被击败 + 忒咳哩-哩/精神创伤，按版本 1/2/3）与 actReveal（→R1 结局），或把 reveal.type 改成引擎支持的数据形态。'),
  issue('high', 'runtime',
    '版本 2/3 的 agendaIndex 越界：setupScenario 把 agendaIndex 设为 version-1（1/2），但 state.agendas 只有 1 张 → 引擎读不到当前议程；已复现 advanceAgenda 静默 no-op、doom 累积到 20 也不推进（版本 1 则抛错），第二/三次进入无时间压力、无法正常结束。',
    `${B}:69-74 / ${D}:147`,
    '把版本 1/2/3 的 agenda/act 作为 1 张卡的数据（stage/doomThreshold 按版本取 08550/08551/08552），agendaIndex 恒为 0，不要用 agendaIndex 编码版本号。'),
  issue('high', 'runtime',
    '版本 2/3 的密谋毁灭阈值错误：setupScenario 只替换 originalCode，agenda 其余印刷数据仍取 08550（doomThreshold 15），而 08551/08552 应为 13/11；act stage 同样恒为 1a。',
    `${B}:71-72 / ${D}:147 / src/cards/cards-data.js（08550 doom=15、08551=13、08552=11）`,
    '用 stage(AGENDA_VERSION_CODES[version]) / stage(ACT_VERSION_CODES[version]) 取对应版本的印刷数据。'),
  issue('high', 'primitive',
    '19 个幻景地点的线索值全部为 0：definition 用 location({...clues:0})，card-data.location 因此生成 cluesPerInvestigator:0；placeLocation 又硬写 clues:0/maxClues:0。幻景地点的线索=幻景数值×未入场记忆数，0 线索导致「共同花线索翻面」永远无法执行，整章核心循环不可用。',
    `${D}:66-69 / ${B}:138-148 / content/campaigns/edgeOfTheEarth/card-data.js:32-41 / src/engine/locations.js:143-151`,
    '地点线索按印刷 clues（08556–08574）与「入场时减去已在场/胜利区的记忆数」计算（参考实现 mirageRunner 的 PerPlayer(m*n)）。'),
  issue('high', 'primitive',
    '声明未接线：mirageId / tier / reactionInvestigate / forcedAfterInvestigate / forcedInvestigate / forcedReveal / forcedOnFrostReveal / forcedOnCluesDiscovered / forcedTekeliliDraw / forcedTekeliliReveal / forcedFirstEntry / forcedTreacheryAttach / investigatorShroudBonus / extraInvestigateCost / moveCost / freeFrostForClues / shroudBonusIfTreacheryAttached / actionShuffleTekelili / locationModifier 等 flags 在 src+content 中只有条目自身声明，没有任何读点（唯一命中是测试断言 flags 存在）。',
    `${E('08560')}:9-14（示例）/ ${E('08571')}:9-16 / 全仓检索仅命中条目自身与 tests/eote-scenario-fatalMirage.test.mjs:142`,
    '按「声明即接线」补 behavior 读点（或迁移为 locationRule 描述子），并把无读点的声明从账本撤销；不得以测试断言 flag 值代替行为测试。'),
  issue('high', 'primitive',
    'flags.storyFlip 的唯一读点 behavior.flipStoryFace 没有任何引擎/内容调用点（全仓仅测试直接调用）；28 张关联面（08556b–08583b）的翻面数据在真实游玩中不会被读取；幻景地点也缺少「花线索翻面」action 入口（无 actions/performScenarioAction 钩子）。',
    `${B}:197-265 / tests/eote-scenario-fatalMirage.test.mjs:96,117,128,134 / src/engine/encounter.js:196-197`,
    '把翻面动作接到引擎 actions/performScenarioAction（或 locationRule 原语），并由地点 flip 事件调用 flipStoryFace；否则 storyFlip 数据 = 死数据。'),
  issue('high', 'primitive',
    '记忆敌人与坚毅伙伴的核心机制未接线：enemyRule.flipOnDefeat（08575–08584）无读点；preyPartner、loyal reaction flags（reactionDrawDamage 等）无读点；9 张记忆敌人没有 abilities，所有 [reaction]/[forced] 卡面能力缺失；flipStoryFace 里生成记忆敌人时用印刷固定 health（3/4/5），忽略 healthPerInvestigator。',
    `${E('08575')}:9-14 / ${E('08579')}:9-14 / ${B}:218-231 / src/engine/enemies.js:525-527`,
    '接 flipOnDefeat（敌人击败 → 读 b 面故事卡）与各 [reaction] 能力；生成用 spawnEnemy（走敌人定义 healthPerInvestigator）。'),
  issue('high', 'primitive',
    '故事/记录写入不闭环：b 面 08575b–08583b 用 storyFlip.resolutePartner / record 键，但读点只认 memoryEnemy/partner/victory；即使翻面也只把卡放进胜利区，不写「直面内心恶魔」、不把伙伴切到坚毅版本（resolutePartner/record/victoryOnBanish 三个键全仓无读点）。',
    `${E('08575b')}:12-14 / ${B}:218-262`,
    'flipStoryFace 增加 resolutePartner/record 分支：写 campaign.records.partnersFacedInnerDemon、把该伙伴 mark 为 resolute、处理 victoryOnBanish；或把 b 面数据改为 memoryEnemy 同构。'),
  issue('high', 'runtime',
    '结局钩子未接线：引擎 applyResolutionEffects 读 behavior.resolution，但 fatalMirage 的 behavior 只有 scenarioResolution（无 resolution 键），真实引擎路径不会执行结局记录：fatalMirageTimes / fatalMirageResolution / memoriesDiscovered / memoriesBanished / partnersFacedInnerDemon / xp 全部不会写（index.js 的 recordWrites 成为死声明）。',
    `${B}:275-296,302-323 / src/engine/campaign-flow.js:241-243 / ${I}:29-34`,
    'behavior 增加 resolution: scenarioResolution 并按引擎回调签名（state, resolutionKey, events, api）适配。'),
  issue('medium', 'impl-vs-text',
    '结局 XP 与记录口径错误：scenarioResolution 用「胜利区 b 码数量」当 XP（memoryCards.length），印刷规则是「新记录的记忆故事卡 Victory X 之和」+「其他非故事卡胜利点」；且正则 /^085(5[6-9]|6\\d|7[0-4])b$/ 不含 08575b–08583b（记忆敌人背面 victory 1），漏记漏 XP；也不记录伙伴伤害/恐惧、不划掉对应「发现的记忆」。',
    `${B}:276-296`,
    '按参考实现：memoriesInVictory = 胜利区所有 story 卡；XP 累加其 victory 值；同步 crossOut memoriesDiscovered、记录 partnerDamage。'),
  issue('high', 'impl-vs-text',
    '混沌标记失败追加效果缺失：08549 的 [cultist]（失败放线索）、[tablet]（失败移去记忆囚笼或洗忒咳哩-哩；困难失败 2+ 两者都做）、[elder_thing]（失败给幻灵敌人放毁灭）四个 rider 完全未实现；chaos.js 只返回数值，behavior 没有 afterTest/PassedSkillTest 读取揭示标记（对比 iceAndDeathPart2/behavior.js:355-374 的同族实现）。',
    `${C}:6-34 / ${E('08549')}:9-16 / tests/eote-scenario-fatalMirage.test.mjs:139-155（只测数值）`,
    '在 behavior.afterTest 读取揭示标记与失败差值，按难度结算 rider。'),
  issue('high', 'impl-vs-text',
    '遭遇牌组组成错误：参考 Setup 需要 gather Fatal Mirage / Agents of the Unknown / Left Behind / Miasma / Nameless Horrors / Silence and Mystery / Tekeli-li / Chilling Cold 八组；definition.GATHER_GROUPS 漏了 Chilling Cold（2 张诡计），ENCOUNTER_DECK 仅 22 张；同时把 Tekeli-li 组的 7 张弱点洗进主遭遇牌库，且未初始化忒咳哩-哩牌库（其他 EOTE 章节在 behavior 里 initializeTekeliDeck，fatalMirage 没有，manifest.requiredMechanicIds 为空）。',
    `${D}:19-22,94-99 / ${I}:26 / content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:114`,
    '补齐 chillingCold；把 Tekeli-li 弱点从主遭遇牌库拆出并在 setup 初始化 tekeli 牌库；manifest 登记 eoteTekeliDeck/eotePartners。'),
  issue('high', 'impl-vs-text',
    'setting 缺关键一步：preScenarioSetup / 伙伴选择未实现。参考实现在 PreScenarioSetup 让每位调查员从剩余伙伴里选一名（资产入场并恢复伤害/恐惧）；fatalMirage behavior 没有 preScenarioSetup，choosePartner 只有测试调用，真实游玩开局没有任何伙伴资产在场上，后续「伙伴是否活着」全部走兜底为 true。',
    `/src/engine/setup.js:740,754（preScenarioSetup 读点）/ ${B}:173-195（choosePartner 无生产调用点）`,
    '补 preScenarioSetup 伙伴选择（参考 FatalMirage.hs#ForInvestigator），并把选择结果写入伙伴名册/记录。'),
  issue('high', 'impl-vs-text',
    '准备阶段已放逐记忆进胜利区用了地点正面卡号：setupScenario 对 banished 地点 push { code: LOCATIONS[id].code }（如 08560），参考实现放入的是卡背 story 卡（08560b）。storyVictoryCount 只数以 b 结尾的码 → 已放逐记忆不计入 [skull] 值，结局也不再重复记录/去重口径不一致。',
    `${B}:94-97 / ${C}:14-20 / 参考 Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs:220-226`,
    'push `${LOCATIONS[id].code}b`（story 面卡号）。'),
  issue('high', 'primitive',
    '两处写状态越界/口径不一致：flipStoryFace 的「被划掉」分支用 asset.location === here 近似「弃掉附属到本地点的卡」，但调查员资产通常没有 location 字段（实际什么都不会弃，地点 attachments 也未清）；移动敌人包含已交战敌人（参考只移动未交战/massive）；且未 removeLocation、未提供「可推进当前幕或继续游戏」选择。',
    `${B}:232-244 / 参考 FatalMirage/Helpers.hs#handleMemory:94-113`,
    '按引擎原语：清 location.attachments、只移动 unengaged/massive、removeLocation、mayAdvance 选择。'),
  issue('medium', 'impl-vs-text',
    '08585/08586 两张诡计在真实遭遇路径里是 no-op：encounterDefinitions 声明 entryRevelation:true，但条目没有 encounterResolve / treacheryRule.test；fatalMirage behavior 也没有 resolveEncounter 钩子，treachery-tokens 的 entryRevelation 分支读不到任何效果，卡被弃掉且什么也不发生（易散之雾永不附属，回首往事不造成恐惧/毁灭）。',
    `${E('08585')}:12-14 / ${E('08586')}:12-14 / src/engine/treachery-tokens.js:113-124 / content/campaigns/edgeOfTheEarth/card-data.js:72-74`,
    '给 08585/08586 写 encounterResolve（或在本章 behavior.resolveEncounter 里按 treacheryRule 分派）。'),
  issue('medium', 'duplication',
    '同一规则重复三份：08549 的标记数值同时写在条目 flags.tokenMeanings、chaos.js FATAL_MIRAGE_TOKEN_MEANINGS、definition.scenario.tokenMeanings，且已漂移（条目 tablet 只写 -3，chaos.js 困难 -4）；条目 flags.tokenMeanings 无引擎读点（引擎读 state.scenario.tokenMeanings）。',
    `${E('08549')}:9-16 / ${C}:6-11 / ${D}:156-159`,
    '单源：chaos.js 导出、definition 引用；删除条目里的 tokenMeanings 副本。'),
  issue('medium', 'duplication',
    '三版议程/三版幕/19 个幻景地点/28 张关联面高度同构：agenda 三个条目除 version 外完全相同（agendaRule.freeMoveToPrisonOfMemories 三份、flags 三份）；act 三个 actRule:{}；地点的 mirage 规则没有共享原语，逐卡以不同 flag 名重复；MIRAGE_CHOICES 与各 b 面 storyFlip.choices 是同一数据两份；MEMORY_LINKS 与 b 面 storyFlip.memoryEnemy/partner 也是同一关系两份。',
    `${E('08550')}:11-14 / ${E('08551')}:11-14 / ${E('08552')}:11-14 / ${D}:125-135 vs ${E('08557b')}:12 / ${D}:113-123 vs ${E('08566b')}:13`,
    '上收 mirageLocation 原语与 storyFlip 数据表（一个真相源），版本差异只保留数据。'),
  issue('medium', 'tests',
    '测试与账本证据不成立：61/75 张卡在 tests-coverage 中为 none；60/75 张在 audit/eote-all-card-acceptance.json 里的证据是同一条 scenario-ledger 指向 tests/eote-scenario-theHeartOfMadnessPart2.test.mjs（该文件不包含任何 fatalMirage 卡号、也不提 fatalMirage），属错误证据；eote-scenario-fatalMirage.test.mjs 的断言多为直接调用 behavior 函数与断言 flags 声明存在（如 142-144 行），没有任何真实引擎 startScenario/applyResolutionEffects 路径断言。',
    'audit/eote-all-card-acceptance.json（60 条 fatalMirage 记录）/ games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/tests-coverage.json / tests/eote-scenario-fatalMirage.test.mjs:139-155',
    '重新以行为证据（真实引擎路径 + 卡号在标题）登记；删除跨章 scenario-ledger 证据。'),
  issue('medium', 'primitive',
    'simplified 披露链断裂：08560/08561/08562/08565/08566/08567/08571/08572 与 08587–08595 的 simplified reason 写 "pending-primitive: p7-08560 / p7-08587（近似已披露）"，但 artifacts/migration/eote/primitive-requests/ 下不存在 p7-08560.json / p7-08587.json（全仓仅 audit 两个文件出现该 id），deferred 的 pendingBehaviorRequests 也未列对应 primitiveRequest 条目；条目头注释没有近似说明，scenarioApproximations / approximationMarkers 为空。',
    'audit/eote-all-card-acceptance.json（17 条 simplified）/ audit/eote-migration.json#releaseAcceptance.deferred / games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/known-deviations.json',
    '补写 primitive 请求与条目级近似注释（逐条写清实现到哪一步）；否则 simplified 视为未披露的 missing。'),
]

const scenario = {
  id: 'fatalMirage',
  name: '致命幻景 / Fatal Mirage',
  referenceCode: '08549',
  cardsInScope: 75,
  flow: {
    status: 'partial',
    enteredFrom: 'content/campaigns/edgeOfTheEarth/interludes.js:124-134,184-205,243-264（幕间 I/II/III 的门选项 next: fatalMirage）；parts.js:83-85 的幕间出口；flow.js:42-51 的 SCENARIO_NEXT',
    returnedTo: 'flow.js:74-84 的 fatalMirageReturn（stepReturn：city/forbidden peaks → 主线下一章）；parts.js:59-66 的入口/返回表；src/campaign/campaign-flow.js:375-435 支持 stepReturn',
    setup: `${B}:64-136 setupScenario 被引擎 setupLocations 调用（src/engine/setup.js:743,795-799）`,
    deadlocks: [
      '议程推进即抛错（已复现）：runAgendaReveal campaignRule 无 agendaReveal → Error 密谋规则尚未迁移：08550（src/engine/phases.js:276-278）',
      '版本 2/3 agendaIndex 越界 → 当前议程 undefined，议程永不推进（advanceAgenda 静默返回，已复现）',
      '幕没有推进/揭示实现（actRule 为空、无 checkObjectives/actReveal），胜利结局无法触发；只有全灭的 noResolution 可出（需确认全灭路径）',
      '19 个地点线索值 0 → 幻景翻面 action 无资源可花，核心循环不可用（即使补了翻面入口）',
      '伙伴资产不在场：无 preScenarioSetup/choosePartner 生产调用点，记忆敌人的「伙伴活着」判定恒走兜底 true',
    ],
    records: {
      statedReads: ['memoriesBanished', 'memoriesDiscovered', 'partnersFacedInnerDemon'],
      statedWrites: ['memoriesBanished', 'memoriesDiscovered', 'fatalMirageResolution', 'fatalMirageTimes', 'fatalMirageCompleted', 'partnersFacedInnerDemon', 'resolutePartners', 'xp'],
      engineWriter: '不存在：behavior 无 resolution 键（src/engine/campaign-flow.js:241-243）；scenarioResolution 只在测试里被调用',
      readsInCampaign: 'records.js 声明 8 个键；fatalMirageTimes 在 behavior.fatalMirageVersion 读，其余 fatalMirageResolution/fatalMirageCompleted/resolutePartners 全仓无消费点',
    },
  },
  issues: SCENARIO_ISSUES,
}

// —— 分类判定 ——
const CATEGORY = {
  scenarioRef: ['08549'],
  agenda: ['08550', '08551', '08552'],
  act: ['08553', '08554', '08555'],
  location: [],
  locationStory: [],
  memoryEnemy: ['08575', '08576', '08577', '08578', '08579', '08580', '08581', '08582', '08583'],
  memoryStory: ['08575b', '08576b', '08577b', '08578b', '08579b', '08580b', '08581b', '08582b', '08583b'],
  partner: ['08587', '08588', '08589', '08590', '08591', '08592', '08593', '08594', '08595'],
  horrorShade: ['08584'],
  treachery: ['08585', '08586'],
}
for (let n = 56; n <= 74; n++) {
  const code = '085' + String(n).padStart(2, '0')
  CATEGORY.location.push(code)
  CATEGORY.locationStory.push(code + 'b')
}
const categoryOf = code => Object.keys(CATEGORY).find(key => CATEGORY[key].includes(code))

const splitClauses = text => String(text || '').split('\n').map(line => line.trim()).filter(Boolean)

function clauseList(code) {
  const card = cardsByCode[code].card || {}
  const cat = categoryOf(code)
  const textLines = splitClauses(card.text)
  const backLines = splitClauses(card.backText)
  const out = []
  const add = (text, status, evidence, note = '') => out.push({ text, status, evidence, note })
  if (cat === 'scenarioRef') {
    for (const line of textLines.slice(1)) add(line, /if you fail/i.test(line) ? 'missing' : 'implemented',
      `content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js:6-11,22-34`, /if you fail/i.test(line) ? '数值已实现，失败追加效果未实现（无 afterTest 钩子）' : '数值由 chaos.js/behavior.chaosTokenValue 实现')
    for (const line of backLines.slice(1)) add(line, /if you/i.test(line) ? 'missing' : 'implemented',
      `content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js:6-11,22-34`, /if you/i.test(line) ? '困难/专家 rider 未实现' : '困难数值已实现（hard bonus 见 chaos.js:23-31）')
    add('英文/中文卡面数据与参考实现一致（skull 数值、difficulty 分支）', 'implemented', 'src/cards/cards-data.js（08549 字段）', '')
    return out
  }
  if (cat === 'agenda') {
    add(textLines.join(' '), 'missing', dev(code), 'agendaRule.freeMoveToPrisonOfMemories 无读点；agenda 在真实路径无法揭示/推进（无 agendaReveal 钩子）')
    add(backLines.join(' '), 'missing', dev(code), '背面「其余调查员被击败 + 忒咳哩-哩/精神创伤」无实现；版本 1 推进时抛 密谋规则尚未迁移：08550（已复现）')
    add('版本选择：由 behavior.fatalMirageVersion / agendaCodeForVersion 决定', 'approximation', `${B}:42-57,67-74`, '仅替换 originalCode；doomThreshold/stage 仍用 08550 的 15/1a，版本 2/3 应为 13/11 与 2a/3a')
    return out
  }
  if (cat === 'act') {
    add(textLines.join(' '), 'missing', dev(code), 'actRule:{} 无目标判定；无 checkObjectives/actReveal/actIndexAfterAdvance，幕永远不会推进（→R1 结局不可达）')
    add(backLines.join(' '), 'missing', `${B}:302-323`, '结局 R1 未接线（behavior 无 resolution 键）')
    return out
  }
  if (cat === 'location') {
    const mirage = textLines.find(line => /^Mirage /.test(line)) || textLines[0]
    add(mirage, 'missing', dev(code) + ' / ' + D + ':66-69', '幻景关键词整体缺失：无「共同花线索翻面」动作、无入场按已入场记忆数减线索、无 cleared-of-mirages 判定；地点线索值被置 0（definition LOCATIONS cluesPerInvestigator=0）')
    for (const line of textLines.filter(line => !/^Mirage /.test(line))) {
      if (/^X is the current agenda number/.test(line)) {
        add(line, 'missing', `${D}:66-69 / ${E(code)}:12`, '幻景线索值说明（每张记忆卡使线索值减少幻景数值）；当前地点线索被置 0，未实现该计算')
        continue
      }
      add(line, 'missing', dev(code), '地点强制/反应能力仅声明 flag 名，无任何读点（无 locationRule/abilities，behavior 也无 locationEntered/afterInvestigate 钩子）')
    }
    return out
  }
  if (cat === 'locationStory') {
    for (const line of textLines) {
      if (/^Choose one/m.test(line) || /^- /.test(line)) add(line, 'approximation', `${E(code)}:12 / ${B}:201-216`, '选择与「放入一边的下一层地点」只在 behavior.flipStoryFace 里实现，引擎无调用点（测试直调）')
      else if (/Flip this card back over/.test(line)) add(line, 'missing', `${E(code)}:12`, '翻回/卡面翻面机制缺失：b 面被建模为独立 global storyAsset，引擎无翻面入口')
      else add(line, 'approximation', `${E(code)}:12`, '直接放置地点逻辑在 flipStoryFace 的 choices[0] 兜底，无玩家选择交互')
    }
    return out
  }
  if (cat === 'memoryEnemy') {
    add(textLines[0] || 'keywords', 'implemented', `content/campaigns/edgeOfTheEarth/card-data.js:54-81`, 'Alert/Retaliate 由 encounterDefinitions 解析进敌人定义（引擎支持关键词）')
    add(textLines.find(line => /^Prey/.test(line)) || 'Prey', 'missing', dev(code), 'preyPartner 无读点；记忆敌人没有「生成到被翻面地点」的引擎逻辑')
    for (const line of textLines.filter(line => /\[reaction\]|Forced/.test(line))) {
      add(line, 'missing', dev(code), line.includes('Forced') ? 'enemyRule.flipOnDefeat 无读点，敌人被击败不会翻面结算 08575b–08583b' : '记忆敌人的 [reaction] 能力没有 abilities 实现')
    }
    add('healthPerInvestigator（按调查员数）', 'missing', `${B}:224-231 / src/engine/enemies.js:525-527`, 'flipStoryFace 若被调用会用固定 health 生成，未走 spawnEnemy 的 healthPerInvestigator')
    return out
  }
  if (cat === 'memoryStory') {
    for (const line of textLines) {
      add(line, 'missing', `${E(code)}:12-14 / ${B}:258-262`, 'storyFlip 用 resolutePartner/record 键，但读点只认 memoryEnemy/partner/victory：即使翻面也只入胜利区，不记录直面恶魔、不切换坚毅版本')
    }
    add('Add this card to the victory display.（victory 1）', 'missing', `${E(code)}:12`, 'flipStoryFace 的 else-if 分支可把卡 push 胜利区，但无引擎调用点；且 victory 值未被结局 XP 统计（正则不含 08575b–08583b）')
    return out
  }
  if (cat === 'partner') {
    add(textLines.find(line => /^Partner/.test(line)) || 'Partner.', 'implemented', `${E(code)}:9-15`, 'uses/usesType 由条目声明，实例创建由 campaign 侧照抄；但真实引擎路径没有把坚毅伙伴交给调查员的调用点（choosePartner 仅测试）')
    const abilityLine = textLines.find(line => /\[fast\]|\[reaction\]|\[action\]/.test(line))
    if (['08589', '08592', '08593'].includes(code)) {
      add(abilityLine, 'approximation', `${E(code)}:16-30`, 'ability 已实现，但印刷 [fast] 被建模为 kind:action 且 cost.action:true（要花行动），应为自由触发；08592/08593 的效果为近似（不能攻击只 info、看牌库顶过于宽泛）')
    } else {
      add(abilityLine, 'missing', `${E(code)}:12-15`, 'abilities: []，只有未被读取的 partnerRules handler 名；能力完全未实现（坚毅 Dyer/Sinha/Claypool/Ellsworth/Takada 与 08588 丹佛斯）')
    }
    add('Partner. 坚毅形态与 expeditionTeam 基础伙伴的映射（08587–08595 ↔ 08714–08722）', 'approximation', `${B}:16-24,150-160,268-273`, '映射按中文名反查、按名册状态判定存活；基础伙伴能力在 _shared/expedition_team/08714–08722 单卡条目，坚毅形态没有复用/复用边界未在账本说明')
    return out
  }
  if (cat === 'horrorShade') {
    add(textLines[0] || 'Aloof. Hunter.', 'approximated' in {} ? 'approximation' : 'implemented', 'content/campaigns/edgeOfTheEarth/card-data.js:54-81', 'Aloof/Hunter 关键词解析进敌人定义')
    add('While Horrifying Shade is at a location that is cleared of mirages, it loses aloof.', 'missing', `${E(code)}:13`, 'losesAloofAtFlippedLocation 无读点；引擎没有 cleared-of-mirage 概念')
    add('Forced - After you discover or take control of 1 or more clues at Horrifying Shade\'s location: Place an equal amount of doom on Horrifying Shade.', 'missing', `${E(code)}:13`, 'doomOnClueDiscover 无读点；无 abilities/钩子')
    add('enemyRule: { flipOnDefeat: false }', 'approximation', `${E(code)}:12`, '印章无翻面，flipOnDefeat:false 是冗余声明（且 flipOnDefeat 本身无读点）')
    return out
  }
  if (cat === 'treachery') {
    for (const line of textLines) {
      add(line, 'missing', `${E(code)}:12-14 / src/engine/treachery-tokens.js:113-124`, 'entryRevelation 路径找不到 encounterResolve/treacheryRule.test；本章无 resolveEncounter，真实抽到该卡时什么都不发生（treacheryRule 键无读点）')
    }
    return out
  }
  return out
}

const verdictOf = (code, clauses) => {
  const cat = categoryOf(code)
  const missing = clauses.filter(clause => clause.status === 'missing').length
  const approximation = clauses.filter(clause => clause.status === 'approximation').length
  if (cat === 'partner' && ['08589', '08592', '08593'].includes(code)) return 'approximation'
  if (missing > 0) return 'gap'
  if (approximation > 0) return 'approximation'
  return 'match'
}

const perCardIssues = code => {
  const cat = categoryOf(code)
  const list = []
  if (cat === 'scenarioRef') {
    list.push(issue('high', 'impl-vs-text', '四个混沌标记的失败追加 rider 未实现（只实现数值）。', `${E(code)}:9-16 / ${C}:6-34`, 'behavior 补 afterTest 结算 rider'))
    list.push(issue('medium', 'duplication', 'marker 数值三处重复且已漂移（tablet 困难 -4 只在 chaos.js）。', `${E(code)}:9-16 / ${C}:6-11 / ${D}:156-159`, '单源化'))
  } else if (cat === 'agenda') {
    list.push(issue('high', 'impl-vs-text', '正面 [fast] 移去记忆囚笼与背面「其余调查员被击败…」均只声明 agendaRule 数据，无读点/无 agendaReveal。', `${dev(code)} / ${B}:302-323`, '补 agendaReveal 并接 agendaRule'))
    list.push(issue('high', 'runtime', '版本 2/3 的 agendaIndex 越界（agenda 数组只有 1 张），议程不会推进；版本 1 推进时抛 密谋规则尚未迁移：08550（已复现）。', `${B}:67-74 / ${D}:147`, '按版本取对应印刷数据、agendaIndex 恒 0'))
    list.push(issue('medium', 'duplication', '三版议程条目除 version 外完全重复，规则应上收原语。', `${E('08550')}:11-14 / ${E('08551')}:11-14 / ${E('08552')}:11-14`, '共享 agendaRule 数据表'))
  } else if (cat === 'act') {
    list.push(issue('high', 'impl-vs-text', '幕目标/推进没有任何实现（actRule:{}；无 checkObjectives/actReveal），→R1 结局不可达。', `${dev(code)} / ${B}:302-323 / src/engine/reveal.js:151-162`, '实现幕推进条件与 actReveal'))
    list.push(issue('high', 'runtime', '引擎读 state.agendas/acts 推进；幕只有 1 张且 stage 恒为 1a，版本 2/3 幕面数据未生效。', `${B}:71-72`, '按版本取 stage(ACT_VERSION_CODES[version])'))
  } else if (cat === 'location') {
    list.push(issue('high', 'impl-vs-text', '幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。', `${dev(code)} / ${D}:66-69 / ${B}:138-148`, '实现 mirage 原语（参考 FatalMirage/Helpers.hs#mirage/mirageRunner）'))
    list.push(issue('high', 'primitive', '本卡的强制/反应文本只有 flag 声明（mirageId/tier/' + (unreadByCode[code] || []).map(key => key.split('.').pop()).join('/') + '），无任何读点。', `${dev(code)}`, '按声明即接线补 behavior/locationRule 读点'))
  } else if (cat === 'locationStory') {
    list.push(issue('high', 'primitive', 'storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。', `${E(code)}:12 / ${B}:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134`, '接引擎翻面 action → flipStoryFace'))
    list.push(issue('medium', 'impl-vs-text', '故事面「选择一项 + 放入地点 + 翻回」中，翻回机制缺失（b 面被建模为独立故事卡，无翻面入口）；选择交互只取 choices[0] 兜底。', `${B}:207-216`, '补选择交互与翻面/回收'))
  } else if (cat === 'memoryEnemy') {
    list.push(issue('high', 'impl-vs-text', '被击败时翻面结算（flipOnDefeat）与 [reaction] 能力缺失；preyPartner 未接线。', `${dev(code)} / ${B}:302-323`, '接 flipOnDefeat（击败 → 结算对应 b 面）+ reaction abilities'))
    list.push(issue('medium', 'runtime', '若经 flipStoryFace 生成，health 用印刷固定值而非 healthPerInvestigator。', `${B}:224-231`, '走 spawnEnemy 敌人定义'))
  } else if (cat === 'memoryStory') {
    list.push(issue('high', 'impl-vs-text', 'resolutePartner / record / victoryOnBanish 键无读点：即使翻面也不记录直面恶魔、不切换坚毅伙伴。', `${E(code)}:12-14 / ${B}:218-262`, '补 resolutePartner/record 分支'))
    list.push(issue('medium', 'impl-vs-text', '「Add this card to the victory display」的 victory 1 未纳入结局 XP（正则不含 08575b–08583b）。', `${B}:276-291`, '结局统计胜利区所有 story 卡 victory 值'))
  } else if (cat === 'partner') {
    if (['08589', '08592', '08593'].includes(code)) {
      list.push(issue('medium', 'impl-vs-text', '印刷 [fast] 被实现为消耗 1 行动（kind:action + cost.action:true）；效果细节为近似（08592 的「本轮不能攻击」仅写日志、08593 只能看 1 张牌且无「可弃掉」选择）。', `${E(code)}:16-30`, '改为自由触发并补齐效果细节'))
    } else {
      list.push(issue('high', 'impl-vs-text', '伙伴能力未实现（abilities: []），只有无读点的 partnerRules 声明。', `${E(code)}:12-15`, '按印刷补 abilities（参考同组 08714–08722 的实现风格）'))
    }
    list.push(issue('high', 'runtime', '伙伴资产在真实引擎路径中不会入场：choosePartner 无生产调用点、behavior 无 preScenarioSetup；本卡只能通过测试手工放入。', `${B}:173-195 / src/engine/setup.js:740`, '补 preScenarioSetup 伙伴选择'))
  } else if (cat === 'treachery') {
    list.push(issue('high', 'impl-vs-text', '显现文本无实现：entryRevelation 路径无 encounterResolve/test/effect，真实遭遇抽到该卡为 no-op。', `${E(code)}:12-14 / src/engine/treachery-tokens.js:113-124`, '写 encounterResolve 或 behavior.resolveEncounter'))
  } else if (cat === 'horrorShade') {
    list.push(issue('high', 'impl-vs-text', '「cleared of mirages 时失去冷漠」与「发现线索后放等量毁灭」均未实现（无读点、无 abilities）。', `${E(code)}:12-13`, '补敌人持续能力与线索发现强制'))
    list.push(issue('low', 'impl-vs-text', 'enemyRule.flipOnDefeat:false 是无读点的冗余声明。', `${E(code)}:12`, '删除'))
  }
  return list
}

const cards = DATA.scope.codes.map(code => {
  const record = cardsByCode[code]
  const card = record.card || {}
  const clauses = clauseList(code)
  const verdict = verdictOf(code, clauses)
  const issues = perCardIssues(code)
  const testEntry = coverageByCode[code]
  const testStatus = testEntry?.level === 'strong' ? 'covered' : testEntry?.level === 'file-only' ? 'weak' : 'none'
  const ledger = DATA.deviations.simplified.find(entry => entry.code === code)
  return {
    code,
    name: card.name || cardNameEn(code),
    nameZh: card.nameZh || cardName(code),
    type: card.type,
    ledgerStatus: ledger ? 'simplified' : 'verified',
    simplifiedReason: ledger ? ledger.reason : null,
    verdict,
    accepted: false,
    clauses,
    tests: {
      status: testStatus,
      evidence: testEntry ? (testEntry.strongTitles?.length
        ? `${testEntry.strongTitles[0].file}:${testEntry.strongTitles[0].line} ${testEntry.strongTitles[0].title}`
        : `tests/eote-scenario-fatalMirage.test.mjs（仅文件命中，无本卡断言）`) : '无测试命中',
      note: testStatus === 'none' ? 'tests-coverage 判定 none；真实引擎路径无覆盖' : '',
    },
    issues,
  }
})

const issueCount = cards.flatMap(card => card.issues).concat(SCENARIO_ISSUES)
const bySeverity = issueCount.reduce((map, item) => { map[item.severity] = (map[item.severity] || 0) + 1; return map }, {})
const summaryCounts = cards.reduce((map, card) => { map[card.verdict] = (map[card.verdict] || 0) + 1; return map }, {})

const findings = {
  area: 'campaign/b',
  auditor: 'campaign-auditor-b',
  method: '逐卡逐子句核对 cards-data 卡面 vs 单卡条目/章节 behavior/definition/chaos 消费点，并以 in-process 引擎路径复现议程推进问题；D3/D4/D5 附 file:line；simplified 逐条对照 audit/eote-all-card-acceptance.json 与 audit/eote-migration.json#releaseAcceptance.deferred。',
  generatedAt: '2026-11-08',
  scope: { codes: DATA.scope.codes, count: DATA.scope.codes.length, chapter: 'fatalMirage' },
  summary: {
    cards: cards.length,
    match: summaryCounts.match || 0,
    approximation: summaryCounts.approximation || 0,
    gap: summaryCounts.gap || 0,
    blocked: 0,
    notApplicable: 0,
    issuesBySeverity: { high: bySeverity.high || 0, medium: bySeverity.medium || 0, low: bySeverity.low || 0 },
    verifiedInLedger: cards.filter(card => card.ledgerStatus === 'verified').length,
    simplifiedInLedger: cards.filter(card => card.ledgerStatus === 'simplified').length,
  },
  testsRun: {
    command: 'node tests/eote-scenario-fatalMirage.test.mjs tests/eote-scenario-shared.test.mjs',
    note: '在 games/arkhamhorror 下以 in-process 方式（node --experimental-test-isolation=none --test）运行通过：27 tests / pass 27 / fail 0（fatalMirage 8 条 + shared 19 条）。断言均为直接调用 behavior/条目，没有真实引擎 startScenario/applyResolutionEffects 路径断言。',
  },
  scenario,
  issues: issueCount,
  cards,
}

fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json', JSON.stringify(findings, null, 1))
console.log('wrote findings.json', JSON.stringify(findings.summary))
console.log('scenario issues', SCENARIO_ISSUES.length)
