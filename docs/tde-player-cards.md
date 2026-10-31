# 《食梦者》玩家卡手册（M2 / P7）

> **状态（2026-10-31）**：P7 / M2 完成。87 条玩家包记录（`tdePlayer`）逐卡实现并由 4 个分片测试实跑验收：
> **72 张可入牌组 + 11 张场外绑定卡/绑定弱点（`deckLimit=0`，只作依赖）+ 4 张基础弱点**。
> 账本 [`audit/tde-player-acceptance.json`](../audit/tde-player-acceptance.json) 逐字节复算口径：87/87 verified、0 blocked、**57 张显式简化**、101 例逐卡测试；生成物 [`src/cards/tde-player-acceptance.js`](../src/cards/tde-player-acceptance.js) 由 `--write`/`--check` 逐字节复算。
> 事实来源：[`scope.json`](../artifacts/migration/tde/scope.json) 的 `shards.playerWaves`、[`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)、P7 worker 报告。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.2；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §4.6（多子进程 + 原语队列）。
> 过程证据：[`tde-p7-report.md`](./tde-p7-report.md)。

## 1. 事实：87 条记录 = 72 可入牌组 + 11 场外绑定 + 4 基础弱点

| 分片 | 记录数 | 卡号 | worker |
| --- | ---: | --- | --- |
| `M2-1` | 22 | 06018–06034、06110（含 4 张基础弱点 06035–06038 与绑定弱点 06019/06025） | `w-m2-1` |
| `M2-2` | 22 | 06111–06118、06155–06167、06195（含绑定副本 06113） | `w-m2-2` |
| `M2-3` | 22 | 06196–06205、06234–06245（含 Myriad 集群 06199/06241–06243/06245 与 Researched 06236–06238） | `w-m2-3` |
| `M2-4` | 21 | 06246、06276–06285、06323–06332（含绑定对 06276/06277、06282/06283、06330/06331 与 escape 卡 06329/06331） | `w-m2-4` |
| 合计 | **87** | 06018–06332 | — |

- **可入牌组 72 张**；**依赖卡 15 张**：11 张 `deckLimit=0` 的场外绑定卡/绑定弱点（06019、06022、06025、06028、06031、06032、06033、06113、06277、06283、06331）+ 4 张基础弱点（06035 自私自利、06036 偷窃癖、06037 嗜睡症、06038 最可怕的噩梦）。
- 印刷包分布：`tde` / `sfk` / `tsh` / `dsm` / `pnr` / `wgd` / `woc`（P1 账本为准）。
- 关键词归属（P2 实测）：**Myriad 14 张**全部在玩家包；**Researched 3 张**（06236–06238 梦境日记）；**Bonded 27 条**中玩家包 21 条（含 4 条绑定弱点）。

## 2. 卡片契约

- **一张有行为的卡 = 一个文件**：`src/cards/entries/<code>.js`，`export default` 恰好一个条目，`code` 等于文件名；不得写进 `card-abilities.js` 或任何批次大数组。
- 卡文件不得 import `engine.js` / `card-abilities.js` / 批次文件 / `content/`；只通过描述子与 `ctx.api` 改状态。
- 同一执行内：写单卡文件 → `node tools/tde-p7-index-sync.mjs`（串行索引同步）→ `node --test tests/tde-player-m2-<n>.test.mjs`。合并后由主进程统一 `node tools/build-card-index.mjs --write`。
- 未实现的子句一律 `simplified: true` + `note`（写明未实现什么/缺哪个读点/已实现哪部分），报告 `simplified[]` 汇总；**不 silent 简化、不 blocked 占位**。

## 3. 逐卡验收口径

| 项 | 结果 |
| --- | --- |
| 分片测试 | 4 个文件：`tests/tde-player-m2-1…4.test.mjs`，四片合计 **101 例**（22/23/23/31 例 + 账本测试 6 例，共 107 例） |
| 实跑证据 | 每张卡至少 1 条 `TDE <code> <中文名>` 前缀的真实行为测试（fixture/打出/触发/检定/断言状态）；账本逐卡记录 `evidence:{file,line,test}` |
| 账本 | `audit/tde-player-acceptance.json`：87/87 verified、72 可入牌组、15 依赖、57 简化、`testsPassed=101` |
| 生成物 | `src/cards/tde-player-acceptance.js`：verified 集合、基础弱点集合、profile、sha256；`--check` 逐字节比对 |
| 包清单 | `content/packs/tdePlayer/manifest.js`：`status: playable`、87 张 `rulesImplemented:true`、72 张 `deckbuilding:true`、15 张 `dependencyOnly:true` |
| 可用性 | `src/deck/availability.js`：87 条 strict、72 张进 `ALL_BUILDABLE_CODES`、15 张 `dependencyOnly`、默认构筑池不变 |
| 构筑/升级池 | `src/deck/deckbuilding.js` 开放玩家池收录 72 张；`src/campaign/campaign.js` 仅 06 记录可见 06 卡（01–05 记录看不到） |
| Myriad | `web/deck-rules.js`：逐卡 `deckLimit` + 同名跨卡号 3 张上限（`MYRIAD_TITLE_LIMIT`/`myriadUsage`）；`src/engine/myriad.js` 在 `buildDeckFromList` 兜底；`web/hub.js` 构筑界面显示同名 n/3 |
| Researched | 06236/06237/06238 条目声明 `researchRequirement:'youHaveInterpretedTheDreams'`；记录由 06112（0 级梦境日记）用 `api.recordResearch` 写入；未记录时不可购入 |

## 4. 显式简化（57 张，逐卡 note 见条目与账本 `remaining`）

| 分片 | 简化数 | 代表口径 |
| --- | ---: | --- |
| M2-1 | 13 | 绑定贡品/附着物理形态、遭遇牌库玩家卡显现、动态地点连接、神话抽取步骤替换、跨调查员限制类弱点 |
| M2-2 | 15 | 检定期间反击/警戒+抽牌、绑定副本离场去向、取消显现的弃置时点窗口、部分「下一张免费」类窗口 |
| M2-3 | 16 | 三张同名合体结算、绑定副本条件图标、工程化槽位（`restrictedSlots` 近似）、行动历史类额外行动、部分成功奖励 |
| M2-4 | 13 | 符号效果替换（黑猫）、负技能图标/强制投入（梦境寄生物）、绑定交换的场外实体细节、部分取消标记窗口 |

- 简化不是「未迁移」：主印刷效果已实现并测试；未还原子句逐条写进 `note`，账本 `remaining` 单列，P8/P10 前必须处理或保持显式。
- P7 保持 `literalCardBehavior=false` 口径：不宣称规则等价。

## 5. escape 逃生口（P3 登记，P7 收尾）

| 卡号 | 名称 | P7 结果 |
| --- | --- | --- |
| 06164 | 飘渺灵体 | `simplified`：「无形」状态位（不能交战/攻击/伤害）无通用读点，按显式简化 |
| 06329 | 闪耀的偏方三八面体 | `simplified`：费用替代管线成功分支可实现，失败取消分支简化 |
| 06331 | 梦境寄生物 | `simplified`：负技能图标 + 强制投入无通用原语（负图标/强制投入留 P8 评估） |

## 6. 原语请求队列（5 条，全部 `rejected` + 替代方案）

`artifacts/migration/tde/primitive-requests/` 保留 5 条 worker 请求（P7 主进程按「显式简化优先」回写 `rejected`，附 `resolution.suggestion`，作为 P8/P10 评估依据）：

| 请求 | 卡 | 建议 |
| --- | --- | --- |
| `searchedCardRule.resolve` | 06023 | P7 用固定动作 `discard` 近似；自定义 resolve 留 P8 |
| 遭遇牌库玩家卡通道 | 06028 | P7 数据/绑定关系可验证 + note；显现通道留 P8 |
| `locationLink` 动态连接 | 06029 | P7 地点附属形态 + note；连接读点留 P8 |
| 神话抽取步骤替换窗口 | 06110 | P7 查看/排列近似 + note；步骤替换留 P8 |
| 诡计弃置时点窗口 | 06156 | P7 用 `encounterDrawn` + `api.cancelEncounterDraw` 近似；完整窗口留 P8 |

统计：`artifacts/migration/tde/reports/primitive-queue.json`（`pending 0 / claimed 0 / done 0 / rejected 5`，gate.pass=true）。

## 7. 验收命令

```powershell
npm run test:tde:player      # 4 个分片 + 账本测试（107 例）
npm run audit:tde:player     # --check：87/87、72/15、证据前缀、生成物字节一致
npm run report:tde:player    # workers.json / primitive-queue.json（87 done / 0 blocked / 57 simplified）
npm run cards:check          # 索引 + 一卡一文件 + 条目合规（TDE 新增 0 条 R1/R2/R3）
node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json
```

## 8. 边界

- `content/packs/tdePlayer` 已 `playable`，但**未注册进 `content/registered.js` bundle**（三个 TDE 包与战役一起在 P10 接入，路线图 §10.2 接入点 1）；P7 只完成卡池、构筑与升级接线。
- 57 张显式简化 + 15 张依赖卡不代表卡面完整实现；账本 `remaining` 是 P8/P10 的处理清单。
- 战役章节已由 P8 落地为 `development`（8/8，283 条记录全落点）；选人与构筑已可用；剧情自译属 P8-T、真实双线开闸属 P9.5、注册发布属 P10。
- 不宣称规则等价：发布口径为 `playable` + `earlyAccess`，详见 [`tde-release.md`](./tde-release.md)。

## 9. 相关手册与维护

- 逐卡行为：`src/cards/entries/<code>.js` + 4 个分片测试；账本 `audit/tde-player-acceptance.json`（`--write` 生成，不手改）。
- 修改流程：改条目 → `node tools/tde-p7-index-sync.mjs` → `npm run test:tde:player` → `npm run audit:tde:player:write` → 审阅 diff → `npm run audit:tde:player`（必须逐字节一致）。
- 维护：分片与卡数以 `scope.json` 的 `shards.playerWaves` 为准；原语账本见 [`tde-primitives.md`](./tde-primitives.md)，关键词/规则书见 [`tde-rules.md`](./tde-rules.md)，调查员见 [`tde-investigators.md`](./tde-investigators.md)。
