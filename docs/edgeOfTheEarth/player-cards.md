# P6 一般玩家卡（《地球边缘》）

本批范围为 115 条一般玩家卡记录（`08019`–`08133`）：111 张可构筑玩家卡（资产 72 / 事件 33 / 技能 6，含 4 张弱点型资产以外的全部）与 4 张基础弱点（`08130`–`08133`，只作随机基础弱点依赖，不进入构筑池）。逐卡状态由[玩家卡审计](../../audit/eote-player-acceptance.json)复算；[路线图](README.md)只有在当前源码的 Node、浏览器与回归门禁通过后才勾选。

本阶段不开放战役与章节（P7–P8）。`eotePlayer` 包独立升为 playable：115 条记录全部登记 `rulesImplemented=true`，111 张可构筑卡进入构筑界面与开放玩家卡池，4 张基础弱点只作依赖；`eoteCampaign` 保持 catalog-only，大厅不出现该战役入口。

## 分片与验收

分片来自 P0 scope 的 `shards.playerWaves`（并集恰好为 `partitions.eotePlayer`，无交集）：

| 分片 | 卡号 | 张数 | 测试 |
| --- | --- | --- | --- |
| M2-1 | `08019`–`08048` | 30 | `tests/eote-player-m2-1.test.mjs` |
| M2-2 | `08049`–`08078` | 30 | `tests/eote-player-m2-2.test.mjs` |
| M2-3 | `08079`–`08108` | 30 | `tests/eote-player-m2-3.test.mjs` |
| M2-4 | `08109`–`08133` | 25 | `tests/eote-player-m2-4.test.mjs` |

每张卡一个单卡文件 `src/cards/entries/<code>.js`（`export default` 一个条目、`code` 等于文件名），仅通过描述子与 `ctx.api` 改写状态；没有任何一张卡在引擎里加卡号分支。每张卡至少一条实跑行为测试（标题 `P6 <code> …`），覆盖费用、槽位、使用次数、职阶/属性、目标、窗口、区域、持续时间、每轮/每局限制、升级折扣与代表性负面路径；基础弱点覆盖抽到/显现与去向。

四份分片测试由 `tools/audit-eote-player.mjs` 实跑并汇总为 `audit/eote-player-acceptance.json`，同时生成 `src/cards/eote-player-acceptance.js`（已验证/可构筑/基础弱点码表，供 manifest 与 availability 读取，不手写卡号清单）。`audit/eote-player-shards.json` 记录分片与 worker，`audit/eote-player-queue.json` 记录原语请求；账本要求队列无 pending、分片并集精确、无简化卡。

## 共用原语与通道

P6 期间新增/复用的声明式读点集中在：`ctx.api` 的下一次检定加值、免费移动额度、跨座位快速事件候选、场外 `setAside` 通道、手牌转移与「如同自己手牌」打出、指定混沌标记「咒印」替代揭示、调查成功的线索发现替换、附属区技能投入、沉稳（composure）扩展到伤害侧、伤害分配限制、`lookAt` 6 张排列等。所有读点均为通用原语（无卡号分支），并附引擎/行为测试；卡条目只声明 flag/字段或调用 `ctx.api`。`eotePlayer` 卡牌不进入 `PLAYABLE_INVESTIGATOR_CODES`/AI 自动牌组默认池，既有 13 局 golden replay 保持零漂移；可构筑码表只进入开放玩家池（`EXPANDED_PLAYER_CARD_CODES`）与构筑界面。

## 验证与证据

在 Mod 目录运行。先合并全部单卡文件并统一重建索引，再生成验收；运行期间哈希变化会阻止确认。

```powershell
node tools/build-card-index.mjs --write            # 合并 115 张单卡文件后统一重建
node --test tests/eote-player-m2-1.test.mjs tests/eote-player-m2-2.test.mjs tests/eote-player-m2-3.test.mjs tests/eote-player-m2-4.test.mjs
node tools/run-eote-player-browser.mjs             # 真实大厅构筑池 + 卡牌行为（桌面 1440 / 移动 390）
node tools/audit-eote-player.mjs --write           # 实跑分片测试 → 账本 + 生成可构筑码表
node tools/audit-eote-player.mjs --check
node tools/verify-eote.mjs --node                  # 含四份分片测试
node tools/verify-eote.mjs --regression            # test:fast 无新增失败 + replay 零漂移
node tools/audit-eote-investigators.mjs --check
node tools/audit-eote-primitives.mjs --check
node tools/audit-eote-rules.mjs --check
node tools/audit-eote-interactions.mjs --check
```

浏览器验收经真实大厅 HTTP 通路：构筑池开放（生产大厅 `/api/catalog` 的构筑卡池须含 EotE 可构筑卡）与代表性卡牌的真实 UI 行为（事件打出、资产装备/攻击、技能投入检定、基础弱点显现），双视口截图；账本 `audit/eote-player-browser.json`。生产 Mod 不注册测试卡、不增加调试 HTTP 入口。

逐卡结论写入 `audit/eote-player-acceptance.json`；过程日志与截图位于大厅根 `artifacts/migration/eote/p6/` 与 `artifacts/migration/eote/reports/`。任何 `missing`、简化或阻塞卡都不进入账本已完成数量或构筑池。
