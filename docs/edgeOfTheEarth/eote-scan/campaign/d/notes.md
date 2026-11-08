# 战役卡审计 D · 疯狂之心 I–II + 心之共享组 + 其他共享组/远征队/Tekeli-li/纪念碑

- 审计员：campaign-auditor-d（task-7）
- 范围：eoteCampaign `08648–08738` 共 **91 条**（疯狂之心共享组 08648–08658、Part1 08659–08670、Part2 08671–08686、其他共享遭遇组 08687–08713、远征队 08714–08722、Tekeli-li 08723–08729、纪念碑 08730–08738）
- 只读审计：未修改 mod 内任何文件；证据均为 `相对 mod 根路径:行号`。工作底稿与探针在 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/`。
- 机械线索：`screen/flags-readpoints.json`（本分片 91 条 unread）、`integrity`、`keyword-coverage`、`tests-coverage`、`known-deviations`、`primitive-compliance`、`duplication`。

## 一、结论摘要

| 指标 | 数量 |
| --- | --- |
| 卡片总数 | 91 |
| verdict=match（accepted） | 31 |
| verdict=approximation | 24 |
| verdict=gap | 36 |
| verdict=blocked | 0 |
| high issues | 62 |
| medium issues | 53 |
| low issues | 37 |
| unread 声明逐条判定 | 91 条 = 真未接线 30 + 部分接线 7 + 死声明/元数据 54 |

> 说明：91 条卡片账本为 84 verified + 7 simplified；独立复核后 **36 张判 gap、24 张 approximation**，其中 18 条既有 verified 记录与 high 问题并存（见 §八）。

## 二、Top 高优先问题（file:line）

- **P0** 疯狂之心 II 议程 08672 无印刷毁灭值 → doomThreshold=0，引擎 `checkAgenda` 在下一神话阶段立即推进并触发坡道清场；幕 3 目标随即失去全部高塔地点，场景流程被提前打乱/卡死（探针：agendaIndex 1→2 且 locations 变为 gate+坡道+隧道） — `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:53 / src/engine/act-agenda.js:435 / content/.../theHeartOfMadnessPart2/behavior.js:132`
- **P0** 疯狂之心 II R1/R2 结局永远不可达：`drKenslerHasAPlan` / `theTruthOfTheMirageEludesYou` 全仓只有读取与 schema 声明，没有任何写入点 — `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:275-276 / content/campaigns/edgeOfTheEarth/records.js:227,239`
- **P0** 08716 伊里亚·阿什瓦克成功躲避后引用未定义变量 `here` → ReferenceError（引擎探针复现），能力每次成功都崩溃 — `src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js:35`
- **P0** Tekeli-li 牌库在疯狂之心 I/II 从未初始化（只有 Ice and Death I/II 初始化，且存于单关 scenarioFlags）；Part1 [tablet] 抽牌恒为空，Part2 只写日志 —— 两章的石板标记/弱点机制整体空转 — `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:229-243 / scenarios/theHeartOfMadnessPart2/behavior.js:319 / src/engine/mechanic-state.js:3-6`
- **P1** 08670 静电释放揭示效果在引擎路径上不可达：definition 只给 entryRevelation/surge（无 effect:"campaignRule"），条目无 encounterResolve/treacheryRule.test，behavior.resolveEncounter 只在 `t.effect.kind==="campaignRule"` 时被调用 — `src/cards/encounter-entries/.../theHeartOfMadnessPart1/08670.js:8-13 / content/.../Part1/definition.js:151 / src/engine/treachery-tokens.js:119,124`
- **P1** 08679 无名的疯狂两处规则错误：①「不能受到伤害」未实现；② 强制横置方向写反（卡面要求把最近的**已重整**副本横置，behavior 把**已横置**副本改回重整，探针确认） — `src/cards/encounter-entries/.../theHeartOfMadnessPart2/08679.js:10 / content/.../Part2/behavior.js:323-327`
- **P1** 08673 攻击迷雾高塔时检定难度用了「高塔生命（线索值）」而非战斗值（帷幕）；探针：08677 帷幕 3 → 实际难度 4。另 [reaction]「发现线索换伤害」完全未实现 — `content/.../Part2/behavior.js:235 / src/cards/encounter-entries/.../08673.js:13`
- **P1** 08674–08678 五张迷雾高塔：背面进入附加费（团队 1×人数线索）未接线；[fast] 前置「控制已激活封印」未检查（无条件提供、无效点击被吞）；B/C/D/E 四枚封印的持续力量只记 `flags.pylonPowers` 而全仓无读点（仅 A 的 +1 伤害生效） — `src/cards/encounter-entries/.../08674.js:11-18 / content/.../Part2/behavior.js:238-242`
- **P1** 08660 瘴气召唤背面 D/E 效果与卡面不符：卡面 D 失去 1 行动（激活 2）、E 失去 3 资源（激活 6）；条目写成 D 得 1 线索、E 得 2 资源 — `src/cards/encounter-entries/.../theHeartOfMadnessPart1/08660.js:21-24`
- **P1** 08662 休眠背面「按刚放上门的封印种类」的治疗/抽牌/额外行动/资源完全未实现（onLeave 只打日志） — `src/cards/encounter-entries/.../08662.js:10-12`
- **P1** 伙伴支援（08714–08722）整场战役没有入场路径：官方规则每章开局选派并置入战场；`interaction.partners.setup` 无调用方、任何章节 storyAssets/牌组都不含这 9 张，`PARTNER_ASSET_RULES/partnerRosterSpec` 无读点 → 9 张卡不可用（08715/08721 能力整条缺失） — `src/engine/eote-interactions.js:109-130 / content/campaigns/edgeOfTheEarth/shared-encounters.js:183-226`
- **P1** 纪念逝者（08730–08738）领取流程未接线：`initializeMemorials/memorialsSpec` 无调用方，幕间不给遗物 → 9 张卡在正式战役不可获得；其中 08731 整条 action 未实现、08733/08737 事件卡无 played 实现（引用的 `src/cards/entries/08733.js`、`08737.js` 不存在） — `content/campaigns/edgeOfTheEarth/shared-encounters.js:227 / src/engine/api-mechanics.js:249 / src/cards/encounter-entries/.../08731.js:8-10,08733.js:7-8`
- **P1** 共享敌人印刷关键词在合并表丢失：08687 Hunter/Retaliate 为 `{}`（Part2 定义不按卡文派生关键词且注册在最后覆盖）、08679 Alert/Massive/Retaliate 为 `{}`；elder_things 的 08695/08696 根本不在 ALL_ENEMIES，且 peaks/city 遭遇牌库实际不含共享卡（deck 14/20，共享 0 张）→ 被抽到时 `未知遭遇卡` 抛错 — `content/.../Part2/definition.js:105-118 / src/engine/card-lookup.js:26 / src/engine/encounter.js:198,274`
- **P1** 08649 伊夸之门背面「调查员与敌人不能进入、不能拥有附属」未实现（Part2 中门以未揭示面进场却可直接进入翻面），披露请求 p7-08649 仍 pending — `src/cards/encounter-entries/.../08649.js:31 / artifacts/migration/eote/primitive-requests/p7-08649.json`

## 三、D3 关卡可跑通结论

### theHeartOfMadnessPart1
- setup：runnable — tests/eote-scenario-theHeartOfMadnessPart1.test.mjs:122-148（16 地点/随机槽位/5 封印休眠）；探针确认 setup 后无 Tekeli-li 牌库
- 规则：partial — content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js:70-282
- 流程：runnable-with-gaps — 幕 08662→08663 由 behavior.checkObjectives 推进；议程 5/6/6 毁灭阈值正常；结局 R1/R2/R3 与记录经 resolution 落账
- 推进/死锁：deadlock-risk-low — 封印取回→激活→放门链路可跑（含测试）；但 Tekeli-li 牌库从未初始化，石板标记恒无效果（behavior.afterTest:229-243）；R3 爆炸检测由 behavior.checkDetonation:70-82 覆盖
- 指南：present — story-text key theHeartOfMadnessPart1；章节测试断言 sectionCount=79
- 问题：· 未初始化 Tekeli-li 牌库 → 08648 [tablet] 抽牌恒为空 · 08670 抽到无效果 · 08662/08660 背面结算缺失/错值 · 08651/08652 查看未揭示地点仅日志

### theHeartOfMadnessPart2
- setup：runnable — tests/eote-scenario-theHeartOfMadnessPart2.test.mjs:101-113（10 设施+5 高塔随机、门翻面、内环约束）
- 规则：broken — content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js:221-256,287-313
- 流程：broken — 探针：agendaIndex 1（08672 doomThreshold=0）→ checkAgenda 立即推进到 2 并触发坡道清场；幕 3 目标失去全部高塔地点（content/.../definition.js:53 + src/engine/act-agenda.js:435）
- 推进/死锁：deadlock-risk-high — R1/R2 记录 drKenslerHasAPlan / theTruthOfTheMirageEludesYou 无写入点（records.js:227,239）；仅 R3 可达；Tekeli-li 牌库未初始化
- 指南：present — story-text theHeartOfMadnessPart2；测试断言 sectionCount=53
- 问题：· 议程 08672 无毁灭阈值 → 下一神话阶段自动推进并提前进入坡道场景，幕 3 无法完成（流程损坏） · R1/R2 分支永久不可达 · Tekeli-li 牌库未初始化，[tablet] 仅写日志（behavior.js:319） · 高塔攻击难度错误 + 封印力量未接线

推进链路复核细节：
- Part1：`08649` 放封印动作 → `behavior.performAction` 团队线索取回 → `campaign/eote-seals.js` 激活 → 放门 → `behavior.checkObjectives` 幕 1/2 推进；结局 R1/R2/R3 与记录在 `behavior.resolution` 落账（测试覆盖）。未发现硬死锁，但石板标记无效果、08662/08660 背面缺/错。
- Part2：正常路径本应是「塌 5 塔 → 幕 4 逃到隐藏隧道 → 按记录 R1/R2/R3」，实际因 08672 提前推进会在幕 3 阶段移除全部高塔地点，幕 3 目标再也无法完成；且 R1/R2 记录无写入点，只剩 R3。结论：**当前 Part2 流程不可完整跑通**。

## 四、D4 声明即接线：本分片 91 条 unread 逐条判定

判定口径：全仓（src+content+web+tests）grep 无该 token 字面读点、且不存在按值通用分派 → 判真未接线；若行为已由其它路径承接 → 死声明/部分接线。完整结构化结果见 `findings.json#unreadTriage`。

| # | 卡号 | 卡片 | 声明 | kind | 判定 | 严重度 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 08664 | 冰川岩洞 | `flags.sealRecover` | key | dead-declaration | medium | 08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点 |
| 2 | 08665 | 雕画密室 | `flags.sealRecover` | key | dead-declaration | medium | 08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点 |
| 3 | 08666 | 地城祭坛 | `flags.sealRecover` | key | dead-declaration | medium | 08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点 |
| 4 | 08667 | 脓水隧道 | `flags.sealRecover` | key | dead-declaration | medium | 08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点 |
| 5 | 08668 | 灰岩洞穴 | `flags.sealRecover` | key | dead-declaration | medium | 08664–08668 死声明；封印种类硬编码在 move.rule 字符串，recoverSkill/Difficulty 才是真读点 |
| 6 | 08669 | 原生质团 | `flags.spawnFarthestOuterRing` | key | unwired | high | 生成规则整条缺失，无读点 |
| 7 | 08669 | 原生质团 | `flags.enemyPhaseEndReadyIfActivatedSeal` | key | partial | medium | behavior.enemyPhaseEnd 只实现重整（近似已披露），字段未读 |
| 8 | 08669 | 原生质团 | `flags.nearestSealHolder` | rule-value | unwired | high | Prey 规则未接：场景定义也未从卡文派生 prey |
| 9 | 08672 | 无名存在 | `flags.finalMirageDoomReplacement` | key | unwired | high | 毁灭替换未实现（引擎已有 doomPlacementReplacement 读点） |
| 10 | 08672 | 无名存在 | `agendaRule.namelessInPlay` | rule-value | unwired | high | 议程目标未实现，导致 doomThreshold=0 时会提前推进 |
| 11 | 08673 | 摧毁高塔 | `actRule.pylonAttackable` | key | partial | medium | 行为层用「当前幕卡号 + 高塔原语」另路实现，本字段无读点 |
| 12 | 08673 | 摧毁高塔 | `actRule.clueReactionDamage` | key | unwired | high | 发现线索打高塔的反应缺失 |
| 13 | 08674 | 迷雾高塔 | `flags.pylonKind` | key | dead-declaration | medium | 5 张死声明；种类由 move.rule 字符串承接 |
| 14 | 08674 | 迷雾高塔 | `locationRule.enterCostCluePerInvestigator` | key | unwired | high | 进入高塔的团队线索附加费缺失 |
| 15 | 08675 | 迷雾高塔 | `flags.pylonKind` | key | dead-declaration | medium | 5 张死声明；种类由 move.rule 字符串承接 |
| 16 | 08675 | 迷雾高塔 | `locationRule.enterCostCluePerInvestigator` | key | unwired | high | 进入高塔的团队线索附加费缺失 |
| 17 | 08676 | 迷雾高塔 | `flags.pylonKind` | key | dead-declaration | medium | 5 张死声明；种类由 move.rule 字符串承接 |
| 18 | 08676 | 迷雾高塔 | `locationRule.enterCostCluePerInvestigator` | key | unwired | high | 进入高塔的团队线索附加费缺失 |
| 19 | 08677 | 迷雾高塔 | `flags.pylonKind` | key | dead-declaration | medium | 5 张死声明；种类由 move.rule 字符串承接 |
| 20 | 08677 | 迷雾高塔 | `locationRule.enterCostCluePerInvestigator` | key | unwired | high | 进入高塔的团队线索附加费缺失 |
| 21 | 08678 | 迷雾高塔 | `flags.pylonKind` | key | dead-declaration | medium | 5 张死声明；种类由 move.rule 字符串承接 |
| 22 | 08678 | 迷雾高塔 | `locationRule.enterCostCluePerInvestigator` | key | unwired | high | 进入高塔的团队线索附加费缺失 |
| 23 | 08679 | 无名疯狂 | `flags.cannotTakeDamage` | key | unwired | high | 「不能受到伤害」缺失 |
| 24 | 08679 | 无名疯狂 | `flags.exhaustNearestOnSuccess` | key | unwired | high | 强制实现了但方向相反（把已横置改回重整） |
| 25 | 08680 | 解开封印的幻影 | `flags.spawnNearestStandingPylon` | key | unwired | high | 生成规则缺失 |
| 26 | 08680 | 解开封印的幻影 | `flags.protectsReadyPylon` | key | unwired | high | 高塔免伤缺失 |
| 27 | 08680 | 解开封印的幻影 | `flags.moveTowardPylonAtEnemyPhaseEnd` | key | partial | medium | behavior 用槽位顺序近似，非最近且不检查 ready |
| 28 | 08681 | 最终幻景 | `flags.finalMirage` | key | dead-declaration | low | 身份元数据，无行为依赖 |
| 29 | 08681 | 最终幻景 | `flags.resolutionByRecords` | key | partial | medium | 行为在 checkObjectives 里近似实现；且记录无写入点 |
| 30 | 08681 | 最终幻景 | `actRule.namelessGainsHunter` | key | unwired | high | 未复用引擎既有 actRule.enemiesGainHunter 原语 |
| 31 | 08681 | 最终幻景 | `actRule.finalMirageOutcome` | rule-value | dead-declaration | low | 结局分支在 behavior.checkObjectives 内实现，rule-value 未读 |
| 32 | 08686 | 隐秘隧道 | `flags.objectiveRun` | key | dead-declaration | low | 目标由 08681 的 behavior 承接 |
| 33 | 08686 | 隐秘隧道 | `locationRule.objectiveRun` | key | dead-declaration | low | 目标由 08681 的 behavior 承接 |
| 34 | 08691 | 同源迷雾 | `flags.replacesTekeliShuffleAtLocation` | key | unwired | medium | 披露于 p7-08691.json（pending） |
| 35 | 08714 | 威廉·戴尔教授 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 36 | 08714 | 威廉·戴尔教授 | `flags.heal2Horror` | rule-value | dead-declaration | low | 能力由 abilities 实现，元数据字符串无读点 |
| 37 | 08715 | 丹佛斯 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 38 | 08715 | 丹佛斯 | `flags.draw2AfterTekeliliResolved` | rule-value | unwired | medium | 08715 的整条反应未实现 |
| 39 | 08716 | 伊里亚·阿什瓦克 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 40 | 08716 | 伊里亚·阿什瓦克 | `flags.evadeBase5ThenMayMove` | rule-value | dead-declaration | low | 能力已实现但成功路径 ReferenceError（见卡片 high） |
| 41 | 08717 | 玛拉·辛哈医生 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 42 | 08717 | 玛拉·辛哈医生 | `flags.heal2Damage` | rule-value | dead-declaration | low | 能力由 abilities 实现 |
| 43 | 08718 | 艾弗里·克莱普尔 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 44 | 08718 | 艾弗里·克莱普尔 | `flags.cancelFrostRevealNewToken` | rule-value | dead-declaration | low | 能力由 tokenReveal 反应实现（context.when 已核对有效） |
| 45 | 08719 | 詹姆斯·“曲奇”·弗雷德里克斯 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 46 | 08719 | 詹姆斯·“曲奇”·弗雷德里克斯 | `flags.fightBase5NonEliteCannotAttackThisRound` | rule-value | partial | medium | 攻击已实现，「本轮不能攻击」只打日志 |
| 47 | 08720 | 艾米·肯斯勒博士 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 48 | 08720 | 艾米·肯斯勒博士 | `flags.investigateBase5LookTopCard` | rule-value | dead-declaration | low | 能力由 abilities 实现 |
| 49 | 08721 | 罗尔德·埃尔斯沃思 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 50 | 08721 | 罗尔德·埃尔斯沃思 | `flags.blankNonWeaknessTreacheryText` | rule-value | unwired | medium | 08721 的整条 free 能力未实现 |
| 51 | 08722 | 高田弘子 | `flags.partnerRules` | key | dead-declaration | low | 字段与 rule-value 字符串均无读点；08715/08721 的能力另行缺失（见卡片问题） |
| 52 | 08722 | 高田弘子 | `flags.gain1ResourceMoveUpTo3` | rule-value | dead-declaration | low | 能力由 abilities 实现 |
| 53 | 08699 | 穿越冰雪 | `flags.moveEntryTest` | key | unwired | medium | 披露于 p7-08699.json（pending） |
| 54 | 08702 | 身陷疯狂 | `flags.attachToPossessedEnemy` | key | partial | medium | 附属与毁灭已由 encounterResolve 实现；字段未读 |
| 55 | 08702 | 身陷疯狂 | `flags.difficultyBonus` | key | unwired | medium | 难度 +1 未实现，披露于 p7-08702.json |
| 56 | 08730 | 克莱普尔的皮草 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 57 | 08731 | 爱伦·坡作品集 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 58 | 08732 | 曲奇的特制.32手枪 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 59 | 08733 | 戴尔的素描 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 60 | 08733 | 戴尔的素描 | `flags.eventCard` | key | unwired | high | 事件卡无 played 条目，无法打出 |
| 61 | 08733 | 戴尔的素描 | `flags.draw3AnyFreeWindow` | rule-value | unwired | high | 同 eventCard |
| 62 | 08734 | 埃尔斯沃思的靴子 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 63 | 08734 | 埃尔斯沃思的靴子 | `flags.footwear` | key | unwired | medium | Footwear 限制未实现 |
| 64 | 08735 | 肯斯勒的日志 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 65 | 08736 | 辛哈的医药箱 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 66 | 08737 | 高田的物品 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 67 | 08737 | 高田的物品 | `flags.eventCard` | key | unwired | high | 事件卡无 played 条目，无法打出 |
| 68 | 08737 | 高田的物品 | `flags.gain3ResourcesDraw1RemoveFromGame` | rule-value | unwired | high | 同 eventCard |
| 69 | 08738 | 安雨 | `flags.memorial` | key | dead-declaration | medium | 字段未读；真正的缺口是纪念领取流程未接线（high，见卡片问题） |
| 70 | 08706 | 瘴气折磨 | `flags.attachToPartnerAsset` | key | partial | medium | 附属已由 encounterResolve 实现；伙伴支援无入场路径 |
| 71 | 08707 | 朦胧瘴气 | `flags.turnEndDirectHorror` | key | unwired | medium | 披露于 p7-08707.json |
| 72 | 08703 | 渎神幻象 | `flags.tekeliliDoubleResolution` | key | unwired | medium | 披露于 p7-08703.json |
| 73 | 08704 | 窥看不可说之事 | `flags.drawTekeliliAndResolveThenShuffle` | key | unwired | medium | 披露于 p7-08704.json（抽牌/去向已接，立即结算缺） |
| 74 | 08708 | 巨型白化企鹅 | `flags.moveSurchargeAtEnemyLocation` | key | unwired | medium | 披露于 p7-08708.json |
| 75 | 08712 | 极地幻景 | `flags.clueDiscoveryDiscardNonWeakness` | key | unwired | medium | 披露于 p7-08712.json |
| 76 | 08723 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 77 | 08724 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 78 | 08725 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 79 | 08726 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 80 | 08727 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 81 | 08728 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 82 | 08729 | 忒咳哩-哩 | `flags.returnToTekeliliDeckBottom` | key | dead-declaration | low | 行为在 weakness resolve 内用 api.mechanics.tekeli.return 完成 |
| 83 | 08648 | 疯狂之心 | `flags.sealAwareToken` | key | dead-declaration | low | 行为已由章节 chaos.js#cultistCountsAsFrost 承接，此 flag 纯元数据 |
| 84 | 08648 | 疯狂之心 | `flags.towerAwareToken` | key | dead-declaration | low | 行为已由章节 chaos.js#isMistPylon 承接，此 flag 纯元数据 |
| 85 | 08649 | 伊夸之门 | `flags.claimedSealsKeptOnResign` | key | dead-declaration | low | api.resign 不清理封印记录，规则自然满足；无读点 |
| 86 | 08650 | 地热口 | `flags.roomSeal` | key | dead-declaration | medium | 08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量 |
| 87 | 08651 | 被遗忘的神庙 | `flags.roomSeal` | key | dead-declaration | medium | 08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量 |
| 88 | 08652 | 寇斯图书馆 | `flags.roomSeal` | key | dead-declaration | medium | 08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量 |
| 89 | 08653 | 原生质池 | `flags.roomSeal` | key | dead-declaration | medium | 08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量 |
| 90 | 08654 | 无光之海大厅 | `flags.roomSeal` | key | dead-declaration | medium | 08650–08654 五张重复死声明；激活行为在各自 abilities 内实现，封印种类为条目常量 |
| 91 | 08655 | 水下扩张区 | `flags.firstFrostModifier` | key | dead-declaration | low | 行为在地点 forced 能力内实现；behavior.applyTokenEffect 为重复死代码 |

## 五、D5 复用/复制逻辑复核

- **D5-1（medium）** 08650–08654 五张「取回封印→团队线索→激活封印」地点条目各写 ~55 行几乎相同逻辑（仅技能/封印/额外效果不同）；definition 里 ACTIVATE_LOCATION_CODES 数据无读点，应上收为共享 locationRule 工厂或原语 — `src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08650.js:17-41 等 5 份 / content/.../definition.js:105-107`
- **D5-2（medium）** 08664–08668 五张取回封印地点条目同样复制 5 份，仅 rule 字符串/label/flags 不同；封印种类可走数据表 — `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08664.js:8-15 等 5 份`
- **D5-3（medium）** 「附属到最近且没有同名附属的地点」在 08691/08692/08699/08712 复制 4 份（含未使用的 nearestLocation 帮助函数与 if(true)/if(false) 死分支），应上收为 locationAttachment 原语 — `src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08691.js:15-30 / deadly_weather/08692.js:23-45 / hazards_of_antarctica/08699.js:20-40 / silence_and_mystery/08712.js:13-29`
- **D5-4（medium）** 「地点附属强制窗口」被拆成 7 份独立 primitive-request（08691/08692/08693/08694/08699/08702/08707/08712），同一句规则分散排队；应合并为一个原语再逐卡接线 — `artifacts/migration/eote/primitive-requests/p7-08691.json … p7-08712.json`
- **D5-5（high）** Tekeli-li 牌库初始化在 iceAndDeathPart1/behavior.js:114 与 iceAndDeathPart2/behavior.js:91 各写一遍，且 7 卡面/份数常量在两者 definition 各抄一份；HeartOfMadness I/II 则完全没初始化 → 同一战役资源没有统一初始化原语（应放战役序章/统一 setup） — `content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:114 / iceAndDeathPart2/behavior.js:91 / scenarios/theHeartOfMadnessPart1/behavior.js:87-96（无 tekeli）`
- **D5-6（medium）** 伙伴/遗物数据存在三份来源：records.js#PARTNERS（含 resolute 映射）、shared-encounters.js#PARTNER_ASSET_RULES/RESOLUTE_PARTNER_FORMS/MEMORIAL_FOR_PARTNER（从未被读取）、条目 flags；数据漂移风险高 — `content/campaigns/edgeOfTheEarth/records.js:150-170 / content/campaigns/edgeOfTheEarth/shared-encounters.js:183-228`
- **D5-7（medium）** 同一句「frost 首次揭示视为 -3」在 08655 单卡 forced 与 Part1 behavior.applyTokenEffect（写死卡号 08655，返回值无人消费）各实现一份 — `src/cards/encounter-entries/.../08655.js:12-30 / content/.../theHeartOfMadnessPart1/behavior.js:250-258`
- **D5-8（low）** 08692/08693/08694 三张 deadly_weather 诡计是同一模板的三份拷贝（仅附属目标/标签不同），可共享 helper — `src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08692.js, 08693.js, 08694.js`

共享组「被哪些章节实际使用」核对（探针实测遭遇牌库）：
- Part1 遭遇牌库 48 张，含共享卡 16 种：08703–08711、08723–08729（namelessHorrors/miasma/penguins/shoggoths/tekelili）。
- Part2 遭遇牌库 14 张，仅含共享卡 08687/08688（agentsOfTheUnknown）。
- Ice and Death Part3 / Fatal Mirage 分别含 17 / 19 种共享卡；**To the Forbidden Peaks / City of the Elder Things 的 gather 声明了 elderThings 等共享组，但实际遭遇牌库（14/20 张）不含任何共享卡** → elder_things 的 08695/08696/08697 全局不可达。
- 共享诡计/敌人的条目通过引擎通用 `entryRevelation` + `abilities` 窗口结算（**不依赖**各章 behavior 读点）；仅 08670（Part1 专属）走章节 behavior，且该路径不可达（见 P1）。

## 六、simplified 卡逐条复核（08587–08595、08673、08679、08681–08685）

| 卡号 | 账本 | 披露 | 现状复核 | 仍需 simplified? | 严重度 |
| --- | --- | --- | --- | --- | --- |
| 08587  | simplified | p7-08587（引用文件 artifacts/migration/eote/primitive-requests/p7-08587.json 不存在） | abilities: []，[fast] 治愈 2 恐惧只有 uses 数据，未实现 | 是 | medium |
| 08588  | simplified | p7-08587（文件不存在） | abilities: []，[reaction] 抽 3 弃弱点未实现 | 是 | medium |
| 08589  | simplified | p7-08587（文件不存在） | 敏捷 6 躲避 + 移动已实现（api.evade/testResult/moveDestinations） | 否（已实现） | low |
| 08590  | simplified | p7-08587（文件不存在） | abilities: []，治愈 2 伤害未实现 | 是 | medium |
| 08591  | simplified | p7-08587（文件不存在） | abilities: []，取消 frost 二选一未实现 | 是 | medium |
| 08592  | simplified | p7-08587（文件不存在） | 战斗 6 + addEffect 已实现，「不能攻击」用空 modifiers 的 addEffect 装饰（无实际禁攻读点） | 是 | medium |
| 08593  | simplified | p7-08587（文件不存在） | 调查 6 + lookAt 已实现，但「可弃掉该牌」缺失 | 是 | medium |
| 08594  | simplified | p7-08587（文件不存在） | abilities: []，文本空白能力未实现 | 是 | medium |
| 08595  | simplified | p7-08587（文件不存在） | abilities: []，获得 1 资源 + 移动最多 3 资源未实现 | 是 | medium |
| 08673 摧毁高塔 | simplified | p7-08673（引用文件不存在） | 攻击高塔已实现但难度取错值（health 而非 shroud）；线索反应未实现；「近似已披露」不足以覆盖规则错误 | 是 | high |
| 08679 无名疯狂 | simplified | p7-08679（引用文件不存在） | 不能受伤未实现、横置方向写反、关键词丢失——属可立即修复的规则错误，不应记为「已披露近似」 | 是 | high |
| 08681 最终幻景 | simplified | p7-08681（引用文件不存在） | 获得猎手/毁灭替换未实现，R1/R2 记录无写入点 | 是 | high |
| 08682 巨大坡道 | simplified | p7-08682（引用文件不存在） | 离开检定已接线，仅「花 1 线索自动成功」缺失 | 是 | medium |
| 08683 巨大坡道 | simplified | p7-08682（文件不存在） | 同 08682（难度 3） | 是 | medium |
| 08684 巨大坡道 | simplified | p7-08682（文件不存在） | 同 08682（难度 2） | 是 | medium |
| 08685 巨大坡道 | simplified | p7-08682（文件不存在） | 同 08682（难度 1） | 是 | medium |

补充：`p7-08587`、`p7-08673`、`p7-08679`、`p7-08681`、`p7-08682` 等被 simplified 账本引用的 primitive-request 文件在 `artifacts/migration/eote/primitive-requests/` 下**不存在**（目录共 25 个文件，无上述编号）；即「近似已披露」的披露物本身缺失（低/中披露问题）。

## 七、测试运行与断言强度

- 命令：`cd games/arkhamhorror && node tests/eote-scenario-theHeartOfMadnessPart1.test.mjs`、同 Part2、同 shared（in-process，未用 spawn/npm run）。
- 结果：Part1 7/7、Part2 7/7、shared 19/19，全部 pass（exit 0）。
- 断言强度：Part1：混乱标记用例（tests/eote-scenario-theHeartOfMadnessPart1.test.mjs:223-235）只断言 chaos helper 返回值，未初始化 Tekeli-li 牌库，未覆盖“实际抽牌”路径
- 断言强度：Part2：结局用例（:178-192）直接伪造 campaign.records.drKenslerHasAPlan=true，未验证记录写入路径；议程/毁灭/高塔攻击难度/pylon 力量/进入费用均无用例（:115-152 的 test stub 恒成功）
- 断言强度：shared：伙伴用例（tests/eote-scenario-shared.test.mjs:326-345）手工把 08714 塞进资产区，未验证“每章开局选派并置入战场”；纪念用例（:402-414）只在原语层 claim，未验证幕间接线
- 断言强度：08716 成功躲避路径、08679 横置方向、08673 难度取值均无断言

## 八、既有账本「verified」与 high 问题并存清单（供 Lead 复核）

| 卡号 | 账本 | 复核发现 | 证据 |
| --- | --- | --- | --- |
| 08660 瘴气的召唤 | verified | high：背面 D/E 效果与卡面不符 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08660.js:21-24` |
| 08662 蛰伏 | verified | high：背面整段未实现 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08662.js:10-12` |
| 08669 原生质团 | verified | high：Spawn/Prey 未接线；再结算敌人阶段只近似 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08669.js:8-16` |
| 08670 静电释放 | verified | high：揭示效果在引擎路径上不可达 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08670.js:8-13 + content/.../definition.js:151` |
| 08672 无名存在 | verified | high：议程目标/毁灭替换未实现且 doomThreshold=0 自动推进 | `content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js:53` |
| 08674 迷雾高塔 | verified | high：进入附加费+前置条件缺失（仅 A 力量生效） | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08674.js:11-18` |
| 08675 迷雾高塔 | verified | high：进入附加费+前置条件缺失+B 力量未实现 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08675.js:11-18` |
| 08676 迷雾高塔 | verified | high：进入附加费+前置条件缺失+C 力量未实现 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08676.js:11-18` |
| 08677 迷雾高塔 | verified | high：进入附加费+前置条件缺失+D 力量未实现 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08677.js:11-18` |
| 08678 迷雾高塔 | verified | high：进入附加费+前置条件缺失+E 力量未实现 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08678.js:11-18` |
| 08680 解开封印的幻影 | verified | high：Spawn/高塔免伤未实现；移动非最近 | `src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08680.js:9-14` |
| 08687 原初恶魔 | verified | high：Hunter/Retaliate 关键词在合并表中丢失 | `src/engine/card-lookup.js:26 + content/.../theHeartOfMadnessPart2/definition.js:105-118` |
| 08714 威廉·戴尔教授 | verified | high：伙伴支援无入场路径（9 张同） | `src/engine/eote-interactions.js:109-130（无调用方）` |
| 08716 伊里亚·阿什瓦克 | verified | high：成功躲避后 ReferenceError | `src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js:35` |
| 08721 罗尔德·埃尔斯沃思 | verified | high：整条 free 能力未实现（integrity empty-behavior） | `src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08721.js:9-12` |
| 08731 爱伦·坡作品集 | verified | high：整条 action 未实现 | `src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08731.js:8-10` |
| 08733 戴尔的素描 | verified | high：事件卡无 played 实现（引用的玩家条目文件不存在） | `src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08733.js:7-8` |
| 08737 高田的物品 | verified | high：事件卡无 played 实现（引用的玩家条目文件不存在） | `src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08737.js:7-8` |

## 九、方法与复现

- 卡面事实源：`src/cards/cards-data.js`（经 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/bundles/<code>.md` 审阅包交叉核对中英卡面/数值/份数）。
- 引擎读点：`src/cards/card-rules.js`（entryFlags/locationRuleFor/agendaRuleFor…）、`src/engine/{act-agenda,turn,encounter,treachery-tokens,movement,skill-effects,card-lookup,mechanic-state,eote-facilities,eote-tekeli}.js`、`src/campaign/{eote-seals,eote-partners,eote-memorials}.js`。
- 运行时探针（真实引擎 + 真实内容，in-process）：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/probe-runtime.mjs`、`probe2.mjs`、`probe3.mjs`、`probe4.mjs`；关键复现：
  - `probe2.mjs` A：Part2 `checkAgenda` 使 agendaIndex 1→2 并执行坡道清场（08672 doomThreshold=0）。
  - `probe2.mjs` B：08716 成功躲避 → `ReferenceError: here is not defined`。
  - `probe2.mjs` C：08679 成功差值使已横置副本变回 ready（方向相反）。
  - `probe2.mjs` D：08677 攻击高塔实际难度 4（生命）而非 3（帷幕）。
  - `probe2.mjs` E：无封印控制时 [fast]「释放封印力量」仍被提供且返回 handled。
  - `probe-runtime.mjs`：合并后 `ALL_ENEMIES["08687"]={}`、`["08679"]={}`、08695/096 缺失；Part1 setup 后 `scenarioDecks.tekeli` 不存在。
- 未做：浏览器界面验收（D2 仅按条目/投影静态判读）；`08587–08595` 的 D1 全量属 fatalMirage 分片，本报告只按任务要求复核 simplified 披露与现状。

## 十、对 Lead 的建议优先级

1. 先修 Part2 流程三件套（08672 doomThreshold/目标、记录写入点、Tekeli 牌库全局初始化），否则该章不可完整跑通。
2. 修 08716 ReferenceError、08679 横置方向、08660 D/E 数值、08673 难度取值 —— 均为一两行、可立即修且有探针复现。
3. 统一「共享敌人定义」：Part2 定义派生关键词或改用 campaign card-data 构建；把 elderThings 等共享组真正纳入 peaks/city 遭遇牌库。
4. 把 Tekeli 牌库、伙伴选派/入场、纪念领取上收为战役级统一接线（当前一个复制两份、另两个完全没接）。
5. 汇总 primitive-request 缺口时合并同一「地点附属强制窗口」的 7 份请求，并补回 simplified 账本引用但缺失的请求文件。
