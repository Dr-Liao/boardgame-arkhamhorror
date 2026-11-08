## 附录 A：各 area 覆盖与 issue 统计

| area | 卡数 | issue | high | medium | low | 结论摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| investigators | 22 | 31 | 5 | 13 | 13 | match=14/approx=5/gap=3 |
| player-a | 60 | 77 | 7 | 47 | 23 | match=17/approx=36/gap=7 |
| player-b | 55 | 65 | 12 | 33 | 20 | match=21/approx=24/gap=10 |
| campaign-a | 48 | 132 | 61 | 63 | 8 | {"match":5,"approximation":13,"gap":30,"blocked":0} |
| campaign-b | 75 | 322 | 226 | 94 | 2 | match=0/approx=3/gap=72 |
| campaign-c | 52 | 91 | 65 | 20 | 6 | match=2/approx=6/gap=44 |
| campaign-d | 91 | 152 | 62 | 53 | 37 | match=31/approx=24/gap=36 |
| scenarios | 0 | 38 | 17 | 18 | 3 | {"gap":7,"approximation":1} |
| interactions | 0 | 5 | 0 | 2 | 3 |  |
| primitives | 0 | 39 | 33 | 5 | 1 |  |

## 附录 B：逐章 verdict 分布

| 分区/章节 | total | match | approximation | gap | blocked |
| --- | --- | --- | --- | --- | --- |
| eoteInvestigators|- | 22 | 14 | 5 | 3 | 0 |
| eotePlayer|- | 115 | 38 | 60 | 17 | 0 |
| eoteCampaign|shared:_shared | 80 | 23 | 20 | 37 | 0 |
| eoteCampaign|iceAndDeathPart1 | 5 | 0 | 0 | 5 | 0 |
| eoteCampaign|iceAndDeathPart2 | 21 | 5 | 11 | 5 | 0 |
| eoteCampaign|iceAndDeathPart3 | 5 | 0 | 0 | 5 | 0 |
| eoteCampaign|fatalMirage | 75 | 0 | 3 | 72 | 0 |
| eoteCampaign|toTheForbiddenPeaks | 25 | 1 | 1 | 23 | 0 |
| eoteCampaign|cityOfTheElderThings | 27 | 1 | 5 | 21 | 0 |
| eoteCampaign|theHeartOfMadnessPart1 | 12 | 7 | 1 | 4 | 0 |
| eoteCampaign|theHeartOfMadnessPart2 | 16 | 1 | 5 | 10 | 0 |

## 附录 C：P0/P1 候选（按 high issue 排序，前 120 条）

| # | severity | dimension | 卡/章 | summary | evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | high | impl-vs-text | 08004 | 打出牌库顶后不再重新揭示：常驻「top card revealed」在下次抽牌/轮初前失效，deckTop 打出通道也随之消失 | src/engine/play-channels.js:303-318（无 sync 调用）/ src/engine/eote-deck-top.js:109-118（markDeckTopPlayed 删除记录）/ src/engine/eote-investigator-support.js:196-220 |
| 2 | high | impl-vs-text | 08004 | 「揭示到弱点即强制抽取」被实现为 drawCards 尾部惰性抽取，非揭示时点触发；被揭示的弱点可长期停在牌库顶 | src/engine/deck-ops.js:629-640 / src/cards/entries/08004.js:6,12 注释也写「揭示到弱点时强制抽取」 |
| 3 | high | impl-vs-text | 08005 | commitDeckTop 跳过投入合法性检查并按全部图标计数：可把不匹配的牌库顶投入检定并凭空加图标（如仅意志图标的牌投入战斗检定仍 +1） | src/engine/eote-investigator-support.js:229-253（icons=Object.values(def.icons) 全量求和）/ src/engine/commit-rules.js:19-54（既有匹配逻辑未调用）/ src/engine/stats.js:327 / 探针 P3a |
| 4 | high | impl-vs-text | 08006 | 预示者只封锁抽牌，不封锁检索/洗牌/牌库操纵：searchDeck 在锁定期仍能公开检索并取牌（弱点严重弱化） | src/engine/eote-investigator-support.js:159-165 / src/engine/deck-ops.js:532-533（仅 drawCards）/ src/engine/deck-ops.js:387-444（searchDeck 无锁）/ 探针 P5 |
| 5 | high | impl-vs-text | 08013a | 「你本回合下一次检定 +5 且该检定结束后翻面」被实现为全局 endOfTest 效果 + 全局延迟翻面：任意调查员的检定结束都会消耗掉 +5 并让演武提前翻面（多人局卡牌效果失效） | src/engine/tests.js:1533（expireEffects(state,'endOfTest') 无座位过滤）/ src/engine/tests.js:596-600 / src/engine/eote-investigator-support.js:105-135 / 探针 P8（座位 1 检定后 effects=0、08013a→08013b） |
| 6 | high | impl-vs-text | 08028 | 卡面“改为查找敌人生成”没有替代神话阶段遭遇抽取：打出后仍会照常抽遭遇卡（多抽 1 张）。 | src/cards/entries/08028.js:27-58（无 skip）；src/engine/turn.js:144-146；对照 src/cards/entries/07269.js:4 |
| 7 | high | impl-vs-text | 08053 | 2 充能分支“移动最多 2 次”用固定起始地点的连接枚举：第一次移动后第二次仍出现原地点邻居，且引擎位移不校验相邻 → 可实际移动到与当前位置不相连的地点（非法移动），同时漏掉当前位置的合法连接。 | src/cards/entries/08053.js:47-57; src/engine/movement.js:186-196; src/engine/hidden-rules.js:121-162 |
| 8 | high | impl-vs-text | 08058 | “移动最多 3 次”分支用固定起始地点的连接枚举（第二次起目的地错误），且引擎位移不校验相邻 → 可移动到不相连地点（非法移动）。 | src/cards/entries/08058.js:42-52; src/engine/movement.js:186-196; src/engine/hidden-rules.js:121-162 |
| 9 | high | impl-vs-text | 08059 | 卡片全部效果（升级前 2 张 -1 经验、新购卡 +1 经验）未实现，只写了一个无人读取的 scenarioFlag：实战/战役升级层零效果。 | src/cards/entries/08059.js:8-10,14-26 |
| 10 | high | impl-vs-text | 08062 | 卡面核心“该行动期间每次技能检定可改用 willpower”完全未实现；引擎已实现专用原语 takeBasicActionWithSubstitution（m2-2-08062 implemented），条目仍走 beginImmediateAction → 功能缺失且注释过时。 | src/cards/entries/08062.js:9-10,45; src/engine/api-misc.js:1470-1489 |
| 11 | high | impl-vs-text | 08070 | “Uses (1 charge) + 每轮开始补满”完全未实现：能力是 free、无 cost/exhaust/limit，可无限次代理结算手牌法术能力；费用/充能也未转移到 True Magick 上。 | src/cards/entries/08070.js:8-10,21-54 |
| 12 | high | impl-vs-text | 08074 | 真实打出路径下事件已离开手牌，moveCard from:"hand" 失败 → “附属到道具支援”永不发生，卡牌实际只是花 0 费进弃牌堆；能力2 也随之永不生效。 | src/cards/entries/08074.js:41; src/engine/actions.js:159; src/engine/card-ops.js:196-220; src/engine/actions.js:302-341 |
| 13 | high | impl-vs-text | 08079 | 「该攻击的伤害/恐惧不能分配给盟友支援」整句未实现，主效果（按受到点数抽牌）反而因此变强；prior 账本记 verified。 | src/cards/entries/08079.js:6-7,14-22；src/engine/harm-threat.js assignHarm 无「本次攻击不能分配给盟友」读点 |
| 14 | high | primitive | 08081 | 印刷「非直接伤害必须先分配给有胆有识」未实现：条目缺 flags.composureDamage。 | src/cards/entries/08081.js:17-19 vs src/engine/harm-threat.js:160-165 |
| 15 | high | impl-vs-text | 08083 | 盟友支援目标的「治愈 1 点伤害」不生效（api.healAsset 第二参传了数字而非 spec）。 | src/cards/entries/08083.js:38 vs src/engine/api-misc.js:759-769 |
| 16 | high | impl-vs-text | 08088 | eventPlayed 反应把 uses 永久设为 2 且不限打牌者，等价于事件后永续 2 发弹药（未披露的规则偏差）。 | src/cards/entries/08088.js:22-24 vs src/engine/actions.js:520-523 |
| 17 | high | impl-vs-text | 08091 | 第二子句（符号揭示改为查找并揭示咒印）整条缺失，而引擎专用原语已实现并测试（queue 也标 done）。 | src/cards/entries/08091.js:14-16,25-45 vs src/engine/api-misc.js:1418-1442；tests/eote-player-primitives.test.mjs:197 |
| 18 | high | impl-vs-text | 08102 | 触发条件读了真实 context 不存在的字段（asset.location/asset.traits），真机上永远不触发。 | src/cards/entries/08102.js:14-16 vs src/engine/assets.js:397-401 |
| 19 | high | impl-vs-text | 08105 | criteria 依赖真实引擎从不设置的 state.skillTest.actionKind，导致能力在真机永不出现（整卡失效）。 | src/cards/entries/08105.js:16 vs src/engine/tests.js:166-180,233(combat.js),610(actions.js) |
| 20 | high | impl-vs-text | 08107 | 同 08105：actionKind 判据导致两条能力真机不可用。 | src/cards/entries/08107.js:21,25 vs src/engine/tests.js:166-180 |
| 21 | high | primitive | 08130 | 「如同 1 点伤害被治愈（治愈即弃卡）」未实现：引擎 threatDamageSink 已就绪（entry 应声明 flags.threatDamageSink）却仍用旧近似。 | src/cards/entries/08130.js:13-15,29-31 vs src/engine/harm-threat.js:702-740；tests/eote-player-primitives.test.mjs:85 |
| 22 | high | primitive | 08130 | 替代用的免费 discardSelf 能力无法把威胁区卡移除（ability-exec.js:178-189 无 threat 分支）：卡留在威胁区继续锁行动，同时卡号被塞进弃牌堆。 | src/cards/entries/08130.js:29-31 vs src/engine/ability-exec.js:178-189；real-path probe |
| 23 | high | primitive | 08131 | 「如同 1 点伤害被治愈（治愈即弃卡）」未实现：同 08130，threatDamageSink 已就绪未接线。 | src/cards/entries/08131.js:12-13,26-28 vs src/engine/harm-threat.js:702-740 |
| 24 | high | primitive | 08131 | 免费 discardSelf 无法移除威胁区卡（同 08130）。 | src/cards/entries/08131.js:26-28 vs src/engine/ability-exec.js:178-189 |
| 25 | high | runtime | 08501 | 真实引擎路径下 [skull]/[cultist]/[tablet] 修正均为 0（hook 名应为 resolveChaosToken，不是 chaosTokenValue） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:368-370,411 / content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:349,402 / content/campaigns/edgeOfTheEarth |
| 26 | high | impl-vs-text | 08501 | Part III 缺失 [cultist]/[tablet] 失败后果（洗入忒咳哩-哩/弃牌库顶+抽弱点） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164 |
| 27 | high | impl-vs-text | 08502 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 28 | high | impl-vs-text | 08503 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 29 | high | impl-vs-text | 08503 | 「有遭遇卡牌附属时 +2 隐藏」未实现（声明 locationRule.shroudWhenAttached 无读点） | src/cards/encounter-entries/edgeOfTheEarth/_shared/ice_and_death/08503.js:7-11；读点 src/engine/actions.js:587-588（只支持 locationRule.shroudModifier）；known-deviations p7-shared-08503 |
| 30 | high | impl-vs-text | 08504 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 31 | high | impl-vs-text | 08505 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 32 | high | impl-vs-text | 08506 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 33 | high | runtime | 08506 | 未探索地点入场费在真实引擎路径永远不收取（引擎先 reveal 再调用 locationEntered，且忽略其返回值） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166；src/engine/movement.js:235-249；src/engine/locations.js:251-287；参考 Location/Cards/.../BroadSnowdrifts.hs:16-18 |
| 34 | high | impl-vs-text | 08507 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 35 | high | runtime | 08507 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166；src/engine/movement.js:235-249 |
| 36 | high | impl-vs-text | 08508 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 37 | high | runtime | 08508 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 38 | high | impl-vs-text | 08509 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 39 | high | runtime | 08509 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 40 | high | impl-vs-text | 08510 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 41 | high | runtime | 08510 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 42 | high | impl-vs-text | 08511 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 43 | high | runtime | 08511 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 44 | high | impl-vs-text | 08512 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 45 | high | runtime | 08512 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 46 | high | impl-vs-text | 08513 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 47 | high | runtime | 08513 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 48 | high | impl-vs-text | 08514 | 地点卡印刷「隐藏值 shroud」未进入章节地点数据：LOCATION_TABLE/placeLocation 只带 shelter/clues，card-data.js#location 不复制 shroud；引擎调查难度 = loc.shroud + … 得到 NaN | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:28-61,98-104、content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js:26-52,83-90、content/campaigns/edgeOfThe |
| 49 | high | runtime | 08514 | 入场费同 08506（真实路径不收取） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:128-166 |
| 50 | high | duplication | 08515 | 击败 08515 时强制效果结算两次（章节 behavior.enemyDefeated + 单卡 forced ability） | src/cards/encounter-entries/edgeOfTheEarth/_shared/ice_and_death/08515.js:6-23 与 content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:301-313 同时生效；引擎读点 src/engine/enemies.js:701-708 |
| 51 | high | runtime | 08518 | 议程背面效果在真实引擎路径永不结算（Part1 behavior.agendaReveal 是空函数；resolveAgendaBack 无引擎读点） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:373-380,399；引擎 src/engine/phases.js:268-283；probe：advanceAgenda(doom) 后 0 副作用 |
| 52 | high | runtime | 08519 | 议程背面在真实引擎路径永不结算（同 08518） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:197-203,399；src/engine/phases.js:268-283 |
| 53 | high | runtime | 08520 | 议程 III 背面在真实引擎路径永不结算（同 08518）：本应由它强制结束 Part I 并结算 R1 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:205-218,399；src/engine/phases.js:268-283 |
| 54 | high | runtime | 08521 | 引擎只调用 behavior.actions/performAction（moves.js:222、dispatch.js:633），本章 behavior 导出的是 scenarioActions/performScenarioAction → 真实引擎路径从不提供营地撤退/抽取地点底牌行动 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:397-398 / content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:396-397 / content/campaigns/edgeOfTheEarth/sce |
| 55 | high | runtime | 08521 | 幕 1a 背面在真实引擎路径缺失：behavior 无 actReveal，advanceAct 抛 "场景规则尚未迁移：08521" | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:382-412（无 actReveal）；src/engine/reveal.js:151-176；probe |
| 56 | high | runtime | 08521 | 营地记录键与检查点读取口径不一致：Part1 只写 records.camp（自定义键）与 iceAndDeathPart1CampShelter，检查点读 Camp_* 记录/eoteShelterValue → 检查点庇护值=0、失踪伙伴=9 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:344,353,361；content/campaigns/edgeOfTheEarth/checkpoints.js:197-205；content/campaigns/edgeOfTheEarth/records.js:186-214,258-262； |
| 57 | high | runtime | 08523 | Part II behavior 无 agendaReveal：真实引擎议程推进抛 "密谋规则尚未迁移：08523"（probe 实测），关卡议程流程中断 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:382-405（无 agendaReveal）；src/engine/phases.js:268-283；probe |
| 58 | high | runtime | 08524 | Part II 无 agendaReveal，08524 推进同样抛错（同 08523 根因） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:382-405；src/engine/phases.js:268-283 |
| 59 | high | runtime | 08525 | 议程 VI 背面效果在真实引擎路径永不结算（同 08523 根因） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:132-147,382-405；src/engine/phases.js:268-283 |
| 60 | high | runtime | 08526 | 引擎只调用 behavior.actions/performAction（moves.js:222、dispatch.js:633），本章 behavior 导出的是 scenarioActions/performScenarioAction → 真实引擎路径从不提供营地撤退/抽取地点底牌行动 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:397-398 / content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:396-397 / content/campaigns/edgeOfTheEarth/sce |
| 61 | high | runtime | 08526 | 幕背面推进在真实路径缺失：behavior 无 actReveal，advanceAct 抛 "场景规则尚未迁移：08526"（probe） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:382-405；src/engine/reveal.js:151-176 |
| 62 | high | runtime | 08526 | 地点底下的 9 张卡（8 剧情 + 1 Mia 敌人）在真实路径永不可翻出 → 08527–08534 / 08535–08543 全部不可用；所有未被击败调查员撤退目标也无法达成 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:254-320；probe 合法行动列表 |
| 63 | high | impl-vs-text | 08536 | 「抽取忒咳哩-哩牌库顶最多 2 张」实现成 api.drawCards（抽玩家牌库），抽的是玩家自己的牌库而不是忒咳哩-哩牌库 | src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart2/08536.js:92-102（api.drawCards）；对照 src/engine/scenario-runtime.js:1396 与 eote-tekeli 原语 src/engine/eote-tekeli.js:113-119 |
| 64 | high | runtime | 08544 | agendaWouldAdvance 签名与语义双重错误：引擎传 (state, scenarioRuntime) 并用 true 表示阻止推进；实现按 (state, agenda) 且把 false 当阻止 → Part III 议程永远不推进 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:74-88；src/engine/act-agenda.js:326-329；probe（doom=10 后 agendaIndex 0） |
| 65 | high | runtime | 08544 | 「翻出底牌并生成」只把牌塞进 encounterDiscard，没有任何生成/结算读点执行 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:83-87 |
| 66 | high | runtime | 08544 | 议程背面（加 frost / 洗入 2 张忒咳哩-哩）完全未实现，且推进即抛错 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164；src/engine/phases.js:268-283 |
| 67 | high | runtime | 08545 | 议程背面未实现且推进抛错（同 08544 根因） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164；src/engine/phases.js:268-283 |
| 68 | high | runtime | 08546 | 幕 08546 在真实引擎路径无法推进/结算：behavior 无 checkObjectives 与 actReveal，engine 的通用 objective 读点不认识 {type:"noEidolonEnemies"} | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164；src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3/08546.js:12；src/engine/act-agenda.js:183-190；src/engine/reve |
| 69 | high | runtime | 08546 | 营地撤退行动不可达（hook 名错误）+ Part III 无线索 → 4 线索费用不可支付 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:100-126；content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:39 |
| 70 | high | impl-vs-text | 08546 | 「每个幻灵敌人获得胜利 0」未实现 | src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3/08546.js；参考 Act/Cards/.../UnderAttack.hs:33-36 |
| 71 | high | impl-vs-text | 08547 | 「被击败时移除其底下所有正面朝下卡牌」未实现（Part III behavior 无 enemyDefeated 钩子） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164；参考 Enemy/Cards/.../SeepingNightmare.hs:28-38 |
| 72 | high | impl-vs-text | 08547 | 「幻灵敌人从 SN 地点移动时该地点视为与营地相连」未实现 | src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3/08547.js:12；参考 SeepingNightmare.hs:18-26 |
| 73 | high | impl-vs-text | 08548 | 整张卡的显现效果未实现（treacheryRule.spawnBeneathOrHunterAttack / flags.surgeIfNoSeepingNightmare 均无读点） | src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3/08548.js:8-14；src/engine/treachery-tokens.js:113-123（找不到 encounterResolve 时无效果）；参考 Treachery/Cards/.../Phantasmagoria.hs:19-44 |
| 74 | high | runtime | iceAndDeathPart1 | 行为钩子名不符（scenarioActions/performScenarioAction vs 引擎 actions/performAction）→ 营地撤退不可用，幕目标不可达 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:397-398；src/engine/moves.js:222；src/engine/dispatch.js:633；probe legalActions 无 scenarioAction |
| 75 | high | runtime | iceAndDeathPart1 | agendaReveal 空实现 → 08518/08519/08520 背面全部不结算（probe：advanceAgenda 无敌人/牌库变化） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:399；src/engine/phases.js:268-283 |
| 76 | high | runtime | iceAndDeathPart1 | actReveal 缺失 → advanceAct 抛 "场景规则尚未迁移：08521"（probe） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:382-412；src/engine/reveal.js:151-176 |
| 77 | high | runtime | iceAndDeathPart1 | 13 张地点 shroud 未接线；未探索地点入场费永不收取（reveal 先于 locationEntered，且返回值被忽略） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js:98-104；src/engine/movement.js:235-249；probe（5 线索进入辽阔雪地后仍 5） |
| 78 | high | runtime | iceAndDeathPart1 | 营地记录口径不一致导致检查点庇护值/失踪伙伴错误 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:344,353；content/campaigns/edgeOfTheEarth/checkpoints.js:197-205；probe eoteShelterValue=0 |
| 79 | high | runtime | iceAndDeathPart2 | 无 agendaReveal → advanceAgenda 抛 "密谋规则尚未迁移：08523"（probe） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:382-405；src/engine/phases.js:268-283 |
| 80 | high | runtime | iceAndDeathPart2 | 无 actReveal + actions/performAction 未接线 → advanceAct 抛 "场景规则尚未迁移：08526"，抽底牌/撤退不可用（probe） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:382-405,254-320 |
| 81 | high | runtime | iceAndDeathPart2 | 下游：08527–08543 在真实路径不可达（剧情/被附身队员） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js:254-320 |
| 82 | high | runtime | iceAndDeathPart3 | 议程无法推进：agendaWouldAdvance 语义/签名反了（probe doom=10 后 agendaIndex 仍 0） | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:74-88；src/engine/act-agenda.js:328 |
| 83 | high | runtime | iceAndDeathPart3 | 幕无法推进/结算：无 checkObjectives、无 actReveal、objective {type:noEidolonEnemies} 引擎不识 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:149-164；src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart3/08546.js:12；src/engine/act-agenda.js:183-190 |
| 84 | high | impl-vs-text | iceAndDeathPart3 | 地点无线索且无 shelter：营地撤退费不可支付、[skull]=0、08516 难度 0、庇护值记录 0 | content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js:31-40,81-86；content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js:39,48-60 |
| 85 | high | impl-vs-text | iceAndDeathPart3 | 08544/08545/08546/08547/08548 五张卡的规则大段缺失（见各卡 issues） | 见 cards 08544–08548 |
| 86 | high | impl-vs-text | 08549 | 四个混沌标记的失败追加 rider 未实现（只实现数值）。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08549.js:9-16 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js:6-34 |
| 87 | high | impl-vs-text | 08550 | 正面 [fast] 移去记忆囚笼与背面「其余调查员被击败…」均只声明 agendaRule 数据，无读点/无 agendaReveal。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08550.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 |
| 88 | high | runtime | 08550 | 版本 2/3 的 agendaIndex 越界（agenda 数组只有 1 张），议程不会推进；版本 1 推进时抛 密谋规则尚未迁移：08550（已复现）。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:67-74 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:147 |
| 89 | high | impl-vs-text | 08551 | 正面 [fast] 移去记忆囚笼与背面「其余调查员被击败…」均只声明 agendaRule 数据，无读点/无 agendaReveal。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08551.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 |
| 90 | high | runtime | 08551 | 版本 2/3 的 agendaIndex 越界（agenda 数组只有 1 张），议程不会推进；版本 1 推进时抛 密谋规则尚未迁移：08550（已复现）。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:67-74 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:147 |
| 91 | high | impl-vs-text | 08552 | 正面 [fast] 移去记忆囚笼与背面「其余调查员被击败…」均只声明 agendaRule 数据，无读点/无 agendaReveal。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08552.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 |
| 92 | high | runtime | 08552 | 版本 2/3 的 agendaIndex 越界（agenda 数组只有 1 张），议程不会推进；版本 1 推进时抛 密谋规则尚未迁移：08550（已复现）。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:67-74 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:147 |
| 93 | high | impl-vs-text | 08553 | 幕目标/推进没有任何实现（actRule:{}；无 checkObjectives/actReveal），→R1 结局不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08553.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 / src/engine/reveal.js:151-162 |
| 94 | high | runtime | 08553 | 引擎读 state.agendas/acts 推进；幕只有 1 张且 stage 恒为 1a，版本 2/3 幕面数据未生效。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:71-72 |
| 95 | high | impl-vs-text | 08554 | 幕目标/推进没有任何实现（actRule:{}；无 checkObjectives/actReveal），→R1 结局不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08554.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 / src/engine/reveal.js:151-162 |
| 96 | high | runtime | 08554 | 引擎读 state.agendas/acts 推进；幕只有 1 张且 stage 恒为 1a，版本 2/3 幕面数据未生效。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:71-72 |
| 97 | high | impl-vs-text | 08555 | 幕目标/推进没有任何实现（actRule:{}；无 checkObjectives/actReveal），→R1 结局不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08555.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:302-323 / src/engine/reveal.js:151-162 |
| 98 | high | runtime | 08555 | 引擎读 state.agendas/acts 推进；幕只有 1 张且 stage 恒为 1a，版本 2/3 幕面数据未生效。 | content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:71-72 |
| 99 | high | impl-vs-text | 08556 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 100 | high | primitive | 08556 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556.js:12 |
| 101 | high | primitive | 08556b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 102 | high | impl-vs-text | 08557 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08557.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 103 | high | primitive | 08557 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/failBy1Take1HorrorForPlus1），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08557.js:12 |
| 104 | high | primitive | 08557b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08557b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 105 | high | impl-vs-text | 08558 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08558.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 106 | high | primitive | 08558 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/harderShroudOrExtraAction），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08558.js:12 |
| 107 | high | primitive | 08558b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08558b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 108 | high | impl-vs-text | 08559 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08559.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 109 | high | primitive | 08559 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/millDeckForTekeliliWeaknesses），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08559.js:12 |
| 110 | high | primitive | 08559b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08559b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 111 | high | impl-vs-text | 08560 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08560.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 112 | high | primitive | 08560 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/shroudPlus1AndCannotLeave），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08560.js:12 |
| 113 | high | primitive | 08560b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08560b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 114 | high | impl-vs-text | 08561 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08561.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 115 | high | primitive | 08561 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08561.js:12 |
| 116 | high | primitive | 08561b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08561b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 117 | high | impl-vs-text | 08562 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08562.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |
| 118 | high | primitive | 08562 | 本卡的强制/反应文本只有 flag 声明（mirageId/tier/take1HorrorThenExtraClueOnSuccess），无任何读点。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08562.js:12 |
| 119 | high | primitive | 08562b | storyFlip 的唯一读点 behavior.flipStoryFace 无引擎/内容调用点（仅测试直调），本卡翻面行为在真实游玩不可达。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08562b.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:201-265 / tests/eote-scenario-fatalMirage.test.mjs:128,134 |
| 120 | high | impl-vs-text | 08563 | 幻景关键词（线索翻面/减线索/cleared of mirages）完全缺失；地点线索被置 0，核心循环不可用。 | src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08563.js:12 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js:66-69 / content/campaigns/edgeOfTheEarth/scenarios/fatalMirage |

## 附录 D：逐卡 verdict（403 条）

| code | name | partition | 章节/组 | 账本状态 | 独立 verdict | high | medium | low |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 08001 | 丹妮拉·雷耶丝 | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08002 | 机修工的扳手 | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08003 | 黑帮暴徒 | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08004 | 诺曼·威瑟斯 | eoteInvestigators |  | verified | gap | 2 | 2 | 2 |
| 08005 | 伊波恩之书 | eoteInvestigators |  | verified | gap | 1 | 2 | 1 |
| 08006 | 预示者 | eoteInvestigators |  | verified | gap | 1 | 0 | 1 |
| 08007 | 蒙特雷·杰克 | eoteInvestigators |  | verified | match | 0 | 0 | 1 |
| 08008 | 可靠的长鞭 | eoteInvestigators |  | verified | match | 0 | 1 | 0 |
| 08009 | 被埋葬的秘密 | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08010 | 陈丽丽 | eoteInvestigators |  | verified | approximation | 0 | 3 | 0 |
| 08011a | 演武（心神合一·运功面） | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08011b | 演武（心神合一·破功面） | eoteInvestigators |  | verified | match | 0 | 0 | 2 |
| 08012a | 演武（凝神静气·运功面） | eoteInvestigators |  | verified | match | 0 | 0 | 1 |
| 08012b | 演武（凝神静气·破功面） | eoteInvestigators |  | verified | match | 0 | 0 | 1 |
| 08013a | 演武（扭转乾坤·运功面） | eoteInvestigators |  | verified | approximation | 1 | 0 | 0 |
| 08013b | 演武（扭转乾坤·破功面） | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08014a | 演武（稳如泰山·运功面） | eoteInvestigators |  | verified | approximation | 0 | 2 | 1 |
| 08014b | 演武（稳如泰山·破功面） | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08015 | 命运重担 | eoteInvestigators |  | verified | match | 0 | 0 | 1 |
| 08016 | 鲍勃·詹金斯 | eoteInvestigators |  | verified | approximation | 0 | 2 | 1 |
| 08017 | 精明的交易 | eoteInvestigators |  | verified | approximation | 0 | 1 | 1 |
| 08018 | 贪婪 | eoteInvestigators |  | verified | match | 0 | 0 | 0 |
| 08019 | 全副武装 | eotePlayer |  | verified | match | 0 | 0 | 2 |
| 08020 | 正面迎击 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08021 | “到我身后！” | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08022 | 成群结队 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08023 | 扫堂腿 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08024 | 防御姿态 | eotePlayer |  | verified | approximation | 0 | 1 | 2 |
| 08025 | 蝴蝶对剑 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08026 | 闪躲 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08027 | 战斗训练 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08028 | 追猎行动 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08029 | 提尔斯哈之牙 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08030 | 蝴蝶对剑 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08031 | 强制学习 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08032 | 耶利米·科尔比 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08033 | 通路档案 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08034 | 繁星密语 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08035 | 登山靴 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08036 | 加入马队 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08037 | 地区勘测 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08038 | 医学教科书 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08039 | 发掘古物 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08040 | 科学理论 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08041 | 通路档案 | eotePlayer |  | verified | approximation | 0 | 2 | 1 |
| 08042 | 通路档案 | eotePlayer |  | verified | approximation | 0 | 2 | 1 |
| 08043 | 通路档案 | eotePlayer |  | verified | approximation | 0 | 2 | 1 |
| 08044 | 通路档案 | eotePlayer |  | verified | approximation | 0 | 2 | 1 |
| 08045 | 亵渎预言 | eotePlayer |  | verified | approximation | 0 | 0 | 1 |
| 08046 | 地下支持 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08047 | 提前侦察 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08048 | 21点 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08049 | 反间谍活动 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08050 | 欺骗制度 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08051 | 不当交易 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08052 | 行业专家 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08053 | 红色闹钟 | eotePlayer |  | verified | gap | 1 | 0 | 0 |
| 08054 | 金钱万能 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08055 | 黑市 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08056 | 刚毅果敢 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08057 | 黑色扇子 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08058 | 红色闹钟 | eotePlayer |  | verified | gap | 1 | 0 | 0 |
| 08059 | 掉进兔子洞 | eotePlayer |  | verified | gap | 1 | 0 | 0 |
| 08060 | 咏春棍 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08061 | 冥想放空 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08062 | 闭环 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08063 | 力量之风 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08064 | 先见 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08065 | 密教理论 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08066 | 平行命运 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08067 | 天文地图集 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08068 | 治愈真言 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08069 | 情绪稳定 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08070 | 真法魔典 | eotePlayer |  | verified | gap | 1 | 0 | 0 |
| 08071 | 补给匮乏 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08072 | 沙夫纳的目录 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08073 | 绷带 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08074 | 应急装备 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08075 | 厄运手镯 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08076 | 阅后即焚 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08077 | 人多力量大 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08078 | 无畏精神 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08079 | 血债血偿 | eotePlayer |  | verified | gap | 1 | 1 | 1 |
| 08080 | 灭火器 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08081 | 有胆有识 | eotePlayer |  | verified | gap | 1 | 0 | 1 |
| 08082 | 抵挡 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08083 | 医学生 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08084 | 追踪 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08085 | 追踪 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08086 | 迈克尔·利 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08087 | 狙击 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08088 | 老旧的霰弹枪 | eotePlayer |  | verified | gap | 1 | 0 | 0 |
| 08089 | 快拔枪套 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08090 | 克图格亚的烙印 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08091 | 恩科西·马巴蒂 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08092 | 克图格亚的烙印 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08093 | 巨石锤 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08094 | 长柄大锤 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08095 | 防护服 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08096 | 长柄大锤 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08097 | 袖珍望远镜 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08098 | 远古海图 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08099 | 吉恩·波尔格 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08100 | 远古海图 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08101 | 占卜 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08102 | 保护魂灵 | eotePlayer |  | verified | gap | 1 | 0 | 1 |
| 08103 | 占卜 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08104 | 威廉·韦伯教授 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08105 | 破冰锥 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08106 | 威廉·韦伯教授 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08107 | 破冰锥 | eotePlayer |  | verified | gap | 1 | 1 | 0 |
| 08108 | 虚影易位 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08109 | 身形虚化 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08110 | 虚影易位 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08111 | 身形虚化 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08112 | "再来一张！" | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08113 | 大肆借贷 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08114 | 珍贵记忆 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08115 | 珍贵记忆 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08116 | 护身法宝 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08117 | 尘世宁静 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08118 | 附魔弓 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08119 | 尘世宁静 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08120 | 先知先觉 | eotePlayer |  | verified | approximation | 0 | 2 | 0 |
| 08121 | 一探究竟 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08122 | 好勇斗狠 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08123 | 技艺精湛 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08124 | 古物藏家 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08125 | 危险处境 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08126 | 厚重皮衣 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08127 | 雪橇犬 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08128 | 驯兽之杖 | eotePlayer |  | verified | match | 0 | 0 | 1 |
| 08129 | 请求支援 | eotePlayer |  | verified | match | 0 | 0 | 0 |
| 08130 | 臂伤 | eotePlayer |  | verified | gap | 2 | 2 | 0 |
| 08131 | 腿伤 | eotePlayer |  | verified | gap | 2 | 0 | 0 |
| 08132 | 惊慌 | eotePlayer |  | verified | approximation | 0 | 1 | 1 |
| 08133 | 麻木 | eotePlayer |  | verified | approximation | 0 | 1 | 0 |
| 08501 | 亡命冰原 | eoteCampaign | shared:_shared | verified | gap | 2 | 2 | 0 |
| 08502 | 坠机点 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08503 | 冰冻海岸 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08504 | 危险道路 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 0 |
| 08505 | 不稳定冰盖 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08506 | 辽阔雪地 | eoteCampaign | shared:_shared | verified | gap | 2 | 1 | 0 |
| 08507 | 冰封荒原 | eoteCampaign | shared:_shared | verified | gap | 2 | 1 | 0 |
| 08508 | 岩石峭壁 | eoteCampaign | shared:_shared | verified | gap | 2 | 1 | 0 |
| 08509 | 雪冢 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08510 | 破冰船登陆点 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08511 | 严寒洞穴 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08512 | 屏障营地 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08513 | 莱克营地遗址 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08514 | 水晶洞穴 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 0 |
| 08515 | 疾行谬物 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08516 | 无限恐惧症 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08517 | 零能见度 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08518 | 冷遇 | eoteCampaign | iceAndDeathPart1 | verified | gap | 1 | 1 | 0 |
| 08519 | 深入白雪 | eoteCampaign | iceAndDeathPart1 | verified | gap | 1 | 0 | 1 |
| 08520 | 没时间了 | eoteCampaign | iceAndDeathPart1 | verified | gap | 1 | 1 | 0 |
| 08521 | 寻找扎营点 | eoteCampaign | iceAndDeathPart1 | verified | gap | 3 | 0 | 0 |
| 08522 | 星之恐怖 | eoteCampaign | iceAndDeathPart1 | verified | gap | 0 | 1 | 1 |
| 08523 | 狂风呼啸 | eoteCampaign | iceAndDeathPart2 | verified | gap | 1 | 1 | 0 |
| 08524 | 寒冷夜晚 | eoteCampaign | iceAndDeathPart2 | verified | gap | 1 | 1 | 0 |
| 08525 | 疯狂与死亡 | eoteCampaign | iceAndDeathPart2 | verified | gap | 1 | 1 | 0 |
| 08526 | 失踪队员 | eoteCampaign | iceAndDeathPart2 | verified | gap | 3 | 0 | 0 |
| 08527 | 死路 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08528 | 冰上裂缝 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08529 | 忧心弃物 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08530 | 消失的足迹 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08531 | 被剖开的探险家 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08532 | 深层邪恶 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 1 |
| 08533 | 血腥证据 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 0 |
| 08534 | 心中的疯狂 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 1 | 1 |
| 08535 | 威廉·戴尔教授 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 4 | 0 |
| 08536 | 丹佛斯 | eoteCampaign | iceAndDeathPart2 | verified | gap | 1 | 3 | 0 |
| 08537 | 伊里亚·阿什瓦克 | eoteCampaign | iceAndDeathPart2 | verified | match | 0 | 3 | 0 |
| 08538 | 玛拉·辛哈医生 | eoteCampaign | iceAndDeathPart2 | verified | match | 0 | 3 | 0 |
| 08539 | 艾弗里·克莱普尔 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 4 | 0 |
| 08540 | 詹姆斯·“曲奇”·弗雷德里克斯 | eoteCampaign | iceAndDeathPart2 | verified | match | 0 | 3 | 0 |
| 08541 | 艾米·肯斯勒博士 | eoteCampaign | iceAndDeathPart2 | verified | match | 0 | 3 | 0 |
| 08542 | 罗尔德·埃尔斯沃思 | eoteCampaign | iceAndDeathPart2 | verified | approximation | 0 | 4 | 0 |
| 08543 | 高田弘子 | eoteCampaign | iceAndDeathPart2 | verified | match | 0 | 3 | 0 |
| 08544 | 邪灵现身 | eoteCampaign | iceAndDeathPart3 | simplified | gap | 3 | 1 | 0 |
| 08545 | 冰雪深处 | eoteCampaign | iceAndDeathPart3 | verified | gap | 1 | 1 | 0 |
| 08546 | 陷入围攻！ | eoteCampaign | iceAndDeathPart3 | simplified | gap | 3 | 1 | 0 |
| 08547 | 渗出梦魇 | eoteCampaign | iceAndDeathPart3 | verified | gap | 2 | 1 | 0 |
| 08548 | 千变幻景 | eoteCampaign | iceAndDeathPart3 | verified | gap | 1 | 0 | 0 |
| 08549 | 致命幻景 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08550 | 虚灵纠缠(版本一) | eoteCampaign | fatalMirage | verified | gap | 2 | 1 | 0 |
| 08551 | 虚灵纠缠(版本二) | eoteCampaign | fatalMirage | verified | gap | 2 | 1 | 0 |
| 08552 | 虚灵纠缠(版本三) | eoteCampaign | fatalMirage | verified | gap | 2 | 1 | 0 |
| 08553 | 旧事阴影(版本一) | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08554 | 旧事阴影(版本二) | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08555 | 旧事阴影(版本三) | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08556 | 记忆囚笼 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08556b | 记忆囚笼 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08557 | 大本营 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08557b | 大本营 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08558 | 菲奥多西亚号甲板 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08558b | 菲奥多西亚号甲板 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08559 | 大学礼堂 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08559b | 大学礼堂 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08560 | 树篱迷宫 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08560b | 树篱迷宫 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08561 | 荒废车站 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08561b | 荒废车站 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08562 | 沿海水域 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08562b | 沿海水域 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08563 | 古老者厅室 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08563b | 古老者厅室 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08564 | 河景剧院 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08564b | 河景剧院 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08565 | 耸立岩石 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08565b | 耸立岩石 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08566 | 飞机场 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08566b | 飞机场 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08567 | 阿拉斯加荒野 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08567b | 阿拉斯加荒野 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08568 | 凌乱宿舍 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08568b | 凌乱宿舍 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08569 | 戴尔的教室 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08569b | 戴尔的教室 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08570 | 医务室 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08570b | 医务室 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08571 | 肯斯勒博士的办公室 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08571b | 肯斯勒博士的办公室 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08572 | 摩艾石像 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08572b | 摩艾石像 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08573 | 奥斯曼前线 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08573b | 奥斯曼前线 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08574 | 黑色岩石 | eoteCampaign | fatalMirage | verified | gap | 2 | 0 | 0 |
| 08574b | 黑色岩石 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08575 | 狩猎失败之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08575b | 狩猎失败之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08576 | 去世病人之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08576b | 去世病人之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08577 | 失踪父亲之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08577b | 失踪父亲之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08578 | 饱经战乱的国家之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08578b | 饱经战乱的国家之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08579 | 悔恨航程之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08579b | 悔恨航程之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08580 | 无法述说的恶魔之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08580b | 无法述说的恶魔之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08581 | 可怕发现之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08581b | 可怕发现之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08582 | 翻译异星文字之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08582b | 翻译异星文字之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08583 | 单恋之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08583b | 单恋之记忆 | eoteCampaign | fatalMirage | verified | gap | 1 | 1 | 0 |
| 08584 | 恐怖阴影 | eoteCampaign | fatalMirage | verified | gap | 1 | 0 | 1 |
| 08585 | 易散之雾 | eoteCampaign | fatalMirage | verified | gap | 1 | 0 | 0 |
| 08586 | 回首往事 | eoteCampaign | fatalMirage | verified | gap | 1 | 0 | 0 |
| 08587 | 威廉·戴尔教授 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08588 | 丹佛斯 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08589 | 伊里亚·阿什瓦克 | eoteCampaign | fatalMirage | simplified | approximation | 1 | 1 | 0 |
| 08590 | 玛拉·辛哈医生 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08591 | 艾弗里·克莱普尔 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08592 | 詹姆斯·“曲奇”·弗雷德里克斯 | eoteCampaign | fatalMirage | simplified | approximation | 1 | 1 | 0 |
| 08593 | 艾米·肯斯勒博士 | eoteCampaign | fatalMirage | simplified | approximation | 1 | 1 | 0 |
| 08594 | 罗尔德·埃尔斯沃思 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08595 | 高田弘子 | eoteCampaign | fatalMirage | simplified | gap | 2 | 0 | 0 |
| 08596 | 失落之峰 | eoteCampaign | toTheForbiddenPeaks | no-behavior | match | 0 | 0 | 0 |
| 08597 | 失落山峰 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08598 | 恐怖降临 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 1 | 0 |
| 08599 | 登上高峰 | eoteCampaign | toTheForbiddenPeaks | verified | approximation | 0 | 1 | 0 |
| 08600 | 深厚积雪 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08601 | 白色断崖 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08602 | 陡峭斜坡 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08603 | 狭窄山脊 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08604 | 岩架 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08605 | 白雪复盖的峭壁 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08606 | 迎风通路 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 1 | 0 |
| 08607 | 山顶 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 1 |
| 08608 | 星之恐怖 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 1 | 0 |
| 08609 | 拘束型古老者 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 2 | 0 | 0 |
| 08610 | 降雪 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08611 | 雪崩 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08612 | 悬于边缘 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08613 | 低温症 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 1 | 0 |
| 08614 | 绿皂石 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08615 | 木制雪撬 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08616 | 炸药 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08617 | 瘴气水晶 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08618 | 矿物标本 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08619 | 小型收音机 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08620 | 备用零件 | eoteCampaign | toTheForbiddenPeaks | verified | gap | 1 | 0 | 0 |
| 08621 | 古老者之城 | eoteCampaign | cityOfTheElderThings | no-behavior | match | 0 | 0 | 0 |
| 08622 | 恐惧潜伏 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 1 | 0 |
| 08623 | 自下而来的毁灭 | eoteCampaign | cityOfTheElderThings | verified | gap | 2 | 1 | 0 |
| 08624 | 错综复杂之城(版本一) | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08625 | 错综复杂之城(版本二) | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08626 | 错综复杂之城(版本三) | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08627 | 追寻未知(版本一) | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08628 | 追寻未知(版本二) | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08629 | 追寻未知(版本三) | eoteCampaign | cityOfTheElderThings | verified | gap | 2 | 0 | 0 |
| 08630 | 隐秘隧道 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 1 | 0 |
| 08631 | 古代天文馆 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08632 | 石桥 | eoteCampaign | cityOfTheElderThings | verified | approximation | 0 | 1 | 0 |
| 08633 | 圆柱塔 | eoteCampaign | cityOfTheElderThings | verified | approximation | 0 | 1 | 0 |
| 08634 | 迷宫房间 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08635 | 地图资料室 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08636 | 无顶堡垒 | eoteCampaign | cityOfTheElderThings | verified | approximation | 0 | 1 | 0 |
| 08637 | 破败街道 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 1 | 0 |
| 08638 | 巨大尖顶 | eoteCampaign | cityOfTheElderThings | verified | approximation | 0 | 0 | 1 |
| 08639 | 埋没通路 | eoteCampaign | cityOfTheElderThings | verified | approximation | 0 | 0 | 1 |
| 08640 | 古老者之庙 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 1 | 0 |
| 08641 | 星之恐怖 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08642 | 和蔼的古老者 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08643 | 复苏的古老者 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 0 | 0 |
| 08644 | 真相开端 | eoteCampaign | cityOfTheElderThings | verified | gap | 1 | 1 | 0 |
| 08645 | 崩塌废墟 | eoteCampaign | cityOfTheElderThings | verified | gap | 2 | 0 | 0 |
| 08646 | 冻伤 | eoteCampaign | cityOfTheElderThings | verified | gap | 2 | 0 | 0 |
| 08647 | 附身 | eoteCampaign | cityOfTheElderThings | verified | gap | 2 | 0 | 0 |
| 08648 | 疯狂之心 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08649 | 伊夸之门 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08650 | 地热口 | eoteCampaign | shared:_shared | verified | match | 0 | 1 | 0 |
| 08651 | 被遗忘的神庙 | eoteCampaign | shared:_shared | verified | approximation | 0 | 2 | 0 |
| 08652 | 寇斯图书馆 | eoteCampaign | shared:_shared | verified | approximation | 0 | 2 | 0 |
| 08653 | 原生质池 | eoteCampaign | shared:_shared | verified | match | 0 | 1 | 0 |
| 08654 | 无光之海大厅 | eoteCampaign | shared:_shared | verified | match | 0 | 1 | 1 |
| 08655 | 水下扩张区 | eoteCampaign | shared:_shared | verified | match | 0 | 1 | 1 |
| 08656 | 拱形走廊 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08657 | 原始恐怖 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08658 | 地球根源 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08659 | 跳动的心脏 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 0 | 0 |
| 08660 | 瘴气的召唤 | eoteCampaign | theHeartOfMadnessPart1 | verified | gap | 1 | 0 | 1 |
| 08661 | 疯狂的召唤 | eoteCampaign | theHeartOfMadnessPart1 | verified | approximation | 0 | 1 | 0 |
| 08662 | 蛰伏 | eoteCampaign | theHeartOfMadnessPart1 | verified | gap | 1 | 0 | 0 |
| 08663 | 巨大封印 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 0 | 0 |
| 08664 | 冰川岩洞 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 2 | 0 |
| 08665 | 雕画密室 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 2 | 0 |
| 08666 | 地城祭坛 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 2 | 0 |
| 08667 | 脓水隧道 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 2 | 0 |
| 08668 | 灰岩洞穴 | eoteCampaign | theHeartOfMadnessPart1 | verified | match | 0 | 2 | 0 |
| 08669 | 原生质团 | eoteCampaign | theHeartOfMadnessPart1 | verified | gap | 1 | 1 | 0 |
| 08670 | 静电释放 | eoteCampaign | theHeartOfMadnessPart1 | verified | gap | 2 | 0 | 0 |
| 08671 | 封印减弱 | eoteCampaign | theHeartOfMadnessPart2 | verified | approximation | 0 | 1 | 0 |
| 08672 | 无名存在 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 3 | 0 | 0 |
| 08673 | 摧毁高塔 | eoteCampaign | theHeartOfMadnessPart2 | simplified | gap | 2 | 1 | 0 |
| 08674 | 迷雾高塔 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 2 | 1 | 0 |
| 08675 | 迷雾高塔 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 3 | 1 | 0 |
| 08676 | 迷雾高塔 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 3 | 1 | 0 |
| 08677 | 迷雾高塔 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 3 | 1 | 0 |
| 08678 | 迷雾高塔 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 3 | 1 | 0 |
| 08679 | 无名疯狂 | eoteCampaign | theHeartOfMadnessPart2 | simplified | gap | 3 | 0 | 0 |
| 08680 | 解开封印的幻影 | eoteCampaign | theHeartOfMadnessPart2 | verified | gap | 2 | 1 | 0 |
| 08681 | 最终幻景 | eoteCampaign | theHeartOfMadnessPart2 | simplified | gap | 3 | 0 | 0 |
| 08682 | 巨大坡道 | eoteCampaign | theHeartOfMadnessPart2 | simplified | approximation | 0 | 1 | 0 |
| 08683 | 巨大坡道 | eoteCampaign | theHeartOfMadnessPart2 | simplified | approximation | 0 | 1 | 0 |
| 08684 | 巨大坡道 | eoteCampaign | theHeartOfMadnessPart2 | simplified | approximation | 0 | 1 | 0 |
| 08685 | 巨大坡道 | eoteCampaign | theHeartOfMadnessPart2 | simplified | approximation | 0 | 1 | 0 |
| 08686 | 隐秘隧道 | eoteCampaign | theHeartOfMadnessPart2 | verified | match | 0 | 0 | 1 |
| 08687 | 原初恶魔 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 0 |
| 08688 | 潜藏的疯狂 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08689 | 实体疯狂 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08690 | 冰川幻影 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08691 | 同源迷雾 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08692 | 南极寒风 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08693 | 雪盲危机 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08694 | 极地旋涡 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08695 | 古老者清道夫 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 0 |
| 08696 | 古老者守卫 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 0 |
| 08697 | 古老者崛起 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 0 |
| 08698 | 冰缝 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08699 | 穿越冰雪 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08700 | 迷失的研究员 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08701 | 狂乱的探险家 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08702 | 身陷疯狂 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08703 | 渎神幻象 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08704 | 窥看不可说之事 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08705 | 噩梦烟气 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08706 | 瘴气折磨 | eoteCampaign | shared:_shared | verified | approximation | 0 | 2 | 0 |
| 08707 | 朦胧瘴气 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08708 | 巨型白化企鹅 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08709 | 呜啊！呜啊！呜啊！ | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08710 | 失落的修格斯 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08711 | 狂暴的修格斯 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08712 | 极地幻景 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 0 |
| 08713 | 黑暗极光 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 0 |
| 08714 | 威廉·戴尔教授 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08715 | 丹佛斯 | eoteCampaign | shared:_shared | verified | gap | 2 | 1 | 0 |
| 08716 | 伊里亚·阿什瓦克 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 1 |
| 08717 | 玛拉·辛哈医生 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08718 | 艾弗里·克莱普尔 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08719 | 詹姆斯·“曲奇”·弗雷德里克斯 | eoteCampaign | shared:_shared | verified | gap | 1 | 1 | 1 |
| 08720 | 艾米·肯斯勒博士 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08721 | 罗尔德·埃尔斯沃思 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 1 |
| 08722 | 高田弘子 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08723 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08724 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08725 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08726 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08727 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | approximation | 0 | 1 | 1 |
| 08728 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08729 | 忒咳哩-哩 | eoteCampaign | shared:_shared | verified | match | 0 | 0 | 1 |
| 08730 | 克莱普尔的皮草 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08731 | 爱伦·坡作品集 | eoteCampaign | shared:_shared | verified | gap | 2 | 0 | 1 |
| 08732 | 曲奇的特制.32手枪 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08733 | 戴尔的素描 | eoteCampaign | shared:_shared | verified | gap | 3 | 0 | 1 |
| 08734 | 埃尔斯沃思的靴子 | eoteCampaign | shared:_shared | verified | gap | 1 | 1 | 1 |
| 08735 | 肯斯勒的日志 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08736 | 辛哈的医药箱 | eoteCampaign | shared:_shared | verified | gap | 1 | 0 | 1 |
| 08737 | 高田的物品 | eoteCampaign | shared:_shared | verified | gap | 3 | 0 | 1 |
| 08738 | 安雨 | eoteCampaign | shared:_shared | verified | gap | 1 | 1 | 1 |