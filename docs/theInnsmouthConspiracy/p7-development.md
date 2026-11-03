# P7 开发验收记录

P7 尚未完成。生产注册继续关闭，八章使用开发态定义接受专项检查；只有逐章完整行为、指南及流程验收后，才勾选主路线图。完整章验收仍为 **0/8**：本文记录的是可复算的源码与测试证据，不是逐章完成勾选。

- [x] 锁定 P7 改动前 replay 基线：`audit/tic-p7-baseline.json`、`tests/fixtures/replay/tic-p7-baseline.json`。
- [x] 补齐非玩家行动、团队费用、钥匙支付、隐藏牌堆、地图与水位等开发接口，并建立实际规则管线专项。
- [x] 接入闪回 I–XIII 的正文、记忆及奖励处理；使用实际行动、存档恢复和物理卡守恒专项复验。
- [ ] 完成全部共享遭遇卡与八章逐卡行为。
- [ ] 接通闪回 XIV、并行场景目标、四段幕间、升级窗口和完整结局。
- [ ] 完成八章中英文冒险指南、每章规则及桌面1440／移动390浏览器验收。
- [ ] 冻结来源与索引，重建审计，完成全量快测及全部既有 replay 对比。

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

1. 沉睡与效果来源：权威嵌套 provenance、玩家全效果免疫、typed target 过滤、持久修正来源；提案在 `artifacts/migration/tic/p7/workers/late-effect-provenance-proposal.mjs`，尚未落地。
2. 并行幕（Flashback XIV、多活动幕、各自进 Victory2、继续/结局选择）与载具原子乘客批移动、真实驾驶正反面、Road 移除、步行额外行动费用。
3. 剩余牌：`enemyDamaged` 通用接线、07086 动态 Aloof、07106 调查员 DeepOne 持续 trait、捕获/押送，以及换面后 artCode/卡面图、敌人附件离场清理。
4. 八章指南与逐章验收：boss 实际入场、暗置身份、私有堆守恒、完整故事分支、布局；逐章 Node/replay/桌面 1440/移动 390。

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
