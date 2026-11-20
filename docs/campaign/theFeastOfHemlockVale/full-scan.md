# 九循环《铁杉谷盛宴》全量扫描报告（2026-11-18）

> **扫描对象**：FHV（The Feast of Hemlock Vale，《铁杉谷盛宴》，战役编号 `10`，编码段 `10001`–`10743`）
> 当前 HEAD `d17d3c7` 的全量内容：**441 条印刷记录**（`fhvInvestigators` 20 / `fhvPlayer` 120 / `fhvCampaign` 301）、
> 5 位调查员与 15 张专属/绑定依赖、120 张一般玩家卡、301 张战役卡（102 地点 / 68 敌人 / 13 敌人-地点 /
> 37 诡计 / 24 幕 / 24 议程 / 34 剧情资产 / 10 剧本参考 / 1 其他）、12 个场景模块（4 序曲 + 8 章）、
> 18 个共享遭遇组、战役层流程与尾声。
>
> **扫描方式：独立复核，不采信迁账本结论。** 不采信 `audit/fhv-*.json` 的 `verified`/`match`、README 勾选
> 或测试标题；只采信「印刷卡文（英/中） + 当前工作区实现 + 引擎读点 + 可复现的真实引擎探针」。
> 逐卡语义复核由 10 个分片（4 个玩家/调查员片、6 个战役片、3 个场景片）与 Lead 机械审计并行完成，
> Lead 对每个 high 级发现逐条做真实引擎复现。
>
> **数据与复现**：工作区 `G:/boardgame-hall-ai/artifacts/fhv-scan/`
> （`data/` 机械账本与探针结果、`scripts/` 全部可复现探针、`probes/` 分片临时探针、`findings/` 分片逐卡 JSON）。
> 扫描阶段**未修改 `games/arkhamhorror` 源码与账本**；全部新文件只写 `artifacts/fhv-scan/`。
>
> **工作区说明**：扫描进行期间，工作区还出现了另一批与本扫描无关的未提交改动
> （`web/audio/music/**` 媒体/曲目表、`web/scenario-music.js`、`web/img/campaigns/theFeastOfHemlockVale/**`、
> `web/img/thumbs/**` 等，为九循环音乐/素材同步）。这些改动不影响卡牌与关卡逻辑；涉及
> `build-presentation.mjs --check` 的证据按「并发改动」单独记账，不计入 FHV 内容缺陷。

## 0. 结论

**一句话**：441 条记录的数据层一致性与大部分卡牌/关卡实现质量明显高于账本所声明的「全部 verified」口径，
但当前 HEAD 存在 **4 个 P0（真实引擎可复现：1 个章节核心循环崩溃、2 个无 seat 选择软锁、1 个遭遇卡未注册崩溃、
1 个全灭结局崩溃）**、以及若干 P1（终章尾声文本错、审计门禁不可复现、关卡验收测试非真实引擎）和
P2（201 个无读点声明、187 个条目中文硬编码、证据披露口径）。**P0 全部位于正常游玩路径上**，
说明既有「P8 完整路线」验收依赖 `debug.endScenario` 跳过实际关卡玩法，不能作为「关卡可跑通」的证据。

| 指标 | 数值 |
| --- | --- |
| 记录 / 实现文件 / 已注册 | 441 / 432 / 432（9 张剧本参考卡按设计无条目） |
| 卡表数据 vs 上游 `cards_en.json` / `cards_zh-cn.json` | 字段差异 **0 / 0**，中文缺译 **0**，残留英文 **0** |
| 直写状态（R1） / 引擎卡号分支 | **0 / 0** |
| 数据层（12 关地点/敌人/幕/议程 vs 卡表） | 0 处真实不一致（负数帷幕、X 生命等印刷特例已核对） |
| 真实引擎：12 关进入并到达结算 | **12/12**（但见 P0-1/2/3/4） |
| 真实引擎：全部 60 个已声明结局 | **60/60 通过** |
| 真实引擎：55 个战役敌人 / 37 个战役诡计 | 52 / 34 可完整交互；3 敌人为背面或追击区设计；**3 诡计抽到即崩溃（P0-3）** |
| 真实引擎：140 张玩家/调查员卡 | 131/131 可结算（9 张永久/弱点卡按规则不可打出，非缺陷） |
| 无 seat 的 `api.choose` | **12 处**（writtenInRock 9 / theLostSister 3），其中 2 处已真实复现软锁 |
| 声明无读点的条目字段 | **201 个键 / 302 处声明**（printed 值与卡表漂移 0） |
| 硬编码中文动态文案 | 187 个条目 / 1030 处（说明文字、提示、日志） |
| 关卡验收测试真实性 | 12 个 `tests/fhv-scenario-*.test.mjs` 全部为合成 state + behavior 钩子级，**0 个真实引擎关卡内玩法** |
| 审计门禁（HEAD） | `npm run audit:fhv:check` **失败**；复算 `status=pending`、`playable=false`、`equivalenceCertified=false` |
| 浏览器回归（本轮补跑） | FHV 交互 18/18 通过（desktop/mobile）；P8 战役 28/28 通过（真实引擎） |

**修复顺序与验收见同目录 [`fix-plan.md`](fix-plan.md)：P0 5 项、P1 6 项、P2 7 项。**

## 1. 扫描范围与方法

### 1.1 范围与分片

| 分片 | 覆盖 | 记录数 |
| --- | --- | --- |
| investigators | 5 位调查员 + 15 张专属/签名/绑定依赖（10001–10018、10005b/10016a/10016b） | 20 |
| player1 / player2 / player3 | 120 张一般玩家卡（10019–10138，含 4 张基础弱点与 3 张 Research） | 40 + 40 + 40 |
| campaignRockHouse | 岩间密语 + 汉洛克庄园（幕/议程/地点/敌人/敌人-地点/诡计/剧情资产/参考卡） | 63 |
| campaignHeathSister | 寂静荒野 + 消失的姐妹 | 41 |
| campaignDepthsHollow | 深沼之物 + 扭曲空洞 | 48 |
| campaignNightFate | 最长一夜 + 山谷的命运 | 61 |
| campaignSharedA / B | 居民、The Vale、三日/休日/雨日/宴日、传家宝、林中恐怖、色彩爪牙等 18 个共享组 | 60 + 28 |
| scenarioPreludes / scenarioMidA / scenarioLate | 12 个场景模块（definition/behavior/layout/chaos/index）与指南、剧情、结束条件 | 4 + 4 + 4 章 |
| 合计 | 441 条记录全覆盖（分片无交集、并集守恒） | 441 |

### 1.2 五个维度（判定口径）

| 维度 | 名称 | 判定内容 |
| --- | --- | --- |
| D1 | 实现 vs 描述 | 每个印刷子句是否逐句落地；错值/缺分支/语义反向/只声明不实现 |
| D2 | 交互可感知 | 是否有 `legalMoves` 产出 / `pendingChoice` 提示；是否可被玩家回答；是否静默默认；动态文案 i18n |
| D3 | 关卡可跑通 | 真实引擎 setup/推进/结算/转场；behavior 钩子是否被引擎读点调用；错误处理（崩溃/软锁） |
| D4 | 原语合规 | R1 直写状态、声明即接线、卡号分支、同规则重复手写 |
| D5 | 复用/重印 | 同文卡共享实现；重印只实现一次 |

### 1.3 证据与复核

- **印刷文本**：`src/cards/cards-data.js` 的 441 条记录与上游 `参考资源/ArkhamHorror-main/frontend/public/cards_en.json`、
  `cards_zh-cn.json` 逐字段比对（名称/正文/背面/特性/费用/经验/槽位/技能图标/敌人数值/帷幕/线索/毁灭/Victory）。
- **实现读点**：逐卡沿「条目文件 → `content/campaigns/theFeastOfHemlockVale/**` → `src/engine/**`」确认读点；
  参考实现（Haskell）只作行为对照，不作权威。
- **真实引擎探针**（Lead，全部可复跑，见 §9）：
  `probe-scenarios.mjs`（12 关进入/推进/结算）、`probe-depth.mjs`（rounds/agenda-first/逐地点揭示/敌人交互四策略）、
  `probe-resolutions.mjs`（全部 60 个声明结局）、`probe-encounter-registry.mjs`（遭遇牌库逐张真实抽取）、
  `probe-cards.mjs`（55 敌人 + 37 诡计 + 140 玩家卡的引擎冒烟）、`probe-actions.mjs`（每关 legalMoves 场景行动）。
- **机械审计**：`screen.mjs`（数据保真/R1/卡号分支/i18n/测试真实性）、`dead-declarations.mjs`（声明读点与 printed 漂移）、
  `scan-seatless-choices.mjs`（无 seat 选择）、`probe-registration-gaps.mjs`（场景引用卡号的注册闭包）、
  `evidence-traceability.mjs`（账本 file:line 可追溯）、`hook-wiring.mjs`（引擎钩子 vs 场景导出）。
- **浏览器**：本轮在 HEAD 补跑 `tools/run-fhv-interactions-browser.mjs`（18/18 通过）与真实引擎 P8 战役测试（28/28 通过）。
- **复核规则**：分片审计员的每条 high 都由 Lead 用真实引擎探针重新复现后才写入 §4；不能复现的降级或标 `needs-review`。

### 1.4 与迁移账本的口径差异

迁移账本（`audit/fhv-migration.json` 等）把「条目存在 + 测试通过 + 账本自洽」视为 `verified`；
本报告只把「**真实引擎里玩家可达并产生正确结果**」视为通过。因此本报告出现两类账本中不存在的结论：
① 大量 `scenarioData` 卡「有测试、有账本、有行为文件」但真实执行会崩溃/软锁；
② 账本自身的 `verified` 在 HEAD 无法复算（见 §5 P1-2）。

## 2. 机械一致性（可复算）

### 2.1 卡表数据与上游一致

441 条记录与上游英文/中文卡表逐字段比对：**英文差异 0、中文差异 0、缺译 0、残留英文 0**。
比对口径见 `artifacts/fhv-scan/scripts/screen.mjs`（`<b>/<i>` 等标签在导入时已剥离，比对时同样剥离；
特性按点号拆分排序；技能图标按 `icons` 对象归一；敌人数值映射 `enemy_*`）。

### 2.2 数据层（战役卡印刷数据）

12 个场景模块内嵌的地点/敌人/幕/议程记录与卡表逐项比对：帷幕、线索、胜利点、敌人战斗/闪避/伤害/恐惧、
幕/议程阶段与毁灭阈值。**无真实不一致**；少数差异全部是印刷特例且有实现说明：
负数帷幕/负生命表示「动态值」（如 `10625` 的 X=黑暗等级、`10532–10535` 的帷幕式地点），
`10625` 卡表把伤害/恐惧记为 0 而 definition 按印刷覆盖为 1/1（注释已披露）。
见 `artifacts/fhv-scan/data/probe-data-layer.json`。

### 2.3 原语合规基线

- R1 直写状态：432 个实现文件中 **0 处**（与 `audit/entries` 基线一致、且无 FHV 新增）。
- 引擎卡号分支：`src/engine/**` 中 FHV 卡号字面量 **0 处**。
- 注册闭包：441 条记录中 432 条有实现文件且全部进入生成索引；9 条剧本参考卡（10501/10502/10523/10549/
  10569/10588/10605/10626/10704）按设计无条目（与上游 `CampaignSteps.hs` 的 ScenarioStep 口径一致）。
- 账本证据可追溯：`audit/fhv-*.json` 中 822 条 `文件:行号` 引用除上游参考路径外全部可解析（`evidence-traceability.mjs`）。

### 2.4 声明即接线（D4）

`dead-declarations.mjs` 抽出 FHV 条目里的 1960 条声明（480 个键），扣除在 `src/engine`、`content`、`web` 中
有真实读点的键后，**201 个键 / 302 处声明**没有任何引擎或内容读点（`dead: 201`），另有 8 个键只有测试在读。
典型类别（全部有 `文件:行号` 证据，详见 `data/dead-declarations.json`）：

- **场景数据第二事实源**：`spawnDirection`（10 张混种，behavior 实际读 `definition.js#ENEMY_SPAWN_DIRECTION`）、
  `printedCluesPerInvestigator`（10 张地点）、`controlBonus`（10 张居民）、`parleySetAside`（7 张居民背面）、
  `printedFight/Evade/Health/Damage/Horror/Victory`（菌类等 5 张敌人）。
- **无读点的规则键**：`cannotBeMoved`、`cannotMakeAttacksOfOpportunity`、`pairedLocationCode`、
  `preludeOnly`、`nightOnlyKeywords`、`failByChoicePerPoint`、`calendarRecord`、`setAsideOnSetup` 等。
- **printed 值与卡表漂移 0**（这批重复声明的数值与卡表一致，风险是未来漂移而非当前错值）。
- **函数/对象契约错位**：`theLongestNight/behavior.js:1191` 把 `spawnOverrides` 导出为函数，
  而引擎 `enemies.js:418` 按对象下标读取 `spawnOverrides?.[code]`，该钩子实际从未被调用（`probe-depth` 已证明
  该关 12 个敌人靠 `spawnLocation` 正常生成，故无当前行为缺陷，属死声明）。

### 2.5 i18n（D2）

FHV 条目与章节行为中的玩家可见动态文案（`label`/`prompt`/`api.info`/`message`）**187 个条目共 1030 处中文硬编码**，
无英文回退键（示例：`src/cards/entries/10021.js` 的 attack label、`10005.js` 的翻面提示、`hemlockHouse`
法典提示等）。`web/locales/en.*` 与 `web/locales/zh-CN.*` 只覆盖界面骨架，不覆盖条目动态文案；英文界面玩家会看到中文。
与既有 TIC/TCU 等循环同口径问题，本轮登记为 P2（见 fix-plan P2-6）。

### 2.6 关卡验收测试真实性（证据质量）

`tests/fhv-scenario-*.test.mjs`（12 个文件、约 1.1 万行）**全部**使用 `stateFor()` 合成 state + 直接调用
`chapter.behavior.*` 钩子，**没有任何一个用例启动真实引擎进入该关卡**（对照：3 个文件直接 `createGameState`，
20 个文件用 `tests/core-fixture.mjs`）。P8 战役 E2E 虽然真实驱动 hub，但每章以 `debug.endScenario` 结束，
同样跳过关卡内玩法。这解释了为什么 P0-1/2/3/4 能在「逐章 12/12 verified」的账本下存活。

## 3. 真实引擎探针结果

### 3.1 12 关进入与结算

`probe-scenarios.mjs`：生产组合根 `content/registered.js` + `createGameState({campaignId, campaignHub:true})`
→ `debug.scenario` 进入每一关，结果 **12/12 可进入**，setup 均含地点/幕/议程/混乱袋/结局表；
12/12 在推进幕与议程后到达 `scenarioResult`。setup 摘要（地点/幕/议程/遭遇牌堆张数）：

| 关卡 | 地点 | 幕 | 议程 | 遭遇牌堆 | 备注 |
| --- | --- | --- | --- | --- | --- |
| welcomeToHemlockVale | 8 | 1 | 1 | 0 | 序曲无遭遇牌堆（设计） |
| writtenInRock | 5 | 2 | 2 | 23 | **幕 1 背面即软锁（P0-2）** |
| hemlockHouse | 10 | 2 | 3 | 22 | **议程推进崩溃（P0-1），洗入诡计崩溃（P0-3）** |
| theSilentHeath | 3 | 2 | 2 | 41 | 通过 |
| theLostSister | 4 | 3 | 2 | 29 | **诡计揭示软锁（P0-2）** |
| theThingInTheDepths | 9 | 2 | 2 | 29 | 通过 |
| theTwistedHollow | 5 | 2 | 1 | 28 | 通过（1 张敌人按规则进入追击区） |
| dawnOfTheSecondDay | 8 | 1 | 1 | 0 | 序曲无遭遇牌堆（设计） |
| theLongestNight | 10 | 1 | 1 | 33 | **全灭结局崩溃（P0-4）** |
| dawnOfTheFinalDay | 8 | 1 | 1 | 0 | 序曲无遭遇牌堆（设计） |
| preludeTheFinalEvening | 8 | 1 | 1 | 0 | 序曲无遭遇牌堆（设计） |
| fateOfTheVale | 4 | 2 | 3 | 28 | 通过 |

### 3.2 四策略深探（rounds / agenda-first / 逐地点揭示 / 敌人交互）

`probe-depth.mjs` 对 12 关各跑四套策略：回合推进（4 回合、遇遭抽牌、敌人阶段）、议程优先推进、
逐地点揭示、逐敌人生成+移动+攻击/闪避。结果：

- 逐地点揭示、敌人交互：**12/12 无错误**（55 张战役敌人中 52 张可生成并交互；3 张为背面/追击区设计）。
- 回合推进：9/12 通过；hemlockHouse 崩溃（P0-1）、theLostSister 软锁（P0-2）、theLongestNight 崩溃（P0-4）。
- 议程优先：11/12 通过；writtenInRock 软锁（P0-2）、hemlockHouse 崩溃（P0-1）。

### 3.3 结局与遭遇卡

- `probe-resolutions.mjs`：12 关 **60 个已声明结局 key** 全部可结算（无异常）；但引擎「全员被击败」
  兜底路径使用 `noResolution`，`theLongestNight` 未声明该 key（P0-4）。
- `probe-encounter-registry.mjs`：58 张战役敌人中 55 张进 `ALL_ENEMIES`（3 张未进的是调查员签名敌人/
  背面），40 张战役诡计中 34 张进 `ALL_TREACHERIES`；**10545/10546/10743 三张诡计未注册**，
  真实抽取抛「未知遭遇卡」（P0-3）；其余场景遭遇牌库逐张抽取均正常。
- `probe-cards.mjs`：140 张玩家/调查员卡在真实引擎夹具中 131/131 可结算
  （9 张为永久卡/基础弱点，按规则不可从手牌打出，属探针预期而非缺陷）。

### 3.4 场景行动可达性（D2）

`probe-actions.mjs`：进入每关后真实 `legalMoves` 均产出场景行动（`scenarioAction`），
数量与 `behavior.actions` 返回的声明一致（例：welcome 2、hemlockHouse 3/4、theLongestNight 6、fateOfTheVale 0 起步）。
可见「剧本书动作/关卡特殊行动」在引擎层是可达的；玩家不可达的问题集中在 **选择没有 seat 无法回答**（P0-2）
与**章节核心循环崩溃**（P0-1、P0-3、P0-4）。

## 4. P0：真实引擎可复现的崩溃与软锁

> 每条均给出复现脚本（相对 `games/arkhamhorror/` 执行）与真实堆栈/状态证据；
> 修复步骤见 [`fix-plan.md`](fix-plan.md) §P0。

### P0-1 汉洛克庄园：敌人-地点翻面抛「未知机制字段 massive」，章节议程推进即中断

- **现象**：进入 `hemlockHouse` 后推进议程（议程 1 → 2）时抛
  `TypeError: 未知机制字段 massive`，对局中断；回合推进中敌人-地点翻面同样崩溃。
- **证据**：
  `content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js` 的 `enemyLocationFace()`
  固定带 `massive: true`（`ENEMY_LOCATION_FACES`），`CELLAR_ENEMY_FACE` 另带 `singleSided: true`；
  `content/.../hemlockHouse/behavior.js:436` 调 `api.turnLocationIntoEnemy(location.id, face, …)`；
  引擎 `src/engine/enemy-location.js:5-16` 的 `validateEnemyFace` 只允许
  `code/name/nameEn/shroud/traits/fight/evade/health/damage/horror/victory/retaliate/alert/elite`，
  `assertFields` 见 `src/engine/mechanic-state.js:33` 抛错。真实堆栈：
  `turnLocationIntoEnemy → flipToEnemySide → flipNearestDormantToMostInvestigators → agendaReveal`。
- **复现**：`node artifacts/fhv-scan/scripts/debug-hemlock-agenda.mjs`
  （议程推进崩溃）；`node artifacts/fhv-scan/scripts/probe-depth.mjs`（rounds 策略同样崩溃）。
- **影响**：汉洛克庄园的议程/敌人-地点核心循环不可玩；「本章可通关」不成立。
- **修法方向**：引擎 `validateEnemyFace` 接受并忽略内容层的派生关键词（`massive`/`singleSided` 等，
  引擎本就会强制 `massive:true`），或内容层从 face 对象剔除这些字段；补真实引擎回归（议程推进 + 翻面）。

### P0-2 writtenInRock / theLostSister：`api.choose` 未传 seat → 无 seat 的 pendingChoice，玩家无法回答（软锁）

- **现象**：真实引擎在以下位置产生 `pendingChoice`，`pendingChoice.seat` 为 `undefined`，
  `actingSeats()` 返回 `[undefined]`，`legalMoves` 不产出任何 `choose` 动作 → 对局永久卡住（只能重开）。
- **证据**：`content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/behavior.js:525-535`
  （矿车朝向）、`:703`、`:744`、`:1084`、`:1096`、`:1164`、`:1276`、`:1343`（共 9 处）、
  `.../theLostSister/behavior.js:797`、`:853`、`:1316`、`:1349`（共 3 处）的 `api.choose({...})` 均未带 `seat`；
  `src/engine/scenario-runtime.js:1656/1660` 的 `choose/choice` 直接 `requestChoice(state, request)` 不补默认值；
  `src/engine/resolution.js:66-106` 无 seat 时 `choiceSeats = [undefined]`。
- **真实复现**：`probe-scenarios.mjs` 已复现两处玩家可达路径：
  ① writtenInRock 幕 1 背面（塌方）选择矿车朝向 → `seatless choice mineCartFacing/10507`；
  ② theLostSister 抽到诡计 `10586`「重属自然（白日）」→ `pendingChoice` 无 seat。
- **影响**：writtenInRock 在第一个幕间就软锁（矿车朝向是必然流程）；theLostSister 的诡计 10586/10587
  抽到即软锁。两章均不可正常通关。
- **修法方向**：内容层 12 处补 `seat`（通常 `inv.seat` 或 `state.campaign.leadSeat`）+
  引擎层 `requestChoice` 对缺失 seat 兜底（`state.currentSeat ?? leadSeat`）+ 静态检查（`api.choose` 必须带 seat）
  + 真实引擎回归（把两关推进过这些节点）。

### P0-3 汉洛克庄园/最长一夜/终章：放一边后洗入遭遇牌库的 3 张诡计未注册，抽到即「未知遭遇卡」崩溃

- **现象**：`10545 墙外奇物`、`10546 拖离正道`、`10743 “着火了！”` 三张诡计不在生产 `ALL_TREACHERIES`；
  它们按印刷被放一边，随后由章节效果洗入遭遇牌库（汉洛克庄园议程 1b「活着的庄园」、最长一夜的火、
  终章火焰），**抽到即抛 `未知遭遇卡` 中断对局**。
- **证据**：三张卡的遭遇定义未进入任一场景 `encounterDefinitions([...])` 列表——
  `content/.../hemlockHouse/definition.js:491-497` 只传 `ENCOUNTER_DECK_CODES`（已排除
  `SET_ASIDE_TREACHERY_CODES`）与少数剧情卡；`theLongestNight/definition.js:233`、`fateOfTheVale/definition.js:309`
  同理。`content/.../hemlockHouse/behavior.js:1464-1470` 把 10545/10546 洗入牌库；
  `theLongestNight/behavior.js:993` 用 `api.drawEncounter(..., { code: 10743 })` 抽火。
  真实注册检查：`probe-encounter-registry.mjs`（`treacheriesRegistered: 34/40`）。
- **真实复现**：`node artifacts/fhv-scan/scripts/repro-set-aside.mjs`；
  或对任意 FHV 关卡执行 `debug encounter` 直接抽 `10545/10546/10743` → `未知遭遇卡：<code>`。
- **影响**：汉洛克庄园议程 1 背面之后遭遇牌库含未注册卡（必然崩溃）；最长一夜的火焰行动/终章火焰同样。
- **修法方向**：把三张「放一边后洗入/抽出」的诡计加入对应场景的 `encounterDefinitions`（保留 set-aside 语义），
  并加机械门禁：每关 `ENCOUNTER_DECK + SET_ASIDE_CARDS + 章节行为字面量卡号` 必须全部在
  `ALL_ENEMIES/ALL_TREACHERIES/cardDef` 注册闭包内。

### P0-4 最长一夜：全员被击败 → 引擎请求 `noResolution`，章节未声明该结局 → 「未知剧本结局」崩溃

- **现象**：最长一夜中调查员被敌人攻击击败（正常玩法路径），`checkOutcome` → `finishScenario('noResolution')`
  抛 `Error: 未知剧本结局`，战役无法结算。
- **证据**：`src/engine/harm-threat.js:374-381` 在无存活调查员时固定调用 `finishScenario('noResolution')`；
  `src/engine/campaign-flow.js:246` 要求 `Object.hasOwn(state.scenario.resolutions, key)`；
  `theLongestNight/definition.js:306` 的 `resolutions` 只有 `investigatorDefeat/resolution1-4`，
  **缺 `noResolution`**；`behavior.js:1704-1719` 自己把 `noResolution` 映射到 `resolution3`/`investigatorDefeat`，
  但引擎在调用行为前就抛错。真实堆栈（`debug-longest-night.mjs`）：
  `enemyAttack → applyHarm → checkDefeated → checkOutcome → finishScenario`。
- **复现**：`node artifacts/fhv-scan/scripts/debug-longest-night.mjs`（2–3 回合内必然复现）。
- **影响**：最长一夜全灭（真实可能）时崩溃，战役不可结算；同型风险：`welcomeToHemlockVale` 与
  `dawnOfTheSecondDay` 也缺 `noResolution`（当前幕文本写「调查员不能被击败」，暂不可达，但属潜在同类）。
- **修法方向**：`theLongestNight` 补 `noResolution` 结局（正文用 `investigatorDefeat`，behavior 已有映射）；
  两段序曲同样补齐为防御；引擎侧可选：`noResolution` 缺失时按 manifest 统一兜底并记日志；补全灭回归。

### P0-5 寂静荒野：任何敌人攻击后都被击败（判据把常量卡号当条件），章节核心循环反转

- **现象**：真实引擎中，寂静荒野的敌人攻击一次后立即被击败并进入胜利区。实测同时生成
  `10563 无彩幼虫 / 10564 族群兵虫 / 10565 族群虫后`，一回合内三个敌人全部消失，
  `victoryDisplay` 变成 `10563,10564,10565`；族群虫后（Boss，Victory 2）攻击一次即死，关底战失效。
  印刷上只有 10563「攻击后击败它」这一条。
- **证据**：`content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/behavior.js:952`
  写作 `codeOf(enemy) === COLORLESS_LARVA_CODE || flagIs(COLORLESS_LARVA_CODE, 'defeatAfterAttack')`
  ——第二个操作数与**攻击者**无关，而 10563 条目恒定声明 `defeatAfterAttack: true`
  （`src/cards/encounter-entries/.../theSilentHeath/10563.js:5`），因此条件对任何敌人都恒真；
  引擎在每次敌人攻击结算后调用该钩子（`src/engine/enemies.js:335`）。
- **复现**：`node artifacts/fhv-scan/scripts/verify-silentheath-attack.mjs`
  （输出 `round 2: enemies=none`、`victoryDisplay ["10563","10564","10565"]`）。
- **影响**：寂静荒野的敌人威胁与关底战被反转（敌人自杀、胜利点白送），章节结论不可信。
- **修法方向**：判据改为 `flagIs(codeOf(enemy), 'defeatAfterAttack')`（保留 10563 卡号判断即可），
  补真实引擎回归：非 10563 敌人攻击后仍在场、10563 攻击后进胜利区（Victory 0）。

### P0-6 面具「每个牌组仅限 1 张」：`legalMoves` 暴露第二张 Mask、`applyMove` 抛异常（合法动作崩溃）

- **现象**：控制任意 `[[Mask]]` 支援后，第二张 Mask 出现在 `legalMoves`（显示「装备…」），
  `validateMove` 返回可打出，但 `applyMove` 抛 `Error: 没有合法的槽位替换方案` —— 玩家点合法按钮即崩溃。
- **证据**：`src/cards/entries/10111.js`（破碎冠冕，未简化披露）、`10133/10134.js` 的
  `controlledTraitLimit` / `singleInvestigatorNoSlot` 类声明；引擎
  `src/engine/engine.js:2667` 的 `canEquip || assetReplacementPlans` 与 `src/engine/assets.js:212`
  在 apply 阶段才失败，`legalMoves`/`validateMove` 没有同一前置校验；
  复现脚本 `artifacts/fhv-scan/probes/p3-mask-crash.mjs`（实测 `first mask in play: [10111]` →
  `legalMoves exposes second mask` → `validateMove: ok` → `applyMove THREW`）。
- **影响**：玩家可正常获得第二张 Mask（10111 未近似披露），点击即崩溃；属于「合法动作」级引擎不一致。
- **修法方向**：把槽位/唯一性限制前移到 `play` 的合法性判定（`legalMoves`/`validateMove` 与
  `applyMove` 同一判据），或让 `applyMove` 以「非法动作」拒绝而非抛异常；补引擎回归（两张 Mask 同时入手）。

### P0-7 终章《山谷的命运》主线不可达（幕 1 目标永假 + 幕 3 永不揭示）

- **现象**：终章幕 1 的「每位调查员都取回真正的调查员卡」目标永远不满足，玩家没有推进幕的动作；
  幕 3a 也永不揭示（`advanceToAct3` 设 `actIndex=2` 后引擎再 `++` 越过 3 张幕牌库），
  `actReveal → api.finish(R1–R5)` 永不执行 → 5 个印刷胜利结局全部不可达，只剩议程 3 背面的 `noResolution`。
- **证据**：`fateOfTheVale/behavior.js:221` 写扁平键 `fateTrueSelfReturned:${seat}`、`:956` 读对象键
  `flagsFor(state).fateTrueSelfReturned?.[inv.seat]`；`:826-833` 的 `advanceToAct3` 与引擎
  `src/engine/act-agenda.js:66-80` 的无条件 `actIndex++` 冲突。复现：`findings/scenarioLate.json`（FV-1/FV-2）
  与 `probes/probe-scenarioLate-focus6.mjs`。
- **影响**：终章主线与胜利结局不可达；与 P1-1/P1-14 的尾声缺陷叠加后，「完整战役」在终章断裂。
- **修法方向**：统一该记录的读写形状；`advanceToAct3` 改用 `actIndexAfterAdvance` 钩子或修正索引；
  补终章真实引擎回归（幕 1→2→3a→R1–R5）。

## 5. P1：高严重度规则错误、叙事与证据（16 项）

> 严重度口径：high = 规则相反/关键内容不可达/关键状态错误；medium = 明确偏差、数值或分支错但可玩；
> low = 文案/披露/复用。每条给出分片证据与（若有）Lead 复现。「已披露」指迁移账本/条目 note 已登记为近似。

| # | 问题 | 严重度 | 关键证据 | 来源 |
| --- | --- | --- | --- | --- |
| P1-1 | 终章尾声把 3 个互斥结局全部拼接，且固定追加 epilogue1（实测 1515 字、epilogue1 出现 2 次） | high | `epilogue.js:101-102,166-167`；`flow.js:445-465` | Lead + campaignLayer |
| P1-2 | 审计门禁在 HEAD 不复现：investigators 账本哈希漂移、复算 `status=pending/playable=false` | high（账本层） | `audit/fhv-investigators.json` sources；`data/audit-fhv-computed.json` | Lead |
| P1-3 | 12 个关卡测试全部为合成 state + 直接钩子，0 个真实引擎关卡内玩法；P8 用 `debug.endScenario` 跳过 | high（证据质量） | `tests/fhv-scenario-*.test.mjs`；`data/screen.json.testAuthenticity` | Lead |
| P1-4 | theLostSister：10586 永远走 (Day) 面（不存在的 `api.isDarkLocationHere`）、10587 整卡无附属建立点、10579/10585 等声明未接线、10583a/10584a/b 翻面后生命双计（实测 11 vs 8）、10570 议程毁灭双记（2×天数） | high/medium | `theLostSister/behavior.js:1374,1515,396,1116-1122`；`findings/campaignHeathSister.json` | 分片 + Lead 复现生命双计 |
| P1-5 | writtenInRock：Ally/Resident 按实例 traits 判定（引擎只在 cardDef 上）、12 张敌人-地点 per-investigator 生命无读点、10503 doom-to-next-agenda flag 名不匹配、10508 进入费与 10522/10548 反应未接线 | high/medium | `findings/campaignRockHouse.json`、`scenarioMidA.json` | 分片 |
| P1-6 | 混乱标记「If you succeed」用标记修正前的 `failedBy`（引擎 onDraw 契约），hard/expert 的 [cultist] 在必败检定时也成功结算 | medium | `src/engine/skill-effects.js:111`；`theSilentHeath/behavior.js:1648`；`theLostSister/behavior.js:1216` | 分片 + Lead 代码核对 |
| P1-7 | 声明即接线：201 键 / 302 处声明无引擎/内容读点；`spawnOverrides` 函数 vs 对象错位；printed 漂移 0 | medium | `data/dead-declarations.json`；`theLongestNight/behavior.js:1191` vs `enemies.js:418` | Lead |
| P1-8 | 英文界面条目动态文案仍为中文（187 条 / 1030 处硬编码） | medium（i18n） | `data/screen.json.i18n` | Lead |
| P1-9 | 寂静荒野/其他：10558/10559/10560 地点自有行动/反应缺失、10575 谈判不可翻牌、10557 起始地点揭示检定不可达、10549 可选变强制等 | medium | `findings/campaignHeathSister.json` | 分片 |
| P1-10 | 欢迎序曲：开场选择的 [tablet]/[elder_thing] 混乱标记从未进袋（preScenarioSetup 早于 setupChaosBag 被覆盖） | high | `welcomeToHemlockVale/behavior.js:785-795`；`src/engine/setup.js:830,836`；Lead 真实引擎复现 | Lead + 分片 |
| P1-11 | 最终之夜：8 条地点法典（9–16）无 actions/performAction 入口，玩家不可达 | high | `preludeTheFinalEvening/behavior.js:1617-1689`；`10705a.js:16-30` | 分片（真实引擎探针） |
| P1-12 | 汉克 10016a/10016b：无 per-window limit 的反应被窗口循环重复结算 12 次（一次恐惧抽 12 张 / 一次 2 伤害 +24 资源） | high | `10016a.js:68`、`10016b.js:67`；`src/engine/ability-exec.js:363`；Lead 复现 10016a | 分片 + Lead |
| P1-13 | 第二段纯叙事夜：指南无 body 键且回落到首夜正文（实测 501 字全为首夜）；Simeon 存亡分支未实现 → dawn3/尾声条件走错 | high | `interludes.js:234-236`；`flow.js:294-301`；上游 `TheFeastOfHemlockVale.hs:218-241` | campaignLayer |
| P1-14 | 终章结局映射与战役收尾：resolution2 被误判 devoured/defeat；`campaign.result` 与 `campaignOutcome` 相反（焚毁仍报 victory）；疲劳袋替换未落地；序曲经验可提前花/法典奖励被压平；`crossedOutResidents` 卡号 vs 居民 id、`finishedTheirMeal` 全队布尔、夜 2 resolution 全拼 | high/medium | `fateOfTheVale/behavior.js:1654/1687`、`epilogue.js:123`、`src/engine/hub.js:319-333`、`web/hub.js:1120`、`interludes.js` | campaignLayer |
| P1-15 | 最长一夜：印刷 `[action]: Resign.` 撤退不可达（legalMoves 从无 resign；卡文兜底正则不匹配） | high | `src/engine/turn-flow.js:454-459`；`findings/scenarioLate.json`（LN-2） | 分片（真实引擎） |
| P1-16 | 幕索引越界：终章 `advanceToAct3` 与扭曲空洞幕 2 背面后 actIndex 越过 acts 队列（同一模式） | high/medium | `fateOfTheVale/behavior.js:826-833`、`act-agenda.js:66-80`；`findings/scenarioLate.json` TH-2 | 分片 |

补充说明：

- **P1-1** 的修复要点：节点只绑定 `epilogue.body`，三个结局按 `fhvEpilogueBranch(records).textKey` 运行时选择；
  `FHV_EPILOGUE_BRANCHES` 与 `textKeys` 声明要么接线要么删除。
- **P1-4/P1-5** 的大部分条目在条目标注里已披露为近似（`simplified: true`），但其中
  「永远走白日面/整卡无读点/生命双计/毁灭双记」属于会改变对局结果的实现缺陷，不能只按披露放过。
- **P1-12** 的同类风险：FHV 条目里 31 条 reaction/fast 未声明 limit（`data/reaction-no-limit.json`），
  需逐条判定「每次事件一次」是否被窗口循环放大。
- **P1-14** 还包含：`manifest` 未声明 `endings` → `campaign.ending` 恒 null；最终夜 3 条
  `chaosBagTransitions` 的 `when` 永远匹配不到（死声明）；`noUpgrade` 字段无引擎读点（低）。

## 6. 逐卡/逐场景分片结果与 P2 治理

### 6.1 分片汇总（逐卡/逐场景）

| 分片 | reviewed | match | approximation | gap | blocked | issues | scenarioIssues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| campaignHeathSister | 41 | 16 | 9 | 16 | 0 | 36 | 6 |
| campaignLayer | 0 | - | - | - | - | 14 | 0 |
| campaignRockHouse | 63 | 30 | 13 | 11 | 9 | 41 | 6 |
| investigators | 20 | 11 | 7 | 2 | 0 | 15 | 1 |
| player1 | 40 | 29 | 8 | 3 | 0 | 14 | 0 |
| player2 | 40 | 17 | 19 | 4 | 0 | 27 | 0 |
| player3 | 40 | 13 | 16 | 8 | 3 | 32 | 0 |
| scenarioLate | 0 | - | - | - | - | 20 | 0 |
| scenarioMidA | 0 | - | - | - | - | 24 | 0 |
| scenarioPreludes | 0 | - | - | - | - | 18 | 0 |
| **合计** | **244** | **116** | **72** | **44** | **12** | **241** | **13** |

> 口径：`match` 全部印刷子句落地；`approximation` 主行为可用但有明确偏差（已披露或未披露见 §6.2/§6.3）；
> `gap` 有未实现子句或不可达关键效果；`blocked` 实现不可用/触发即崩溃。

### 6.2 逐场景 verdict

| 场景 | 分片 | verdict | 场景级问题数 | 主要观察 |
| --- | --- | --- | --- | --- |
| theThingInTheDepths | scenarioLate | approximation | 6 | 真实引擎跑通：debug scenario → act1 背面（鳄龟混种+触须）→ agenda1 背面（中央地点沉没+深沼之物）→ 击败深沼之物 → resolution4 → scenarioResult；另一路 agenda2 背面全灭 → noResolution → scenarioResult（noReso |
| theTwistedHollow | scenarioLate | approximation | 4 | 真实引擎跑通：进入 → 揭示全部地点（议程 1a 正面每次揭示在四方向铺树林，12 地点）/ 5 地点 → 幕 1 背面 Codex Σ → 幕 2 背面「才出虎口」→ 特殊议程 → 全撤退 → resolution1 → scenarioResult(pendingNode=dawnOfTheSecondDay)。r |
| theLongestNight | scenarioLate | gap | 6 | 真实引擎跑通：进入 → 幕背面（R1/R2 → R4）→ scenarioResult；另一路议程背面（精神创伤 → 推进幕）→ scenarioResult。resolutions 只有 investigatorDefeat/resolution1–4，缺 noResolution → 全灭分支抛错（LN-1）。合法 |
| fateOfTheVale | scenarioLate | blocked | 4 | 真实引擎跑通的部分：布置 4 镜巢/4 密使/深渊/放一边/遭遇牌库；幕 1 背面（补线索+划掉蕾切尔嬷嬷+洞穴洗入深渊）；幕 2 背面 → 幕间（无战役记录时仅 escape 可选）→ 安装幕 3a；议程 3 背面 → 全员阵亡 → noResolution → scenarioResult(pendingNode= |
| writtenInRock | scenarioMidA | blocked | 7 | 布置、牌库、混乱袋、居民/放一边均与指南一致；主要问题是幕 1 背面塌方的 seatless 选择软锁（每局必触发），以及若干未接线的幕/卡子句。 |
| hemlockHouse | scenarioMidA | blocked | 5 | 布置/12 房随机/居民/掠食袋建立均可跑；但议程 1b 的 massive 崩溃与 10545/46/10743 未注册是两个独立的高危阻断，且前者在阈值 2 就会发生。 |
| theSilentHeath | scenarioMidA | approximation | 3 | 三张起始地点、Horrors 暗牌库/暗堆、水晶残骸、荒芜 v.I/v.II、虫后与 R1–R4 链都能跑通；缺口集中在 v.II『失去巡逻』和三张洞穴地点的自有行动/反应（均为近似披露）。 |
| theLostSister | scenarioMidA | blocked | 9 | 布置、岩穴牌库/扩图、双面敌人、Act 1→2→3 背面与结局链可跑通；但 10586 的 seatless 选择是高频硬软锁，10587/10579/10582/10577-80 等条目效果未接线，10570 的 doom 记账双倍。 |
| welcomeToHemlockVale | scenarioPreludes | gap | 7 | 布置/法典行动/结局链是四段序曲里最完整的一段：8 地点、Day One、按人数放毁灭、20 张居民放一边、7 处 [action] 法典 + 老磨坊 [reaction] 都能在真实 legalMoves 里走到（probe 逐地点验证），居民经法典 9–16 入场后由共享居民条目提供谈判（probe：hemlock |
| dawnOfTheSecondDay | scenarioPreludes | approximation | 6 | 布置（Day Two、Boarding House 起点、Judith 在十字路口、划掉居民移出、按人数放毁灭）与 16 条法典、结局 1/2→3 的收束都与印刷一致；probe 里 8 处地点都能出法典行动，居民谈判走共享条目（法典 7 的「花费 X 资源」与 10699 卡面一致；法典 9 端到端出 [help/s |
| dawnOfTheFinalDay | scenarioPreludes | approximation | 3 | 本序曲是三段「黎明」里最完整的一段：地点用对（10690a/10691a + 第 3 日面）、移除名单正确、两位居民先入场、三条结局（noResolution/R1→R2）都收敛到 R2 的整备，且 fireworks tally、hunch、Bliss 二选一、2 点奖励经验都能在真实引擎里跑通（probe 逐项验证 |
| preludeTheFinalEvening | scenarioPreludes | gap | 2 | 布置段完成度很高（10688 同时作幕/议程、10690b/10691b 傍晚面、狂乱的赴宴者按人数、居民按阈值翻敌人面、Leah 因未勘察北角矿井被划掉、Bertie/Marquez 条件入场、开场三分支的 token 与记录都正确落地——probe 的 bag/campaignBag 里确实有 tablet+eld |

### 6.3 未披露 high 问题（Lead 已逐条复核/复现）

- **[10573] D3 · ✅ Lead 复现**：performAction 的 lostSisterLureFromDark 用 pickTarget 选目标，而 pickTarget 调 api.choose 时不传 seat（797 行），且即使只有一个候选也会走 choose；因此每次使用都产生无 seat 的待决选择。
  - 证据：content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js:781；content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js:797；src/engine/resolution.js:96
  - 复现：`node artifacts/fhv-scan/probes/heath-sister-lost-sister.mjs（lure → pendingChoice {prompt:'选择要拉到这里的敌人', options:['e1'], seatless:true}）`
- **[10574] D3 · ✅ Lead 复现**：与 10573 同一句印刷行动共用 behavior.performAction 的 lostSisterLureFromDark/pickTarget，choose 不传 seat（797 行），使用即产生无 seat 待决选择。
  - 证据：content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js:702；content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js:797
  - 复现：`node artifacts/fhv-scan/probes/heath-sister-lost-sister.mjs（同一代码路径）`
- **[10579] D1 · 分片报告**：条目声明 flags.onRevealSpawn（10579.js:13），但全仓库没有任何读取点；theLostSister 的 locationRevealed（610-622 行）只还原特性/名称/黑暗并同步双面敌人，不生成任何敌人。
  - 证据：src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10579.js:13；content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js:610；src/engine/locations.js:283
  - 复现：`node artifacts/fhv-scan/probes/heath-sister-lost-sister2.mjs（10579 段：enemies [] / asideBefore==asideAfter）`
- **[10549] D1 · 分片报告**：hard/expert 的 shuffleVictoryOnSuccess 用 effect.test.failedBy 判“成功”，而 skill-effects.js:111 传入的是 `Math.max(0, frame.difficulty - frame.value)`，且在标记修正计入前取值（tests.js:1190 先派发 onDraw，1312 才写 skillTest.value）——它表示「若这枚标记为 0 时是否成功」，不是本次检定结果。
  - 证据：content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/chaos.js:103；content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/behavior.js:1651；src/engine/skill-effects.js:111；src/engine/tests.js:1190
  - 复现：`node artifacts/fhv-scan/probes/heath-sister-silent-heath2.mjs（cultistHard 段）；困难难度、水晶果园调查`
- **[10524b] D3 · ✅ Lead 复现**：翻面走 flipToEnemySide → api.turnLocationIntoEnemy(face)，而 ENEMY_LOCATION_FACES 的面里带 massive 字段（definition.js:218），引擎 validateEnemyFace 的 assertFields 只允许 code/name/nameEn/shroud/traits/fight/evade/health/damage/horror/victory/retaliate/alert/elite。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:218；games/arkhamhorror/src/engine/enemy-location.js:10；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:435
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse.mjs（A.agendaAdvance）`
- **[10525] D3 · ✅ Lead 复现**：洗牌与结算猎杀之屋都写了（behavior.js:1460-1470、1491-1494），但中间「翻面」调用链会抛「未知机制字段 massive」，导致后两步永远不执行；另外洗入的 10545/10546 未注册。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1472；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1509；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:218；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:76
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse.mjs（A.agendaAdvance）`
- **[10526] D3 · ✅ Lead 复现**：背面的「翻面」与正面 [fast] 的「翻面」都走 flipToEnemySide → turnLocationIntoEnemy，被 massive 字段断言拒绝（behavior.js:1472-1474、1216-1218；definition.js:218）。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1472；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1216；games/arkhamhorror/src/engine/enemy-location.js:28
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse2.mjs（J 段命中同一条 api.turnLocationIntoEnemy）`
- **[10527] D3 · ✅ Lead 复现**：翻面崩溃同 10526；另外 4 张 Fire!（10743）被洗入遭遇牌库，但 10743 未注册进 ALL_TREACHERIES（definition.js:76-98 将其排除，definitions 也不含它）。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1475；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:76；games/arkhamhorror/src/engine/encounter.js:279
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse2.mjs（K.10743）`
- **[10528] D3 · ✅ Lead 复现**：议程 3a 的 [fast] 翻面与强制掠食检定（抽到 [elder_thing] 时）都落到同一 massive 断言崩溃路径。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:1082；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js:708；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:218
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse.mjs（A）`
- **[10545] D3 · ✅ Lead 复现**：卡未注册：definition.js:76-87 把 10545 放进 SET_ASIDE_TREACHERY_CODES 并从 encounterDefinitions 的 code 列表排除，ALL_TREACHERIES 里没有它；engine/encounter.js 的伤害管线只在 ALL_TREACHERIES 命中时结算，否则 throw。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:76；games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:81；games/arkhamhorror/src/engine/encounter.js:126；games/arkhamhorror/src/engine/encounter.js:279
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse.mjs（A2、A2b）`
- **[10546] D3 · ✅ Lead 复现**：同 10545：被 definition.js:76-87 排除在 encounterDefinitions 外，未进 ALL_TREACHERIES；抽到即抛错，涌动/拖拽/攻击三条实现全部不可达。
  - 证据：games/arkhamhorror/content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js:76；games/arkhamhorror/src/engine/encounter.js:199；games/arkhamhorror/src/engine/encounter.js:279；artifacts/fhv-scan/probes/probe-rockhouse2.json
  - 复现：`node artifacts/fhv-scan/probes/probe-rockhouse2.mjs（K.10546）`
- **[10016a] D2 · 分片报告**：该反应没有 limit，引擎的反应窗口循环（ability-exec.js:363 guard<12）会在同一窗口反复重发同一个无费用反应；probe 中一次 horrorPlaced 窗口连续 12 次询问并全部结算，实际抽了 12 张牌（deck 33→21），与「每次放置恐惧只触发一次」相反。
  - 证据：src/cards/entries/10016a.js:68；src/cards/entries/10016a.js:71；src/engine/ability-exec.js:363；src/engine/ability-exec.js:366
  - 复现：`node artifacts/fhv-scan/probes/probe-hank3.mjs`
- **[10016b] D2 · 分片报告**：与 10016a 同因：无 limit 的反应被 harmAssigned 窗口重复提供并结算；probe 中一次 2 点伤害窗口连续 12 次触发，资源 5→29（+24），与每次伤害放置只触发一次相反。
  - 证据：src/cards/entries/10016b.js:67；src/cards/entries/10016b.js:71；src/engine/ability-exec.js:363；src/engine/ability-exec.js:419
  - 复现：`node artifacts/fhv-scan/probes/probe-hank2.mjs`
- **[10111] D2 · ✅ Lead 复现**：legalMoves 会列出第二张 Mask 的 play 候选、validateMove 也返回可打出，但 applyMove 走到 executePaidAction 时抛异常「没有合法的槽位替换方案」：canEquip 因 controlledTraitLimit 失败，assetReplacementPlans 又无法通过（另一张 Mask 仍在场），引擎没有回落成校验错误。
  - 证据：src/cards/entries/10111.js:33；src/engine/assets.js:212；src/engine/engine.js:2667
  - 复现：`node artifacts/fhv-scan/probes/p3-mask-crash.mjs（先装备 10111，再点装备 10133：legalMoves 有候选、validate ok、applyMove 抛「没有合法的槽位替换方案」）`
- **[10626] D3 · 分片报告**：scenario.resolutions 缺 noResolution；引擎全灭时 finishScenario('noResolution') → campaign-flow.js:246 抛「未知剧本结局」，状态停在关卡内且无可提交动作。
  - 证据：content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/definition.js:344-345；src/engine/harm-threat.js:374-381；src/engine/campaign-flow.js:246
  - 复现：`node artifacts/fhv-scan/probes/probe-scenarioLate-focus.mjs → longestNightAllDefeated`
- **[10629] D2 · 分片报告**：legalMoves 从不产出 resign：地点无 resign 标记、scenario.resignAnywhere 未设，引擎的卡文兜底正则匹配不上「[action]: Resign.」/「[action]：撤退。」。
  - 证据：src/engine/moves.js:656-661；src/engine/turn-flow.js:454-459；content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js:1850-1935
  - 复现：`node artifacts/fhv-scan/probes/probe-scenarioLate-focus4.mjs → longestResign=[]`

### 6.4 已披露但影响核心玩法的近似（需在 fix-plan P2-1 升级或校正披露）

- [10563] high/D1：behavior.enemyAttackResolved 的判据是 `codeOf(enemy) === COLORLESS_LARVA_CODE || flagIs(COLORLESS_LARVA_CODE, 'defeatAfterAttack')`；第二个操作数与攻击者无关，且 10563 条目恒定声明 defeatAfterAttack: true，因此该条件恒真 —— 本关任何敌人攻击后都会被“击败”。
- [10586] high/D1：条目在 `api.isDarkLocationHere` 存在时才用它判定昼夜，否则直接传 night:false（10586.js:24-27）；章节运行时（scenarioRuntime）没有该方法，于是永远走 (Day) 面，即使在已揭示的黑暗地点也是检定 combat。
- [10586] high/D3：失败二选一的 askChoice 调用 api.choose({prompt, options}) 时没有传 seat（1349 行），引擎 requestChoice 也不会补默认座位，产生的 pendingChoice.seat 为 undefined：所有座位 legalMoves 为空、任何 move 都被 choiceError 拒绝。
- [10587] high/D1：条目只声明 flags（10587.js:13-22），没有 encounterResolve，也没有任何代码把 10587 挂到地点：显现时卡直接进遭遇弃牌堆。behavior 里读该附属的两处（suppressedDarkIds、luminousGrowthLocations）因此永远读不到东西。
- [10578] high/D1：behavior.beforeMove 用 api.revealChaosToken / api.drawChaosToken 取标记，但章节运行时只有 api.revealToken（scenario-runtime.js:1648），两个 safeCall 都返回 null → face 为空 → 触发集合不命中，整段强制被静默跳过；且其后的 api.choose（853 行）没有传 seat，一旦真取到标记会立刻变成无 seat 
- [10585] high/D1：条目只声明 flags.attachToItemOnSuccess / attachedAssetBlankedExceptTraits / attackableWhileAttached（10585.js:14-16），章节 behavior 没有对应实现，引擎也没有“敌人附属到支援”的通道，声明即未接线。
- [10507] high/D3：道岔反应的选择由 behavior 直接调 api.choose 且没有 seat（behavior.js:743-752）；引擎 requestChoice 在不传 seat/seats 时生成无座位 pendingChoice，任何座位都无法回答，legalMoves 为空。
- [10518] high/D3：入场强制的滑动/交换各用一次 api.choose，均未传 seat（behavior.js:1083-1089、1095-1101）。
- [10054] high/D2：唯一能力依赖 assetExhausted 窗口，但窗口只在旧式能力（ability-exec.js:135-139）与 api.exhaust（api-misc.js:536）派发；描述子 cost.exhaust 在 ability-rules.js:113 只写 source.exhausted，不派发窗口。宿主池实测：注册卡中[[工具]]/[[科学]]支援有 36 个用描述子横置费用、0 个用旧式 cost.exhaust，因此
- [10050] high/D1：实现只做到「智力替代躲避 + 成功后 attachPlayerCardToAsset 附属」，所附属敌人获得的庞大、不能移动、躲避后发现 1 线索（每轮一次）三条全部缺失：没有给敌人加 massive、没有阻止移动的写点、附属卡也不是能力窗口来源（玩家卡附敌不在 descriptorSources 的敌人分支里）。
- [10098] high/D1：10098 的私有 ROT_RULES 只登记了 {rot} 名字（10098.js:44-50），但三个 forced 能力分别读取 rotRuleOf(code)?.enemyCannotAttack（10098.js:156-157）、.gainResourcesOnDefeatMax（10098.js:173）与 .enemyStatModifiers（10098.js:145）；这三个字段在自己的表里根本不存在，因此条件恒假／
- [10089] high/D1：本条目没有行为（10089.js:35 abilities: []），轮末伤害只写在 10098 的 forced roundEnds（10098.js:191-207）；而等级 0 的同名杖 10085 只有 enemyAttack / defeatEnemy 两个 forced（10085.js:158-196），没有 roundEnds。两张杖共用同一套绑定腐烂集合（bonded.js#bondedPoolMain），因此用 10
- [10090] high/D1：整条被动力未实现：条目只有 zoneReplacement（10090.js:36）与空 abilities（10090.js:37），note 自述「不能移动」没有读点（10090.js:27-28）。引擎的敌人移动拦截只有 enemy.immobile，且 enemy.attachments 不是实体规则/修正来源。
- [10096] high/D1：条目只有 commit 图标（10096.js:30-36），没有任何「忽略关键词/地点效果」的声明或读点（note 10096.js:8-19 自述缺 commit 档案的时长作用域）。
- [10109] high/D1：修正只写成描述子 modifiers（target:'handSize'，condition.sourceInHand），但 stats.js#handSize 只读 passive.handSizeBonus / 调查员规则 / 威胁区，从未调用 modifierTotal(...,'handSize')，因此这条修正在任何地方都不产生效果；属于「声明未接线」。
- [10109] high/D1：完全没有触发读点：条目 abilities 为空，全仓只有 10109.js 自己提到这个卡号；finishScenario 在结局结算时只扫描 traumaAtGameEndWhenInHand，购买折扣原语 grantPurchaseDiscount 只有 api 出口、没有任何调用者。
- [10117] high/D1：该反应没有任何实现，也没有能力来源：descriptorSources 只枚举手牌/受控支援/威胁区等，enemy.attachments 里的玩家卡不会成为窗口来源；敌人离场时 discardHostedAssets 把飞斧弃到控制者弃牌堆。
- [10118] high/D1：条目完全空实现（abilities: []）；引擎的投入候选只扫手牌 + playChannels 的 commit 通道，弃牌堆不是来源，也没有「投入后洗回牌库」的档案字段。
- [10133] high/D2：与 10111 同一崩溃路径：控制另一张 Mask 时，破碎冠冕的 play 候选出现在 legalMoves 且 validateMove 通过，applyMove 抛「没有合法的槽位替换方案」。
- [10134] high/D2：反向交换把本卡放进手牌（而不是场外绑定集合），此时破碎冠冕在场且两张都是 [[Mask]]；玩家若再从手牌打出暮光冠冕，会命中「Limit 1 Mask per investigator」的崩溃路径（legalMoves 暴露、applyMove 抛错）。
- [10655] high/D3：fateTrueSelfReturned 写入用扁平键 `fateTrueSelfReturned:${seat}`，读取用对象 flags.fateTrueSelfReturned[seat] → 幕 1 目标永远不满足。
- [10656] high/D3：advanceToAct3 设 actIndex=2，引擎幕结算后 actIndex++ → 3（越过 3 张的幕牌库），幕 3a 永不揭示，api.finish(R1–R5) 永不执行。
- [10586] high/D3：10586 失败二选一的 askChoice 未传 seat（另有 3 处同类），产生无 seat pendingChoice，legalMoves=0。
- [10587] high/D1：10587 显现/持续效果/敏捷弃卡均无读点，抽到等于空牌。

### 6.5 近似/未披露分布

- 分片 issue 总数 241：disclosed 87 / disclosed-high 24 / **undisclosed 89**
- 严重度：{"high":48,"medium":107,"low":86}

### 6.6 P2：近似披露、声明接线、i18n 与流程（7 项）

1. **P2-1 已披露近似卡的披露校正**：171 条 `simplified` 记录中，部分披露「根因」写错：
   10043 声称 `locationRevealed` 收不到描述子（已被 `probes/p10b-locreveal.mjs` 证伪，窗口可达 →
   属可实现漏实现）；10586 披露「按地点是否黑暗判定」但实现永远走白日；10587 披露「只读持续效果」
   但没有附属建立点；10563 披露未提越界判据。需逐条校正文本，并把影响核心玩法的近似
   （10050/10054/10109/10111/10117/10118 等）升级原语或明确下架决策。
2. **P2-2 引擎描述子 `cost.exhaust` 不派发 `assetExhausted` 窗口**（同一规则两套结算）：
   `src/engine/ability-rules.js:113` 只写 `source.exhausted`，而 `ability-exec.js:135-139` 与
   `api-misc.js:536` 会派发窗口。导致 10054「精准调配」对走描述子横置的大多数支援失效
   （实测 10040 横置后无提示；宿主池 36 描述子 / 0 旧式）。修引擎一处即可让 10054 生效。
3. **P2-3 机械门禁**：把本轮的注册闭包、无 seat 选择、死声明、敌人-地点 face 字段检查
   固化成脚本并接入 `cards:check`/`cards:encounter-check`/FHV 审计门禁。
4. **P2-4 文档与账本口径**：README 的「12 章逐章 verified / 完整路线」需注明关卡内玩法由合成 state
   测试覆盖；「441 张卡文直达」实为按 pattern → 规则条目链接；P8 的 `verified` 需在 P0/P1 修复后重签。
5. **P2-5 事件卡「延迟返回手牌」口径**：10100/10101/10102 被实现为结算后立即回手（同回合可二次使用）、
   10123 模式 1 缺「地点附属→手牌」原语、10126 重试不重放原效果（player3 分片，均已披露近似）。
6. **P2-6 战役层遗留**：四档混乱袋、整备、升级窗、记录 schema、观察投影隐私已核验通过（campaignLayer
   分片：bag 14/14/15/16、整备 9→5 资源与 3 线索保留、240 键 schema 闭合、投影不泄露法典正文）；
   其余 `noUpgrade` 无读点、`chaosBagTransitions` 死声明等按 P1-14/低优先处理。
7. **P2-7 分片账本归档**：`artifacts/fhv-scan/findings/*.json` 与 triage 结果压缩为可签入审计账本，
   修复后重跑全部 FHV 审计链并重签 `equivalenceCertified`。

## 7. 已核验为正确的关键项（避免过度否定）

- 441 条记录的**卡表数据与中文翻译**与来源完全一致（0 差异、0 缺译）。
- **R1 直写状态 0、引擎卡号分支 0**；432 个条目全部进入生成索引与生产注册。
- **12 关全部可进入**，setup 数据齐全（地点/幕/议程/混乱袋/遭遇牌库/结局表），**60 个声明结局全部可结算**。
- **逐地点揭示**与**逐敌人生成/移动/战斗/闪避**在 12 关均无错误（55 敌人中 52 可交互，其余为背面/追击区设计）。
- 玩家卡 120 张 + 调查员 20 张在真实引擎夹具中均可加载/打出/结算（142 例 P6 测试与 71 例 P5 测试在当前 HEAD 通过）。
- 混乱袋四档（14/14/15/16 枚）与上游 `campaignChaosBag` 逐枚一致；三天三夜时间轴、勘察选择、
  夜探分支与上游 `nextStep` 语义一致（parts.js 有逐条来源注释）。
- 浏览器：FHV 交互 18/18（含桌面/移动、法典、整备、网格、矿车、敌人-地点、调查员状态、指南）与
  P8 战役 28/28 通过。
- 规则书/关键词/指南生成链 `--check` 通过（12 份指南 0 缺译块、1462 叶正文 0 缺译）。

## 8. 已知限制与未覆盖

- **浏览器证据类型**：`fhv-interactions.browser.mjs` 使用测试夹具状态而不是真实战役状态（与以往循环同口径）；
  P8 release 浏览器用例本轮未重跑（原因：工作区有并发媒体改动、且重跑会写入发布账本；
  交互 18/18 与战役 28/28 已提供当前 HEAD 的补充证据）。P0 级问题均为引擎层，浏览器无法绕过。
- **并发改动**：扫描期间工作区出现音乐/素材同步改动（非本任务产生），已在上方说明；
  受其影响 `build-presentation.mjs --check` 的漂移不单独归因于 FHV。
- **上游数据 quirk**：个别卡表数据与印刷不符（如 10625 的伤害/恐惧/生命），实现已在 definition 中按印刷覆盖并披露。
- **未做**：多人/在线大厅的 FHV 全流程（P8 历史账本声明已覆盖；本轮只重跑了战役引擎与交互浏览器），
  以及 AI 队友在 FHV 全流程中的行为质量评估。

## 9. 复现与证据索引

全部脚本只读工作区、只写 `artifacts/fhv-scan/`；在 `games/arkhamhorror/` 下执行：

```bash
# 机械一致性
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/extract.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/screen.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/dead-declarations.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/scan-seatless-choices.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-registration-gaps.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/evidence-traceability.mjs
# 真实引擎探针
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-scenarios.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-depth.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-resolutions.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-encounter-registry.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-cards.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/probe-actions.mjs
# P0 定点复现
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/debug-hemlock-agenda.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/debug-longest-night.mjs
node G:/boardgame-hall-ai/artifacts/fhv-scan/scripts/repro-set-aside.mjs
# 账本复算
node tools/audit-fhv.mjs --check
node tools/audit-fhv-investigators.mjs --check
```

数据文件（`artifacts/fhv-scan/data/`）：`cards.json`、`screen.json`、`lead-summary.json`、
`dead-declarations.json`、`seatless-choices.json`、`probe-scenarios.json`、`probe-depth.json`、
`probe-resolutions.json`、`probe-encounter-registry.json`、`probe-cards.json`、`probe-data-layer.json`、
`registration-gaps.json`、`evidence-traceability.json`、`hook-wiring.json`、`audit-fhv-computed.json`；
分片逐卡结果在 `artifacts/fhv-scan/findings/*.json`。
