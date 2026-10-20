# 失落的时代（三循环）迁移现状与后续计划

本文依据 `audit/tfa-migration.json`、`content/` 实际代码、`tests/tfa-migration.test.mjs`、参考资源统计与一次全量回归实测整理。规范口径见 [Arkham 内容迁移规范](arkham-content-migration.md)。

## 0. 一页结论

| 项目 | 现状 |
| --- | --- |
| 当前里程碑 | **M4 完成**（M3-A 机制 + M3-B 十章剧本 + M3-C 剧情全文 + M4 关键词与规则书），`audit:tfa`、`audit:tfa:scenarios`、`import:tfa-story:check`、`test:tfa*`、`test:tfa:rules:browser` 全部通过 |
| 1 调查员 | **已完成**：04001–04005 可选人，04006–04016 逐张实现并验收（能力、旧印、构筑、弱点、存档） |
| 2 玩家卡 | **已完成（91 / 91）**：支援、事件、技能、弱点链、附属、封印、永久卡与装备逐卡验收，86 张可构筑 |
| 3 剧本 | **M3-B 完成**：十章都有 `definition/layout/behavior`，逐章验收账本见 `audit/tfa-scenario-acceptance.json`；十章保持 `development`（`literalCardBehavior` 与浏览器验收未完成，简化分支逐条登记在 `gaps`） |
| 4 机制与剧情 | **M3-A/M3-C 完成**：七项循环机制已登记并有单测；`tools/import-tfa-story.mjs` 生成 `story-text.js`（序章、十章导入、32 个结局分支、58 个段落组、幕间与尾声），`tests/tfa-story.test.mjs` 证明未触发分支不泄露、私密段落按座位过滤、存档不重写历史正文 |
| 5 关键词与规则书 | **M4 完成**：8 个关键词 8/8 `verified`（卡面来源 + 引擎行为 + Node 验收 + 规则书条目 + 卡文直达）；`web/rulebook-data.js` 新增 9 条失落的时代条目、拼音索引与 04 循环卡文直达；桌面与移动端规则书/卡牌链接浏览器用例如期通过 |
| 6 发布 | **M5 入口已开放**：展示图 `web/img/campaigns/theForgottenAge` 与音频目录已入仓；战役与十章均为 `playable`，账本 `milestone: M5` + `earlyAccess: true`（逐条核对与浏览器发布验收仍未全部通过，因此不宣称规则等价） |
| 战役启动 | 可启动：`contentRegistry.assertLaunchable('theForgottenAge')` 通过，大厅列表与设置项都出现；序幕选远征求领队并按人数购买补给品，幕间与补给点按卡面划掉补给（见下方 M5 段与 [docs/tfa-card-audit.md](tfa-card-audit.md) §8） |
| 全量回归 | 迁移期实测 **2 207 用例全部通过**（`node tools/run-tests.mjs all`），TFA 相关测试文件全绿；生成物 `import-cards --check`、`build-presentation --check`、`audit-core-acceptance --check` 均无漂移 |

一句话判断：**目录、调查员、机制、玩家卡、十个剧本、剧情全文、关键词与规则书都已完成；M5 已把入口与补给链路打通，剩余工作是从 `earlyAccess` 走向逐条卡面核对与发布浏览器验收。**

## 1. M0 基线产物（M3 之后仍在用）

| 产物 | 说明 |
| --- | --- |
| `content/campaigns/theForgottenAge/manifest.js` | 战役清单：10 章、序章→尾声共 19 个流程节点（已填入剧情正文）、混乱袋、48 字段记录表、`status: 'catalog-only'` |
| `content/campaigns/theForgottenAge/shared.js` | 四难度混乱袋（14/14/14/15 枚，双骷髅 + 1 古神 + 无教徒/石板）、10 章原卡号、48 个记录字段、19 项补给清单 |
| `content/campaigns/theForgottenAge/chapters.js` | 占位章节工厂（M3 之后没有章节再用，保留为后续循环的提升点样板） |
| `content/campaigns/theForgottenAge/scenarios/*/index.js` | M3 后为真实模块：`definition.js` + `layout.js` + `behavior.js` + manifest，保留真实卡号 04043/04054/04113/04161/04205×2/04237/04277/04314/04344 |
| `content/packs/tfaCampaign/manifest.js` | 231 张战役卡，25 个 `encounterGroupIds`（含遭遇组别名注释），`catalog-only` |
| `content/packs/tfaInvestigators/manifest.js` | 16 张（5 调查员 + 11 专属卡），`verified` |
| `content/packs/tfaPlayer/manifest.js` | 91 张玩家卡 + 基础弱点 04038/04040，`development` |
| `content/registered.js` | 三个包与战役、10 章均已注册 |
| `tools/audit-tfa.mjs` | 锁 330 个 `.hs` + 11 个中文剧情 JSON 的 SHA-256；强制 `catalog-only`、强制卡包无重叠分区、汇总章节账本；`--write/--check` |
| `tools/audit-tfa-scenarios.mjs` | 逐章验收账本：12 项 checks、文件哈希、遭遇卡实现清单、`gaps`；`--write/--check` |
| `audit/tfa-migration.json` | `milestone: M3`，361 条印刷记录 = 338 主卡号 + 23 关联面 = 231 + 16 + 91；剧本组 `pending`（逐条核对与浏览器验收未完成）、剧情 `verified`、关键词/规则书 `pending` |
| `tests/tfa-migration.test.mjs` | 6 个用例全绿（十章 development、分区唯一、混乱袋与记录、流程顺序、共用卡图解析、账本不可伪造） |
| `README.md` 进度表 | 已登记「10 章不可启动 / 231 / 5 位 / 91 / M3 完成」 |

参考来源与资源盘点（均为可用状态）：

- 剧本行为来源 9 个 Haskell 文件、合计 2 853 行（HeartOfTheElders 475、ThreadsOfFate 413、TheDepthsOfYoth 372、ShatteredAeons 322、TheDoomOfEztli 321、TheBoundaryBeyond 316、TheCityOfArchives 229、TurnBackTime 209、TheUntamedWilds 196）。
- 中文剧情 11 个 JSON（`base.json` + 10 章）。
- 卡图共用共享目录：英文 `web/img/cards/04*.avif` 471 张、中文 `web/img/zh/cards/04*.avif` 495 张；`04277` 无中文图，走英文回退（测试已固定该行为）。
- 意外多出的 `theForgottenAge/scenarios/heartOfTheElders.json`（合订版）仍未纳入锁定清单：M3-C 生成器只读 `heartOfTheEldersPart1.json` / `heartOfTheEldersPart2.json`，合订版保持未登记。

## 2. 逐阶段缺口

### M1 调查员（04001–04016）——已完成

- `content/packs/tfaInvestigators/manifest.js`：五位调查员的构筑规则（含 04003 芬恩「探索者／幸存者合计最多 5 张」交叉限额、04002 遗物特质、04004 受祝特质）、主能力、旧印效果，以及 04006–04016 共 11 张专属卡的支援／事件／弱点行为；`status: 'verified'`。
- 新增引擎原语：`tfaInvestigator` 效果族（`playAllyDiscounted` 盟友减费、`investigateAction` 免费调查、`finnPistol` 手枪攻击、`smuggledGoods` 走私货物检索）；旧印 kind `tfaSearchAlly`／`tfaMoveAfterTest`／`tfaPerExhaustedEnemy`／`tfaChosenReward`／`tfaCalvinSign`；芬恩的 `extraEvade` 额外躲避行动（0 行动点、每回合一次、非法复用被拒）；马泰奥的 `auto_fail → elder_sign` 每局一次替换与开场 +5 XP；加尔文的伤害／恐惧属性加成；米奇·布朗的非独特盟友额外槽；杰克·威廉斯的每回合首次移动／调查免借机攻击与地点揭示抽牌；古代抄本的封印与揭示替代；伊格蛇族的敌人弱点封印；时间尽头的直接伤害承接；四张专属弱点的三种分支。
- 顺带修正：`createGameState` 的调查员候选洗牌改用独立随机流，避免新增调查员改变旧种子对局的牌序与混乱标记（否则每加一位调查员都会漂移既有回归）。
- 测试：`tests/tfa-investigators.test.mjs` 31 个用例（含 1–4 人开局、JSON 恢复、非法路径），`npm run test:tfa:investigators`。
- 审计：`audit/tfa-migration.json` 升到 `milestone: M1`，记录 `selectableInvestigators: 5` 与 `verifiedInvestigatorCards: 16`。

### M2 玩家卡（91 张 + 2 张基础弱点）

- `content/packs/tfaPlayer/effects.js`：逐卡登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐。
- 逐卡审计账本由 `tools/audit-tfa.mjs` 生成：`audit/tfa-migration.json` 的 `playerCards.verifiedCodes` 必须与 `IMPLEMENTED_PLAYER_CODES` 完全一致，且包内不得再有 `rulesImplemented: false` 的卡（这两条已是硬校验）。
- 注意**同名不同义**：玩家卡上的 `Uses (N supplies)` 已被现有 `uses` 原语支持；而战役级「检查补给（check your supplies）」是全新机制（M3），两者不得复用同一实现或同一关键词条目。
- 开放后需同步 `availability` 与 README 的构筑池数字（现为扩展池 272 张 = 敦威治与卡尔克萨 186 + 失落 86）。

**M2-A（第一批，已完成）**：`content/packs/tfaPlayer/effects.js` + `tfaPlayer` 调度器，共 22 张——支援 04025/04026/04107/04203/04235/04268/04273/04275，事件 04103/04111/04233/04234/04269，技能 04155/04157/04198/04309，剧本模式弱点链 04038–04042。新增引擎钩子：技能失败奖励、按成功点数抽牌（弱点洗回牌库）、`placeChargeOrSecret`、忽略符号效果、躲避期敏捷加值、连接数属性加成、轮末弃置、霰弹枪卡膛、职业杀手一次性增伤。`tests/tfa-player-acceptance.test.mjs` 19 个用例；`audit/tfa-migration.json` 记录 `playerCards: { verified: 22, total: 91 }`。未开放卡不得出现在构筑池（`getAvailability(...).availability === 'catalog-only'` 已由测试锁定）。

**M2-B（已完成，34 张）**：`tfaPlayerEffect3` 调度器补齐其余全部玩家卡，并新增三层通用规则——「仅限冒险卡能力检定」与「任意检定可投入」的投入限制、封印/替代任意标记的选择器、从弃牌堆打出的事件（04033/04272/04312）。逐组交付：

- 支援：04017 求生匕首、04022 古代巨石（未鉴定）、04023 埃兹特里之牙、04035 雅沃托、04106 老练分析、04108 销赃贩子、04109 奥术研究、04151 准备万全、04154 一目十行、04158 追忆未来、04159 反复尝试、04160 围困、04197 奥利芙·麦克布莱德、04230/04231 古代巨石（研究完成）、04236 自食其力、04307 纳克特手稿、04308 时间借取、04310 虚空碎裂。
- 事件：04028「交给你了！」、04032 黑暗预言、04033 临时武器、04034 狗屎运、04104 枪法如神、04110 反击法术、04199 危险预感、04200 学无止境、04202 勇斗异劫、04272 将就一下、04312 临时路障。
- 技能：04036 殊死一搏、04150 占据先机、04153 参透真谛、04192 英勇无畏。

新增引擎原语（均有逐卡用例）：揭示前的替代与额外揭示（`tfaBeforeChaosReveal`：危险预感强制替代、奥利芙揭示 3 选 2、黑暗预言揭示 5 选 1、勇斗异劫按难度差额外揭示）、符号标记取消窗口（反击法术）、检定开始/失败结束窗口（追忆未来、学无止境、殊死一搏）、正在结算诡计的能力（埃兹特里之牙）、打出前的费用与「获得快速」修正（销赃贩子、自食其力）、弃牌堆打出（三张即兴事件）、技能牌转化为支援（英勇无畏）、抽牌后的秘密结算（研究完成的两块古代巨石）、滴答换额外行动（时间借取）、封印已揭示的「0」标记（虚空碎裂）、战役层永久卡（老练分析按记录哈希确定性挑选第二张升级版本；奥术研究购买时 1 点精神创伤 + 每场冒险后第一张法术升级减 1 经验，并打通失落的时代玩家的 P4 升级路径）。

**M2-C（已完成）**：附属、封印与检定改写共 14 张连同前三批一起并入 `content/packs/tfaPlayer/effects.js`，`tests/tfa-player-acceptance.test.mjs` 现为 86 个用例（含 1–2 人开局、待决选择回放、战役层升级），`audit/tfa-migration.json` 记录 `playerCards: { verified: 91, total: 91 }`。全部 91 张可构筑 86 张（5 张剧本模式弱点作为依赖卡牌）。

### M3-A 机制层（已完成）

七项机制在 `src/engine/engine.js` 中实现，并在 `content/mechanics.js` 的 `supportedMechanics` 显式登记：
`tfaExploration`（探索牌库，牌序进入状态、`beforeExplore`/`afterExplore` 剧本钩子）、`tfaSupplies`（19 项补给，按人记录、同地点检查、划掉）、`tfaVengeance`（胜利区复仇点数，敌人 `vengeance` 在击败时入区）、`tfaYigsFury`（数值记录，不为负）、`tfaPoisoned`（永久弱点 04102 进入威胁区域）、`tfaRelicOfAges`（遗物随携带者移动或固定在地点）、`tfaExpeditionLeader`（战役领队指针）。`tests/tfa-mechanics.test.mjs` 11 个用例覆盖确定性洗牌、JSON 存档、地点检查与非法路径。

### M3-B 剧本（已完成，十章均为 `development`）

- 目录结构：`content/campaigns/theForgottenAge/card-data.js`（印刷数据、符号连线、遭遇组别名、卡面结构表）与 `encounter-rules.js`（共享遭遇组效果与限制钩子）先把「遭遇组 → 卡号」定下来，再逐章写 `definition.js` / `layout.js` / `behavior.js` / `index.js`。
- 遭遇组对照表：卡包清单声明 25 个 `encounterGroupIds`，目录里实际 22 个 `encounterCode`；`wilds ↔ TheUntamedWilds`、`eztli ↔ theDoomOfEztli`、`heart_of_the_elders ↔ sharedHeartOfTheElders + Part1/2`、`the_boundary_beyond ↔ theBoundaryBeyond` 等别名关系写在 `content/packs/tfaCampaign/manifest.js` 与 `card-data.js` 的 `GROUP_ALIASES` 里，`requiredEncounterGroupIds` 只引用卡包声明过的 ID（注册表强制校验，填错立即抛错）。
- 逐章交付：布置与放在一边区、幕／议程与推进条件、地点正反面与符号连线、章节遭遇牌堆组成、敌人/诡计结构、混乱标记表（`tfa-chaos.js`，四档难度按 Haskell `getChaosTokenValue`）、结局与跨章记录写入。
- 两处结构性难点已按原样处理：`HeartOfTheElders` 上下两半共用剧本卡 04205，拆成两个注册项并共用同一张标记表（`tfaChaosToken` 接受 Part1/Part2 别名）；`TheDepthsOfYoth` 的深度等级存 `state.scenarioFlags.depthLevel`（混乱标记读取同一字段），`ShatteredAeons` 的年代/时间线分支按记录分流。
- 验收：`tools/audit-tfa-scenarios.mjs` 生成 `audit/tfa-scenario-acceptance.json`，逐章记录 12 项 checks、文件哈希、地点/幕/议程/遭遇/结局清单、`pendingEncounterCodes` 与 `gaps`。`tests/tfa-scenario-acceptance.test.mjs` 守住账本形状与「不得提前 verified」。
- 真实引擎验证：`tests/tfa-engine-integration.test.mjs` 用一个只在本文件有效的 `playable` 克隆跑通「布置 → 探索 → 存档回放」；`tests/tfa-engine-setups.test.mjs` 把十章逐章克隆成 `playable`，用 `createGameState` 验证每章都能单独开局（地点、遭遇牌库、幕/议程、混乱袋、合法行动、JSON 往返）。
- 保持诚实：`literalCardBehavior` 全章为 `false`（未逐张核对卡面字面需求），`browserAcceptance` 全章为 `false`（M5 才做），简化分支写进账本 `gaps` 并汇总进 `audit/tfa-migration.json` 的 `remaining`。

### M3-C 剧情全文（已完成）

- `tools/import-tfa-story.mjs --write/--check`：从锁定的中文剧情来源生成 `content/campaigns/theForgottenAge/story-text.js`（`TFA_STORY_TEXT` + 供战役流程图使用的 `storyText`）。规则提示（`p.basic`）、记录/奖励列表（`ul`）与图片占位不会混入正文。
- 收集范围：序章、十章导入（含条件段落组）、全部结局分支（32 个）、五个幕间、补给点与尾声。
- 运行时投影：`src/campaign/story.js` 新增 `tfaIntroduction` / `tfaFlowStory`，按进入该章时的战役记录选择分支（如 埃兹特里的覆灭 的「等候补给／清出道路」、破碎永世 的「火盆是否点燃」、天机之城 的「合作／反抗」），补给类分支读取 `state.campaign.supplies`；未触发分支不进入观察视图。旧存档的完整历史正文由 `savedIntroduction` 原样保留，只有摘要级旧档才按当时记录重建。
- `tests/tfa-story.test.mjs`：生成物与 `--check` 一致、每章有导入正文、每个可达结局有正文（来源无独立正文时回退到剧本摘要且仍是可读正文）、无 HTML 控制标记、互斥分支不泄露、私密段落按座位过滤、存档不重写历史。

### M4 关键词与规则书（已完成）

- **8 个关键词 8/8 `verified`**，逐项 5 检查（来源卡号 + 引擎行为 + Node 验收 + 规则书条目 + 卡文直达）：
  `explore`（探索牌库/探索行动）、`vengeance`（复仇）、`yigsFury`（伊格之怒）、`supplies`（补给与检查补给）、
  `poisoned`（中毒）、`relicOfAges`（古代遗物）、`expeditionLeader`（远征领队）、`elderThing`（旧神标记）。
  清单集中在 `content/campaigns/theForgottenAge/keywords.js`，审计与测试共用这一份事实来源。
- **规则书**：`web/rulebook-data.js` 新增 9 条失落的时代条目——`tfaCampaign`（战役与记录）、`tfaExploration`（探索牌库）、
  `tfaSupplies`（补给与检查补给，明确区分卡面 `Uses (N supplies)`）、`tfaVengeance`（复仇与伊格之怒）、`tfaPoison`（中毒）、
  `tfaRelic`（古代遗物与远征领队）、`tfaTimeline`（时间线与年代）、`tfaDescent`（深度等级与下降）、`tfaChaos`（混乱符号）。
  同时补上拼音索引键（`RULE_PINYIN`）与 `04` 循环卡文直达：剧本/幕/议程/地点/敌人/诡计按类型与卡面文字连到对应条目。
- **Node 验收**：`tests/tfa-rules.test.mjs` 9 个用例覆盖关键词清单、卡面来源、引擎导出、关键词行为可执行（探索/复仇/伊格之怒/补给/中毒/遗物/领队/旧神标记）、
  规则书结构、拼音索引、实现边界表述、章节卡与全量 04 卡的规则链接、搜索匹配。
- **浏览器验收**：`tests/tfa-rules.browser.mjs` 4 个用例（桌面/移动端各两条）覆盖规则目录、搜索、相关条目跳转与返回、
  卡牌详情规则链接与焦点恢复；截图写入仓库根目录 `artifacts/tfa-migration/`（与迁移规范 §2 一致，且被 gitignore）。
  审计以专用用例文件作为 `desktopBrowser`/`mobileBrowser` 证据，不在 `--check` 里依赖本地截图，干净检出不会误报漂移。
- **资源**（已补齐）：`web/img/campaigns/theForgottenAge/` 与 `web/audio/music/campaigns/theForgottenAge/` 已随仓库提供，
  `presentation` 检查因此覆盖战役展示图与场景配乐。

### M5 发布（入口与补给链路已完成）

- **已完成**：战役与十章推到 `playable`，`assertLaunchable('theForgottenAge')` 通过，大厅可开新战役；
  序幕按人数发放补给品点数（10/7/5/4）并逐位购买，补给点提供第二次购买（8/5/4/3），
  幕间按卡面共同划掉等于人数的配给、用药品移除牌组里的中毒弱点、划掉 1 个汽油；
  大厅新增「补给品」页签，牌桌战役面板显示公开清单；规则书三条不实表述已改写。
  账本升到 `milestone: M5`、`playable/launchEnabled/earlyAccess: true`、`equivalenceCertified: false`。
  验收：`tests/tfa-launch-supplies.test.mjs`（10 个用例，真实引擎）＋ `audit:tfa` / `audit:tfa:scenarios` 均通过。
- **仍待完成**：三组确认全 `verified` 之前不宣称规则等价——`literalCardBehavior` 与章节 `browserAcceptance` 仍为 `false`；
  仍剩「另一支探险队的帮助」结局记录、两处「有就自动划掉」的补给选择，以及年代／时间线面板。
- **P1 遭遇卡与玩家卡（已完成）**：核心盒混入的 11 种遭遇卡（01163–01178）与 04259／04261 由共享解析器逐条实现，
  逐章账本待办遭遇卡 23 → 7；玩家卡的五处系统性偏差（借机攻击、快速卡、多技能、`selfOnly`、威胁区字段）一并修好。
  验收：`npm run test:tfa:encounters`（17 个用例）＋ `npm run test:tfa:player-p1`。
- **P1 剧情与幕间（已完成）**：五个幕间与补给点按卡面逐项结算（毛毯、放哨、配给不足、药品与中毒、汽油、地图、水壶、伊塔卡的信念、归位程式、恢复意识、粉笔、火盆、遗物读数、结尾划补给、3 XP 治中毒 / 5 XP 治创伤）；
  48 条战役记录补中文名，`records-audit.mjs` 复跑只剩 1 个记录键无写入者；幕间正文按 `nodeId` 只记录到达段落，局外面板新增「幕间纪事」羊皮纸卡。
  验收：`npm run test:tfa:interludes`（17 个用例）。
- 同步 README 进度表、`audit/tfa-migration.json` 的 `milestone`/`verifiedScope`/`remaining`、`package.json` 脚本。

## 3. 建议执行顺序

按依赖关系排成 8 个可独立验收的批次，每批都是一个可提交、可回滚的最小闭环。

| 批次 | 内容 | 主要交付物 | 完成判据 |
| --- | --- | --- | --- |
| **P0** | 修基线（§5） | 依赖补齐与产物重生成 | **已完成**：`npm test` 1775/1775、`presentation:check` 无漂移 |
| **P1** | M1 调查员 | `tfaInvestigators` 能力层、引擎原语、`tests/tfa-investigators.test.mjs` | **已完成**：5 人可选人、16 张专属卡逐张验收、31 个用例通过 |
| **P2** | M3-A 机制层 | `mechanics.js` 登记 + 7 项机制实现 + 机制单测 | **已完成**：11 个机制用例通过，含探索牌库确定性存档测试 |
| **P3** | M2 玩家卡 | `tfaPlayer/effects.js`、逐卡验收、`literalCardBehavior` 测试 | **已完成**：91 / 91 张通过验收，86 张可构筑，`tfa-player-acceptance` 86 个用例 |
| **P4** | M3-B 剧本（10 章分批） | 每章 `definition/layout/behavior` + 遭遇组对照表 + 章节验收 | **已完成**：十章 `development`，12 项 checks 逐项有证据路径，`audit:tfa:scenarios` 与十章单测全绿 |
| **P5** | M3-C 剧情全文 | `import-tfa-story.mjs`、`story-text.js`、`tfa-story.test.mjs` | **已完成**：`--check` 稳定；未触发分支不泄露、私密段落按座位过滤 |
| **P6** | M4 关键词+规则书 | 8 关键词条目、规则书 9 条、拼音索引、卡文直达、桌面/移动端浏览器用例 | **已完成**：关键词 8/8 `verified`、规则书 6 项全真（含两端浏览器验收） |
| **P7** | M5 发布 | 展示图与音频、大厅/联机/浏览器 E2E | **入口与补给链路已完成**：十章 `playable`、战役可启动、序幕购买与幕间划补给落地；账本 `earlyAccess`，逐条核对与浏览器 E2E 仍是收尾项 |

粗估工作量（以已完成的二循环实际产出为标尺）：P1 ≈ 0.6×、P3 ≈ 1.0×、P4 ≈ 1.2×（机制比二循环多）、P5 ≈ 0.4×、P6 ≈ 0.5×、P7 ≈ 0.3×；P4 内部建议按「荒莽密林 → 埃兹特里 → 命运之线 → 界限彼端 → 久远腹地（上/下）→ 天机之城 → 幽嘶深渊 → 破碎永世 → 时间倒流」推进，先易后难，把幽嘶深渊与破碎永世留在机制稳定之后。

## 4. 每批次的完成定义（DoD）

1. `npm run test:tfa` 与 `npm run audit:tfa` 通过；新增测试文件同步登记进 `tests/suites.mjs`（`suite-manifest.test.mjs` 会守住漏登记）。
2. 新脚本同步加入 `games/arkhamhorror/package.json`（`test:tfa:*` / `audit:tfa:*` / `import:tfa-story*`）。
3. `audit/tfa-migration.json` 由 `npm run audit:tfa:write` 重生成，不手改；`milestone`、`verifiedScope`、`remaining` 随之更新。
4. `README.md` 进度表与叙述、构筑池数字同步。
5. 任何简化或未覆盖分支写进 `remaining`，对应 `literalCardBehavior` 保持 `false`；不得用「代码里出现卡号」充当实现证据。

## 5. 基线健康（P0 已完成，2026-10-19）

修复前实测：`tests 1763 / pass 1756 / fail 7`，`npm run presentation:check` 退出码 1。7 项失败均与三循环无关，但会让迁移规范要求的「最低验证命令」长期非绿。现已全部处理：

| 失败项 | 实际成因 | 处理方式 |
| --- | --- | --- |
| `tests/hall-online.test.mjs` | 仓库从未安装依赖：`relay/` 解析不到 `ws`（root `devDependencies` 已声明） | 在仓库根与 `games/arkhamhorror` 执行 `npm install`（workspaces 把 `ws`/`sharp` 提升到根 `node_modules`） |
| `tests/image-translation.test.mjs` | 同上，缺 `sharp`（`games/arkhamhorror` 已声明） | 同上 |
| `只读导入校验与未知 CLI 参数具有可靠退出状态` | 生成物落后于代码：`src/integration/attack-style.js` 在上次生成后才加入，`resourceVersion` 因此变化 | 逐项核对后 `node tools/import-cards.mjs --write` |
| `N1 输出稳定且逐项关闭差集，不覆盖 N0 冻结报告` | 同上 | 同上；已确认 N0 冻结报告 `audit/resource-report.json` 字节未变 |
| `媒体许可登记保留，运行时图片仅在 Mod 图库…` | `docs/images/screenshot-table.jpg` 是 README 插图，落在白名单外 | 在测试中把 `docs/images/` 登记为文档插图例外（与 `public/avatars`、符号字体同类处理），文件保留 |
| `展示资源生成工具默认只读…` | `audit/presentation-report.json` 记录的实现文件哈希过期 | 审阅后 `node tools/build-presentation.mjs --write` |
| `Core 验收清单严格对应 183 条原始基础包记录` | 账本记录的 4 个测试文件哈希过期（`Stale evidence`） | 复跑 `node tools/audit-core-acceptance.mjs --write`，183/183 证据重新校验通过 |

**生成物差异范围（已核对，非内容变更）**：

- `src/cards/cards-data.js` 仅 `resourceVersion` 一行变化，5 930 张卡的数据逐字段一致（比对过 `catalog/sources/*.json` 与 `catalog/provenance.json`，均字节相同）。
- `audit/catalog-report.json` 变化 147 行，全部是 `implementationFiles` 的 `bytes`/`sha256` 与新增的 `attack-style.js` 条目，加 `resourceVersion`；`summary` 与 `coverage` 计数完全一致。
- `audit/presentation-report.json` 变化 14 行，是 `catalog.resourceVersion` 与实现文件哈希；`presentationVersion`、图源统计未变。
- `audit/core-acceptance.json` 变化 8 行，仅 4 个测试文件哈希；`src/cards/core-acceptance.js` 仅 `CORE_ACCEPTANCE_SHA256` 常量跟随变化。

**修复后实测**：`npm test` 1 775/1 775 通过（退出码 0）；`npm run test:hall` 79 通过 / 1 跳过（macOS 脚本需 bash）；`presentation:check` `drift: []`；`import-cards --check` 退出码 0；`audit:tfa --check` 与 `test:tfa`（6/6）仍通过。

**遗留**：Playwright 浏览器二进制未安装（缓存为空），`npm run test:browser` 与 `.browser.mjs` 用例需先执行 `npx playwright install`；该项不属于 `npm test`，未纳入 P0。

### M2-B 收尾实测（逐文件执行）

`node --test` 会为每个测试文件启动子进程，当前 DSH 沙箱禁止管道式 `spawn`（`EPERM`），因此改用「每个文件一个继承 stdio 的子进程」逐文件跑完 80 个测试文件：

- **用例 1 902 个：1 895 通过，7 个未执行**。7 个全部是「CLI 退出状态」类用例（`audit-resources --help/--unknown`、`import-cards --check`、`build-presentation --check`、`fetch-images --verify`、`import-carcosa-story --check/--unknown`），它们在测试里用 `spawnSync` 启动子进程，沙箱内 `status` 恒为 `null`。这 7 条断言已逐个用同一命令直接复核：`--help` 退出 0、`--bogus` 退出 1、`import-cards --check` 退出 0、`build-presentation --check` `drift: []`、`fetch-images --verify --limit=1` `readOnly: true/contentComplete: true` 退出 0、`import-carcosa-story --check` 退出 0 且 `--unknown` 退出 1。
- 生成物在 M2-B 收尾后重新生成并复核：`import-cards --check` 退出 0（`strictAccepted` 404 → 438）、`build-presentation --check` `drift: []`、`audit:tfa --check` 退出 0。
- `node tools/audit-core-acceptance.mjs --check` 同样依赖子进程，沙箱内不可执行；`tests/core-ledger.test.mjs`（账本哈希校验）在同一次逐文件回归中通过。


### M3 收尾实测（`node tools/run-tests.mjs all`，M3 时点）

- 全量 **2 198 用例 / 2 196 通过 / 0 预期外失败**。整套回归在本次会话里用 `node tools/run-tests.mjs <tier>`（`spawnSync` + `stdio: 'inherit'`）直接执行，不再需要按文件拆开跑；此前记录的「CLI 子进程用例在沙箱内不可执行」在 `danger-full-access` 下已消失。
- 新增/更新的 TFA 测试文件 19 个：`tfa-untamed-wilds`(15) `tfa-doom-of-eztli`(31) `tfa-threads-of-fate`(26) `tfa-boundary-beyond`(23) `tfa-heart-of-the-elders-part1`(32) `tfa-heart-of-the-elders-part2`(24) `tfa-city-of-archives`(31) `tfa-depths-of-yoth`(28) `tfa-shattered-aeons`(33) `tfa-turn-back-time`(28) `tfa-story`(9) `tfa-scenario-acceptance`(3) `tfa-engine-integration`(2) `tfa-engine-setups`(10)，加上既有的 `tfa-migration`(6) `tfa-investigators`(31) `tfa-mechanics`(11) `tfa-player-acceptance`(86)。
- 引擎改动 3 处，均为向后兼容的钩子：`doExplore` 新增 `beforeExplore` 拦截、`damageEnemy` 新增 `enemy.tfaDamageReduction` 减伤字段、`scenarioRuntime` 暴露七项机制入口。改完按 P0 流程重新生成了 `src/cards/cards-data.js`（仅 `resourceVersion` 变化）、`audit/catalog-report.json` 与 `audit/presentation-report.json`，`import-cards --check`、`build-presentation --check`（`drift: []`）与 `audit-core-acceptance --check`（183/183）均通过。
- 迁移审计：`tools/audit-tfa.mjs --write` 生成 `audit/tfa-migration.json`（`milestone: M3`），`tools/audit-tfa-scenarios.mjs --write` 生成 `audit/tfa-scenario-acceptance.json`（10 章逐章 12 项 checks、文件哈希、`pendingEncounterCodes`、`gaps`）。两处 `--check` 与 `import-tfa-story --check` 均可重复执行。
- 诚实边界：10 章全部 `development`、`literalCardBehavior` 全部 `false`、`browserAcceptance` 全部 `false`，战役保持 `catalog-only` 且 `assertLaunchable` 抛错；剩余项见 `audit/tfa-migration.json` 的 `remaining`。

**遗留**：Playwright 配置使用系统 Edge（`channel: 'msedge'`），不需要额外下载浏览器；`npm run test:tfa:rules:browser` 与 `.browser.mjs` 用例已在 M4 跑通。

### M4 收尾实测

- `node tools/run-tests.mjs all` 全绿（见 §0 的全量回归行）；新增 `tests/tfa-rules.test.mjs`（9 个用例）登记进 `tests/suites.mjs` 与 `node-suite.mjs`。
- `npm run test:tfa:rules` 9/9；`npm run test:tfa:rules:browser` 4/4（桌面 + 移动端各 2 条，截图落在 `artifacts/tfa-migration/`）。
- 顺手把 `tests/carcosa-rules.browser.mjs` 的截图目录也改到仓库根 `artifacts/carcosa-migration/`：`presentation-images.test.mjs` 规定 PNG 验收截图不能落在游戏运行目录，两个循环现在同口径，且 `audit/carcosa` 的浏览器证据口径不变。
- `npm run audit:tfa:write` 生成 `milestone: M4`：关键词 8/8 `verified`、规则书 `verified`（含两端浏览器证据）、章节组仍 `pending`、`playable: false`。
- `npm run test:tfa` 6/6 同步更新为 M4 断言（关键词/规则书状态、`requiredRuleIds`、`remaining` 不再包含 M4 关键词项）。
- `node tools/audit-p6.mjs --write` 重新生成 P6 账本：只有 `implementationHashes` 与 `rows[].testMentions`（测试定位列表）随 M3/M4 的引擎与测试改动变化，`summary` 与 6 条限定修复结论不变，`--check` 恢复通过。

## 6. 风险与决策点

1. **探索牌库与确定性存档**：随机洗牌必须走对局随机数状态，否则 `saveReplay` 检查过不了。M3 已用「状态即牌序 + `helper.randomValue`」实现，并由每章 JSON 往返用例守住。
2. **补给语义分裂**：玩家卡 `uses(supplies)` 与战役「检查补给」必须分开建模、分开命名，规则书也要分开写。M4 在 `tfaSupplies` 条目里显式区分了两者。
3. **久远腹地上下两半**共用剧本卡 04205 与同一条混乱标记表：拆成两个注册项，标记表接受 `heartOfTheEldersPart1/2` 别名并归一到 `heartOfTheElders`，04062 的印刷数值在 `card-data.js` 统一修正。
4. **`theForgottenAge/scenarios/heartOfTheElders.json` 合订版**仍不在锁定清单内：M3-C 的生成器只读 `heartOfTheEldersPart1.json` / `heartOfTheEldersPart2.json`，合订版保持未登记，避免双来源。
5. **展示素材缺口**由 M5 承担：没有 `web/img/campaigns/theForgottenAge` 与音频目录，展示检查无法覆盖（规则书与关键词验收不依赖这些素材）。
6. **实现边界表述**：`playable` 只表示「本 Mod 已声明范围可玩」，不得描述为规则等价认证；`equivalenceCertified` 保持 `false` 直到逐条等价完成。M4 的规则书条目已按此写明「十章 development、入口不可启动」。
7. **章节 `verified` 的门槛**：账本的计算规则是「除 `browserAcceptance` 外的 11 项全真」，而 `literalCardBehavior` 需要逐张核对卡面。当前十章都有已登记的简化分支，因此全部保持 `pending`；把 gap 清单逐条清零是 M5 的收尾工作。
