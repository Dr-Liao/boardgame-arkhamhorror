// 生成 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/findings.json
import fs from 'node:fs'
import { cards } from './findings-data.mjs'

const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c'
const P = 'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks'
const C = 'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings'
const ENG = 'src/engine'
const REF = '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham'
const issue = (severity, dimension, summary, evidence, suggestion) => ({ severity, dimension, summary, evidence, suggestion })

const scenarios = [
  {
    id: 'toTheForbiddenPeaks', name: '失落之峰', nameEn: 'To the Forbidden Peaks', referenceCode: '08596',
    setup: {
      status: 'partial',
      evidence: `${P}/definition.js:60-146（8 地点数据/斜线/放一边）；${P}/behavior.js:69-103（preScenarioSetup/setupLocations）；${ENG}/setup.js:795-799（引擎布置读点）`,
      implemented: [
        '5 个山腰地点 level 0–4 + 山顶 level 5，斜线连接由 definition 数据提供（behavior.js:60-105）',
        '2 个未入场山腰地点 + 星之恐怖 + 7 件探险支援放一边（definition.js:142-146；behavior.js:81-103）',
        'level-0 揭示 + 调查员起始地点（placeLocation 依据 investigator 位置揭示；behavior.js:96）',
        '遭遇牌库本章 14 张（definition.js:133-139）',
      ],
      missing: [
        '混乱袋 +1 [elder_thing] 标记（参考 .hs:225）',
        'Hard +1 / Expert +2 初始毁灭放议程 1a（参考 .hs:228-231）',
        '「已勘察山口」时 level-0 起始线索减半（setupModifier ReduceStartingCluesByHalf，参考 .hs:208-210）',
        '按 Supplies Recovered 把已回收 Expedition 支援放到 level-0、其余移出游戏（参考 .hs:216-227）',
        'Tekeli-li 牌库初始化（addTekeliliDeck，参考 .hs:233）',
        '伙伴存活分支（Eliyah/Claypool/Takada）的 frost/trauma 选择（参考 .hs:90-159）',
      ],
    },
    rules: {
      status: 'partial',
      evidence: `${P}/chaos.js:16-59；${P}/behavior.js:271-305,488-562`,
      notes: [
        '混乱标记两档取值与符号后果已实现并有测试（chaos.js:32-59；tests/eote-scenario-toTheForbiddenPeaks.test.mjs:281-301）',
        '议题/议程正面强制（移动后归还线索）只写在 behavior.afterMove（:244-256），引擎无 afterMove 读点 → 未接线',
        '层级 X 修正读点水平不一致：behavior.locationEntered 依赖 climbState，权威移动不写 → 见 issue',
      ],
    },
    flow: {
      status: 'partial',
      evidence: `${ENG}/phases.js:268-282（议程推进读点）；${ENG}/reveal.js:151-162（幕背面读点）；${P}/behavior.js:105-124,177-187,355-359`,
      notes: [
        '幕 1 allResigned 目标 + 背面 R1 已接线（checkObjectives/actReveal）',
        '议程 1 背面（放星之恐怖）已接线；议程 2 背面 R1/R2 分支已接线',
        '结局记录写入错误（见 issues）；「撤退/失败」分支仅 noResolution 由 checkOutcome 兜底（harm-threat.js:354-361）',
      ],
    },
    runthrough: {
      status: 'partial',
      evidence: 'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:112-316',
      notes: [
        '测试全部用手工 state+apiStub 直调 behavior 钩子，没有一次真实 setup/移动/遭遇抽取；'
        + '因此无法发现：攀登不接线、afterMove 不接线、Traverly 卡不结算、探险支援不入场、共享遭遇组缺失。',
      ],
    },
    guides: { status: 'partial', evidence: `${P}/definition.js:180-194（resolutions/SCENARIO_TEXT）；${P}/texts.js`, notes: ['指南正文由 story-text 生成，入口存在（guideSources sha 匹配 audit/eote-scope.json）；但 setup 面板文案与实际实现不一致（见 setup.missing）'] },
    gatherSetsCheck: {
      evidence: 'audit/eote-scope.json（chapters[toTheForbiddenPeaks].gatherSets：DeadlyWeather/ElderThings/HazardsOfAntarctica/NamelessHorrors/Tekelili/ToTheForbiddenPeaks 全部 mode=gather）',
      result: 'definition.js:32-33（GATHER_GROUPS/SHARED_GROUPS）与 shared-encounters.js:112-116 均为同一 6 组，数据一致（✓）；但 definition.js:133-139 的 ENCOUNTER_DECK 只展开本章组（14 张），共享 5 组未进牌库（✗，见 issues）',
    },
    issues: [
      issue('high', 'runtime', '真实遭遇抽牌不结算本章专属诡计：treacheryDefinition 无 entryRevelation、条目只有 resolveKind；引擎 resolveTreacheryBody 不读 resolveKind，behavior.resolveEncounter 唯一调用点是 effect.kind==="campaignRule"（无本章卡使用）',
        `${P}/definition.js:110-117；${ENG}/treachery-tokens.js:113-124；EOTE 无 encounter-rules.js 分派者；逐卡见 08610–08613`,
        '补 entryRevelation + encounterResolve 转发；补真实遭遇抽取测试'),
      issue('high', 'impl-vs-text', '遭遇牌库缺 5 个共享遭遇组（参考 gather 6 组）：ENCOUNTER_DECK 只含本章 14 张；manifest.requiredEncounterGroupIds 仅注册校验（content/schema.js:281-283），引擎只用 scenario.encounterDeck（src/engine/setup.js:807-815）',
        `${P}/definition.js:133-139；${P}/index.js:16-19；${ENG}/setup.js:807-815；${REF}/Scenario/Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks.hs:187-192；对照 content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:107-120（按 GATHER_GROUPS 展开）`,
        '按 iceAndDeathPart1 模式用 GATHER_GROUPS 展开 ENCOUNTER_DECK（或 setup 时合并）'),
      issue('high', 'runtime', '攀登「从下方进入」机制未接权威移动：ascend 仅 API/测试调用，behavior.locationEntered 的 climbState 永不写入 → 08600–08606 全部 enterFromBelow 强制不触发',
        `${P}/behavior.js:189-199,226-241；${ENG}/eote-climb.js:109-140；${ENG}/api-mechanics.js:176-183；${ENG}/movement.js:236-249`,
        '移动管线在 Level+1 时先记录 enterFromBelow（或 behavior 用 Level 差判定）；补真实移动测试'),
      issue('high', 'runtime', '08597/08598 正面强制「移动后归还全部线索」未接线：behavior.afterMove 无引擎读点（全仓仅测试调用）',
        `${P}/behavior.js:244-256；${ENG}/movement.js:249；tests/eote-scenario-toTheForbiddenPeaks.test.mjs:205`,
        '并入 locationEntered 或补引擎 afterMove 钩子'),
      issue('high', 'runtime', '7 件 Expedition 剧情支援永不入场：setup 全部放一边，preScenarioSetup 不按 suppliesRecovered 放入场/移出，engine 也不自动生成 scenario.storyAssets；08599 的 [action] 与山顶撤退胜利区逻辑因而不可用',
        `${P}/definition.js:48,142-146；${P}/behavior.js:69-78,301-345；${ENG}/setup.js:645；${REF}/.../ToTheForbiddenPeaks.hs:216-227`,
        '按记录把已回收支援放到 level-0、其余移出游戏；补能力实现'),
      issue('high', 'impl-vs-text', '结局记录与结算缺失：behavior.resolution 只写 theInvestigatorsScoutedTheMountainPass；R1 应写 TheTeamClimbedToTheSummit，R2 应写 TheTeamFoundAnotherWayThroughTheMountains；Supplies Recovered 划掉与胜利区支援转牌组/XP 奖励均未实现',
        `${P}/behavior.js:348-350；${P}/definition.js:225-226；${REF}/.../ToTheForbiddenPeaks.hs:265-296；content/campaigns/edgeOfTheEarth/interludes.js:52（读 theTeamFoundAnotherWayThroughTheMountains）`,
        '按 resolution key 写正确记录并处理物资划掉/资产去向；补结局测试'),
      issue('high', 'runtime', 'Tekeli-li 牌库未初始化：参考 setup addTekeliliDeck；本章 08604（从下方进入洗入）、08617（取消弱点）、08723+（弱点抽取）都依赖它；content/.../iceAndDeathPart1/behavior.js:114 有初始化读点，本章无',
        `${P}/behavior.js:1-30（import tekeliShuffleIn 但无 initializeTekeliDeck）；${ENG}/eote-tekeli.js:63-99；grep initializeTekeliDeck 本章无`,
        '在 setup/preScenarioSetup 调用 initializeTekeliDeck（使用 shared-encounters.js:230 tekeliDeckSpec）'),
      issue('medium', 'impl-vs-text', 'setup 缺：混乱袋 +1 [elder_thing]、Hard/Expert 初始毁灭、勘察过山口起始线索减半',
        `${P}/behavior.js:69-103；${REF}/.../ToTheForbiddenPeaks.hs:208-231；${P}/definition.js:196-227`,
        '在 preScenarioSetup 读记录/难度补齐这些 setup 步骤'),
      issue('medium', 'docs', '伙伴序幕分支（Eliyah/Claypool/Takada 存活 → frost/创伤）与「放一边的 2 个山腰地点固定为 08601/08606」已披露近似仅覆盖后者；前者未披露',
        `${P}/behavior.js:54-56（scenarioApproximations 只有 1 条）；${REF}/.../ToTheForbiddenPeaks.hs:90-159`,
        '扩写 scenarioApproximations 或在 preScenarioSetup 实现伙伴分支'),
      issue('medium', 'docs', '测试只测钩子：全部用手工 state/apiStub 直调 behavior（tests/eote-scenario-toTheForbiddenPeaks.test.mjs:35-104），无真实引擎 setup/移动/抽遭遇；断言多为 hook 返回值',
        'tests/eote-scenario-toTheForbiddenPeaks.test.mjs:112-316',
        '补真实引擎链路测试（startScenario→placeLocation→move→drawEncounter→act/agenda 推进）'),
      issue('low', 'docs', '08596 参考卡 no-behavior 口径成立：token 表由 chaos.js 实现，无独立条目；账本 status=no-behavior 与实现一致',
        `${P}/chaos.js:16-59；${P}/definition.js:196-227`,
        '无'),
    ],
  },
  {
    id: 'cityOfTheElderThings', name: '古老者之城', nameEn: 'City of the Elder Things', referenceCode: '08621',
    setup: {
      status: 'partial',
      evidence: `${C}/definition.js:37-153；${C}/behavior.js:73-140；${ENG}/setup.js:795-799`,
      implemented: [
        '16 张城市景观 + 隐秘隧道，三套坐标（CITY_LAYOUTS）与 16 把数值钥匙（CITY_KEY_VALUES）',
        '城市网格与相邻连接（initializeCity/connectGrid/placeGridLocation，behavior.js:92-140）',
        '三套版本的 gather/setAside 数据在 shared-encounters.js:117-136 与参考一致',
      ],
      missing: [
        '按版本替换幕牌库（actsForVersion 只用于 v1 默认值）与 setup 文本（固定 v1）',
        '按版本使用 setAside/removed（SET_ASIDE_BY_VERSION/REMOVED_BY_VERSION 无运行时读点）',
        '移除集：benignElderThing/frostbitten/possessed/reawakened/terror 未按版本移除',
        '混乱袋 +1 [elder_thing]（v1/v2）、Hard/Expert 初始毁灭、勘察城郊的初始线索发现、伙伴死亡加弱点、Tekeli-li 牌库初始化',
        '17 个地点未经 placeLocation：起始地点未揭示、maxClues 缺失、初始线索值错误',
      ],
    },
    rules: {
      status: 'partial',
      evidence: `${C}/chaos.js:11-64；${C}/behavior.js:180-201,220-226,245-253,256-355,371-417`,
      notes: [
        '混乱标记两档取值/tablet+frost 自动失败已实现（chaos.js:27-64；tests:222-240）',
        '特别规则 Keys：取得/转交/淘汰落地三句只有未接线的导出函数，玩家无入口（high）',
        '议程自由行动（查看/移动行列）实现不等价（移动不移动、查看无输出）',
      ],
    },
    flow: {
      status: 'gapped',
      evidence: `${C}/behavior.js:204-243,460-483；${ENG}/act-agenda.js:326-372；${ENG}/harm-threat.js:354-361`,
      notes: [
        '幕 1 钥匙记录目标/幕背面揭示隧道已接线；幕 2 目标 + R1 已接线',
        '议程 2 背面 (→R2) 未实现：最后议程耗尽除全灭外不终结 → R2 不可达',
        '幕背面缺洗混共享组/刷恐怖等子句（08624–08626）',
      ],
    },
    runthrough: {
      status: 'gapped',
      evidence: 'tests/eote-scenario-cityOfTheElderThings.test.mjs:105-273',
      notes: [
        '真实链路不可通：钥匙无法取得 → 幕 1 目标不可达 → 隐秘隧道不揭示 → 幕 2 无法完成；议程耗尽也不结束（R2 缺失）。'
        + '测试全部直调 behavior（claimKey/performAction/resolveEncounter），未覆盖该链路。',
      ],
    },
    guides: { status: 'partial', evidence: `${C}/definition.js:205-234；${C}/texts.js`, notes: ['指南正文/设置文本由 story-text 生成；setup 面板固定 v1，与版本选择逻辑不符'] },
    gatherSetsCheck: {
      evidence: 'audit/eote-scope.json（chapters[cityOfTheElderThings].gatherSets 11 组，CreaturesInTheIce/Shoggoths 为 gatherAndSetAside）+ shared-encounters.js:117-136',
      result: 'shared-encounters.js 的 v1/v2/v3 gather/setAside 与参考 Haskell .hs:334-341/375-382/410-417 逐组一致（✓）；definition.js:130-137 的 ENCOUNTER_DECK 只含本章 20 张，三套 gather 无运行时读点（✗）',
    },
    issues: [
      issue('high', 'runtime', '真实遭遇抽牌不结算本章专属诡计（08644–08647）：treacheryDefinition 无 entryRevelation、条目只有 resolveKind；引擎不读 resolveKind；behavior.resolveEncounter 无调用点',
        `${C}/definition.js:121-127；${ENG}/treachery-tokens.js:113-124；对比 ${C}/../theHeartOfMadnessPart1/definition.js:151`,
        '补 entryRevelation + encounterResolve 转发；补真实抽取测试'),
      issue('high', 'impl-vs-text', '遭遇牌库缺全部共享组且未按版本选用 gather/setAside：ENCOUNTER_DECK 只含本章 20 张；shared-encounters.js:117-136 的三套版本数据无运行时读点（chapterCardPool 无调用者）',
        `${C}/definition.js:130-137；content/campaigns/edgeOfTheEarth/shared-encounters.js:117-136,160-178；${ENG}/setup.js:807-815；${REF}/.../CityOfTheElderThings.hs:334-341,375-382,410-417`,
        'setup 时按版本调 chapterCardPool 合并 gather/setAside 入牌库'),
      issue('high', 'runtime', '数值钥匙无取得/转交入口：behavior.claimKey/giveKeys 只是纯函数，未进 actions/legalMoves；shared 的 scenarioReferenceEntry 用彩色钥匙原语（scenario-keys.js:104-140）且未挂到 08621 → 幕 1「花 2 把 elder_thing/tablet 钥匙」目标不可达，城市流程无法通过幕 1',
        `${C}/behavior.js:180-201,256-293；src/cards/encounter-entries/_shared.js:842-847；${ENG}/scenario-keys.js:104-140；参考 locale specialRules.Keys（fast 取得 / action 转交 / 淘汰落地）`,
        '在 behavior.actions 增加 fast 取得钥匙（地点无线索）与 action 转交，并在淘汰时把钥匙放回地点；补真实链路测试'),
      issue('high', 'impl-vs-text', '版本选择只做了「地图版本」：幕牌库永为 v1（actsForVersion 仅 definition.js:196 默认）、setup 文本固定 v1（definition.js:205-213、SCENARIO_TEXT）、setAside/removed 三套数据无读点 → 08625/08626/08628/08629 与 v2/v3 setup 在真实战役不可达；版本判定也未实现参考的伙伴票（CityOfTheElderThings.hs:242-277），theInvestigatorsScoutedTheCityOutskirts 无任何写点',
        `${C}/definition.js:185-196,205-234；${C}/behavior.js:73-88；${REF}/.../CityOfTheElderThings.hs:108-440`,
        'preScenarioSetup 按记录/伙伴票选版本并替换 acts、setup 文本、gather/setAside/removed'),
      issue('high', 'runtime', '议程 2 背面 (→R2) 未实现：08623 无 onReveal，behavior.finalResolution 无调用者；最后议程耗尽只走 checkOutcome（全灭才结束）→ R2 不可达且「被引导到隐秘隧道」记录不会写',
        `${C}/behavior.js:220-226,415-417；${ENG}/act-agenda.js:355-361；${ENG}/harm-threat.js:354-361`,
        '08623 声明 onReveal:"finalResolution"，behavior.agendaReveal 处理并写 R2 记录；补超时测试'),
      issue('high', 'runtime', '城市地点未走 placeLocation：behavior.setupLocations 直接 cloneLocation 推入 state.locations（17 个）→ maxClues 缺失（revealLocation 以 maxClues 恢复线索，揭示后变 0）、初始线索未按「未揭示=0」处理、起始地点未揭示、胜利点/入场钩子未派发',
        `${C}/behavior.js:83-140；${ENG}/locations.js:143-178（placeLocation 计算 maxClues/revealed）,251-264（revealLocation 用 maxClues）；${C}/definition.js:85-118`,
        '通过 placeLocation 放置或补齐 maxClues/revealed 并揭示起始地点；补地点揭示测试'),
      issue('high', 'impl-vs-text', '按版本移除的卡未移除：REMOVED_BY_VERSION/SET_ASIDE_BY_VERSION 无读点；ENCOUNTER_DECK 仍含 benign×3/frostbitten×4/possessed×4，frostbitten/possessed 会被当普通遭遇卡抽到（参考是移出游戏、仅由序幕加入牌组的弱点）',
        `${C}/definition.js:143-159；${REF}/.../CityOfTheElderThings.hs:364-365,395-400,429-434`,
        'setup 按版本 apply removed/setAside，并补序幕伙伴弱卡分支'),
      issue('high', 'runtime', 'Tekeli-li 牌库未初始化（参考 addTekeliliDeck）；本章 08628 幕 2 行动/08723+ 弱点依赖它',
        `${C}/behavior.js:1-35；${ENG}/eote-tekeli.js:63-99`,
        'setup 调 initializeTekeliDeck（shared-encounters.js:230）'),
      issue('medium', 'impl-vs-text', 'setup 缺：混乱袋 +1 [elder_thing]（v1/v2）、Hard/Expert 初始毁灭、勘察城郊起的初始线索发现（scoutedTheCityOutskirtsBonus）、伙伴死亡时把 frostbitten/possessed 加入调查员牌组',
        `${C}/behavior.js:73-140；${REF}/.../CityOfTheElderThings.hs:87-106,200-219,363-370,394-405`,
        '按参考补 setup 步骤'),
      issue('medium', 'impl-vs-text', '结局记录语义混淆：finalResolution 用 hiddenTunnelRevealed 决定 R1/R2（但该 flag 在幕 1 背面就置真），resolution 用 found 同时写 Found/Guided 两键；R2 应写 theTeamWasGuidedToTheHiddenTunnel',
        `${C}/behavior.js:407-417；${REF}/.../CityOfTheElderThings.hs:474-502`,
        '按 resolution key 分别写 Found（R1）/Guided（R2）'),
      issue('medium', 'docs', '测试只测钩子：全部手工 state+apiStub 直调 behavior（tests/eote-scenario-cityOfTheElderThings.test.mjs:35-100），未跑真实 setup/移动/遭遇抽取/幕推进',
        'tests/eote-scenario-cityOfTheElderThings.test.mjs:105-273',
        '补真实引擎链路测试'),
      issue('low', 'docs', '08596/08621 参考卡 no-behavior 口径成立：08621 token 表由 chaos.js 实现（skull=-钥匙数 等），账本一致；但章节 setup 的 +1 elder_thing token 属章节缺口',
        `${C}/chaos.js:11-64；${C}/behavior.js:73-140`,
        '无'),
      issue('low', 'duplication', 'hiddenTunnel 用孤立格 (6,6) 放地图外，参考放在网格 Pos 0,0（背面不可进入）；近似未在 scenarioApproximations 披露',
        `${C}/behavior.js:92-140（placeGridLocation(HIDDEN_TUNNEL,6,6,{isolated:true})）；${REF}/.../CityOfTheElderThings.hs:345,386,421`,
        '补披露或改为同格占位'),
    ],
  },
]

// --- D5 复用问题（跨两章）---
const duplicationIssues = [
  issue('medium', 'duplication', '两章 behavior 各自重复实现同类工具：peaks 的 moveBelow/dropExpeditionAssetsOf/isExpeditionAsset/nearestElderThingMovesAndAttacks 与 city 的 nearestEnemyMovesAndAttacks/record helper 结构相同；「最近敌人向你移动并攻击」在两章各写一遍，应上收 eote-primitives/shared',
    `${P}/behavior.js:378-437,428-475；${C}/behavior.js:422-448,485-540；参考 primitives.md 的 eote 通用原语清单`,
    '把「下移一层」「掉落 Expedition 支援」「最近敌人移动/攻击」上收共享原语并在两章复用'),
  issue('medium', 'duplication', '数值钥匙存在两套容器/API：eote-city.js 的 city.keys（keyOnLocation/placeKey/takeKey/moveKey/swapKeys，api-mechanics.js:184-191）与 scenario-keys.js 的 kind:"value" 实体；本章只用后者，eote-city 的钥匙 API 在本章零使用点（死 API / 双实现）',
    `${ENG}/eote-city.js:1-20,120-180；${ENG}/api-mechanics.js:184-191；${ENG}/scenario-keys.js:1-20,143-243；${C}/behavior.js:31-56`,
    '收敛到 scenario-keys 数值钥匙一套 API（或明确 eote-city.keys 仅为其它用途并删除未用导出）'),
  issue('low', 'duplication', '城市地图「看行/列」有两套读点：grid-map.js 的 lookRow/lookColumn/revealedGrid 与 eote-city.js 的 visibleOnRow/visibleOnColumn；本章两者都未真正接到自由行动上',
    `${ENG}/grid-map.js:76-100,200-318；${ENG}/eote-city.js:199-220；${C}/behavior.js:274-279`,
    '明确私密窥视的唯一入口并让行动接它'),
  issue('medium', 'duplication', '两章 TREACHERY_HANDLERS 模式与其它 EOTE 章的 behavior.resolveEncounter 同形复制，且“frost 弱点/最近敌人/下移”等句在多章各写一遍；同句规则（AGENTS「三张卡就上收」）已在 EOTE 内部重复',
    `${P}/behavior.js:488-562；${C}/behavior.js:485-540；content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:172`,
    '抽共享 EOTE 结算助手（applyFrostWeakness/nearestEnemyMovesAndAttacks/moveDown）并登记原语'),
  issue('low', 'duplication', '版本化幕/议程已数据化（city actsForVersion、fatalMirage 版本卡）但两处各写一套版本选择；版本选择原语可共享',
    `${C}/definition.js:185-196,201-213；content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:146-147`,
    '上收「版本选择」为共享常量/助手'),
]

const allIssues = [...cards.flatMap(card => card.issues.map(i => ({ ...i, code: card.code }))),
  ...scenarios.flatMap(s => s.issues.map(i => ({ ...i, scenario: s.id }))),
  ...duplicationIssues.map(i => ({ ...i }))]
const bySeverity = { high: 0, medium: 0, low: 0 }
for (const i of allIssues) bySeverity[i.severity] += 1

const summary = {
  cards: cards.length,
  match: cards.filter(c => c.verdict === 'match').length,
  approximation: cards.filter(c => c.verdict === 'approximation').length,
  gap: cards.filter(c => c.verdict === 'gap').length,
  blocked: cards.filter(c => c.verdict === 'blocked').length,
  accepted: cards.filter(c => c.accepted).length,
  issuesBySeverity: bySeverity,
  issuesTotal: allIssues.length,
  highIssueCards: [...new Set(allIssues.filter(i => i.severity === 'high' && i.code).map(i => i.code))].length,
}

const findings = {
  area: 'campaign/c',
  auditor: 'campaign-auditor-c',
  method: '逐卡逐子句核对 cards-data 卡面（中英）vs 单卡条目 + 两章 definition/behavior/chaos 消费点 + src/engine 真实读点 + 两份剧本测试；D1/D3/D4/D5 证据均给「相对 mod 根路径:行号」；参考实现（Haskell/locale）只作对照。只读审计，未修改 games/arkhamhorror。',
  generatedAt: '2026-11-08',
  scope: {
    codes: cards.map(c => c.code),
    count: cards.length,
    chapters: ['toTheForbiddenPeaks (08596–08620)', 'cityOfTheElderThings (08621–08647)'],
    referenceCards: ['08596', '08621'],
  },
  summary,
  testsRun: {
    command: 'cd games/arkhamhorror && node --experimental-test-isolation=none --test tests/eote-scenario-toTheForbiddenPeaks.test.mjs tests/eote-scenario-cityOfTheElderThings.test.mjs',
    result: '20 tests / 20 pass / 0 fail（约 1.0s）',
    note: '两份测试均通过，但都是手工 state+apiStub 直调 behavior 钩子；未跑真实引擎 setup/移动/遭遇抽取/幕-议程推进，因此无法覆盖本报告多数 high issue（断言强度：hooks-only）。',
  },
  cards,
  scenarios,
  duplicationIssues,
  crossShardNotes: [
    {
      subject: 'simplified 卡（08560/08561/08562/08565/08566/08567/08571/08572，fatalMirage，属 campaign-auditor-b 分片）现状复核（D5 口径，仅披露核对）',
      finding: 'known-deviations.json 8 条 simplified（pending primitive p7-08560）+ audit/eote-all-card-acceptance.json 已披露；条目仅声明 flags（如 08560.js:15 forcedAfterInvestigate），对应行为读点不存在（grep shroudPlus1AndCannotLeave 仅条目+测试 flags 断言 tests/eote-scenario-fatalMirage.test.mjs:142）→ 披露存在、实现仍缺失；建议 Lead 让 B 分片按「声明未接线」记 medium。',
    },
    {
      subject: '同源问题提示',
      finding: 'theHeartOfMadnessPart1/behavior.js:172 也定义了 behavior.resolveEncounter，与 peaks/city 同样无引擎调用点（treachery-tokens.js 只对 effect.kind==="campaignRule" 调用）→ 若该章专属诡计也只用 resolveKind，则存在同类 high 问题，建议 Lead 交叉核对（D 分片）。',
    },
    {
      subject: '共享遭遇组展开（D5/跨章不一致）',
      finding: 'iceAndDeathPart1/definition.js:107-120 用 GATHER_GROUPS 扫描 ALL_CARDS.encounterCode 展开 ENCOUNTER_DECK；peaks/city 未采用该模式 → 建议上收为共享助手（gatherDeckFor(groups)）供 8 章复用。',
    },
  ],
}

fs.writeFileSync(`${ROOT}/findings.json`, JSON.stringify(findings, null, 1), 'utf8')
console.log('summary:', JSON.stringify(summary))
console.log('cards:', cards.length, 'scenarios:', scenarios.length)
