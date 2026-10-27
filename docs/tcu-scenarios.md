# 《万象无终》剧本手册（M3，9 章）

> 范围：9 章全部 `playable`（可以从大厅按序章 → 9 章推进）；逐章账本 [`audit/tcu-scenario-acceptance.json`](../audit/tcu-scenario-acceptance.json) 记录 **9/9 verified、pendingEncounterCards 0、scenarioGaps 0、testCases 323**，12 项检查逐章全真。这里的 `verified` 是仓库 P8/P9 迁移确认，不等于卡面逐条等价：**88 条忠实近似**登记在各章 `behavior.scenarioApproximations`，外部审计另发现运行态/逐卡缺口（见 §6）。
>
> 目录契约见 [迁移规范](./arkham-content-migration.md) §3/§5；通用遭遇/关键词机制见 [关键词与规则书手册](./tcu-rules.md)、[原语手册](./tcu-primitives.md)。

## 1. 目录契约与规模

每章在 [`content/campaigns/theCircleUndone/scenarios/<id>/`](../content/campaigns/theCircleUndone/scenarios) 下：`index.js`（导出 scenario/identities/layout/behavior/manifest）、`definition.js`（地点/幕/议程/遭遇牌库/放在一边区/结局）、`layout.js`（桌面坐标）、`behavior.js`（引擎钩子）、`chaos.js`（本章混乱符号表）。`forTheGreaterGood`、`unionAndDisillusion` 另带 `notes.js`（本章近似账本）与 `story-text.js`（P8 可读的 INTRO/SETUP/结局摘要，P9 完整正文在全局 `story-text.js`）。

| 指标 | 数值 |
| --- | --- |
| 章节文件 | 9 × 5 = 45 个 + 4 个补充文件（fgg/union 各 2），共 **49 个 / 10,197 行** |
| 章节专属单卡条目 | [`src/cards/encounter-entries/theCircleUndone/`](../src/cards/encounter-entries/theCircleUndone) 共 **247** 个（215 章节专属 + 32 战役共享） |
| 章节遭遇牌张数（含印刷数量） | 274（逐章见下表），`pendingEncounterCodes=0` |
| 遭遇组 | 21（9 章节组 + 12 共享组，见 `shared.js`） |
| 忠实近似 | 88 条（7+9+11+11+12+9+12+7+10） |
| 逐章 Node 用例 | 41+33+34+36+45+36+29+35+34 = **323** |

## 2. 九章清单

| 章 | id / 参考卡 | 地点/幕/议程 | 遭遇张数 | 结局数 | 章节测试 | 近似 |
| --- | --- | --- | --- | --- | --- | --- |
| 暮色庄园失踪事件 | `disappearanceAtTheTwilightEstate` / 05043 | 7/1/1 | 25 | 1 | [tcu-prologue](../tests/tcu-prologue.test.mjs) 41 | 7 |
| 巫异时刻 | `theWitchingHour` / 05050 | 14/4/2 | 26 | 6 | [tcu-witching-hour](../tests/tcu-witching-hour.test.mjs) 33 | 9 |
| 死亡门前 | `atDeathsDoorstep` / 05065 | 7/3/2 | 25 | 4 | [tcu-deaths-doorstep](../tests/tcu-deaths-doorstep.test.mjs) 34 | 11 |
| 隐秘之名 | `theSecretName` / 05120 | 16/3/4 | 34 | 3 | [tcu-secret-name](../tests/tcu-secret-name.test.mjs) 36 | 11 |
| 恶罪报应 | `theWagesOfSin` / 05161 | 11/2/2 | 24 | 4 | [tcu-wages-of-sin](../tests/tcu-wages-of-sin.test.mjs) 45 | 12 |
| 崇高利益 | `forTheGreaterGood` / 05197 | 13/3/2 | 25 | 4 | [tcu-greater-good](../tests/tcu-greater-good.test.mjs) 36 | 9 |
| 聚合幻灭 | `unionAndDisillusion` / 05238 | 9/4/2 | 28 | 11 | [tcu-union-disillusion](../tests/tcu-union-disillusion.test.mjs) 29 | 12 |
| 混沌魔掌 | `inTheClutchesOfChaos` / 05284 | 16/2/1 | 57 | 5 | [tcu-clutches-chaos](../tests/tcu-clutches-chaos.test.mjs) 35 | 7 |
| 黑色王座 | `beforeTheBlackThrone` / 05325 | 16/3/3 | 30 | 7 | [tcu-black-throne](../tests/tcu-black-throne.test.mjs) 34 | 10 |

## 3. 逐章 12 项检查

`sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors / literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance`。账本另有 `inventory`（地点/幕/议程/敌人/诡计/剧情资产/遭遇张数/放在一边/结局键/遭遇组）与 `fileHashes`（章节文件哈希），`productionGate=playable`、`generatedFrom=original-campaign-only`（ReturnTo 内容不在范围）。

- `literalCardBehavior=true` 是仓库自评；外部审计（`artifacts/tcu-audit/REPORT.md`）复核 377 条记录后指出 60 张卡含未实现子句、174 张为显式近似，因此 **不能**把 12 项全真读成规则等价。
- 布置/区域守恒：`setupLocations` + `encounterDeck` + `setAside`/`removed` + 随机变体（同名地点二选一、宇宙牌库等）都由章节 definition 声明，账本 `setupAndZones` 与运行时建局交叉核对。
- 幕/议程：`stages()` 建卡、`reveal: { type: 'campaignRule' }` 由 `behavior.actReveal/agendaReveal` 接；幕/议程的 `[action]` 归属由 `scenario.scriptCards` 声明（见规范 §4.5.1）。
- 混乱符号：全局 `tcu-chaos.js` + 各章 `chaos.js`；`resolveChaosToken`/`afterTest` 只消费 `delta/drawAnother/onFail`，状态变更回 behavior。
- 跨章记录：`encounter-rules.js` 管共享遭遇组，`campaign.records`（64 键）在 `applyResolution` 写，下章 `preScenarioSetup` 读。

## 4. 关键实现落点

- 单卡优先：`src/cards/encounter-entries/theCircleUndone/<scenario>/<code>.js` 一卡一文件；只有章节级编排留在 `behavior.js`（不按卡号写分支）。
- 共享钩子：[`content/campaigns/theCircleUndone/encounter-rules.js`](../content/campaigns/theCircleUndone/encounter-rules.js)（幽灵/第二牌堆路由、共享组规则、局面钩子）；章节覆盖时必须显式 `encounterRules.X?.(...)`。
- 引擎通用读点：[`src/engine/scenario-runtime.js`](../src/engine/scenario-runtime.js)（内容层唯一窄接口）、[`src/engine/haunted.js`](../src/engine/haunted.js)、[`src/engine/location-state.js`](../src/engine/location-state.js)、[`src/engine/alt-decks.js`](../src/engine/alt-decks.js)、[`src/engine/enemy-faces.js`](../src/engine/enemy-faces.js)。
- 剧本数据：[`content/campaigns/theCircleUndone/shared.js`](../content/campaigns/theCircleUndone/shared.js)（9 章/21 组/混乱袋/64 记录/10 Memento）、[`card-data.js`](../content/campaigns/theCircleUndone/card-data.js)（印刷数据→definition 的桥）、[`manifest.js`](../content/campaigns/theCircleUndone/manifest.js)（flow 与结局）。
- 来源锁：`audit/tcu-scenario-source-lock.json` 锁章节定义/地点/参考卡来源；`tools/scan-tcu-scope.mjs` + `tools/audit-tcu-scenarios.mjs` 复算。

## 5. 验收命令

```powershell
npm run test:tcu:scenarios        # 场景验收 + 序章 + 9 章测试（10 文件）
npm run audit:tcu:scenarios       # --check：9/9、12 项检查、逐章 testCases、来源锁
npm run test:tcu:browser          # 5 spec：规则书/交互/9 章实机/真实大厅/媒体
npm run scan:tcu:scope:check      # 章节/包/遭遇组范围
```

- 浏览器实机：`tests/tcu-scenarios.browser.mjs` 用真实内容注册表 + 真实 `createGameState` 建局，9 章 × 桌面/移动各一条路径（18 例），截图进证据目录。
- P10 外部审计实测：真实 `createGameState` 建局 8/9 通过（巫异时刻异常）、合法动作走查 23 次；Lead 独立 harness 9/9 建局、9/9 到达结算（多数 noResolution/败北，属自动策略生存力问题而非布置阻塞）。

## 6. 运行态与外部审计发现（待修）

- **high**：`beforeTheBlackThrone` 的 `api.cosmos({shuffle})` 接线错误——`scenario-runtime.js` 把 `deckbuilding.shuffle(arr, rng)` 当一元 shuffle 传给 `alt-decks.js`，`rng=undefined` → `TypeError: rng is not a function`；正常走查 3/3 首回合崩溃。
- **high**：`theWitchingHour`「介绍 2」命运选择的 +2 混乱标记被 `setupChaosBag` 重建覆盖（4 难度实际 13 枚而非 15）。
- **high**：`theWitchingHour` 议程「深夜号叫」的强制毁灭写在议程实例 `.doom`，`agendaDoom` 不统计议程实例，12 点推进阈值不受影响。
- medium：`atDeathsDoorstep` 幽灵面翻面不重置 `revealed`；`forTheGreaterGood` 议程 2 背面「替换幕/议程牌库」只用 `state.acts=[]` 近似；low：`inTheClutchesOfChaos` 南区自由行动无「手牌非空」条件导致空转、`theSecretName` 隔离建局未覆盖战役记录分支。
- 88 条近似里包含跨卡/跨章简化（阵营/记录读取、随机地点取样、宇宙二维网格线性化、裂口上限转入侵等）；每条都注明章、卡号与替代实现，见各章 `behavior.scenarioApproximations` 与账本 `remaining`。

## 7. 边界

- 9 章 `playable` 不等于 9 章规则等价：`equivalenceCertified=false`、发布口径 `earlyAccess`（见 [发布手册](./tcu-release.md)）。
- 账本 `testCases=323` 是 P10 记录值；修复轮工作区仍在变动，`npm run test:tcu:scenarios` 的当前实测可能因并发改动出现临时失败，提交前必须以工具复跑结果为准。
- `audit/tcu-scenario-acceptance.json` 由 `tools/audit-tcu-scenarios.mjs --write` 生成；改章节定义/测试后需重跑 `--write`，否则 `--check` 因哈希漂移失败。
