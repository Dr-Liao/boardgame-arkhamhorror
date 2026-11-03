# P7 开发验收记录

P7 尚未完成。生产注册继续关闭，八章使用开发态定义接受专项检查；只有逐章完整行为、指南及流程验收后，才勾选主路线图。

- [x] 锁定 P7 改动前 replay 基线：`audit/tic-p7-baseline.json`、`tests/fixtures/replay/tic-p7-baseline.json`。
- [x] 补齐非玩家行动、团队费用、钥匙支付、隐藏牌堆、地图与水位等开发接口，并建立实际规则管线专项。
- [x] 接入闪回 I–XIII 的正文、记忆及奖励处理；使用实际行动、存档恢复和物理卡守恒专项复验。
- [ ] 完成全部共享遭遇卡与八章逐卡行为。
- [ ] 接通闪回 XIV、并行场景目标、四段幕间、升级窗口和完整结局。
- [ ] 完成八章中英文冒险指南、每章规则及桌面1440／移动390浏览器验收。
- [ ] 冻结来源与索引，重建审计，完成全量快测及全部既有 replay 对比。

| 已接接口 | 规则验收入口 |
| --- | --- |
| 遭遇牌成本、远程全组线索、实际幕行动、按钥匙条件闪回 | `tests/tic-scenario-cost-followup.test.mjs` |
| 钥匙复合成本及彩色选择 | `tests/tic-scenario-key-cost.test.mjs`、`tests/tic-scenario-interactions.browser.mjs` |
| 原子横置生成、显现生成地点、敌人线索转移 | `tests/tic-scenario-atomic-spawn.test.mjs`、`tests/tic-scenario-spawn-followup.test.mjs` |
| 特性连接、圣堂排水与躲避、场景记忆 | `tests/tic-scenario-template-followup.test.mjs` |
| 同行动内独立事件发生次数 | `tests/tic-scenario-occurrences.test.mjs` |
| 真实区域移动、实例槽位豁免、恰好下次重整 | `tests/tic-scenario-zones-followup.test.mjs` |
| 隐藏面水位限制、同地点威胁激活、只选钥匙、无生命值敌人 | `tests/tic-scenario-advanced-followup.test.mjs` |
| 闪回 I–XIII、实际深渊行动和钥匙关联遗物 | `tests/tic-flashbacks.test.mjs` |
| 恶魔礁与全速恐惧1–4人初始设置 | `tests/tic-scenarios-middle-setup.test.mjs` |

开发日志、测试草稿、逐卡SHA、剩余请求和截图放在仓库根目录 `artifacts/migration/tic/p7/`；运行源码不依赖该目录。开发期间的全量运行有失败，不能作为最终验收证据。主路线图中的 P7 保持未勾选。
