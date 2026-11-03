# P6 一般玩家卡验收

范围来自锁定的 `CARD_PARTITIONS.ticPlayer`：93 条记录，90 张可构筑玩家卡与 3 张基础弱点。基础弱点只作为牌组依赖，不进入手动购牌池；原有 AI 默认卡池和随机基础弱点池保持原来的选择范围。调查员包沿用 P5 验收，战役与八章仍待 P7、P8。

逐卡实现、canonical／重印号、实现通道及已执行测试的文件、行号、标题见[玩家卡账本](../../audit/tic-player-acceptance.json)。没有 `missing`、`simplified` 或绕过 API 的新增条目。`07114` 与重印 `12050` 复用同一行为。

主进程将范围分为守护者／探求者 34 条、流浪者／潜修者 35 条、生存者／中立 24 条；[分片清单](../../audit/tic-player-shards.json)检查无交集及并集守恒。三个 worker 只修改各自单卡和请求，主进程维护共享引擎、索引、内容包、文档及账本。[原语请求清单](../../audit/tic-player-queue.json)的 33 项均已落实行为测试，队列无悬挂。

请求总数、按原语与参数去重后的数量、完成／拒绝状态及观察等待统计保存在大厅根目录 `artifacts/migration/tic/reports/primitive-queue.json`。等待统计采用请求创建到主进程写入完成结果的文件更新时间，包含实现和验证时间，不把它解释为 worker 的空闲时间。

## 原语与实际接线

| 契约 | 读点与行为 |
| --- | --- |
| `additionalTokenCost` | 打出、快速反应、投入与能力费用共用精确预检；祝福／诅咒不足时不部分扣费，支持封印标记及当前隐藏值／难度。 |
| `playerTools` | 真实标记的封印、替代揭示、取消／重抽、检定后释放、检索后投入、实体宿主下方抽取、弱点捕获与离场归还；六张诅咒法术共用逐枚标记收益入口。 |
| `playTimingProvider` | 合法行动、预览、校验与执行共享 `fastSourceId`，支付秘密后使洞察事件快速并减费；伪造、过期或空白来源不可使用。 |
| 费用与供应 | 伤害、来源毁灭和抽遭遇作为能力费用；同地点共享秘密由实际持有者支付；补充资源保留已有超额数量。 |
| 实体／控制者 | 附属只修改选中的物理副本；额外法术槽即时检查容量；防具先选择控制者，再由控制者腾槽，费用支付者与所有者分别保留。 |
| 限制与构筑 | 额外交战行动耗用一次且不会被普通行动结束跳过；《先祖知识》增加五张构筑量并要求十张技能；研究升级读取实际战役记录。 |
| 存档与隐私 | 可变费用、额外行动、捕获弱点及检定中的重抽／奖励／释放字段为可选 JSON；非法续算数据拒绝载入。公共展示只含捕获数量，隐藏卡号不下发。 |

具体接口与持久化约定见[原语契约](primitives.md)。新交互复用 P4 已验收的卡面目标、选择面板和标记操作，没有另建旁路操作界面。

## 可复算验收

```powershell
npm run test:tic:player
npm run audit:tic:player
node tools/verify-tic.mjs --node
npm run test:tic:interactions:browser
node tools/verify-tic.mjs --p4-regression
node tools/verify-tic.mjs --p5-replay
node tools/verify-tic.mjs --p6-replay
npm run cards:check
npm run cards:encounter-check
npm run audit:tic:check
```

四份玩家卡测试覆盖每张卡的实际执行及补充负面／组合路径，账本生成器实跑后才允许记录 `verified`。浏览器通过真实大厅、HTTP 与引擎提交，分别在 1440 和 390 宽度操作秘典快速打出及先祖知识下方牌抽取，检查支付、区域变化、无页面错误和横向溢出，截图另存大厅根目录 `artifacts/migration/tic/p6/screenshots/`。

行为改动前锁定的 [P6 replay 基线](../../tests/fixtures/replay/tic-p6-baseline.json)不随实现更新；最终报告为[玩家卡回放](../../audit/tic-player-replay.json)、[当前 Node](../../audit/tic-node-acceptance.json)、[浏览器](../../audit/tic-interactions-browser.json)和[全量快测](../../audit/tic-interaction-regression.json)。各报告要求源码哈希在执行期间稳定，并与审计时的源码一致。
