# 《铁杉谷盛宴》P2 原语

原语计划记录 P1 的 28 项缺口及逐项状态。未完成的项目列在 `pending` 数组中，状态为 `partial` 的项目已有部分引擎接线。任一项尚未验收时，P2 门禁失败。 [原语计划](../../../audit/fhv-primitive-plan.json)

只读目录从当前引擎读取效果、能力种类、窗口、matcher、目标、打出通道和 API 分组。 [原语目录](../../../audit/fhv-primitive-catalog.json)

| 领域 | 引擎接入与复用 |
| --- | --- |
| 日期与法典 | `api.mechanics.calendar` 写入当前日期，`duringPeriod` 用来源实体所在地点决定局部时段。法典声明按顺序挑选首个符合条件的分支，调用方在现有费用管线成功后调用 `codex.resolve`。省略触发者时由队长结算，支持每场、每幕和不限次。 |
| 居民 | `api.mechanics.residents` 在授权的战役记录键上增减有界等级、登记笔记或划除。划除状态与法典门控共同使用。 |
| 网格与移动 | `map.emptyAdjacent` 返回未占用正交格，`map.relocate` 先校验最终坐标再提交位置变动。巡逻配置写 `enemyRule.patrolTarget`，由敌人阶段处理命名地点、特质/线索、空地点或居民所在地点。`rail` 复用网格和载具移动。 |
| 攻击和工事 | `enemyRule.elusive` 由攻防结算读取，使用现有移动、解除交战和横置接口。`enemyRule.allowedDamageSources` 通过来源帧筛选。`defenses: true` 启用关键词移动遇到屏障、进入有诱饵或陷阱的地点及同轮重整限制。 |
| 支援与费用 | `assetRule.shareSuppliesAs` 复用现有使用次数费用，通过同一来源列表预览和支付。`sharedSuppliesSpent` 提供付费者与代付支援。`transferControlledClues` 提供权限检查、线索转移及 `assetCluesPlaced` 窗口。带线索支援离场时回落到地点。 |
| 地点与牌区 | `sinkLocation` 更换地点面、清除地点伤害计数并弃掉玩家附属，保留线索和遭遇附属。独立 `scenarioDecks.draw` 可在空堆时只洗回其自身弃牌，`tokenBag.transfer` 只转移已揭示标记。黑暗等级复用参考卡命名计数 `markers`。 |
| 混乱袋 | `chaosTokens.rank` 按袋内实物数量比较，`payMixed` 在所有刻面有足够数量时一次性扣费，`replaceCampaignNumeric` 复用同一个随机流更新战役袋和当前袋。 |
| 双类型地点 | `turnLocationIntoEnemy` 和 `restoreEnemyLocation` 用同一标识保留地点和敌人读点。调查、线索、毁灭与在场对象用地点记录。攻防、伤害与横置用敌人记录。封印阻止翻面，击败走胜利区并安置坍塌列的对象。 |
| 跨章整备 | `mechanics.survey` 指定整备对应的结局与可承接剧本。战役按座位和调查员身份记录手牌、支援、资源与线索。勘察开局排除已保留实物再洗牌，并跳过起始抽牌与调度。序曲可声明 `noEncounterDeck` 与 `protectInvestigators`。 |
| 行动与附属 | `resolveAssetAction` 可免行动费或全免，按受控支援或弃牌下标读取来源。`attachControlledAsset` 与 `claimHostedAsset` 保留实物、标记及所有者。`parleyEventsFromDiscard` 复用弃牌的打出通道。 |
| 绑定与形态 | `bonded.shuffleCopyIntoDeck` 按卡号取一张场外或弃牌副本，`flipAsset` 保留在场实物和计数。调查员换身、濒败替换、同地点承伤和形态治疗限制走现有结算入口。 |
| 场外与轨道 | `drawBottomMatching` 重排未抽中的场外牌，并调用指定牌堆的遭遇结算。追击区保留敌人实体与附属。轨道方向、布置连通方式和计数兑换分别由载具、网格与参考卡计数接口处理。 |
| 构筑与关间 | 构筑匹配识别印刷的谈判行动及特质等级。临时新购减免随费用预览和购买写入同一账本，在实际成交时扣次数，在下次开局失效。 |

新机制的可选状态沿用剧本机制容器和现有战役记录。读档校验覆盖已保存的日期、法典限次键、独立袋、工事、轨道及支援线索，兼容旧存档结构。

```powershell
npm run plan:fhv:primitives
npm run plan:fhv:primitives:check
$reports = '../../artifacts/migration/fhv/reports'
node --test tests/fhv-primitives.test.mjs *> "$reports/p2-followup-primitives.log"
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/fhv/replay-p2-before.json *> "$reports/p2-followup-replay.log"
npm run test:fast *> "$reports/p2-followup-fast.log"
Set-Content "$reports/p2-followup-fast.exit" $LASTEXITCODE
node tools/audit-fhv.mjs --check-fast p2-followup
npm run audit:fhv:primitives
```
