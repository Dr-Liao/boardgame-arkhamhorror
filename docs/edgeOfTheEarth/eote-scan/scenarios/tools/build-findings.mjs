// 生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/findings.json + notes.md（基于本轮真实引擎 run-through 与静态核对）。
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios'
const LOGS = path.join(OUT, 'logs')
function readJson (file) {
  const buffer = fs.readFileSync(file)
  let text
  // PowerShell 7 的 `>` 重定向是 UTF-16LE；统一容错读取。
  if (buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) text = buffer.toString('utf16le').slice(1)
  else if (buffer.length > 4 && buffer[1] === 0x00 && buffer[3] === 0x00) text = buffer.toString('utf16le')
  else text = buffer.toString('utf8')
  return JSON.parse(text.replace(/^\uFEFF/, ''))
}
const runthrough = readJson(path.join(LOGS, 'runthrough.json'))
const guideCoverage = readJson(path.join(OUT, 'guides/_guide-coverage-v2.json'))
const flowConsistency = readJson(path.join(LOGS, 'flow-consistency.json'))
const deckProbe = readJson(path.join(LOGS, 'decks.json'))
const encounterProbe = readJson(path.join(LOGS, 'probe-encounters.json'))

const R = p => `games/arkhamhorror/${p}`
const CHAPTER_DIR = 'content/campaigns/edgeOfTheEarth/scenarios'

function deepOf (id) {
  return (runthrough.runs.deep || []).find(entry => entry.id === id) || null
}
function coverageOf (id) {
  return (guideCoverage.chapters || []).find(entry => entry.id === id) || null
}

const ISSUES = {
  iceAndDeathPart1: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '行为层 scenarioActions / performScenarioAction（扎营撤退）声明后无任何引擎读点：合法动作列表从不生成 campResign，幕 I 的「全员撤退」目标无法达成，本关无法自然结算（只能全灭 noResolution 或调试指令）',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:249-278`)}（scenarioActions 定义）与 src/engine/moves.js（合法动作生成）grep 无 scenarioActions 读点；src/engine/dispatch.js:633 只执行已出现的 scenarioAction。真实引擎深驱动 10 轮 60 个动作 movesSeen=[play,draw,resource,move,investigate,entityAbility,endTurn]，从未出现 scenarioAction/resign`,
      suggestion: '在 moves.js 的合法动作生成中消费 scenarioBehavior(state).scenarioActions（或改为 locationRule.actions 单卡声明，如 IDP3 08546 的做法），并补真实引擎回归测试（构造撤退→结局 1）',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '议程 I/II/III 背面效果未接线：behavior.agendaReveal 为空函数，条目 08518/08519/08520 的 agendaRule.onAdvance 无引擎读点；议程推进后不生成疾行谬物、不洗入冰中生物、不生成星之恐怖、也不触发「时间不够」的强制撤退结局',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:399`)}（agendaReveal(){}）；${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:372-380`)}（resolveAgendaBack 仅测试调用）；src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart1/08518.js:15 onAdvance 无 src 读点；runthrough deep hookProbe.agenda：agendaIndex 0→1、enemies/encounterDeck/doom 均无变化`,
      suggestion: '把 resolveAgendaBack 接到 agendaReveal（按 agendaRule.onAdvance 字符串分派），并补「议程推进后状态变化」的真实引擎测试',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '结局 1 缺「营地庇护值（最低 3）+ 胜利区 XP」的经验奖励：resolution 钩子只写记录不返回 bonus，引擎按 state.victory 发放',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:342-366`)}（返回 { key, camp, shelter, locationsRevealed }，无 bonus）；src/engine/campaign-flow.js:265-296（XP = state.victory + bonus）；指南 resolutions.resolution1「每位调查员获得等于营地庇护值（最小3）加胜利区的经验」`,
      suggestion: 'resolution 返回 { bonus: Math.max(3, shelter) }，并按指南把伙伴伤害/恐惧记录进战报',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '指南要求开局每名调查员选择一名可用伙伴入场（并记录其伤害/恐惧）；实现没有任何关卡入口调用伙伴选择（FM behavior.choosePartner 无引擎读点），深驱动中伙伴从未入场',
      evidence: `guides/iceAndDeathPart1.en.md setup[0]；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:173-195`)}（choosePartner 仅测试调用）；src/engine 无 choosePartner/eotePartner 触发点（eote-interactions.js:126 的 operation 只有测试覆盖）；runthrough 各章 setup.partnersRoster=9 但无伙伴资产在场`,
      suggestion: '在关卡 setup（或 hubBeginScenario 前）加入 eotePartner 交互：候选=未划去/未 MIA 伙伴，选后放剧情资产；结局时把伙伴 damage/horror 写回战役记录',
    },
    {
      severity: 'low', dimension: 'duplication',
      summary: 'behavior.js 重复定义 PRINTED_LINKS/PUBLIC_LINKS 打印连接表（与 definition.js 同源），应复用单一常量',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:77-89`)} 与 ${R(`${CHAPTER_DIR}/iceAndDeathPart1/definition.js:46-60`)}`,
      suggestion: '从 definition 导出打印连接表并在 behavior 复用',
    },
  ],
  iceAndDeathPart2: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '议程 1（08523 冷风呼啸）推进直接抛错「密谋规则尚未迁移：08523」：behavior 未提供 agendaReveal，而定义把议程 reveal 声明为 campaignRule；真实引擎在第 1 次神话阶段议程推进时崩溃（深驱动 24 个动作后复现）',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:383-404`)}（behavior 对象无 agendaReveal）；src/engine/phases.js:277 在缺少 agendaReveal 时 throw；runthrough deep-drive errors=[\"密谋规则尚未迁移：08523\"]；p8 测试因 debug endScenario 提前结束而绕过该路径`,
      suggestion: '补 agendaReveal（分派 agendaRule.onAdvance / resolveAgendaBack，08523/08524 lookUnderLocation、08525 defeatRemainingAndResolve），并加真实引擎议程推进回归测试',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '行动派生的 act/agenda 背面钩子（agendaRule.onAdvance lookUnderLocation / defeatRemainingAndResolve）与 behavior.resolveAgendaBack / resolveStory 只被测试调用，真实引擎无读点',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:392-398`)}；src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart2/08523.js:10、08524.js:10、08525.js:10；runthrough deep hookProbe.act 抛「场景规则尚未迁移：08526」`,
      suggestion: 'actReveal/agendaReveal 统一分派；补「翻面后查看/击败并结局」的真实引擎用例',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '指南要求开局基础资源 = 当前营地庇护值（而非 5）；实现未调整，深驱动快照 resources=[5,5]（营地 frozenShores 庇护 2）',
      evidence: `guides/iceAndDeathPart2.en.md setup[0]「Each investigator’s base starting resources is equal to the shelter value of the camp, instead of five.」；${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:53-114`)}（setupScenario 无资源调整）；runthrough deep setup.investigatorResources=[5,5]`,
      suggestion: '在 preScenarioSetup/setupScenario 里把每名调查员初始资源设为营地庇护值（记录来源 shelterValueOf），并补测试',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: 'MIA 伙伴压卡数量不足 9：指南要求「敌人+剧情卡合计恰好 9 张」压到 9 个未探索地点下；无 MIA 时实现只压 8 张剧情卡（slice(0,9)），有一处未探索地点无压卡',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:94-108`)}；deep run（无 MIA）` + JSON.stringify(deckProbe.iceAndDeathPart2?.asideAliases) + `；指南 setup[1].children[6]「until there are a total of exactly nine enemy and story cards set aside in this way」`,
      suggestion: '按参考实现补足到 9 张（MIA 敌人优先，否则补剧情卡），并把多出的放回/移出规则写清',
    },
  ],
  iceAndDeathPart3: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '本关无法正常结算：behavior 没有 checkObjectives/actReveal/agendaReveal/resolution 钩子；幕目标 objective.type=noEidolonEnemies 引擎不支持（act-agenda.js 只处理 clues/defeatEnemy/uniqueCultists/actClues），actObjectiveMet 无读点；结局键与指南/剧情不一致',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:90-97`)}（actObjectiveMet）、:149-164（behavior 对象无 checkObjectives/resolution）；${R(`${CHAPTER_DIR}/iceAndDeathPart3/definition.js:137-141`)}（resolutions=victory/defeat/noResolution）；story-text.js 本章 resolutions 键为 noResolution/resolution1/resolution2；runthrough deep：自然结束仅 noResolution（全灭），hookProbe.act/agenda 均抛「…尚未迁移：08546/08544」`,
      danger: true,
      suggestion: '改 resolution 键为指南口径（noResolution/resolution1/resolution2），补 actReveal/agendaReveal/checkObjectives/resolution 钩子并在引擎支持 noEidolonEnemies 目标',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '遭遇牌库未按印刷份数展开（22 张全唯一），且把 7 张 Tekeli-li 放进遭遇牌库、未建立 Tekeli-li 牌库；指南要求按 gather 份数并单独忒咳哩-哩牌库',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/definition.js:116-121`)}（deckCodes=唯一 code 列表）、:136；runthrough setup.encounterDeck=22 unique=22（应为展开后约 24-36 张，按排除幻灵/渗出梦魇后），tekeliDeck=null；指南 setup[0].children[8]「Shuffle each Tekeli-li! weakness card … form the Tekeli-li deck」`,
      suggestion: '按 quantity 展开、过滤出 Tekeli-li 到独立牌库并 initializeTekeliDeck；补开局牌库构成断言测试',
    },
    {
      severity: 'medium', dimension: 'runtime',
      summary: '渗出梦魇副本留在遭遇牌库（指南要求按人数生成后把剩余移出游戏）；已生成梦魇压卡分配用 slice 均分（与「尽量均分」等价但未处理余数）',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:31-69`)}；deckProbe.iceAndDeathPart3.byGroup.seeping_nightmares=2`,
      suggestion: '从遭遇牌库移除全部 Seeping Nightmare，按参考实现 spawn 后移除剩余',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: 'startLocation 固定为 DEFAULT_CAMP（crashSite），与战役记录的当前营地不一致；引擎 UI/起始地点展示可能与实际（frozenShores）不符',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/definition.js:129`)}；runthrough deep setup.startLocation=crashSite 而 investigatorLocation=frozenShores`,
      suggestion: '运行期把 scenario.startLocation 更新为 campId(state)（或由引擎读取 scenarioFlags.camp）',
    },
  ],
  fatalMirage: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '「幻景」核心机制未接线：28 张剧情卡的 flags.storyFlip 只被 behavior.flipStoryFace 读取，而 flipStoryFace 只被单测调用（测试专用代码），真实引擎没有任何翻面动作/选择入口；地点线索变化、记忆敌人/放逐、坚毅伙伴切换在实机都不可达',
      evidence: `src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556b.js:12、08566b.js:13 等 28 张；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:201-265`)}（flipStoryFace 定义）、:317（仅导出）；调用点仅 tests/eote-scenario-fatalMirage.test.mjs:96,117,128,134；src/engine 无 storyFlip/mirage 读点`,
      suggestion: '为幻景地点补引擎动作（花线索翻面 → 调用 flipStoryFace）与故事卡结算；补真实引擎全流程用例',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '幕/议程 reveal 钩子缺失：推进 08553/08550 即抛「场景/密谋规则尚未迁移」，本关无法推进幕/议程；且 behavior 无 resolution 钩子（scenarioResolution 死代码），结算不写 fatalMirageTimes/memoriesBanished/discovered/xp 等记录',
      evidence: `${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:302-323`)}（behavior 对象只有 scenarioResolution，无 resolution/actReveal/agendaReveal）；runthrough deep hookProbe act/agenda 均报「尚未迁移：08553/08550」；runthrough mirage 分支两次进入 records.fatalMirageTimes=0、memories 空`,
      suggestion: '补 actReveal/agendaReveal（版本幕/议程目标）与 resolution 别名，并按指南结算 XP/记录',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '重入版本不切换：fatalMirageVersion 依赖 campaign.completedSteps / records.fatalMirageTimes，但引擎从不写 completedSteps，且 resolution 死代码不写 fatalMirageTimes → 连续三次进入都取 version 1（议程/幕 08550/08553），违背指南「第二次进入用 II、第三次用 III」',
      evidence: `${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:42-50`)}；src/campaign/campaign-flow.js 的 completedSteps 只读派生（scenarioResults 投影），无写入；runthrough mirageVersions=[{version:1,agenda:['08550'],act:['08553']},{version:1,...}]`,
      suggestion: '版本用 completedCampaignSteps(campaign)（或 eoteFatalMirageEntries/eote.mirage.visits）计算，并补三次进入版本切换的真实引擎测试',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '开局/遭遇牌库与指南不一致：gather 缺 Chilling Cold（指南 8 组）；ENCOUNTER_DECK 仅唯一卡面未按印刷份数展开，并把 7 张 Tekeli-li 放进遭遇牌库；未建立 Tekeli-li 牌库；未按版本把已放逐/已发现记忆带回来',
      evidence: `${R(`${CHAPTER_DIR}/fatalMirage/definition.js:19-22`)}（GATHER_GROUPS 7 组）、:90-114（groupCodes 过滤、ENCOUNTER_DECK=唯一列表）；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:64-136`)}（setup 无 initializeTekeliDeck、无 memories 恢复、无 version 对应幕/议程切换的实际放入）；runthrough setup.deckSize=22 unique=22，tekeliDeck=null；指南 setup「Gather … and Chilling Cold」「Shuffle each Tekeli-li! …」`,
      suggestion: '补 Chilling Cold（core 01167×2/01168×2）、展开份数、分离 Tekeli 牌库并初始化；重入时按记录把 Memories Banished 放胜利区/Discovered 入场',
    },
    {
      severity: 'medium', dimension: 'perceivability',
      summary: '每关开局伙伴选择缺失（FM behavior.choosePartner 无读点）；resolution 要求的「记录伙伴伤害/恐惧」没有实现',
      evidence: `${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:173-195`)}；指南 resolutions.partnerDamage；runthrough setup.partnersRoster=9 无伙伴资产`,
      suggestion: '同 IDP1 伙伴接线；结算时写回 damage/horror',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '混乱标记失败/通过后续未实现：behavior 无 afterTest/PassedSkillTest 钩子，08648 参考卡 [cultist]（未成功 2 点内放线索）、[tablet]（失败移回记忆囚笼或洗入 Tekeli，困难失败 2+ 两者）、[elderthing]（失败在幻灵敌人放毁灭）均不结算',
      evidence: `${R(`${CHAPTER_DIR}/fatalMirage/chaos.js:22-34`)}（只返回数值）；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:302-323`)}（无 afterTest）；卡面 src/cards/cards-data.js 08549 text/backText`,
      suggestion: '补 afterTest 处理三类标记的失败/未成功后果（幂等），并补触发器测试',
    },
    {
      severity: 'low', dimension: 'docs',
      summary: 'content/scenario-guides.js 的 fatalMirage note 声称「三版密谋/幕按本次进入次数取对应一面」，与实现（版本恒为 1）不符，属玩家可见文档与实现不一致',
      evidence: `content/scenario-guides.js:193-196；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:42-50`)}`,
      suggestion: '修复版本切换前，先在面板注明当前版本固定/近似',
    },
  ],
  toTheForbiddenPeaks: [
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '遭遇牌库只含本章专用组，指南要求的共享组（Deadly Weather、Elder Things、Hazards of Antarctica、Nameless Horrors、Tekeli-li）全部未加入；实测 opening encounterDeck=14 张全部是 to_the_forbidden_peaks',
      evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/definition.js:32`)}（GATHER_GROUPS 仅 1 组，SHARED_GROUPS 未参与 encounterDeck 构建），:139/:208；runthrough deep setup.encounterDeck=14，deckProbe.byGroup 只有 to_the_forbidden_peaks；指南 setup「Gather all cards from … Deadly Weather, Elder Things, Hazards of Antarctica, Nameless Horrors, and Tekeli-li」`,
      suggestion: '把 SHARED_GROUPS 展开进遭遇牌库（外部队列走基础遭遇组解析），并按份数展开；补开局牌库构成测试',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '开局未把 Campaign Log「Supplies Recovered」里列出的 Expedition 剧情资产放到 level-0 地点：RECORD_READS 声明了 suppliesRecovered 但 behavior 无读点，7 件探险支援全部留在放一边区',
      evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/definition.js:225`)}（RECORD_READS 含 suppliesRecovered、:47 注释）、${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:81-100`)}（setupLocations 只放地点与放一边）、:102 setupEnemies(){}；runthrough setup.setAside=10（7 件支援仍在）`,
      suggestion: 'setupLocations/ setupEnemies 中读取 suppliesRecovered，把对应 EXPEDITION_ASSETS 放到 level-0，其余移出游戏',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '08610–08613 四张章节诡计只声明 treacheryRule.resolveKind，引擎无 resolveKind 读点（唯一读点 behavior.resolveEncounter 仅在 t.effect.kind===\'campaignRule\' 时被调用，这些卡无 effect 数据）→ 抽到即静默无效果；已用调试遭遇 08611/08612/08613 验证 0 状态变化',
      evidence: `src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08610.js:13…08613.js:13；src/engine/treachery-tokens.js:113-137（entryRevelation 路径只认 entry.encounterResolve / entry.treacheryRule.test / t.effect）；${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:258-266`)}（resolveEncounter 依赖 resolveKind）；logs/probe-encounters.json（damage/horror 全 0）`,
      suggestion: '给这些条目补 encounterResolve 或 treacheryRule.test（引擎已支持的真实入口），或让引擎支持 resolveKind 分派',
    },
    {
      severity: 'medium', dimension: 'runtime',
      summary: 'behavior 内 3 处 api.test 形参错误：第 4 参应为 resolve 回调，实际传入 { source, resolve } 对象；一旦这些处理器被触发会抛「options.resolve is not a function」（与 cityOfTheElderThings 已实测崩溃同源）',
      evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:506-509,521-530,538-558`)}；引擎签名 src/engine/scenario-runtime.js:657 test(seat, skill, difficulty, resolve, …)；同类崩溃见 cityOfTheElderThings`,
      suggestion: '改为 api.test(seat, skill, difficulty, result => {...}, 0, { source })',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '指南 setup 要求「Add 1 [elder_thing] token to the chaos bag」；实测开局混乱袋无 elderthing（18 枚），tokenMeanings 却含 elderthing，数值/提示存在但袋中永远抽不到',
      evidence: `guides/toTheForbiddenPeaks.en.md setup[0].children[3]；runthrough deep setup.chaosDistinct 无 elderthing；${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:69-78`)}（preScenarioSetup 未加标记）`,
      suggestion: 'preScenarioSetup 中 state.chaosBag.push(\'elderthing\')，并加开局袋构成测试',
    },
  ],
  cityOfTheElderThings: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '地点动作崩溃：合法动作 scenarioAction:loc:bridgeDiscover 触发 behavior 内 api.test 形参错误（第 4 参传对象而非回调）→ 引擎抛 TypeError「options.resolve is not a function」，关卡卡死且后续待决选择（commit）无法收敛，战役无法进入第三幕之后章节',
      evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:491-499,507-516,547-557,571-579`)}（4 处）；引擎签名 src/engine/scenario-runtime.js:657；实测命令见 logs/probe-city（复现堆栈 tests.js:692 ← behavior.js:571 bridgeDiscover）；runthrough deep：actions={scenarioAction:1} 后 error，H1/H2 无法到达`,
      suggestion: '全部改为 api.test(inv.seat, skill, difficulty, result => {...}, 0, { source })；补真实引擎地点动作用例',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '遭遇牌库只含本章专用组（实测 20 张全为 city_of_the_elder_things），指南要求的共享组（Elder Things、Miasma、Nameless Horrors、Penguins、Shoggoths/Tekeli-li、Locked Doors/Chilling Cold 等按版本）全部未加入',
      evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/definition.js:30-34`)}（GATHER_GROUPS 只 cityOfTheElderThings，SHARED_GROUPS 未进 deck）、:132-137（ENCOUNTER_DECK 只本地组）；runthrough/deckProbe deckSize=20 唯一 6 codes；指南 setup v1/v2/v3`,
      suggestion: '按版本展开 SHARED_GROUPS 进遭遇牌库（含 core 组），移除 SET_ASIDE/REMOVED 清单；补开局构成测试',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '指南 setup 要求「Add 1 [elder_thing] token to the chaos bag」以及「把未获得的 Frostbitten/Possessed 弱点移出游戏」；实现都没做（实测袋中无 elderthing；preScenarioSetup 无弱点清理）',
      evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:73-100`)}（preScenarioSetup/setupLocations 无这两步）；runthrough deep setup.chaosDistinct 无 elderthing`,
      suggestion: 'setup 补 elderthing token 与弱点清理（读战役记录判断是否已在简介获得）',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '四张章节诡计（08644–08647）只声明 resolveKind / flags，引擎无可达结算入口（同 peaks 08610–08613 的 gate 问题）；调试遭遇 08644/08645 实测无任何伤害/恐惧/威胁变化',
      evidence: `src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08644.js:13…08647.js:16；src/engine/treachery-tokens.js:113-137；${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:362-367`)}（resolveEncounter 依赖 resolveKind）；logs/probe-encounters.json`,
      suggestion: '补 encounterResolve/treacheryRule.test 真实入口并移除死路径',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: 'act1 背面只把 hiddenTunnelRevealed 置真并提示，未按版本执行「混洗共享组/遭遇弃牌堆、揭示隐秘隧道、按版本放星之恐怖/加 frost/抽遭遇」等指南流程（act1BackV1/V2/V3 仅日志与局部状态）',
      evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:460-479`)}；指南 setup v1/v2/v3 及 act 背面卡文`,
      suggestion: '按版本补实际混洗/生成/揭示效果，并与共享组接入联动',
    },
  ],
  theHeartOfMadnessPart1: [
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '16 张 Tekeli-li 卡被放进遭遇牌库（应在独立的 Tekeli-li 牌库），且本关未初始化 Tekeli-li 牌库；[tablet] 失败本应「抽 Tekeli-li 牌」，实际抽遭遇牌/无牌可抽',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/definition.js:21-24`)}（ENCOUNTER_GROUPS 含 tekelili）、:150-160；runthrough/deckProbe H1 deck=48 中 tekelili=16、tekeliDeck=null；指南 setup[0].children[10]「Shuffle each Tekeli-li! weakness card …」`,
      suggestion: '从遭遇牌库剔除 tekelili，建立 Tekeli-li 牌库；抽牌走 tekeliDraw',
    },
    {
      severity: 'medium', dimension: 'perceivability',
      summary: '本章 scenario.tokenMeanings = {}（08648 参考卡 4 个符号语义不显示），而 H2 有完整 tokenMeanings；同一条参考卡的两半展示不一致',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/definition.js:212`)}（tokenMeanings: {}）；runthrough deep setup.tokenMeaningKeys=[]；H1 behavior.makeHeartOfMadnessChaosToken 仍按 08648 取值`,
      suggestion: '接入 HEART_OF_MADNESS_TOKEN_MEANINGS（chaos.js 已提供），与 H2 共用',
    },
    {
      severity: 'medium', dimension: 'runtime',
      summary: '08670 电静放电诡计只声明 flags.revelation，引擎无可达入口（同 resolveKind 问题），抽到无效果',
      evidence: `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08670.js；src/engine/treachery-tokens.js:113-137`,
      suggestion: '补 encounterResolve 或 behavior.resolveEncounter 的真实触发路径',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '两处已声明近似：原质团「敌人阶段结束再次重整并结算敌人阶段」按重整+提示近似；石板抽 Tekeli 直接取顶放弃牌。近似已在 scenarioApproximations 披露，但规则语义仍降级',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/behavior.js:11-13,269`)}`,
      suggestion: '保留披露；后续用引擎「重复敌人阶段」原语替换',
    },
  ],
  theHeartOfMadnessPart2: [
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '已声明近似：「15 份无名的疯狂」按 enemy 实例计数；「毁灭被放置时改为生成无名的疯狂」（doomPlacementReplacement）明确标注留待 P8，当前未实现（属 declared gap）',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/behavior.js:10-14`)}`,
      suggestion: '补 doom 放置替换原语；无名的疯狂按副本/集群计数',
    },
    {
      severity: 'medium', dimension: 'runtime',
      summary: '封印放置为近似：休眠封印被平均分配给调查员并提示「战役状态近似」，未严格按指南「每枚已激活封印由一名调查员控制、休眠封印由各自调查员控制、其余移出游戏」',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/behavior.js:87-100`)}（prepareSeals）；指南 setup[0].children[9-12]`,
      suggestion: '按战役封印状态（eote.seals）决定控制者，移除多余封印',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '指南要求把 The Great Seal/Shoggoths/Locked Doors（含 5 张 Ancient Facility）移出游戏、Striking Fear 只收 2×Dissonant Voices+2×Frozen in Fear；实现靠 ENCOUNTER_GROUPS 与 STRIKING_KEEP 过滤，但无「从牌库/放一边区搜索并移出」的实体卡移除（依赖未入池），也未处理 Great Seal 设施卡与 H1 牌库残留',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/definition.js:86-100`)}；指南 setup[0].children[1-2]`,
      suggestion: '在 setup 中对在场/放一边/牌库做显式搜索移除，并加断言',
    },
    {
      severity: 'low', dimension: 'impl-vs-text',
      summary: 'startLocation 字段固定为 facility7，实际开局调查员在另一设施（指南由队长选择离门最近的设施），UI 起始地点字段与实际可能不一致',
      evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/definition.js`)} startLocation；runthrough deep setup：startLocation=facility7，investigatorLocation=facility8`,
      suggestion: '运行期按队长选择更新 startLocation 或移除该字段展示',
    },
  ],
}

const CAMPAIGN_FLOW = {
  verdict: 'flow-graph: ok / leaf-scenarios: broken',
  edges: flowConsistency.handlerEdges,
  stepOrder: flowConsistency.steps,
  chaosBags: flowConsistency.chaosBags,
  prologue: flowConsistency.prologue,
  flowNodes: flowConsistency.flowNodes,
  sequences: {
    fullNoMirage: runthrough.checks.mainScenarioSequence,
    flowOnlyReachedEnd: runthrough.checks.flowOnlyReachedEnd,
    flowOnlyHistory: runthrough.checks.flowOnlyHistory,
    mirageBranch: runthrough.checks.mirageScenarioSequence,
    fleeCheckpoint2: runthrough.checks.fleeSequence,
  },
  saveRestore: {
    changes: runthrough.saveRestore.changes,
    secondChanges: runthrough.saveRestore.secondChanges,
    identicalRecords: runthrough.saveRestore.identicalRecords,
    continuedScenario: runthrough.saveRestore.continuedScenario,
    jsonBytes: runthrough.saveRestore.jsonBytes,
  },
  failurePath: runthrough.runs.failurePath,
  issues: [
    {
      severity: 'high', dimension: 'runtime',
      summary: '真实引擎下整条战役无法自然跑通：第 2 章（IDP2）议程推进抛缺钩子错误，第 5 章（City）地点动作抛 TypeError 并卡死待决选择，第 3/4 章（IDP3/FM）无法正常结算；p8 验收测试全程用 debug endScenario 跨章，掩盖了这些关卡内路径',
      evidence: 'logs/runthrough.json runs.main（停在 cityOfTheElderThings；errors 见 deep）；tests/eote-p8-campaign.test.mjs:201（fixture finishScenario 使用 debug endScenario）；p8 12 个测试文件 125 用例全绿但均在关卡设置后立即调试结束',
      suggestion: '为每章补「真实动作推进→自然结算/推进幕」的引擎测试；CI 加入本 run-through 脚本',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '检查点 I 的营地庇护值没有从 IDP1 结局传导：IDP1 resolution 写 records.camp（地点 id）与 iceAndDeathPart1CampShelter，而 checkpoints.shelterValueOf 只读 records.eoteShelterValue / records.campXxx → 取 0，导致本该庇护 2 的营地全部 9 名伙伴 MIA（随后被 IDP2 结局划去）',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:342-366`)}；${R('content/campaigns/edgeOfTheEarth/checkpoints.js:197-205')}（shelterValueOf）；runthrough main：chapter1 records.camp=frozenShores/shelter=2，chapter2 records.eoteMissingCount=9、eoteMissingPartners=9 人`,
      suggestion: 'shelterValueOf 优先读 iceAndDeathPart1CampShelter 或写入 records[`camp${Name}`]；补检查点庇护值回归测试',
    },
    {
      severity: 'high', dimension: 'runtime',
      summary: '多个结局钩子缺失导致战役记录不落账：IDP3 与 FM 的 behavior 未挂 resolution 钩子（scenarioResolution 为死代码）→ iceAndDeathPart3Resolution/fatalMirageTimes/memoriesBanished/memoriesDiscovered/xp 等不写；IDP1 缺 XP bonus；伙伴伤害/恐惧从未记录',
      evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:126-143`)}、${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:275-296`)}（函数定义但 behavior 对象未挂 resolution）；src/engine/campaign-flow.js:241-254（只调用 scenarioBehavior(state).resolution）；runthrough main recordsAfter：iceAndDeathPart3Resolution=\"\"、fatalMirageTimes=0`,
      suggestion: '补 resolution 别名并逐章断言结算记录写入；把「记录写入」纳入 e2e',
    },
    {
      severity: 'high', dimension: 'impl-vs-text',
      summary: '每关开局的「伙伴选择」与「伙伴伤害/恐惧记录」规则未实现（指南 base 规则 + 各关 setup），导致伙伴机制整体不可玩：无伙伴入场、无伤害、无纪念/划去闭环（虽有 eotePartner 原语与 FM choosePartner，但无引擎触发）',
      evidence: `${R('content/campaigns/edgeOfTheEarth/prologue.js:139-162')}（只建名册）；src/engine/eote-interactions.js:126（eotePartner 操作无调用方）；各章 setup 无伙伴选择；tests 仅单测 choosePartner`,
      suggestion: '在 scenarioSetup 阶段接入 eotePartner 交互并回写伙伴状态/伤害',
    },
    {
      severity: 'medium', dimension: 'docs',
      summary: 'EOTE_STEP_ORDER 只有 15 步且缺 fatalMirage，与 audit/eote-scope.json 的 16 步（含 fatalMirage）及 parts.js 自身注释「16 个战役步骤」不一致',
      evidence: `${R('content/campaigns/edgeOfTheEarth/parts.js:45-55')}（注释 16 步、数组 15 步）；audit/eote-scope.json campaignFlow.steps（含 fatalMirage）；flow-consistency.json steps.missing=[\"fatalMirage\"]`,
      suggestion: '把 fatalMirage 收入 stepOrder（或注明可选步骤排除口径）并对齐 scope 账本',
    },
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: '幕间为近似：自动查看前 N 名存活伙伴（非队长选择）、奖励经验按查看数固定、Dyer 存活移除忒咳哩-哩弱点等专属奖励留待章节接线（已在代码披露）',
      evidence: `${R('content/campaigns/edgeOfTheEarth/interludes.js:16-19,347-393')}（近似声明与实现）；guides/base.json interludes`,
      suggestion: '把查看选择交给玩家（真实选择），补专属奖励',
    },
    {
      severity: 'low', dimension: 'docs',
      summary: 'audit/eote-scope.json 的 nextStepEdges 与实现 nextStep 的候选顺序不同（checkpoint1: [checkpoint2, iceAndDeathPart2] vs 实现 [iceAndDeathPart2, checkpoint2]；interlude1/2、interlude3 同样顺序差异），集合一致',
      evidence: 'flow-consistency.json nextEdges；audit/eote-scope.json campaignFlow.nextStepEdges',
      suggestion: '统一顺序口径或在 scope 注明顺序无意义',
    },
  ],
}

const GUIDE_PANEL = {
  verdict: 'registered + placeholder-correct / coverage partial',
  registered: guideCoverage.chapters.map(chapter => chapter.id),
  allRegisteredInScenarioGuidesJs: guideCoverage.summary.allRegistered,
  webGuideFiles: flowConsistency.guideSources.webGuideIds,
  coverage: guideCoverage.chapters.map(chapter => ({
    id: chapter.id,
    enTextBlocks: chapter.enTextBlocks,
    zhTextBlocks: chapter.zhTextBlocks,
    zhMissingBlocks: chapter.zhMissingBlocks,
    zhEnglishLeak: chapter.zhEnglishLeak.length,
    zhSameAsEn: chapter.zhSameAsEn.length,
    chineseStatus: chapter.chineseStatus,
    officialChinese: chapter.officialChinese,
    refZhCoverage: chapter.refZhCoverage,
  })),
  placeholder: {
    mechanism: 'web/scenario-setup-view.js:71-74（block.missing → t(\'setup.chineseMissing\')）',
    zhString: 'web/locales/zh-CN.panels.js:9 「中文待补」',
    enString: 'web/locales/en.panels.js:8 「Chinese text pending translation」',
    englishMasquerade: guideCoverage.summary.anyZhEnglishLeak ? '有' : '无（0 条英文冒充；zh 缺失块走 missing 标记）',
  },
  testEvidence: 'node tests/scenario-guides.test.mjs：7/7 通过（每关 zh/en setup+resolution >100 字符、无未展开 @: 键/HTML、zh 不夹英文句）',
  issues: [
    {
      severity: 'medium', dimension: 'docs',
      summary: '中文指南覆盖不足：8 章 zh 缺失块 fatalMirage 33、city 32、H2 17、H1 14、peaks 12、IDP3 10、IDP1 2、IDP2 1；缺失块按口径显示「中文待补」而非英文冒充（口径正确），但成段缺失影响中文玩家阅读 setup/结局细节',
      evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/guides/_guide-coverage-v2.json；web/scenario-guides/*.json 的 chineseGaps；web/locales/zh-CN.panels.js:9',
      suggestion: '按 chineseGaps 清单补译（或保持 missing 标记并在发布说明标注覆盖率）',
    },
  ],
}

const CHAOS = {
  bags: {
    verdict: 'match',
    detail: '四档 CHAOS_BAGS 与 audit/eote-scope.json chaosBags 逐 token 完全一致（easy16/standard17/hard18/expert18）',
    evidence: `content/campaigns/edgeOfTheEarth/shared.js:96-106；audit/eote-scope.json chaosBags；flow-consistency.json chaosBags.*.equal=true；tests/eote-p8-campaign.test.mjs:175-187`,
  },
  perChapter: [
    { id: 'iceAndDeathPart1', card: '08501', verdict: 'value-match / rider-gap', detail: '[skull] ceil(庇护/2)（困难=庇护）、[cultist]-2、[tablet]-3/-4 与 08501 卡面一致；cultist/tablet 失败后果由 afterTest 实现', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/chaos.js:11-73`)}；cards-data 08501 text/backText` },
    { id: 'iceAndDeathPart2', card: '08501', verdict: 'match', detail: '数值与失败后果（含 hard 差值张数）同 08501，与 Part I 同口径', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/chaos.js:10-86`)}` },
    { id: 'iceAndDeathPart3', card: '08501', verdict: 'value-match / rider-missing', detail: '数值一致；但 behavior 无 afterTest，[cultist] 洗入忒咳哩-哩、[tablet] 弃牌顶并抽弱点两条失败后果不结算；且 Tekeli 牌库未初始化', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/chaos.js:10-36`)}；${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:149-164`)}（无 afterTest）` },
    { id: 'fatalMirage', card: '08549', verdict: 'value-match / rider-missing', detail: '四个符号数值与 08549 两档一致（困难 skull=剧情数+议程号近似 agendaIndex+1）；但 [cultist]/[tablet]/[elderthing] 的失败/未成功后果（放线索/移回囚笼或洗 Tekeli/幻灵放毁灭）无 afterTest 实现', evidence: `${R(`${CHAPTER_DIR}/fatalMirage/chaos.js:6-34`)}；${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:302-323`)}` },
    { id: 'toTheForbiddenPeaks', card: '08596', verdict: 'match（除 elderthing 不在袋中）', detail: 'skull=高度（困难+2）、cultist=-1 移动下方、tablet 丢探险支援、elderthing 最近古老者移动/攻击 与 08596 两档一致；但开局未向混乱袋加 elderthing（指南 setup）', evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/chaos.js:17-69`)}` },
    { id: 'cityOfTheElderThings', card: '08621', verdict: 'match（除 elderthing 不在袋中）', detail: 'skull=钥匙数（困难+2）、cultist=-2 放钥匙、tablet 与 frost 联动、elderthing 最近敌人 与 08621 两档一致；但开局未加 elderthing', evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/chaos.js:11-62`)}` },
    { id: 'theHeartOfMadnessPart1', card: '08648', verdict: 'value-match / tokenMeanings-missing', detail: '取值与失败后果实现（skull 旧日支配者-3/-4、cultist 视为 frost、tablet 抽 Tekeli、elderthing 失败3+放毁灭）；但 scenario.tokenMeanings 为空且 Tekeli 牌库缺失', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/chaos.js:11-86`)}；${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/definition.js:212`)}` },
    { id: 'theHeartOfMadnessPart2', card: '08648', verdict: 'match', detail: '转用 Part I 的同一份 08648 语义，tokenMeanings 已接入', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/chaos.js:1-6`)}` },
  ],
  issues: [
    {
      severity: 'medium', dimension: 'impl-vs-text',
      summary: 'FM / IDP3 缺失败后果（rider），H1 缺 tokenMeanings 展示；FM/IDP3 的 Tekeli-li 牌库未初始化使「抽 Tekeli」类后果无法执行',
      evidence: '见 perChapter 表；runthrough setup.tekeliDeck 仅 IDP1/IDP2 非 null',
      suggestion: '补齐 afterTest/afterPass 与 Tekeli 牌库初始化；H1 接入 HEART_OF_MADNESS_TOKEN_MEANINGS',
    },
  ],
}

const TESTS = {
  command: 'cd games/arkhamhorror && node tests/eote-scenario-*.test.mjs tests/eote-campaign-flow.test.mjs tests/eote-p8-campaign.test.mjs tests/eote-p8-registration.test.mjs（逐文件 in-process；禁止 npm run test:*）',
  files: 12,
  tests: 125,
  pass: 125,
  fail: 0,
  durationNote: 'p8-campaign 最长（约 37s）；全部节点均 pass（见 logs/tests.log）',
  extra: 'node tests/scenario-guides.test.mjs：7/7 通过；自建 run-through：flow-only 战役抵达 campaign end，真实动作 run 暴露 3 类崩溃/阻塞',
}

const SCENARIO_META = [
  ['iceAndDeathPart1', '亡命冰原 I · Ice and Death, Part I', '08501', 'gap'],
  ['iceAndDeathPart2', '亡命冰原 II · Ice and Death, Part II', '08501', 'gap'],
  ['iceAndDeathPart3', '亡命冰原 III · Ice and Death, Part III', '08501', 'gap'],
  ['fatalMirage', '致命幻景 · Fatal Mirage', '08549', 'gap'],
  ['toTheForbiddenPeaks', '失落之峰 · To the Forbidden Peaks', '08596', 'gap'],
  ['cityOfTheElderThings', '古老者之城 · City of the Elder Things', '08621', 'gap'],
  ['theHeartOfMadnessPart1', '疯狂之心 I · The Heart of Madness, Part I', '08648', 'gap'],
  ['theHeartOfMadnessPart2', '疯狂之心 II · The Heart of Madness, Part II', '08648', 'approximation'],
]

const SETUP_FACTS = {
  iceAndDeathPart1: [
    { item: '收集 Ice and Death/The Crash/Creatures in the Ice/Deadly Weather/Hazards of Antarctica/Silence and Mystery/Tekeli-li/Ancient Evils（8 组）', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/definition.js:22-24,108-128`)}（GATHER_GROUPS + SHARED_CORE_DECK 01166×3），实测 deck=23（含 ancientEvils 3）` },
    { item: 'Creatures in the Ice 放一边；9 张 Uncharted 地点放一边；Skittering Nonsense ×3、Terror of the Stars 放一边', status: 'implemented', evidence: `实测 setAside=20（11 张卡 + 9 地点）；${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:105-108`)}` },
    { item: 'Crash Site/Precarious Ice Sheet/Treacherous Path/Frozen Shores 入场，全员从 Crash Site 开始', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/definition.js:85-91`)}；runthrough setup.locations=4 revealed=4` },
    { item: 'Hard +1 doom / Expert +2 doom；建立 Tekeli-li 牌库（16 张）', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart1/behavior.js:114-116`)}；runthrough tekeliDeck=16` },
    { item: '每名调查员可选一名可用伙伴入场', status: 'missing', evidence: '见 issue：伙伴选择无引擎入口（behavior 无 choosePartner 调用）' },
  ],
  iceAndDeathPart2: [
    { item: '收集 8 组（含 Ancient Evils）；议程 4–6 + 幕 2', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/definition.js:20-22,186-195`)}；实测 agendas=[08523,08524,08525]、act=[08526]` },
    { item: '按 Campaign Log 的 Locations Revealed 放地点（已揭示），其余未揭示；从营地开始', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:64-76`)}；实测 13 地点、revealed=4、起始=frozenShores（camp 记录）` },
    { item: 'MIA 伙伴变被附身敌人 + 8 张剧情卡合计 9 张压到 9 个未探索地点下', status: 'approximation', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:78-108`)}（无 MIA 时只有 8 张）` },
    { item: '基础资源=营地庇护值（非 5）', status: 'missing', evidence: '实测 resources=[5,5]' },
    { item: '建立 Tekeli-li 牌库', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart2/behavior.js:91`)}；实测 16 张` },
    { item: '每名调查员可选伙伴', status: 'missing', evidence: '同 IDP1' },
  ],
  iceAndDeathPart3: [
    { item: '收集 8 组（含 Seeping Nightmares/Creatures in the Ice/Ancient Evils）', status: 'approximation', evidence: 'GATHER_GROUPS 缺 ancientEvils（beat 未加 core）；deck 未按份数展开且含 Tekeli 卡' },
    { item: '议程 7–8 + 幕 3', status: 'partially', evidence: '卡号 08544/08545/08546 对上，但结算钩子缺失（见 issues）' },
    { item: '按记录放全部地点、只营地揭示、清空营地线索', status: 'implemented', evidence: `实测 locations=13、revealed=1（frozenShores）；${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:37-44`)}` },
    { item: '按人数生成渗出梦魇于不同非营地地点，8 张幻灵均分压底，剩余移出游戏', status: 'approximation', evidence: `${R(`${CHAPTER_DIR}/iceAndDeathPart3/behavior.js:46-69`)}（均分+slice、剩余未移出牌库）` },
    { item: '建立 Tekeli-li 牌库', status: 'missing', evidence: 'runthrough tekeliDeck=null' },
  ],
  fatalMirage: [
    { item: '收集 8 组（含 Chilling Cold）', status: 'missing', evidence: `${R(`${CHAPTER_DIR}/fatalMirage/definition.js:19-22`)} 仅 7 组，实测 deck 无 core 01167/01168` },
    { item: '首次：Prison of Memories 入场，其余 18 地点放一边；9 Memory 敌人 + 9 Resolute 支援放一边；只建 agenda1/act1；Hard/Expert 加 doom', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/fatalMirage/behavior.js:64-136`)}；实测 locs=1、asideLocations=18、doom 按难度` },
    { item: '重入：按第 2/3 次换 agenda2/3、act2/3，把 Memories Banished 放胜利区、Discovered 入场', status: 'missing', evidence: '实测两次进入均 version1/08550/08553；memories 恢复未实现' },
    { item: '建立 Tekeli-li 牌库', status: 'missing', evidence: 'tekeliDeck=null；7 张 Tekeli 反在遭遇牌库' },
    { item: '每名调查员开局选择伙伴', status: 'missing', evidence: 'choosePartner 无引擎读点' },
  ],
  toTheForbiddenPeaks: [
    { item: '收集 6 组（含共享组）', status: 'missing', evidence: '实测 deck=14 仅本章组；GATHER_GROUPS 只有 1 组' },
    { item: '七个山腰地点洗混取 5 排斜线，山顶在顶端，level 0–5；揭示 level-0 从该处开始', status: 'approximation', evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:54-56`)}（固定 5 个，已在 scenarioApproximations 披露）` },
    { item: '加 1 [elder_thing] 混乱标记；按 Supplies Recovered 放探险支援；星之恐怖放一边', status: 'missing', evidence: '实测袋无 elderthing；支援仍在放一边（setAside=10）' },
    { item: '建立 Tekeli-li 牌库', status: 'missing', evidence: 'tekeliDeck=null' },
    { item: 'Hard +1 doom / Expert +2 doom', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/toTheForbiddenPeaks/behavior.js:69-78`)}（preScenarioSetup 分支）` },
  ],
  cityOfTheElderThings: [
    { item: '按版本收集 8 组（v1 含 Shoggoths/Locked Doors；v2/v3 含 Chilling Cold/Creatures in the Ice 等）', status: 'missing', evidence: '实测 deck=20 全 chapter 组；共享组未接入' },
    { item: '16 城市景观 + Hidden Tunnel 按版图入场、相邻连通；16 把钥匙随机放；起始地点按版本/队长选择', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:83-100`)}；实测 locations=17、16 keys 初始化` },
    { item: '加 1 [elder_thing] 混乱标记；移除未获得的 Frostbitten/Possessed 弱点', status: 'missing', evidence: '实测袋无 elderthing；无弱点清理代码' },
    { item: '建立 Tekeli-li 牌库', status: 'missing', evidence: 'tekeliDeck=null' },
    { item: 'Hard +1 / Expert +2 doom', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/cityOfTheElderThings/behavior.js:73-80`)}` },
  ],
  theHeartOfMadnessPart1: [
    { item: '收集 9 组（含 Ancient Evils/Locked Doors 等 core 组）', status: 'implemented', evidence: `实测 deck=48 含 ancient_evils 3、locked_doors 2；但误含 tekelili 16` },
    { item: 'Gate of Y\'quaa 入场，全员从门开始；15 座 Ancient Facility 按三环五辐随机布置；5 枚 seal token 放一边', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/behavior.js:185-210`)}；实测 locations=16、start=theGateOfYquaa` },
    { item: '建立 Tekeli-li 牌库（16 张）', status: 'missing', evidence: '实测 Tekeli 卡在遭遇牌库、tekeliDeck=null' },
    { item: 'Hard +1 / Expert +2 doom', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart1/behavior.js:185-210`)}（setup 分支）` },
  ],
  theHeartOfMadnessPart2: [
    { item: '收集 4 组（Stirring in the Deep/Agents/Chilling Cold/Striking Fear，后者只取 2×Dissonant+2×Frozen）', status: 'implemented', evidence: '实测 deck=14：stirring2+agents4+chilling4+striking4（STRIKING_KEEP 过滤）' },
    { item: '移出 Great Seal/Shoggoths/Locked Doors（含 Ancient Facility）；建议程 4–5 + act 3', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/definition.js:60-100`)}（REMOVED_GROUPS + ENCOUNTER_GROUPS 过滤）` },
    { item: 'Gate 翻面；5 个 Mist-Pylon + 10 个 Ancient Facility 洗混布置（内环不能全是 Pylon）；把 15 份 Nameless Madness/Final Mirage/4 Ramp/Hidden Tunnel 放一边', status: 'implemented', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/behavior.js:43-85`)}；实测 locations=16` },
    { item: '按封印状态分配控制者/移除其余封印', status: 'approximation', evidence: `${R(`${CHAPTER_DIR}/theHeartOfMadnessPart2/behavior.js:87-100`)}（已披露近似）` },
    { item: '建立 Tekeli-li 牌库', status: 'missing', evidence: 'tekeliDeck=null（H1 把 Tekeli 放遭遇牌库的连带问题）' },
  ],
}

const scenarios = SCENARIO_META.map(([id, name, cardCode, verdict]) => {
  const deep = deepOf(id) || {}
  const coverage = coverageOf(id) || {}
  return {
    id,
    name,
    cardCode,
    verdict,
    setup: SETUP_FACTS[id],
    rules: [
      { item: '幕/议程 reveal 钩子', status: deep.hookProbe?.act?.ok === false || deep.hookProbe?.agenda?.ok === false ? 'missing' : 'implemented', evidence: deep.hookProbe ? `runthrough deep hookProbe: act=${JSON.stringify(deep.hookProbe.act?.message || deep.hookProbe.act?.ok)} agenda=${JSON.stringify(deep.hookProbe.agenda?.message || deep.hookProbe.agenda?.ok)}` : '未运行' },
      { item: '结局（resolution）钩子与记录写入', status: ['iceAndDeathPart3', 'fatalMirage'].includes(id) ? 'missing' : 'implemented', evidence: `${R(`${CHAPTER_DIR}/${id}/behavior.js`)} behavior 对象；runthrough recordsAfter（见 logs/runthrough.json）` },
      { item: '章节专用遭遇/诡计结算入口', status: ['fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1'].includes(id) ? 'missing/approximation' : 'implemented', evidence: 'treachery-tokens.js:113-137 gate；probe-encounters/静态统计；详见 issues' },
    ],
    flow: {
      nodeInEOTE_FLOW: true,
      nextEdges: flowConsistency.handlerEdges.filter(edge => edge.id === id),
      runthroughSequence: (runthrough.checks.flowOnlySequence || []).includes(id) ? '主流程可达' : '主流程可达（可选分支）',
      naturalEndReachable: deep.naturalEnd ?? null,
      naturalResolution: deep.naturalResolution ?? null,
    },
    runthrough: {
      deepDrive: deep.drive ? {
        steps: deep.drive.steps, actions: deep.drive.actions, movesSeen: deep.drive.movesSeen,
        errors: deep.drive.errors.map(error => error.message), deadlocks: deep.drive.deadlocks,
        actAdvances: deep.drive.actAdvances, agendaAdvances: deep.drive.agendaAdvances,
      } : null,
      hookProbe: deep.hookProbe || null,
      setupSnapshot: deep.setup || null,
      encounterDeckProbe: deckProbe[id] || null,
      reachedInDeepRun: deep.reached ?? false,
      reachError: deep.error || null,
    },
    guides: {
      webGuideExists: (flowConsistency.guideSources.webGuideIds || []).includes(id),
      registeredInScenarioGuidesJs: coverage.registeredInScenarioGuidesJs ?? null,
      enTextBlocks: coverage.enTextBlocks ?? null,
      zhTextBlocks: coverage.zhTextBlocks ?? null,
      zhMissingBlocks: coverage.zhMissingBlocks ?? null,
      zhEnglishLeak: coverage.zhEnglishLeak?.length ?? null,
      englishMasquerade: (coverage.zhEnglishLeak?.length ?? 0) ? 'yes' : 'no',
      chineseStatus: coverage.chineseStatus ?? null,
      officialChinese: coverage.officialChinese ?? null,
      refZhCoverage: coverage.refZhCoverage ?? null,
      placeholder: '中文缺失块由 web/scenario-setup-view.js 渲染 setup.chineseMissing（zh-CN.panels.js:9「中文待补」）',
    },
    issues: ISSUES[id] || [],
  }
})

const severityCount = { high: 0, medium: 0, low: 0 }
const bump = list => {
  for (const issue of list) severityCount[issue.severity] = (severityCount[issue.severity] || 0) + 1
}
for (const scenario of scenarios) bump(scenario.issues)
bump(CAMPAIGN_FLOW.issues)
bump(GUIDE_PANEL.issues)
bump(CHAOS.issues)

const findings = {
  area: 'scenarios',
  auditor: 'scenario-auditor',
  method: '逐章：官方指南（en 主、zh 对照）setup/特别规则/幕议程/地点规则/结局 vs definition+behavior+chaos+单卡条目；真实引擎 run-through（eote-p8-fixture 的 createGameState→legalMoves→applyMove 真路径，章节内合法动作推进 + 幕/议程 reveal 钩子探针 + 强制遭遇探针）；战役流程 prologue→checkpoint×3→interlude×3→fatalMirage 可选→epilogue 的节点/边/记录/存档核对；指南面板覆盖与注册；混乱袋 tokenMeaning 对照卡面 08501/08549/08596/08621/08648。',
  generatedAt: '2026-11-08',
  scope: {
    chapters: scenarios.map(scenario => scenario.id),
    chapterSourceDir: CHAPTER_DIR,
    campaignFlowFiles: 'content/campaigns/edgeOfTheEarth/{prologue,checkpoints,interludes,epilogue,flow,parts,records,shared,shared-encounters,story-access,manifest}.js',
    guideSources: '参考资源 en/zh edgeOfTheEarth + games/arkhamhorror/web/scenario-guides/*.json + content/scenario-guides.js',
    constraint: '只读 mod；本 area 仅写 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/**',
  },
  summary: {
    chapters: scenarios.length,
    verdicts: Object.fromEntries(Object.entries(scenarios.reduce((acc, scenario) => {
      acc[scenario.verdict] = (acc[scenario.verdict] || 0) + 1
      return acc
    }, {}))),
    issuesBySeverity: severityCount,
    topConclusion: '战役流程图本身可走通（flow-only run 抵达 campaign end，检查点/幕间/致命幻景回场分支序列正确，存档往返幂等）；但真实引擎逐章玩法不可完整跑通：IDP2 议程推进抛缺钩子、City 地点动作 TypeError 并卡死、IDP3/FM 无正常结算路径，且伙伴/幻景/遭遇牌库等关键机制未接线。现有 125 个 eote 测试全绿是因为 p8 验收用例在每章 setup 后立即 debug endScenario，未覆盖关卡内真实推进。',
  },
  tests: TESTS,
  campaignFlow: CAMPAIGN_FLOW,
  guidePanel: GUIDE_PANEL,
  chaosBags: CHAOS,
  scenarios,
}

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1), 'utf8')

// ---------------------------------------------------------------------------
// notes.md
// ---------------------------------------------------------------------------
const md = []
md.push('# EOTE 八章实现 & 战役流程审计（scenario-auditor）', '')
md.push(`生成：2026-11-08；证据目录：\`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/logs/\`（tests.log / runthrough.json / runthrough.md / flow-consistency.json / decks.json / probe-encounters.json / probe-city 复现）。`)
md.push('', '## 1. 结论摘要', '')
md.push(`- 8 章 verdict：${JSON.stringify(findings.summary.verdicts)}；问题 ${JSON.stringify(severityCount)}。`)
md.push('- 流程图（EOTE_FLOW）本身：47 节点、8 场景节点、3 检查点、3 幕间、epilogue、end；manifest.flow 与 EOTE_FLOW 一致；flow-only run 在真实引擎里抵达 `campaignResult/end`；检查点 I 放弃（跳 II/III）、检查点 II 逃跑、幕间全开门（3 次 FM）等分支序列与 p8 验收预期一致；存档 JSON→migrateState 幂等（changes=[], secondChanges=[]）并可继续下一章；失败路径 noResolution 后可继续。')
md.push('- 关卡内真实玩法**跑不通**：`runs.main` 在 City 卡死；深驱动逐章结果：IDP1 60 动作无合法撤退动作（幕目标不可达）；IDP2 第 24 步抛「密谋规则尚未迁移：08523」；IDP3/FM 10 轮内只能全灭 noResolution（无正常结算钩子）；City 第一个地点动作即 TypeError「options.resolve is not a function」并留下无法收敛的 commit 选择。')
md.push('- p8 验收 125 用例全绿的原因：`tests/eote-p8-campaign.test.mjs` 全程用 fixture `finishScenario` 的 debug `endScenario` 跨章，不驱动关卡内幕/议程/地点动作。', '')

md.push('## 2. 跑通矩阵（真实引擎）', '')
md.push('| 章节 | 可达 | 深驱动动作 | 自然结算 | 幕/议程推进 | 崩溃/死锁 | 钩子探针 |')
md.push('| --- | --- | --- | --- | --- | --- | --- |')
for (const scenario of scenarios) {
  const rt = scenario.runthrough.deepDrive
  const probe = scenario.runthrough.hookProbe || {}
  const probeText = `act=${probe.act?.ok ? 'ok' : (probe.act?.message || '?')} / agenda=${probe.agenda?.ok ? 'ok' : (probe.agenda?.message || '?')}`
  md.push(`| ${scenario.id} | ${scenario.runthrough.reachedInDeepRun ? '是' : `否（${scenario.runthrough.reachError}）`} | ${rt ? `${rt.steps} 步 ${JSON.stringify(rt.actions)}` : '-'} | ${rt ? (scenario.flow.naturalEndReachable ? scenario.flow.naturalResolution : '否') : '-'} | ${rt ? `${rt.actAdvances}/${rt.agendaAdvances}` : '-'} | ${rt ? (rt.errors.join('；') || '无') : '-'} | ${probeText} |`)
}
md.push('')
md.push('## 3. 指南 vs 实现差异表（逐章要点）', '')
for (const scenario of scenarios) {
  md.push(`### ${scenario.id}（${scenario.verdict}）`, '')
  for (const fact of scenario.setup) md.push(`- setup · ${fact.status} — ${fact.item}（${fact.evidence}）`)
  for (const issue of scenario.issues.filter(issue => issue.severity !== 'low')) md.push(`- [${issue.severity}] ${issue.summary}`)
  md.push('')
}
md.push('## 4. 战役流程与记录缺口', '')
for (const issue of CAMPAIGN_FLOW.issues) md.push(`- [${issue.severity}] ${issue.summary}（${issue.evidence}）`)
md.push('')
md.push('## 5. 指南面板覆盖', '')
md.push('| 章节 | en 文本块 | zh 文本块 | zh 缺失块 | 英文冒充 | 中文状态 | ref-zh 覆盖 | 注册 |')
md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const chapter of GUIDE_PANEL.coverage) {
  md.push(`| ${chapter.id} | ${chapter.enTextBlocks} | ${chapter.zhTextBlocks} | ${chapter.zhMissingBlocks} | ${chapter.zhEnglishLeak} | ${chapter.chineseStatus} | ${chapter.refZhCoverage} | ${GUIDE_PANEL.allRegisteredInScenarioGuidesJs ? '是' : '否'} |`)
}
md.push('', `- 缺失中文按口径显示「中文待补」（\`web/scenario-setup-view.js\` + \`web/locales/zh-CN.panels.js:9\`），无英文冒充；\`node tests/scenario-guides.test.mjs\` 7/7 通过。`, '')
md.push('## 6. 混乱袋/tokenMeanings', '')
md.push(`- CHAOS_BAGS 与 audit/eote-scope.json chaosBags 完全一致（${JSON.stringify(CHAOS.bags.detail)}）。`)
for (const row of CHAOS.perChapter) md.push(`- ${row.id}（${row.card}）：${row.verdict} — ${row.detail}`)
md.push('')
md.push('## 7. 证据/命令', '')
md.push('- in-process 测试：`cd games/arkhamhorror` 后逐文件 `node tests/eote-scenario-*.test.mjs …`（12 文件 125 用例，0 失败；见 logs/tests.log）。')
md.push('- 自建 run-through：`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/runthrough.mjs`（输出 logs/runthrough.json/.md）；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/flow-consistency.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-decks.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-encounters.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-city.mjs`。')
md.push('- 本 area 只读 mod，未修改 games/arkhamhorror 任何文件。')
fs.writeFileSync(path.join(OUT, 'notes.md'), md.join('\n'), 'utf8')
console.log('WROTE findings.json + notes.md')
console.log(JSON.stringify(findings.summary, null, 1))
