# Arkham 模块架构对比与改进方向（对照 `参考资源/ArkhamHorror-main`）

> 日期：2026-02。范围：`games/arkhamhorror`（本文简称"本实现"）与只读参考实现 `参考资源/ArkhamHorror-main`（Haskell 后端 + Vue 前端，简称"参考实现"）。
> 本文只做架构对比与改进建议，不改动运行时行为；所有数字为本次实测（`develop/perf-probe*.mjs`、源码行数统计）。

---

## 0. 结论摘要

两者的定位不同，导致架构取舍完全不同：

- **本实现**是"大厅里的一个可搬运 Mod + LLM 队友"。约束是：嵌入大厅、零构建、离线可跑、AI 只能通过"观察投影 + 合法动作列表"决策。它必须把**可解释性**（合法动作、reason、预览）做成第一公民。
- **参考实现**是"一套完整的规则引擎 + 在线服务"。约束是：把 2015–2026 全量卡牌写成可执行规则。它必须把**规则表达力**（时机窗口、修正、代价、目标匹配）做成第一公民。

一句话概括差距：**参考实现用 6 千多个"能力实例"换取规则覆盖率；本实现用 400 多个"效果条目 + 一个 11k 行 switch"换取移植速度与可搬运性。** 现在到了"表达力开始成为瓶颈"的拐点。

能力面评分（相对成熟度，非绝对）：

| 维度 | 本实现 | 参考实现 | 说明 |
| --- | --- | --- | --- |
| 规则表达力 | ★★ | ★★★★★ | 参考有 Ability/Window/Cost/Modifier/Matcher 五层；本实现是 action 枚举 + 手工窗口 |
| 已实现卡牌量 | ★（418 效果 / 5930 目录） | ★★★★★（6261 CardDef / 6445 行为实例） | 覆盖约 7% vs 近全量 |
| 战役/剧本覆盖 | ★★（4 战役 29 关） | ★★★★★（12 战役 + 12 支线 + 8 挑战） | |
| 存档 / 回放 / 撤销 | ★★ | ★★★★★ | 本实现只有整状态快照 + 关卡检查点 |
| AI 队友集成 | ★★★★★ | ☆（无） | 本实现的独占优势 |
| 多人 / 隐私投影 | ★★★★ | ★★★★ | 本实现按座位显式 allowlist，较清晰 |
| i18n | ★ | ★★★★★ | 本实现引擎内 879+ 处中文字面量 |
| 可搬运性 / 上手成本 | ★★★★★ | ★★ | 单端口 + JSON 存档 vs Docker + Postgres |
| 测试证据 | ★★★★ | ★★★★ | 两边都是"打通剧本"式验收为主 |
| 调试 / 可观测 | ★★ | ★★★★ | 参考有 undo/replay/bug 上报/metrics |

---

## 1. 规模与运行形态

| 项 | 本实现 | 参考实现 |
| --- | --- | --- |
| 语言 / 运行时 | Node 22 ESM，无构建 | Haskell (GHC/stack) + Vue 3/TS/Vite |
| 服务端代码 | 手写 JS 约 42.9k 行 / 191 文件（`engine.js` 11,221 行） | `library/Arkham` 约 493k 行 / 8,089 模块 |
| 生成数据 | `cards-data.js` 352,807 行（13 MB，5,930 卡） | `frontend/public/cards_*.json` + 每卡 `CardDef` 模块（6,261 个） |
| 前端 | 原生 ES Module 9,429 行（JS+CSS），`game-ui.js` 1,666 行 | Vue 3 + Pinia + vue-i18n，890 文件 / 11 MB |
| 测试 | 152 个 `.mjs`（Node + Playwright），37.3k 行 | 394 个 Haskell Spec + 前端测试 + `backend/validate` |
| 存储 | 每步整局 JSON 快照（`<DSH_HOME>/boardgame-hall/sessions/...`） | Postgres：`arkham_games` + `arkham_steps(action_diff jsonb)` |
| 部署 | 双击 `start.bat`，单端口，可离线 | Docker Compose / Kamal / Terraform，CDN 资源 |
| 启动成本 | 实测 import 707 ms、堆 38.6 MB | 编译产物 + 数据库连接 |

> 结论：不要照搬参考实现的 Haskell/Postgres/Docker 三件套——它换来的表达力可以用 JS 里的一层声明式 DSL 拿到，而可搬运性是本产品（大厅 + 免安装发布包 + 离线）的核心卖点。

---

## 2. 规则引擎内核：两种范式

### 2.1 参考实现：不可变 `Game` + 全局消息队列

- `Arkham/Game.hs`（7,224 行）是"消息解释器"：`runMessages` 循环从队列取 `Message`，交给对应实体（asset/enemy/investigator/scenario…）的 `RunMessage` 实例处理，处理过程中**继续往队列里推消息**。
- `Arkham/Message.hs`（2,996 行）是全部效果原语：`Fight`、`Investigate`、`EnemyAttack`、`RevealChaosToken`、`Ask`、`Question`… 每个都是一个可序列化的数据类型。
- 能力模型是**分层的**：
  - `Ability.hs`/`Ability/Type.hs`：`ActionAbility` / `ReactionAbility` / `ForcedAbility` / `ConstantAbility`，各带 `Criteria`（可否使用）、`Cost`、`Limit`（每回合/每阶段/每窗口）。
  - `Window.hs`（553 行）：`Timing` + `WindowType` + `BatchId` + `windowConditionTick`，`mkWhen`/`mkAtIf`/`mkCancel` 构造可撤销、可插入的时机窗口；能力声明自己响应哪个窗口，引擎负责排序、强制触发、上限记录。
  - `Modifier.hs` + `preloadModifiers/handleBlanked`：所有数值改动走修正列表，而不是在读取处写 if。
  - `ActiveCost.hs`（1,905 行）：把"付得起吗"算成独立结果（可选目标、附加代价、折扣），`validate` 与 `apply` 共用同一份计算。
  - `Matcher.hs`（577 行）：`EnemyMatcher`/`LocationMatcher`/`AssetMatcher` 组合子，查询"最近的、已交战且非精英的敌人"这类句子可以写成表达式。
- 结果：加一张卡 ≈ 加一个模块（`instance HasAbilities` + `instance RunMessage`），**不碰内核**。全库 6,445 个 `RunMessage` 实例、1,829 个 `HasModifiersFor` 实例就是这么堆出来的。

### 2.2 本实现：可变状态 + 一个大 switch

- `src/engine/engine.js`（11,221 行）承担了参考实现 `Game.hs` + `Message.hs` + `Window.hs` + `ActiveCost.hs` + `Modifier.hs` 的**全部职责**：`applyMove` 里对 60 多个 action 名做 switch，`performTest` 一个函数约 750 行（`engine.js:3263` 起）。
- 时机窗口是**手工调用点**：`playerWindow()`（`engine.js:2761`）、`reactionWindow()`（`engine.js:2563`）、`WINDOW_LABELS` 常量。哪里开窗口由作者决定，窗口本身没有注册表，也没有"某能力响应某窗口"的声明。
- 数值修正散落在读取处：`getStat()`（`:1734`）里读 `inv.testBonus`/`phaseStatBonus`/资产被动/角色特例，签名检定成功后再由 `applySkillOnSuccess` 处理一轮，`elderSignEffect`（`:4034`）里按调查员 code 分支（`case 'rex'`、`case 'jim'`、`case 'akachi'`、`case 'minh'`）。
- 事务模型是自研的"抛异常暂停 + 答案日志重放"：`resolution.js` 的 `requestChoice` 抛 `ChoicePause`，`resolveTransaction` 克隆整份状态重跑，直到所有选择都被 `answers` 命中。

**差异的实质**：参考实现把"什么时候能做什么、要付什么、数值被谁改、目标是谁"这四件事各给了独立抽象；本实现把它们合并在同一个函数里，靠**具体代码路径**表达。前者可组合（攻防战里的 `ActiveCost` 直接复用），后者每加一个机制就多一条路径。

---

## 3. 卡牌与内容的表达方式

| 项 | 本实现 | 参考实现 |
| --- | --- | --- |
| 卡面数据 | 生成的 `src/cards/cards-data.js`（唯一事实源，导入器产出） | 每卡一个 `CardDef` 模块（`asset "01020" "Machete" 1 Guardian {...}`） |
| 卡牌行为 | `src/cards/card-effects.js`（547 行，418 条）+ 各 pack 的 `effects.js` | `Asset/Assets/*.hs`（1,177）、`Event/Events/*.hs`（519）等，共 6,445 个 `RunMessage` |
| 效果原语 | `effects.js:21` 的 `EFFECT_PRIMITIVES`（约 60 条，另含 `tfaPlayer`、`carcosaInvestigator`、`dunwichPlayerEffect`、`tfaInvestigator` 这类"按战役命名"的逃生口） | `Message.hs` 的类型化原语 + 组合子 |
| 剧本 | `content/campaigns/<c>/scenarios/<s>/{definition,behavior}.js` | `Scenarios/<Campaign>/<Scenario>.hs` + `Act/Agenda/Location/Enemy` 的 CardDef/行为分离 |
| 印刷数据 vs 在局行为 | 未强制分离（`definition.js` 同时写卡号、属性与用途） | 强制分离：`Defs.hs`（纸上）vs `Content.hs`（在局），`docs/homebrew.md:85` |
| 扩展方式 | 注册表 + 契约校验 + 迁移确认（`content/schema.js`、`migration-confirmation.js`） | 目录即插件：`CardDefEntries.hs` 用 pragma 自动发现，`docs/homebrew.md` 是作者手册 |

本实现的"效果原语 + 战役逃生口"已经能看出瓶颈：`EFFECT_PRIMITIVES` 里出现 `tfaPlayer`/`carcosaInvestigator` 这类**以战役命名的动词**，等于承认"这张卡的语义无法用现有原语表达"。参考实现里没有对应物——它把这类差异表达成"新的 Message + 新的 Modifier/Criteria 组合"，而不是新原语。

也要承认参考实现的路径不是免费的：6 千多个模块需要强类型与编译期检查兜底，用 JS 逐卡照抄会得到 6 千个不可维护的文件。**本实现要抄的是分层（能力/窗口/代价/修正），不是照抄逐卡模块的粒度。**

---

## 4. 剧本与战役机制的边界（最大的一处架构偏离）

`ARCHITECTURE.md:107` 明确约定："不得在引擎或大厅中增加按关卡名称判断的分支"。实际代码与这条约定已经背离：

- `engine.js` 中出现 TFA 专属机制与函数：`suppliesFor/grantSupplies/crossOffSupply/checkSupplies`（`:1527-1570`）、`vengeancePoints/recordVengeance`（`:1576`）、`isPoisoned/poisonInvestigator`（`:1590`）、`yigsFury/addYigsFury`（`:1603`）、`relicOfAges/moveRelicOfAges`（`:1631`）、`expeditionLeaderSeat`（`:1616`）、`buildExplorationDeck/doExplore`（`:1657`），以及 `tfa[A-Z]*` 形态的 26 处调用、`tfa` 字样 61 处。
- 状态里直接挂战役字段：`state.explorationDeck`（20 处）、`state.relicOfAges`（6 处）、`state.expeditionLeaderSeat`（3 处）。
- `scenarioRuntime()`（`engine.js:56`）向内容层暴露 **134 个闭包**，其中相当一部分是战役专用 API；内容层可以直接改权威状态（`location.clues -= 1`、`chamber.doom += 1`）。
- 投影层同样知道战役细节：`observation.js:116-129` 手写 `exploration`/`relicOfAges`/`expeditionLeaderSeat`/`vengeance`/`yigsFury` 投影，`:148` 按卡号 `03009` 换背面图。
- 连"规则原语"里也有卡号特判：`rules-state.js:9` 用 `enemy.code === '02255'` + 回合/阶段判断算生命值。

参考实现也有少量战役类型渗进核心（如 `Message.hs` 引入 `Campaigns.TheForgottenAge.Supply`），但主体是 `Arkham/Campaigns/<Campaign>/{Campaign,ChaosBag,Keys,Supply}.hs` 的模块化实现，核心只认识"战役记录键"这一通用概念（`CampaignLogKey.hs`）。

**风险**：每接一个新战役，`engine.js`、`observation.js`、`ai-context.js` 都要新增分支，代码量线性增长而抽象不增长；这也是 TFA 之后接第五个战役会明显变慢的根本原因。

---

## 5. 交互、暂停与并发

| 项 | 本实现 | 参考实现 |
| --- | --- | --- |
| 交互模型 | `pendingChoice` + `choiceMoves`，回答座位显式（支持 `seats` 多人竞答） | `Question`/`Ask`/`SimultaneousAsk`，先入队再暂停 |
| 暂停实现 | 抛 `ChoicePause` 中断事务，答案日志（`answers`）保证重跑一致 | 消息队列 + 状态序列化，天然可停在任意步 |
| 事务原子性 | 克隆 `base` 重跑；检查点上限 16，选择上限 512（`resolution.js:39,111`） | 消息队列单步可重放，diff 持久化 |
| 策略耦合 | **有**：`resolution.js:51-57` 在规则层里判断 `state.humanSeats`，非人类座位自动 `skip` 可选反应 | 无（引擎不关心是谁在做决定） |
| 隐私边界 | `observation.js` 的 `PUBLIC_STATE_FIELDS`/`PUBLIC_INVESTIGATOR_FIELDS` 手工 allowlist | 每实体 `ToJSON` + 按座位投影 |

本实现的 `pendingChoice` + 答案日志其实是个不错的轻量设计（可复现、可 JSON 存档、天然支持多座位竞答），但它有两个结构性局限：

1. **日志只活在一次事务内**：`continuation` 只是当前事务的续算凭据，跨动作没有"动作日志"，因此拿不到 undo/回放/差分测试（参考实现 395 行的 `Undo.hs` 就是靠 `arkham_steps.action_diff` 做到的）。
2. **策略混进规则**：自动 skip 依据 `humanSeats`（AI 座位的可选反应默认跳过）。这属于"谁在操作这个座位"的策略，应该由大厅注入，而不是引擎读状态字段。

---

## 6. 存档、回放、撤销

| 能力 | 本实现 | 参考实现 |
| --- | --- | --- |
| 存档 | 每步整局 JSON 快照 + `revision` 单调校验 | 每步 `action_diff` 追加，可按 diff 重建 |
| 版本迁移 | `save-migration.js`（177 行）+ `schemaVersion=6` / `rulesVersion=n5.5` 硬门槛 | DB 迁移（sqitch，25 个版本） |
| 撤销 | 无（只有"关卡检查点 fork"，`hall-integration.js:85`） | 回合/阶段/动作/整局多粒度撤销（`Undo.hs`） |
| 回放 | 无 | `Replay.hs` + `replayChoices` |
| 复现 bug | 需要玩家描述 + 手动重开 | 给 game id 即可复现/回退 |

这不是"少个功能"，而是**少了一套基础设施**：有了"种子 + 动作序列 → 状态"的纯函数式重放，撤销、bug 复现、golden 回归、AI 决策回归、差分验证都能挂在同一个能力上。当前 `resolveTransaction` 已经有"事务级重放"的雏形，把它上移到"对局级"是性价比最高的一次架构投入。

---

## 7. 前端与展示

- 本实现：`presentation-state.js` 把权威状态转成稳定牌桌数据，`web/` 只负责渲染与提交。**协议设计是对的**（前端不含规则判定），但实现是 9.4k 行原生 JS，`game-ui.js` 1,666 行单文件，无组件化、无 i18n、无类型。
- 参考实现：Vue 3 + Pinia + vue-i18n + Vite，组件化与多语言齐备；还带 `frontend/harness/`（开发/回放工具）和 `frontend/homebrew/`（内容作者资源目录）。
- 差异主要在**工程化**而非架构：本实现的服务端展示投影已经是干净的接口，未来换渲染层不需要动规则层。真要投入，优先做"按区域拆分组件 + 文案外置"，而不是引入框架本身。

---

## 8. i18n 与文案

- 参考实现：`Arkham/I18n.hs` + `Arkham/Text.hs`，能力标签走 `labeled/skip` 的 i18n key；前端 `vue-i18n` + `translation-overrides/`；卡牌文本来自 `cards_en/zh-cn/zh.json` 并按 locale 回退。
- 本实现：`engine.js` 里 **879+ 处中文字符串字面量**（仅统计单引号字面量），通过 `info()` 直接进入权威事件日志与 `state.log`；`observation.js` 把 `log` 投影给所有座位（仅"私有检定"期间用 `publicLog` 替换）；`ai-context.js` 也读这些文本。后果有三：
  1. 无法多语言（一行文案 = 一处代码改动）；
  2. 事件日志不可比较（改文案会破坏测试断言与 AI 提示词稳定性）；
  3. 规则与表达耦合（"日志怎么写"影响"状态怎么存"）。

改造成本不高但收益很直接：事件改为 `{ id, params }` 结构化，投影时渲染文案；`state.log` 存 id+params，旧的字符串在渲染层生成。

---

## 9. 测试与证据

本实现这套"审计账本 + 迁移确认 + 浏览器回归"在小体量项目里其实相当扎实（`audit/core-acceptance.json`、`audit/p6-behavior-ledger.json`、`content/migration-confirmation.js`、152 个测试文件）。结构性短板是**测试形状**：

- 现有测试以"打通某关 + 断言关键状态"为主（`campaign-n4`、`carcosa-final`、`tfa-*`…），缺**规则原语级**单测（参考实现的 `GameSpec/ActionSpec/TokenBagSpec`）。
- 缺**不变量/属性测试**：线索守恒、毁灭守恒、牌数守恒、行动点非负、`revision` 单调、JSON 往返幂等。这些用随机走子器跑 1 万步就能抓到大部分状态腐化。
- 缺**回放型 golden**（见 §6），因此没法把"真实玩家的一局"固化成回归用例。
- 参考实现的 `backend/validate`（603 行）做内容注册表校验，本实现的对应物是审计工具，方向一致。

---

## 10. 我们应当保留的架构优势

1. **AI 契约是一等公民**：`legalMoves` + `actionPreview`（`engine.js`）+ `reason`（"暂不可执行的卡面行动"）+ `describeState`，参考实现完全没有对应物。这是产品差异化，不能为了"更像参考实现"而牺牲。
2. **观察投影是硬边界**：`observation.js` 按座位裁剪手牌/牌库/待决选项，AI 与前端走同一条路径；参考实现靠实体 `ToJSON`，可靠性相近但本实现的"按座位"更显式。
3. **Mod 隔离**：大厅只认 `index.js`；聊天、备忘、检查点、更新、联机都在大厅层，游戏不用重复实现。
4. **可搬运性**：单端口、零构建、JSON 存档、免安装发布包；参考实现需要 Docker + Postgres + Node + GHC。
5. **版本门槛**：`schemaVersion`/`rulesVersion`/`resourceVersion` 三写校验，拒绝静默续算，比"迁移后尽力跑"更安全。
6. **内容契约与迁移确认**：`content/schema.js` + `migration-confirmation.js` 让"接新战役"变成有清单的流程。

---

## 11. 改进方向（按杠杆排序）

### P0-A 声明式能力/时机层（收益最大，决定能否继续接卡）

**问题**：新增卡牌要么加效果原语，要么在 `engine.js` 加分支；`EFFECT_PRIMITIVES` 已出现战役命名的逃生口。

**方向**：
- 定义 `Ability` 描述子：`{ kind: action|reaction|forced|constant, triggers: [windowId], criteria, cost, limit, resolve(ctx) }`；卡牌模块只导出描述子数组，不再直接操作状态。
- 建 `Window` 注册表：把 `WINDOW_LABELS` 与散落的 `playerWindow/reactionWindow` 调用点收口为"引擎在固定时机开固定窗口，能力声明响应"，并补上 `when/before/after/cancel` 四类语义与"每窗口触发上限"。
- 引入 `Matcher` 风格查询（`enemies({ at, engagedWith, trait, elite })`）替代散落 filter，顺带压缩 `scenarioRuntime` 的 134 个 API。
- 引入 `Modifier` 列表 + 统一的 `effectiveStat` 管线，消灭 `getStat`/`elderSignEffect` 里的调查员特判（`rex/jim/akachi/minh`）与 `rules-state.js:9` 的卡号特判。

**验收**：连续新增 20 张卡（含"当…时，若…则…"类反应卡）不修改 `engine.js`；`npm test` 全绿。

### P0-B 对局级动作日志 + 纯函数重放（解锁撤销/复现/回归）

**问题**：只有事务级答案日志，没有对局级动作序列。

**方向**：落盘 `{ seed, moves[] }`（或 `moves[] + 关键随机量`），提供 `replay(seed, moves, until)`；`state` 增加稳定 hash（键排序后哈希）用于相等断言；把现有 `continuation` 语义并入日志。落地后依次解锁：
- 撤销（按动作/按回合）；
- bug 复现（用玩家存档 + 动作序列在测试里跑）；
- golden replay 回归（真实对局固化为测试）；
- AI 评估（同一状态重放不同模型决策，见 §12）。

**验收**：任意现有测试局可重放出逐字节一致的 `state hash`；`replay` 与实时执行在 100 局随机对局上一致。

### P0-C 拆分 `engine.js`（机械重构，不改行为）

**问题**：11,221 行单文件，`applyMove` switch、`performTest` 750 行、战役机制与通用规则混居。

**方向**：按 `core`（zone/实例/数值/随机）/`checks`（检定、提交、混乱袋交互）/`combat`（交战、攻击、仇恨）/`phases`（神话/调查/结算）/`hubs`（局外流转）切分，`engine.js` 只留 dispatch 与公共导出；禁止跨层反向 import（用 ESLint `no-restricted-imports` + 一份 import 图检查脚本）。

**验收**：单文件 < 2.5k 行；public API 与测试零改动；`ARCHITECTURE.md` 的依赖图与实际一致。

### P0-D 战役机制插件化（兑现 ARCHITECTURE.md 的承诺）

**方向**：把 TFA 的 supplies/vengeance/poison/yig's fury/relic/exploration/expedition leader 从引擎状态与 `scenarioRuntime` 中移出，改为内容侧 `mechanics` 注册：
- `stateSlice`（自己的持久字段 + 迁移）
- `project(state, observer)`（替代 `observation.js` 里的战役专用投影）
- `actions/hooks`（替代 `behavior.js` 直接改状态）
- `agentHints`（给 AI 的机制说明）

**验收**：`engine.js`/`observation.js` 内不出现 `tfa|carcosa|dunwich` 字样与具体卡号；新增战役只加 `content/campaigns/<id>/`。

### P1 快速收益（各 1–3 天量级）

1. **文案外置**：`info()` 改结构化事件 `{ id, params }`，文案表放 `src/i18n/zh-CN.js`；顺带解决测试对文案的耦合。
2. **策略外置**：`resolution.js` 的 `humanSeats` 自动 skip 改为注入 `autoPassPolicy`；`state.humanSeats` 从规则层移除。
3. **`validateMove` 返回结构化原因**：现在只返回字符串；改为 `{ code, params, hint }`，前端与 AI 都能消费（AI 侧已有 `reason` 机制，可统一）。
4. **启动与内存**：`cards-data.js` 按 pack 分片 + 懒加载（实测 707 ms / 38.6 MB 启动，单文件 13 MB）；图鉴 API 复用同一索引。
5. **不变量测试**：写一个随机走子器（假设已有 `autoHubMove`/合法动作列表），跑 5k–10k 步，断言守恒与幂等。
6. **调试 trace**：`DEBUG_TRACE=1` 输出每个 action → 子步骤 → choice → token 的环缓冲（参考实现的 `Debug.hs` + `Arkham/Debug` 可对照设计）。

### P2 中长期

7. **卡牌作者 SDK**：对标 `docs/homebrew.md`，让"不改引擎加卡"成为文档化的常规路径（依赖 P0-A）。
8. **前端组件化 + i18n**：在 `presentation-state` 协议不变的前提下拆分 `game-ui.js`，文案走与引擎同一张表。
9. **差分验证**：抽样 3–5 关，用同一随机种子与选择序列对比参考实现的最终状态/结局/战役记录，作为"严格规则验收"的自动化来源（成本高，但能把 `docs/tfa-card-audit.md` 里的手工核对变成断言）。
10. **类型契约**：JSDoc + `tsc --checkJs` 覆盖 `Move`（判别联合）、`State`、`Effect`、`ContentManifest`；至少让"未知 action 名"与"未声明状态字段"在 CI 报错。

---

## 12. AI 队友这条线可以额外拿到的红利

参考实现没有 AI，所以下面这些是"只有我们能做"的方向，且大多依赖 P0-B：

- **决策回归**：用 P0-B 的对局日志固定状态，重跑不同模型/prompt，比较"选了哪个合法动作"，产出可量化的提示词 A/B。
- **提示词稳定性**：`aiDecisionContext` 目前直接 `JSON.stringify(data)`（`ai-context.js:86`），键顺序与浮点格式会抖动，影响 prompt 缓存命中；固定键序 + 数值规范化。
- **可读性分层**：`actionPreview`/`reason` 已经是很好的"可负担性说明"，可以进一步给每条动作打 `intent` 标签（推进/保命/增益/资源），让模型在长列表里先分类后选择。
- **隐私审计**：`aiDecisionContext` 与 `observation` 是两条路径，建议让 AI 上下文**复用** `viewState` 的输出再叠加 `legalMoves`，避免将来一边加字段、另一边泄漏。

---

## 13. 建议的落地顺序（避免边接内容边重构互相踩踏）

```text
阶段 0（1 周）  文案外置 + 策略外置 + validateMove 结构化原因 + trace 开关
阶段 1（2–3 周）engine.js 机械拆分（P0-C），测试零改动通过
阶段 2（3–4 周）对局日志 + replay/hash（P0-B），先接"测试用"，再开放"撤销"
阶段 3（4–6 周）Ability/Window/Modifier 分层（P0-A），新卡只走新路径（strangler 模式，旧路径保持）
阶段 4（2–3 周）战役机制插件化（P0-D），把 TFA 作为第一个搬家对象
阶段 5（持续）  不变量/回放/golden 测试补齐，差分验证抽样启动
```

风险提示：
- 阶段 1、3 是大范围重构，**必须先把 P0-B 的重放能力做出来**，否则重构期间无法快速定位"行为何时变了"。
- 阶段 3 建议"新卡走新层、旧卡先留着"，用一张清单（类似现有 `audit/*-ledger.json`）跟踪迁移进度，避免一次性大爆炸。
- 所有阶段都应同步更新 `ARCHITECTURE.md`，否则文档与实现会像现在这样再次分叉（例如"不得在引擎里按关卡分支"已经被违反）。

---

## 附录：本文引用的关键证据

| 结论 | 证据位置 |
| --- | --- |
| 引擎单体 + action switch | `games/arkhamhorror/src/engine/engine.js`（11,221 行） |
| 战役 API 塞进引擎运行时 | `src/engine/engine.js:56` `scenarioRuntime`（134 个闭包） |
| 检定函数 750 行 | `src/engine/engine.js:3263` `performTest` |
| 调查员特判 | `src/engine/engine.js:4034` `elderSignEffect` |
| 卡号写进规则原语 | `src/engine/rules-state.js:9`（`02255`） |
| 规则层读 `humanSeats` 做策略 | `src/engine/resolution.js:51-57` |
| 投影层写战役专用逻辑 | `src/integration/observation.js:116-129`、`:148`（`03009`） |
| 效果原语的战役逃生口 | `src/cards/effects.js:21` `EFFECT_PRIMITIVES`（含 `tfaPlayer` 等） |
| 无对局级日志/回放 | 全仓 `replay/undo` 仅在测试与 `resolution.js` 事务内出现 |
| 参考：消息队列内核 | `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/{Game,Message,Window,Ability,ActiveCost,Modifier,Matcher}.hs` |
| 参考：撤销/回放 | `library/Api/Handler/Arkham/Undo.hs`、`migrations/deploy/*`（`arkham_steps.action_diff`） |
| 参考：逐卡行为规模 | `Asset/Assets/*.hs` 1,177、`Event/Events/*.hs` 519、`RunMessage` 实例 6,445 |
| 参考：内容扩展手册 | `参考资源/ArkhamHorror-main/docs/homebrew.md` |
| 启动/状态实测 | `games/arkhamhorror/develop/perf-probe.mjs`、`perf-probe2.mjs`（import 707 ms、堆 38.6 MB、state 0.19 MB、合法动作 ~19 条/1.1 KB、AI 上下文 8.2 KB） |
