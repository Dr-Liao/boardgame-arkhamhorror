# P7 开发验收记录

P7 尚未完成。生产注册继续关闭，八章使用开发态定义接受专项检查；只有逐章完整行为、指南及流程验收后，才勾选主路线图。完整章验收仍为 **0/8**：本文记录的是可复算的源码与测试证据，不是逐章完成勾选。

- [x] 锁定 P7 改动前 replay 基线：`audit/tic-p7-baseline.json`、`tests/fixtures/replay/tic-p7-baseline.json`。
- [x] 补齐非玩家行动、团队费用、钥匙支付、隐藏牌堆、地图与水位等开发接口，并建立实际规则管线专项。
- [x] 接入闪回 I–XIII 的正文、记忆及奖励处理；使用实际行动、存档恢复和物理卡守恒专项复验。
- [ ] 完成全部共享遭遇卡与八章逐卡行为。
- [ ] 接通闪回 XIV、并行场景目标、四段幕间、升级窗口和完整结局。
- [ ] 完成八章中英文冒险指南、每章规则及桌面1440／移动390浏览器验收。
- [ ] 冻结来源与索引，重建审计，完成全量快测及全部既有 replay 对比。

## 2026-11-04 现场（铺路读点 + 沉睡 boss 五面）

本轮接着交接第 3 条收尾：先补引擎读点，再落「沉睡 boss 五面」（07292b / 07330a / 07330b / 07331a / 07331b）。基线仍为既有快测与 replay 口径，**没有提高任何基线**；完整章验收仍为 0/8。

### 引擎读点（4 项）

| 读点 | 位置 | 说明 |
| --- | --- | --- |
| 条目级 `enemyDamaged` 窗口 | `src/engine/enemies.js` 的 `damageEnemy`、`src/engine/combat.js` 的攻击伤害路径 | 此前只有章节 behavior 钩子，条目写 `trigger:'enemyDamaged'` 是死声明。两处都在伤害落账后派发一次，上下文带 `enemy / seat / source / damage`；普通战斗路径不经 `damageEnemy`，因此必须单独补一次。 |
| `investigationPhaseEnds` 窗口 | `src/engine/windows.js` + `src/engine/turn.js#runBetweenInvestigationPhases` | 「调查阶段结束时」的真实派发点，位于敌人阶段之前、结算回合中途；无监听者时不写任何状态。 |
| 持久修正行来源过滤 | `src/engine/modifiers.js` + `src/engine/engine.js#setModifierHooks` | `entityModifierTotal` / `entityRuleActive` 的每一行都先问 `enemyModifierAllowed`：沉睡敌人拒绝玩家卡来源的修正行，自己/地点/幕/议程/敌人光环等遭遇来源照常。默认钩子放行，非沉睡目标行为不变。 |
| `evadeSuccess` 窗口实例标识 | `src/engine/combat.js`、`src/engine/enemies.js#autoEvadeEnemy` | 同一回合对同一敌人多次躲避是多个事件；此前两条派发共用去重键会把第二次的条目级强制吞掉。现在带上 `windowInstance`（检定公开日志长度 / 日志长度），与 `testEnds` 的既有追加口径一致。 |

### 沉睡 boss 五面

- `07292b` 达贡（苏醒狂怒）：生命值 = 印刷 6 + 6×调查员人数；`testEnds` 失败后重整并攻击本地点的调查员（原先用了不存在的 `skillTestFailed` 触发，已改为与 07292a 同一窗口）。
- `07330a` / `07331a` 达贡 / 海德拉（深入沉睡）：`enemyRule.slumbering`（免疫/不能攻击/不能交战由 provenance 统一执行）；调查阶段结束时若调查员在对应巢穴且未横置 → 放 1 毁灭；`[action]` 意志(4)：成功选择横置或移除 1 毁灭，失败 ≥3 点放 1 毁灭。
- `07330b` / `07331b` 达贡 / 海德拉（苏醒狂怒）：攻击值 -1/有钥匙的圣堂地点；被躲避或受到伤害后，对场上一张对应子嗣做同样的事（多张时由触发者选择，`windowInstance` 保证每次躲避都触发）。
- 两条沉睡面、两条苏醒面分别由 `src/cards/encounter-entries/_shared.js` 的两个工厂生成（同句规则只写一次）；四张单卡文件只声明印刷差异（名字/巢穴/子嗣卡号）。

### 可复算证据

- `node --test tests/tic-maelstrom-bosses.test.mjs`：19 例全过（含真实回合流程的「调查阶段结束」派发、两条伤害路径的 `enemyDamaged` 派发、修正行来源过滤、多子嗣选择、无子嗣安全结算）。
- `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tic-p7-baseline.json`：13 局 / 797 步逐条一致，行为零变化。
- `node tools/build-encounter-index.mjs --check`：1227 个条目一致；`node tools/audit-card-entry-compliance.mjs --check`：无基线外新增违规。
- `audit/ability-coverage.json` 重建后仅反映本轮新增：非玩家卡 167→171、descriptor 能力 942→950、窗口 112→113（`investigationPhaseEnds`）、enemy 修正 63→65；engineCodes/effectsEntries/escapeCards 仍为 0。
- 全量快测：本轮改动后首跑 **5918 项 / 5911 通过 / 4 失败 / 3 跳过**；其中 3 项来自 TDE P10 账本（见下「环境漂移」），1 项是覆盖度产物漂移（已重建）。重建 `audit/ability-coverage.json` 后复跑：**5918 项 / 5914 通过 / 1 失败 / 3 跳过**，唯一失败即下面的 TDE 环境漂移，TIC 相关项无新增失败。
- **环境漂移（既有失败，非本轮引入）**：`audit/tde-migration.json` 与当前被忽略的 TDE 证据产物不一致——`artifacts/tde-migration/` 少 20 张 completion-guide 截图（93→73），`artifacts/migration/tde/primitive-requests/` 又残留 18 个旧请求文件（账本记录为 0）。这属于交接所说「过程 artifacts 需随工作区整体交接」的丢失，不是源码回归；TDE 账本保持提交态不动，待恢复/重采证据后单独重建，本轮不把它计入 TIC P7 失败。

### 仍未完成（更新交接顺序）

1. **并行幕**（Flashback XIV、多活动幕、各自进 Victory2、继续/结局选择）与载具原子乘客批移动、真实驾驶正反面、Road 移除、步行额外行动费用。
2. 剩余牌：`enemyDamaged` 已接线（本条完成）；仍缺 07086 动态 Aloof、07106 调查员 DeepOne 持续 trait、捕获/押送、换面后 artCode/卡面图、敌人附件离场清理，以及 `enemyMoved` 的跟随/移除路径。
3. `typed target`：本轮五面不需要额外过滤（07163 的 `trackTestTarget` 读点不变；boss 行动的检定经既有 `options.testTarget` 通道，未引入新的死声明）。
4. 八章指南与逐章验收：boss 实际入场（07313/07314/07315 的翻面与入场 entry 仍未写）、暗置身份、私有堆守恒、完整故事分支、布局；逐章 Node/replay/桌面 1440/移动 390。
5. 剩余单卡：252 个分配号中已落盘 171 个条目文件（**81 张仍无文件**），清单见下节。

## 2026-11-03 20:30 现场（交接后的第一轮）

接手时交接文档列的 9 项失败已逐项定位并修复，当前源码的全量快测与既有 replay 都通过：

- `npm run test:fast`：5883 项、5880 通过、0 失败、3 跳过（`fast-eighth.log`，82s）。
- `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tic-p7-baseline.json`：13 局 / 797 步逐条一致，行为零变化（`replay-fifth.log`）。
- 新增 `tests/tic-scenario-reference-final.test.mjs`（200 例）：07041/07123/07163 三张提示卡的四档难度、取消窗口、depths、路障与带类型战斗/躲避分支全部实跑通过。

### 失败根因与修复

| 交接失败 | 根因 | 处理 |
| --- | --- | --- |
| 旧异端者翻面 | `enemy-faces.js` 新 fallback 对已离场/不匹配的实体直接调 `applyPhysicalFace` 并抛错 | 新增 `physicalFacePlanIfAny` 探测接口；不在场或非合法同类型双面时保留旧的「返回 null」语义，只有真实双面才替换印刷值 |
| Flashback 真实 Depth 行动 | 夹具假设「拿完三件遗物也不推进」，但 07167 印刷目标是「控制紫/白/黑三把钥匙，推进」 | 每个地点改为在「三处已揭示」同一初始局面的副本上验证；另加一例断言三遗物真的完成幕目标并进入 interlude3 → horrorInHighGear，同时核对记忆与 terror 记录 |
| 07283 Grand Entryway | 夹具把「洞穴」写成 07291（达贡巢穴，特性是 Lair） | 改用真实 [[Cave]] 地点 07102；`locationRule.connectsToTrait` 双向连接、紫色钥匙与 3n 线索费用全部实跑通过 |
| 八张 scenario reference 无法归属 | 归属算法没有把「关卡自己的 referenceCode」当 token | `collectScenarioTokens` 增加 scenario/manifest 的 referenceCode 与 originalCode；复算 0 unresolved，且只有这 8 条路径变化 |
| Harper 议程 import `_roles.js` | 帮助模块放在了条目私有的旁路文件 | 身份表并入 `encounter-entries/_shared.js`，`content/.../role-data.js` 只读再导出，三张议程改走共享出口；守卫恢复 |
| tier/node-suite 不一致 | 6 个新用例文件未登记 | 6 个文件 + 新提示卡用例全部登记进 `tests/suites.mjs` 与 `tests/node-suite.mjs` |
| content 卡号规则分支 | `companions-setup.js` 用 `code === '07083'` 判断 | 改为内容数据常量列表（同伴进牌库/暂取），不再写按卡号分支；基线回到 0 |
| 覆盖度产物漂移 | 新条目与声明窗口未重建审计 | `audit-abilities --write` 后审阅：增长全部来自 TIC 非玩家条目（47→166 卡、795→940 能力、106→112 声明窗口），遗留指标 engineCodes/effectsEntries 仍为 0 |
| TCU 审计来源漂移 | 共享接口改动 + `tests/suites.mjs` 属于 TCU 玩家卡证据集 | 先重跑 `audit-tcu-player --write`（87/87 仍 verified、166 例通过），再重建 `audit/tcu-migration.json`：只有源哈希变化，gate 仍 pass |

同时修掉交接文档未记录的 TDE 账本漂移：`tools/audit-tde.mjs` 已把浏览器配置路径改成 `tests/playwright/playwright.tde.config.mjs`，但 `audit/tde-migration.json` 仍是旧路径与旧哈希。重建后只有 3 个源的哈希/路径变化，gate 仍 pass、388/388 逐卡与 671 例 Node 验收不变。

### 仍未完成（按交接优先级）

1. 沉睡与效果来源：**第一片已落地**（见下节）；剩余：地点/密谋钩子来源、typed target 过滤、持久修正来源读点、boss 卡本身。
2. 并行幕（Flashback XIV、多活动幕、各自进 Victory2、继续/结局选择）与载具原子乘客批移动、真实驾驶正反面、Road 移除、步行额外行动费用。
3. 剩余牌：`enemyDamaged` 通用窗口派发、07086 动态 Aloof、07106 调查员 DeepOne 持续 trait、捕获/押送，以及换面后 artCode/卡面图、敌人附件离场清理。
4. 八章指南与逐章验收：boss 实际入场、暗置身份、私有堆守恒、完整故事分支、布局；逐章 Node/replay/桌面 1440/移动 390。

### 2026-11-03 21:00 效果来源 provenance（交接第 3 条第一片）

新增 [src/engine/effect-provenance.js](../../src/engine/effect-provenance.js)：进程内帧（WeakMap，**不写 state**，不改变存档与重放指纹）记录「现在这条效果来自哪张卡、属于玩家卡还是遭遇/剧本来源」。

- 权威口径：`asset/event/skill/investigator` **以及无人控制的 `story` 剧情资产**都是玩家卡来源；`enemy/location/act/agenda/treachery/scenario` 是遭遇来源；未知类型返回 null，不按 actor 座位猜。
- 接线：`runExecuteDescriptor` 在整段 resolve（含内部再开的窗口）压帧；`canDamageEnemy` 与 `legalMoves`/`validateMove` 的攻击、躲避、额外躲避、交战都先问 `enemyEffectAllowed`。
- 沉睡：条目声明 `enemyRule.slumbering: true`（注册期只接受布尔值）。沉睡敌人免疫玩家卡效果与调查员行动，剧本/遭遇来源（例如圣堂地点的印刷效果）照常，来源未知时 fail-closed；判定读**当前印刷面**，换面或文本被抹除后立即失效。
- 证据：`tests/tic-effect-provenance.test.mjs`（13 例）逐条验证分类、嵌套帧还原、真实描述子结算的来源、章节钩子的剧本来源帧（含 `Object.freeze` 的 behavior）、沉睡伤害双向、攻击/躲避/交战的合法行动与提交校验、沉睡敌人不被自动交战也不能攻击、玩家卡效果不能横置/位移/交战/躲避/击败而遭遇来源与敌人阶段重整照常、抹除文本恢复、注册期校验、存档无来源字段。全量快测 5896 项 0 失败、既有 replay 13 局 797 步一致（行为零变化）。
- 章节钩子来源帧：`scenarioBehavior(state)` 现在返回按 state 缓存的「剧本来源」包装（冻结友好，不用 Proxy），钩子内部写入算剧本来源，钩子里再结算某张卡仍压自己的帧。
- 沉睡的「不能攻击 / 不能与调查员交战 / 免疫玩家卡效果」已接线：`enemyAttack`、`engagesAutomatically`、`canDamageEnemy`、`legalMoves`/`validateMove`（攻击/躲避/额外躲避/交战）先问 `enemyEffectAllowed`（fail-closed）；`exhaust`/`ready`/`moveEnemy`/`engage`/`autoEvade`/`defeatEnemy`/`flipEnemy` 等写入口用 `enemyPlayerEffectBlocked`——只有来源明确是玩家卡才拒绝，敌人阶段与剧本自动结算（无来源帧）照常，圣堂之类的遭遇来源也照常。
- 尚未接线（写 boss 卡前最后一小步）：`typed target` 过滤与持久修正行读点（`enemyModifierAllowed` 已备好但尚无读点）。


### 尚未落盘的单卡（按 shards.json 与磁盘实测，2026-11-04 更新：81 张）

按权威分片逐号核对（252 个分配号 ↔ 磁盘单卡文件，当前已落盘 171 个条目文件），以下 81 张仍无条目文件。**不要预建空文件**：多数卡的印刷正文需要先补引擎接口（并行幕、载具/Road、捕获/押送等），再按「一卡一文件 + 原语队列」写。2026-11-04 本轮已落盘：07292b（修正为真实条目）、07330a、07330b、07331a、07331b；07292a 已在 2026-11-03 落盘。

- early 缺 15：07060, 07061, 07062a, 07086, 07090, 07094, 07095, 07099, 07105, 07106, 07107, 07124, 07125, 07126, 07127
- middle 缺 33：07164, 07164b, 07165, 07165b, 07166, 07168, 07178, 07183, 07185, 07187, 07188, 07199, 07199b, 07200, 07201, 07202, 07204a, 07204b, 07204c, 07205a, 07205b, 07208a, 07208b, 07208c, 07209a, 07209b, 07210, 07211a, 07211b, 07212a, 07212b, 07213, 07214
- late 缺 33：07232, 07233, 07234, 07235, 07236, 07237, 07238, 07239, 07247, 07249, 07250, 07252, 07252b, 07253, 07259, 07260, 07280, 07281, 07282, 07293, 07297, 07299, 07313, 07314, 07315, 07316, 07317, 07318, 07320, 07321, 07332, 07337, 07338

抽查确认这些号大多带真实印刷行为（例：07168 渔船撤退与钥匙放置、07204a 载具离场共同费用、07313 全程淹没的求取空气、07164 海洋移动额外费用、07280 幕目标、07292a/07330a 沉睡达贡的免疫与翻面），因此不能仅以「已有章节 behavior」计入完成。

| 已接接口 | 规则验收入口 |
| --- | --- |
| 遭遇牌成本、远程全组线索、实际幕行动、按钥匙条件闪回 | `tests/tic-scenario-cost-followup.test.mjs` |
| 钥匙复合成本及彩色选择 | `tests/tic-scenario-key-cost.test.mjs`、`tests/tic-scenario-interactions.browser.mjs` |
| 原子横置生成、显现生成地点、敌人线索转移 | `tests/tic-scenario-atomic-spawn.test.mjs`、`tests/tic-scenario-spawn-followup.test.mjs` |
| 特性连接、圣堂排水与躲避、场景记忆 | `tests/tic-scenario-template-followup.test.mjs` |
| 同行动内独立事件发生次数 | `tests/tic-scenario-occurrences.test.mjs` |
| 真实区域移动、实例槽位豁免、恰好下次重整 | `tests/tic-scenario-zones-followup.test.mjs` |
| 隐藏面水位限制、同地点威胁激活、只选钥匙、无生命值敌人 | `tests/tic-scenario-advanced-followup.test.mjs` |
| 闪回 I–XIII、实际深渊行动、钥匙关联遗物、控制三钥匙推进 | `tests/tic-flashbacks.test.mjs` |
| 恶魔礁与全速恐惧1–4人初始设置 | `tests/tic-scenarios-middle-setup.test.mjs` |
| 07041/07123/07163 提示卡四档难度与 typed 战斗/躲避分支 | `tests/tic-scenario-reference-final.test.mjs` |

开发日志、测试草稿、逐卡SHA、剩余请求和截图放在仓库根目录 `artifacts/migration/tic/p7/`；运行源码不依赖该目录。主路线图中的 P7 保持未勾选。
