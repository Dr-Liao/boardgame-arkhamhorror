# EOTE 八章实现 & 战役流程审计（scenario-auditor）

生成：2026-11-08；证据目录：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/logs/`（tests.log / runthrough.json / runthrough.md / flow-consistency.json / decks.json / probe-encounters.json / probe-city 复现）。

## 1. 结论摘要

- 8 章 verdict：{"gap":7,"approximation":1}；问题 {"high":21,"medium":22,"low":4}。
- 流程图（EOTE_FLOW）本身：47 节点、8 场景节点、3 检查点、3 幕间、epilogue、end；manifest.flow 与 EOTE_FLOW 一致；flow-only run 在真实引擎里抵达 `campaignResult/end`；检查点 I 放弃（跳 II/III）、检查点 II 逃跑、幕间全开门（3 次 FM）等分支序列与 p8 验收预期一致；存档 JSON→migrateState 幂等（changes=[], secondChanges=[]）并可继续下一章；失败路径 noResolution 后可继续。
- 关卡内真实玩法**跑不通**：`runs.main` 在 City 卡死；深驱动逐章结果：IDP1 60 动作无合法撤退动作（幕目标不可达）；IDP2 第 24 步抛「密谋规则尚未迁移：08523」；IDP3/FM 10 轮内只能全灭 noResolution（无正常结算钩子）；City 第一个地点动作即 TypeError「options.resolve is not a function」并留下无法收敛的 commit 选择。
- p8 验收 125 用例全绿的原因：`tests/eote-p8-campaign.test.mjs` 全程用 fixture `finishScenario` 的 debug `endScenario` 跨章，不驱动关卡内幕/议程/地点动作。

## 2. 跑通矩阵（真实引擎）

| 章节 | 可达 | 深驱动动作 | 自然结算 | 幕/议程推进 | 崩溃/死锁 | 钩子探针 |
| --- | --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | 是 | 60 步 {"investigate":60} | 否 | 0/2 | 无 | act=场景规则尚未迁移：08521 / agenda=ok |
| iceAndDeathPart2 | 是 | 24 步 {"investigate":24} | 否 | 0/0 | 密谋规则尚未迁移：08523 | act=场景规则尚未迁移：08526 / agenda=密谋规则尚未迁移：08523 |
| iceAndDeathPart3 | 是 | 32 步 {"investigate":32} | noResolution | 0/0 | 无 | act=场景规则尚未迁移：08546 / agenda=密谋规则尚未迁移：08544 |
| fatalMirage | 是 | 31 步 {"investigate":31} | noResolution | 0/0 | 无 | act=场景规则尚未迁移：08553 / agenda=密谋规则尚未迁移：08550 |
| toTheForbiddenPeaks | 是 | 21 步 {"investigate":21} | noResolution | 0/0 | 无 | act=ok / agenda=ok |
| cityOfTheElderThings | 是 | 1 步 {"scenarioAction":1} | 否 | 0/0 | options.resolve is not a function | act=ok / agenda=ok |
| theHeartOfMadnessPart1 | 是 | 16 步 {"investigate":16} | noResolution | 0/0 | 无 | act=ok / agenda=ok |
| theHeartOfMadnessPart2 | 是 | 12 步 {"investigate":12} | noResolution | 0/0 | 无 | act=ok / agenda=ok |

## 3. 指南 vs 实现差异表（逐章要点）

### iceAndDeathPart1（gap）

- setup · implemented — 收集 Ice and Death/The Crash/Creatures in the Ice/Deadly Weather/Hazards of Antarctica/Silence and Mystery/Tekeli-li/Ancient Evils（8 组）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:22-24,108-128（GATHER_GROUPS + SHARED_CORE_DECK 01166×3），实测 deck=23（含 ancientEvils 3））
- setup · implemented — Creatures in the Ice 放一边；9 张 Uncharted 地点放一边；Skittering Nonsense ×3、Terror of the Stars 放一边（实测 setAside=20（11 张卡 + 9 地点）；games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:105-108）
- setup · implemented — Crash Site/Precarious Ice Sheet/Treacherous Path/Frozen Shores 入场，全员从 Crash Site 开始（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:85-91；runthrough setup.locations=4 revealed=4）
- setup · implemented — Hard +1 doom / Expert +2 doom；建立 Tekeli-li 牌库（16 张）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:114-116；runthrough tekeliDeck=16）
- setup · missing — 每名调查员可选一名可用伙伴入场（见 issue：伙伴选择无引擎入口（behavior 无 choosePartner 调用））
- [high] 行为层 scenarioActions / performScenarioAction（扎营撤退）声明后无任何引擎读点：合法动作列表从不生成 campResign，幕 I 的「全员撤退」目标无法达成，本关无法自然结算（只能全灭 noResolution 或调试指令）
- [high] 议程 I/II/III 背面效果未接线：behavior.agendaReveal 为空函数，条目 08518/08519/08520 的 agendaRule.onAdvance 无引擎读点；议程推进后不生成疾行谬物、不洗入冰中生物、不生成星之恐怖、也不触发「时间不够」的强制撤退结局
- [medium] 结局 1 缺「营地庇护值（最低 3）+ 胜利区 XP」的经验奖励：resolution 钩子只写记录不返回 bonus，引擎按 state.victory 发放
- [medium] 指南要求开局每名调查员选择一名可用伙伴入场（并记录其伤害/恐惧）；实现没有任何关卡入口调用伙伴选择（FM behavior.choosePartner 无引擎读点），深驱动中伙伴从未入场

### iceAndDeathPart2（gap）

- setup · implemented — 收集 8 组（含 Ancient Evils）；议程 4–6 + 幕 2（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:20-22,186-195；实测 agendas=[08523,08524,08525]、act=[08526]）
- setup · implemented — 按 Campaign Log 的 Locations Revealed 放地点（已揭示），其余未揭示；从营地开始（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:64-76；实测 13 地点、revealed=4、起始=frozenShores（camp 记录））
- setup · approximation — MIA 伙伴变被附身敌人 + 8 张剧情卡合计 9 张压到 9 个未探索地点下（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:78-108（无 MIA 时只有 8 张））
- setup · missing — 基础资源=营地庇护值（非 5）（实测 resources=[5,5]）
- setup · implemented — 建立 Tekeli-li 牌库（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:91；实测 16 张）
- setup · missing — 每名调查员可选伙伴（同 IDP1）
- [high] 议程 1（08523 冷风呼啸）推进直接抛错「密谋规则尚未迁移：08523」：behavior 未提供 agendaReveal，而定义把议程 reveal 声明为 campaignRule；真实引擎在第 1 次神话阶段议程推进时崩溃（深驱动 24 个动作后复现）
- [high] 行动派生的 act/agenda 背面钩子（agendaRule.onAdvance lookUnderLocation / defeatRemainingAndResolve）与 behavior.resolveAgendaBack / resolveStory 只被测试调用，真实引擎无读点
- [medium] 指南要求开局基础资源 = 当前营地庇护值（而非 5）；实现未调整，深驱动快照 resources=[5,5]（营地 frozenShores 庇护 2）
- [medium] MIA 伙伴压卡数量不足 9：指南要求「敌人+剧情卡合计恰好 9 张」压到 9 个未探索地点下；无 MIA 时实现只压 8 张剧情卡（slice(0,9)），有一处未探索地点无压卡

### iceAndDeathPart3（gap）

- setup · approximation — 收集 8 组（含 Seeping Nightmares/Creatures in the Ice/Ancient Evils）（GATHER_GROUPS 缺 ancientEvils（beat 未加 core）；deck 未按份数展开且含 Tekeli 卡）
- setup · partially — 议程 7–8 + 幕 3（卡号 08544/08545/08546 对上，但结算钩子缺失（见 issues））
- setup · implemented — 按记录放全部地点、只营地揭示、清空营地线索（实测 locations=13、revealed=1（frozenShores）；games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:37-44）
- setup · approximation — 按人数生成渗出梦魇于不同非营地地点，8 张幻灵均分压底，剩余移出游戏（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:46-69（均分+slice、剩余未移出牌库））
- setup · missing — 建立 Tekeli-li 牌库（runthrough tekeliDeck=null）
- [high] 本关无法正常结算：behavior 没有 checkObjectives/actReveal/agendaReveal/resolution 钩子；幕目标 objective.type=noEidolonEnemies 引擎不支持（act-agenda.js 只处理 clues/defeatEnemy/uniqueCultists/actClues），actObjectiveMet 无读点；结局键与指南/剧情不一致
- [high] 遭遇牌库未按印刷份数展开（22 张全唯一），且把 7 张 Tekeli-li 放进遭遇牌库、未建立 Tekeli-li 牌库；指南要求按 gather 份数并单独忒咳哩-哩牌库
- [medium] 渗出梦魇副本留在遭遇牌库（指南要求按人数生成后把剩余移出游戏）；已生成梦魇压卡分配用 slice 均分（与「尽量均分」等价但未处理余数）
- [medium] startLocation 固定为 DEFAULT_CAMP（crashSite），与战役记录的当前营地不一致；引擎 UI/起始地点展示可能与实际（frozenShores）不符

### fatalMirage（gap）

- setup · missing — 收集 8 组（含 Chilling Cold）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:19-22 仅 7 组，实测 deck 无 core 01167/01168）
- setup · implemented — 首次：Prison of Memories 入场，其余 18 地点放一边；9 Memory 敌人 + 9 Resolute 支援放一边；只建 agenda1/act1；Hard/Expert 加 doom（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:64-136；实测 locs=1、asideLocations=18、doom 按难度）
- setup · missing — 重入：按第 2/3 次换 agenda2/3、act2/3，把 Memories Banished 放胜利区、Discovered 入场（实测两次进入均 version1/08550/08553；memories 恢复未实现）
- setup · missing — 建立 Tekeli-li 牌库（tekeliDeck=null；7 张 Tekeli 反在遭遇牌库）
- setup · missing — 每名调查员开局选择伙伴（choosePartner 无引擎读点）
- [high] 「幻景」核心机制未接线：28 张剧情卡的 flags.storyFlip 只被 behavior.flipStoryFace 读取，而 flipStoryFace 只被单测调用（测试专用代码），真实引擎没有任何翻面动作/选择入口；地点线索变化、记忆敌人/放逐、坚毅伙伴切换在实机都不可达
- [high] 幕/议程 reveal 钩子缺失：推进 08553/08550 即抛「场景/密谋规则尚未迁移」，本关无法推进幕/议程；且 behavior 无 resolution 钩子（scenarioResolution 死代码），结算不写 fatalMirageTimes/memoriesBanished/discovered/xp 等记录
- [high] 重入版本不切换：fatalMirageVersion 依赖 campaign.completedSteps / records.fatalMirageTimes，但引擎从不写 completedSteps，且 resolution 死代码不写 fatalMirageTimes → 连续三次进入都取 version 1（议程/幕 08550/08553），违背指南「第二次进入用 II、第三次用 III」
- [high] 开局/遭遇牌库与指南不一致：gather 缺 Chilling Cold（指南 8 组）；ENCOUNTER_DECK 仅唯一卡面未按印刷份数展开，并把 7 张 Tekeli-li 放进遭遇牌库；未建立 Tekeli-li 牌库；未按版本把已放逐/已发现记忆带回来
- [medium] 每关开局伙伴选择缺失（FM behavior.choosePartner 无读点）；resolution 要求的「记录伙伴伤害/恐惧」没有实现
- [medium] 混乱标记失败/通过后续未实现：behavior 无 afterTest/PassedSkillTest 钩子，08648 参考卡 [cultist]（未成功 2 点内放线索）、[tablet]（失败移回记忆囚笼或洗入 Tekeli，困难失败 2+ 两者）、[elderthing]（失败在幻灵敌人放毁灭）均不结算

### toTheForbiddenPeaks（gap）

- setup · missing — 收集 6 组（含共享组）（实测 deck=14 仅本章组；GATHER_GROUPS 只有 1 组）
- setup · approximation — 七个山腰地点洗混取 5 排斜线，山顶在顶端，level 0–5；揭示 level-0 从该处开始（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js:54-56（固定 5 个，已在 scenarioApproximations 披露））
- setup · missing — 加 1 [elder_thing] 混乱标记；按 Supplies Recovered 放探险支援；星之恐怖放一边（实测袋无 elderthing；支援仍在放一边（setAside=10））
- setup · missing — 建立 Tekeli-li 牌库（tekeliDeck=null）
- setup · implemented — Hard +1 doom / Expert +2 doom（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js:69-78（preScenarioSetup 分支））
- [high] 遭遇牌库只含本章专用组，指南要求的共享组（Deadly Weather、Elder Things、Hazards of Antarctica、Nameless Horrors、Tekeli-li）全部未加入；实测 opening encounterDeck=14 张全部是 to_the_forbidden_peaks
- [high] 开局未把 Campaign Log「Supplies Recovered」里列出的 Expedition 剧情资产放到 level-0 地点：RECORD_READS 声明了 suppliesRecovered 但 behavior 无读点，7 件探险支援全部留在放一边区
- [high] 08610–08613 四张章节诡计只声明 treacheryRule.resolveKind，引擎无 resolveKind 读点（唯一读点 behavior.resolveEncounter 仅在 t.effect.kind==='campaignRule' 时被调用，这些卡无 effect 数据）→ 抽到即静默无效果；已用调试遭遇 08611/08612/08613 验证 0 状态变化
- [medium] behavior 内 3 处 api.test 形参错误：第 4 参应为 resolve 回调，实际传入 { source, resolve } 对象；一旦这些处理器被触发会抛「options.resolve is not a function」（与 cityOfTheElderThings 已实测崩溃同源）
- [medium] 指南 setup 要求「Add 1 [elder_thing] token to the chaos bag」；实测开局混乱袋无 elderthing（18 枚），tokenMeanings 却含 elderthing，数值/提示存在但袋中永远抽不到

### cityOfTheElderThings（gap）

- setup · missing — 按版本收集 8 组（v1 含 Shoggoths/Locked Doors；v2/v3 含 Chilling Cold/Creatures in the Ice 等）（实测 deck=20 全 chapter 组；共享组未接入）
- setup · implemented — 16 城市景观 + Hidden Tunnel 按版图入场、相邻连通；16 把钥匙随机放；起始地点按版本/队长选择（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:83-100；实测 locations=17、16 keys 初始化）
- setup · missing — 加 1 [elder_thing] 混乱标记；移除未获得的 Frostbitten/Possessed 弱点（实测袋无 elderthing；无弱点清理代码）
- setup · missing — 建立 Tekeli-li 牌库（tekeliDeck=null）
- setup · implemented — Hard +1 / Expert +2 doom（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:73-80）
- [high] 地点动作崩溃：合法动作 scenarioAction:loc:bridgeDiscover 触发 behavior 内 api.test 形参错误（第 4 参传对象而非回调）→ 引擎抛 TypeError「options.resolve is not a function」，关卡卡死且后续待决选择（commit）无法收敛，战役无法进入第三幕之后章节
- [high] 遭遇牌库只含本章专用组（实测 20 张全为 city_of_the_elder_things），指南要求的共享组（Elder Things、Miasma、Nameless Horrors、Penguins、Shoggoths/Tekeli-li、Locked Doors/Chilling Cold 等按版本）全部未加入
- [medium] 指南 setup 要求「Add 1 [elder_thing] token to the chaos bag」以及「把未获得的 Frostbitten/Possessed 弱点移出游戏」；实现都没做（实测袋中无 elderthing；preScenarioSetup 无弱点清理）
- [high] 四张章节诡计（08644–08647）只声明 resolveKind / flags，引擎无可达结算入口（同 peaks 08610–08613 的 gate 问题）；调试遭遇 08644/08645 实测无任何伤害/恐惧/威胁变化
- [medium] act1 背面只把 hiddenTunnelRevealed 置真并提示，未按版本执行「混洗共享组/遭遇弃牌堆、揭示隐秘隧道、按版本放星之恐怖/加 frost/抽遭遇」等指南流程（act1BackV1/V2/V3 仅日志与局部状态）

### theHeartOfMadnessPart1（gap）

- setup · implemented — 收集 9 组（含 Ancient Evils/Locked Doors 等 core 组）（实测 deck=48 含 ancient_evils 3、locked_doors 2；但误含 tekelili 16）
- setup · implemented — Gate of Y'quaa 入场，全员从门开始；15 座 Ancient Facility 按三环五辐随机布置；5 枚 seal token 放一边（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:185-210；实测 locations=16、start=theGateOfYquaa）
- setup · missing — 建立 Tekeli-li 牌库（16 张）（实测 Tekeli 卡在遭遇牌库、tekeliDeck=null）
- setup · implemented — Hard +1 / Expert +2 doom（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:185-210（setup 分支））
- [high] 16 张 Tekeli-li 卡被放进遭遇牌库（应在独立的 Tekeli-li 牌库），且本关未初始化 Tekeli-li 牌库；[tablet] 失败本应「抽 Tekeli-li 牌」，实际抽遭遇牌/无牌可抽
- [medium] 本章 scenario.tokenMeanings = {}（08648 参考卡 4 个符号语义不显示），而 H2 有完整 tokenMeanings；同一条参考卡的两半展示不一致
- [medium] 08670 电静放电诡计只声明 flags.revelation，引擎无可达入口（同 resolveKind 问题），抽到无效果
- [medium] 两处已声明近似：原质团「敌人阶段结束再次重整并结算敌人阶段」按重整+提示近似；石板抽 Tekeli 直接取顶放弃牌。近似已在 scenarioApproximations 披露，但规则语义仍降级

### theHeartOfMadnessPart2（approximation）

- setup · implemented — 收集 4 组（Stirring in the Deep/Agents/Chilling Cold/Striking Fear，后者只取 2×Dissonant+2×Frozen）（实测 deck=14：stirring2+agents4+chilling4+striking4（STRIKING_KEEP 过滤））
- setup · implemented — 移出 Great Seal/Shoggoths/Locked Doors（含 Ancient Facility）；建议程 4–5 + act 3（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:60-100（REMOVED_GROUPS + ENCOUNTER_GROUPS 过滤））
- setup · implemented — Gate 翻面；5 个 Mist-Pylon + 10 个 Ancient Facility 洗混布置（内环不能全是 Pylon）；把 15 份 Nameless Madness/Final Mirage/4 Ramp/Hidden Tunnel 放一边（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:43-85；实测 locations=16）
- setup · approximation — 按封印状态分配控制者/移除其余封印（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:87-100（已披露近似））
- setup · missing — 建立 Tekeli-li 牌库（tekeliDeck=null（H1 把 Tekeli 放遭遇牌库的连带问题））
- [medium] 已声明近似：「15 份无名的疯狂」按 enemy 实例计数；「毁灭被放置时改为生成无名的疯狂」（doomPlacementReplacement）明确标注留待 P8，当前未实现（属 declared gap）
- [medium] 封印放置为近似：休眠封印被平均分配给调查员并提示「战役状态近似」，未严格按指南「每枚已激活封印由一名调查员控制、休眠封印由各自调查员控制、其余移出游戏」
- [medium] 指南要求把 The Great Seal/Shoggoths/Locked Doors（含 5 张 Ancient Facility）移出游戏、Striking Fear 只收 2×Dissonant Voices+2×Frozen in Fear；实现靠 ENCOUNTER_GROUPS 与 STRIKING_KEEP 过滤，但无「从牌库/放一边区搜索并移出」的实体卡移除（依赖未入池），也未处理 Great Seal 设施卡与 H1 牌库残留

## 4. 战役流程与记录缺口

- [high] 真实引擎下整条战役无法自然跑通：第 2 章（IDP2）议程推进抛缺钩子错误，第 5 章（City）地点动作抛 TypeError 并卡死待决选择，第 3/4 章（IDP3/FM）无法正常结算；p8 验收测试全程用 debug endScenario 跨章，掩盖了这些关卡内路径（logs/runthrough.json runs.main（停在 cityOfTheElderThings；errors 见 deep）；tests/eote-p8-campaign.test.mjs:201（fixture finishScenario 使用 debug endScenario）；p8 12 个测试文件 125 用例全绿但均在关卡设置后立即调试结束）
- [high] 检查点 I 的营地庇护值没有从 IDP1 结局传导：IDP1 resolution 写 records.camp（地点 id）与 iceAndDeathPart1CampShelter，而 checkpoints.shelterValueOf 只读 records.eoteShelterValue / records.campXxx → 取 0，导致本该庇护 2 的营地全部 9 名伙伴 MIA（随后被 IDP2 结局划去）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:342-366；games/arkhamhorror/content/campaigns/edgeOfTheEarth/checkpoints.js:197-205（shelterValueOf）；runthrough main：chapter1 records.camp=frozenShores/shelter=2，chapter2 records.eoteMissingCount=9、eoteMissingPartners=9 人）
- [high] 多个结局钩子缺失导致战役记录不落账：IDP3 与 FM 的 behavior 未挂 resolution 钩子（scenarioResolution 为死代码）→ iceAndDeathPart3Resolution/fatalMirageTimes/memoriesBanished/memoriesDiscovered/xp 等不写；IDP1 缺 XP bonus；伙伴伤害/恐惧从未记录（games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:126-143、games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:275-296（函数定义但 behavior 对象未挂 resolution）；src/engine/campaign-flow.js:241-254（只调用 scenarioBehavior(state).resolution）；runthrough main recordsAfter：iceAndDeathPart3Resolution=""、fatalMirageTimes=0）
- [high] 每关开局的「伙伴选择」与「伙伴伤害/恐惧记录」规则未实现（指南 base 规则 + 各关 setup），导致伙伴机制整体不可玩：无伙伴入场、无伤害、无纪念/划去闭环（虽有 eotePartner 原语与 FM choosePartner，但无引擎触发）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/prologue.js:139-162（只建名册）；src/engine/eote-interactions.js:126（eotePartner 操作无调用方）；各章 setup 无伙伴选择；tests 仅单测 choosePartner）
- [medium] EOTE_STEP_ORDER 只有 15 步且缺 fatalMirage，与 audit/eote-scope.json 的 16 步（含 fatalMirage）及 parts.js 自身注释「16 个战役步骤」不一致（games/arkhamhorror/content/campaigns/edgeOfTheEarth/parts.js:45-55（注释 16 步、数组 15 步）；audit/eote-scope.json campaignFlow.steps（含 fatalMirage）；flow-consistency.json steps.missing=["fatalMirage"]）
- [medium] 幕间为近似：自动查看前 N 名存活伙伴（非队长选择）、奖励经验按查看数固定、Dyer 存活移除忒咳哩-哩弱点等专属奖励留待章节接线（已在代码披露）（games/arkhamhorror/content/campaigns/edgeOfTheEarth/interludes.js:16-19,347-393（近似声明与实现）；guides/base.json interludes）
- [low] audit/eote-scope.json 的 nextStepEdges 与实现 nextStep 的候选顺序不同（checkpoint1: [checkpoint2, iceAndDeathPart2] vs 实现 [iceAndDeathPart2, checkpoint2]；interlude1/2、interlude3 同样顺序差异），集合一致（flow-consistency.json nextEdges；audit/eote-scope.json campaignFlow.nextStepEdges）

## 5. 指南面板覆盖

| 章节 | en 文本块 | zh 文本块 | zh 缺失块 | 英文冒充 | 中文状态 | ref-zh 覆盖 | 注册 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | 38 | 36 | 2 | 0 | mixed | 0.804 | 是 |
| iceAndDeathPart2 | 26 | 24 | 1 | 0 | mixed | 0.804 | 是 |
| iceAndDeathPart3 | 17 | 8 | 10 | 0 | mixed | 0.804 | 是 |
| fatalMirage | 48 | 12 | 33 | 0 | mixed | 0.5 | 是 |
| toTheForbiddenPeaks | 34 | 22 | 12 | 0 | mixed | 0.627 | 是 |
| cityOfTheElderThings | 73 | 40 | 32 | 0 | mixed | 0.426 | 是 |
| theHeartOfMadnessPart1 | 69 | 52 | 14 | 0 | mixed | 0.648 | 是 |
| theHeartOfMadnessPart2 | 36 | 13 | 17 | 0 | mixed | 0.648 | 是 |

- 缺失中文按口径显示「中文待补」（`web/scenario-setup-view.js` + `web/locales/zh-CN.panels.js:9`），无英文冒充；`node tests/scenario-guides.test.mjs` 7/7 通过。

## 6. 混乱袋/tokenMeanings

- CHAOS_BAGS 与 audit/eote-scope.json chaosBags 完全一致（"四档 CHAOS_BAGS 与 audit/eote-scope.json chaosBags 逐 token 完全一致（easy16/standard17/hard18/expert18）"）。
- iceAndDeathPart1（08501）：value-match / rider-gap — [skull] ceil(庇护/2)（困难=庇护）、[cultist]-2、[tablet]-3/-4 与 08501 卡面一致；cultist/tablet 失败后果由 afterTest 实现
- iceAndDeathPart2（08501）：match — 数值与失败后果（含 hard 差值张数）同 08501，与 Part I 同口径
- iceAndDeathPart3（08501）：value-match / rider-missing — 数值一致；但 behavior 无 afterTest，[cultist] 洗入忒咳哩-哩、[tablet] 弃牌顶并抽弱点两条失败后果不结算；且 Tekeli 牌库未初始化
- fatalMirage（08549）：value-match / rider-missing — 四个符号数值与 08549 两档一致（困难 skull=剧情数+议程号近似 agendaIndex+1）；但 [cultist]/[tablet]/[elderthing] 的失败/未成功后果（放线索/移回囚笼或洗 Tekeli/幻灵放毁灭）无 afterTest 实现
- toTheForbiddenPeaks（08596）：match（除 elderthing 不在袋中） — skull=高度（困难+2）、cultist=-1 移动下方、tablet 丢探险支援、elderthing 最近古老者移动/攻击 与 08596 两档一致；但开局未向混乱袋加 elderthing（指南 setup）
- cityOfTheElderThings（08621）：match（除 elderthing 不在袋中） — skull=钥匙数（困难+2）、cultist=-2 放钥匙、tablet 与 frost 联动、elderthing 最近敌人 与 08621 两档一致；但开局未加 elderthing
- theHeartOfMadnessPart1（08648）：value-match / tokenMeanings-missing — 取值与失败后果实现（skull 旧日支配者-3/-4、cultist 视为 frost、tablet 抽 Tekeli、elderthing 失败3+放毁灭）；但 scenario.tokenMeanings 为空且 Tekeli 牌库缺失
- theHeartOfMadnessPart2（08648）：match — 转用 Part I 的同一份 08648 语义，tokenMeanings 已接入

## 7. 证据/命令

- in-process 测试：`cd games/arkhamhorror` 后逐文件 `node tests/eote-scenario-*.test.mjs …`（12 文件 125 用例，0 失败；见 logs/tests.log）。
- 自建 run-through：`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/runthrough.mjs`（输出 logs/runthrough.json/.md）；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/flow-consistency.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-decks.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-encounters.mjs`；`node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/probe-city.mjs`。
- 本 area 只读 mod，未修改 games/arkhamhorror 任何文件。