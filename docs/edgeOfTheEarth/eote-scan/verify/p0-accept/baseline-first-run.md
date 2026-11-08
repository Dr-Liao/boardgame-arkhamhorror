# 验收套件 · 修复前 baseline 记录（真实运行，非模拟）

> 用途：task-8 要求「先跑一遍记录修复前 baseline（当前应为大量 FAIL）」。本轮修复由 7 名 owner 并发推进，
> 因此 `baseline-results.json`（同名 label 会被后续复跑覆盖）最终保存的是**修复中快照**；
> 真正「修复前首跑」的完整 stdout 见会话日志，此处如实转录其逐项 FAIL 摘要与总览。
>
> 采集时间：2026-11-08 20:52（Asia/Shanghai）
> 命令：`node docs/edgeOfTheEarth/eote-scan/verify/p0-accept/run.mjs --label baseline --no-ledger-check`
> 环境：生产组合根 `tests/eote-p8-fixture.mjs` + `content/registered.js`，Node v22.23.1；首跑耗时约 26s。

## 总览

**PASS 100 / FAIL 49（138 项断言，2 条实测记录）**；P0-12 已先落地为 PASS，其余 P0 项 FAIL。

## 逐项 FAIL 摘要（原文转录）

| 项 | 断言 | 主要 FAIL（期望 → 实测） |
| --- | --- | --- |
| P0-1 | 8/10 | IDP3 legalMoves 无 scenarioAction（actions=play,draw,resource,move,investigate,endTurn） |
| P0-2 | 10/12 | IDP1/IDP2 议程背面剧情事件为空（story=[]） |
| P0-3 | 12/14 | IDP3 afterTest：[cultist] deck 28→28 / horror 0→0；[tablet] deck 28→28 / discard 0→0 |
| P0-4 | 6/7 | 进入未探索地点未揭示（revealed=false，线索 2→0 已扣但未揭示） |
| P0-5 | 16/18 | 全员被击败后 status=playing 未落 noResolution；翻面 applyMove 抛错 |
| P0-13 | 8/9 | performTest [skull] delta=-2 与期望不一致（该期望当时写错，后按印刷修正为 -X） |
| P0-6 | 3/9 | claimKey/giveKeys 不在 legalMoves（scenarioActions=[]）；幕 1 keyActions 不出现；checkAct 不推进 |
| P0-12 | 3/3 PASS | （早于此轮修复已落地） |
| P0-7 | 9/11 | 08716 抛 TypeError；真实躲避后果未发生 |
| P0-8 | 6/14 | Peaks/City 遭遇牌库缺共享组；08612/08613 drawEncounter 抛 `options.resolve is not a function`（peaks owner 后续修复） |
| P0-9 | 9/13 | 08105/08107 窗口出现但未支付横置；08091 未替换咒印；08130 威胁区未移除 |
| P0-10 | 8/11 | 08013a flipAfter 缺失；08014a 额度 3 未清理（当时断言只看 endTurn，后改为下一轮调查阶段口径） |
| P0-11 | 1/5 | scenario-ledger 129/129 全落 Heart Part2；invalid=133 |

> 说明：该首跑时部分 owner 修复已开始落地（故有 PASS 项），且 20:42 `src/engine/play-channels.js`
> 编码事故刚由 Lead 重建恢复；此后随修复推进的复跑收敛：20:55→121/28、21:06→142/12、21:09→146/9、
> 21:13→150/5、21:52 最终→165/0。`baseline-results.json` 为 21:13 修复中快照（P0-11 FAIL、其余 PASS）。
