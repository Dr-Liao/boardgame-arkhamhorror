# 《万象无终》玩家卡手册（M2）

> 范围：87 张玩家卡（85 张普通卡 + 2 张基础弱点 05041/05042），一卡一文件在 [`src/cards/entries/`](../src/cards/entries)，卡号分布在 05020–05042、05109–05119、05151–05160、05186–05324。`src/cards/entries/` 下 05 号段共 110 个条目 = 87 玩家卡 + 19 调查员/专属卡 + 4 序章故事调查员。
>
> 账本：[`audit/tcu-player-acceptance.json`](../audit/tcu-player-acceptance.json)（由 `tools/audit-tcu-player.mjs` 实跑生成）记录 87/87 verified、85 可构筑、83 可入牌组、2 张基础弱点只作依赖；生成物 [`src/cards/tcu-player-acceptance.js`](../src/cards/tcu-player-acceptance.js) 由 `--write`/`--check` 逐字节复算。总账 [`audit/tcu-all-card-acceptance.json`](../audit/tcu-all-card-acceptance.json)：377/377 verified、`simplified=234`、6 个测试文件 425 例通过。

## 1. 结构与可用性

- 一卡一条目：`export default` 恰好一个描述子（`code` 与文件名一致），行为只经描述子 + `ctx.api`；不得写回 `card-effects.js` 的 `EFFECTS` 或引擎卡号分支。
- 可用性/构筑/升级三处同时接线：[`src/deck/availability.js`](../src/deck/availability.js) 的 `TCU_INVESTIGATOR_CODES`/基础弱点、`ALL_BUILDABLE_CODES` 与 `tcuPool` 升级池；85 张可构筑，其中 83 张进入构筑界面与 TCU 战役起始牌组池。
- 2 张基础弱点：05041《第十三幻象》（treachery）、05042《高塔·XVI》（asset）只作构筑依赖，其中 05042 同时是塔罗卡（槽位读点见 [调查员手册](./tcu-investigators.md)）。
- 目录/照片/包三处状态：`content/packs/tcuPlayer/manifest.js` 为 `verified`；打印效果证据逐卡记录在玩家账本 `items[].evidence`（文件 + 行号 + 用例名）。

## 2. 批次与类型分布

4 个批次测试文件：[tests/tcu-player-m2-1.test.mjs](../tests/tcu-player-m2-1.test.mjs)、[tests/tcu-player-m2-2.test.mjs](../tests/tcu-player-m2-2.test.mjs)、[tests/tcu-player-m2-3.test.mjs](../tests/tcu-player-m2-3.test.mjs)、[tests/tcu-player-m2-4.test.mjs](../tests/tcu-player-m2-4.test.mjs)；账本测试 [tests/tcu-player-ledger.test.mjs](../tests/tcu-player-ledger.test.mjs)。当前实测 5 个文件共 123 例全过。

| 职业 \ 类型 | asset | event | skill | treachery | 合计 |
| --- | --- | --- | --- | --- | --- |
| 守卫者 | 9 | 7 | 1 | 0 | 17 |
| 探求者 | 10 | 6 | 1 | 0 | 17 |
| 流浪者 | 9 | 6 | 1 | 0 | 16 |
| 神秘者 | 11 | 4 | 1 | 0 | 16 |
| 幸存者 | 8 | 7 | 1 | 0 | 16 |
| 中立 | 4 | 0 | 0 | 1 | 5 |
| 合计 | 51 | 30 | 5 | 1 | **87** |

## 3. 逐卡验收口径

- 每张卡必须同时满足：① 打印效果有可执行读点与 Node 用例；② 已打包进 `tcuPlayer`；③ 可用性/构筑/依赖门通过；④ 账本 `evidence` 指向具体用例；⑤ `audit:tcu:player --check` 与账本/生成物逐字节一致。
- 描述子字段：`abilities[]`（`kind`：action/free/reaction/interrupt/played/commit/weakness/entersPlay/leavesPlay 等）、`modifiers[]`、`elderSign`、`playCondition`、`uses`、`fast/peril/hidden/permanent/exceptional/exile` 等；效果原语在 [`src/engine/effects.js`](../src/engine/effects.js)，目标/条件/上限/生命周期分别走 `targets.js`/`matcher.js`/`limits.js`/`lifecycle.js`。
- 与调查员/战役的衔接：直觉牌库配额（05002）、资源寄存（05003）、法术额外行动（05004）、塔罗槽位（05023/05027/05031/05035/05039/05040/05042）都在对应专属读点校验，不重复实现规则。
- 4 个 M2 通用读点（开局手牌 +1、离场回收、事件结算后窗口、条件图标）已登记在 M2 账本与测试中；M2 原语队列的 13 条 rejected 请求逐条折算为显式简化（见 §4），不写成「已迁移」。

## 4. 22 张显式简化

账本 `remaining` 里标 `显式简化：` 的玩家卡共 22 张：05021、05029、05032、05033、05036、05040、05042、05112、05152、05157、05158、05196、05230、05231、05236、05237、05279、05280、05319、05321、05322、05324；加上 5 张调查员专属卡（05009/05010/05012/05013/05019）共 27 条显式简化。主要缺口类型：

- 「无合法目标/费用不可支付」前置校验缺失（resolve-only 能力会先付成本再空结算）。
- 取消类时机（弃手牌/失资源/失行动、攻击被取消、符号标记被取消）缺通用取消窗口。
- 临时敌人数值修正、根据特性分组的槽位/配额、beneath 打出通道等既有原语不支持的写法。
- 私密信息投影（查看他人手牌）用公开日志近似。

每条的卡号、卡面子句与替代实现都写在 `audit/tcu-migration.json` 的 `remaining` 与 `artifacts/tcu-player/simplified-table.md`（运行产物，不签入）。

## 5. 验收命令

```powershell
npm run test:tcu:player        # 4 个分片 + 账本测试
npm run audit:tcu:player       # --check：87/87、85/83、证据前缀、生成物字节一致
npm run test:tcu:cards         # 战役卡验收 + 全卡账本测试
npm run audit:tcu:all-cards    # --check：377/377、425 例、234 张简化备注
npm run test:tcu               # 全部 TCU Node 用例（含 tcu-migration）
```

## 6. 已知边界

- 玩家账本 `checks.printedEffects=false`：逐卡打印效果已逐条登记，但该布尔项保留为 false（不宣称逐条等价）；外部审计（`artifacts/tcu-audit/REPORT.md`）复核玩家分片后指出 05020/05025/05118/05153 等旧结论 over-claimed，并把更多子句判为 partial/simplified。
- 22 张显式简化 + 2 张基础弱点依赖不代表卡面完整实现；`simplified=234` 是总账里所有带简化备注的卡数（含战役/调查员），不是玩家卡数。
- `audit/tcu-all-card-acceptance.json` 由 6 个测试文件实跑生成；工作区并行改动后需重跑 `--write`，否则 `--check` 会因证据过期失败。
- 不宣称规则等价：发布口径为 `playable` + `earlyAccess`，详见 [发布手册](./tcu-release.md)。

## 7. 相关手册与维护

- 玩家卡改动流程：改 `src/cards/entries/<code>.js` → `node tools/build-card-index.mjs --write` → `npm run test:tcu:player` → `npm run audit:tcu:player:write` → `npm run test:tcu:cards`；提交前 `--check` 必须逐字节一致。
- 22 张显式简化不是「待办占位」而是已验收的近似：修复任一条时同步更新账本 `remaining`、`artifacts/tcu-player/simplified-table.md` 与卡文件注释，避免重复记账。
- 玩家卡不得引用未 `verified` 的关键词 ruleId；塔罗/直觉牌库/资源寄存等专属读点见 [调查员手册](./tcu-investigators.md)，逐卡证据见 [`audit/tcu-player-acceptance.json`](../audit/tcu-player-acceptance.json)。
- 相关手册：[迁移路线图](./tcu-migration-roadmap.md) §7、[关键词与规则书手册](./tcu-rules.md)、[剧本手册](./tcu-scenarios.md)。

## 附录：复核要点

- 本文数字取自 [`audit/tcu-player-acceptance.json`](../audit/tcu-player-acceptance.json) 与 `audit/tcu-all-card-acceptance.json`；职业/类型分布由账本 items 统计。
- 复核命令：`npm run audit:tcu:player`、`npm run audit:tcu:all-cards`、`npm run test:tcu:player`、`npm run test:tcu:cards`。
- 22 张显式简化以 `remaining` 中 `显式简化：` 条目的卡号为准；修复任一条时同步更新账本与证据前缀。
- 账本/生成物任一漂移时 `--check` 会失败；重跑 `--write` 后需人工审阅 diff 再提交，不得手写账本字段。
