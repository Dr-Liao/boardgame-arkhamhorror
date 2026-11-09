# P5 调查员及专属依赖

本批范围为五位正式调查员与十一张专属卡。逐人状态由[调查员审计](../../../audit/tic-investigators.json)复算，并汇入[总审计](../../../audit/tic-migration.json)；[路线图](README.md)只有在当前源码的 Node、浏览器、回放及全量快测通过后才勾选。

## 逐人范围

| 调查员 | 专属依赖 | 实现与验收重点 |
| --- | --- | --- |
| `07001` 玛丽修女 | `07006` 守护天使、`07007` 信仰危机 | 每次冒险设置加入祝福；轮末反应、旧印成功后加入祝福；天使为同地及连接地点队友承接伤害，分配至致命伤时仍能反应；危机逐枚处理袋内祝福，封印实体不算袋内，池满时替换仍移除原祝福。 |
| `07002` 阿曼达·夏普 | `07008` 晦涩研究、`07009` 深海低语 | 每次调查阶段开始轮换，额外调查阶段也再次结算；优先选低语，其余弱点不能主动放下；每次本人检定强制投入合法下方牌，免额外投入费用，结束返回原宿主；旧印可翻倍正负图标。研究在强制投入之前替换，事件实体不重复进入弃牌堆。 |
| `07003` 特里希·斯卡波罗 | `07010` 潜于阴影、`07011` 影子特工 | 发现线索后按地点敌人提供合法的额外线索／自动躲避选项，每轮一次；旧印可改在任意已揭示地点调查，重算帷幕及线索区；阴影解除交战并限制本轮交战和敌人伤害；特工以归属者为猎物，保留调查发现线索的例外，被自动躲避时也正常弃置。 |
| `07004` 戴克斯特·德雷克 | `07012` 精湛手法、`07013` 密教残页 | 本人回合免费能力挂在调查员卡入口；只弃自己可弃的支援，先结算离场，再选择当时手牌中不同名支援，以折扣打出；旧印收回后抽牌；精湛手法覆盖正常打出和放置入场，仅在该实体的触发能力结算期间加成；密教残页抽到后留在手中，手中／场上修正不同，不能用打出行动打出。 |
| `07005` 塞拉斯·马什 | `07014` 骇变鱼叉、`07015` 塞拉斯的渔网、`07016` 海妖之唤 | 揭示后只收回本人投入的技能，移除图标及奖励，不重复弃置，每轮一次；旧印从弃牌堆投入合法技能，结束回手；鱼叉／渔网检查技能投入条件，结束时可收回武器及技能；海妖之唤按匹配图标收取额外资源，两行动移除，资源不足不能投入。 |

印刷行为与构筑来源以 `audit/tic-scope.json` 的卡面及 Haskell 文件锁为准。来源树位于大厅根目录 `参考资源/ArkhamHorror-main/`，运行时不依赖该目录。

`98016` 是数据明确登记的戴克斯特重印，注册时复用 `07004`，不另建行为文件或另开选人项。`98013` 塞拉斯书附版本的能力文字相同，但数据未登记为本批 canonical 别名，未单独开放；书附替换专属 `98014/98015/98017/98018` 不属于本批范围。

## 共用读点与存档

新共用操作集中在 `src/engine/investigator-mechanics.js`，经 `ctx.api.investigatorTools` 装配；单卡不直接写权威状态。

- `rotateBeneath / swapBeneathEvent / commitBeneath` 复用 `commitOrigins`，轮换、事件延后搬运与强制投入保持实体守恒。`ignoreAdditionalCosts` 只由受信任的规则调用传入，浏览器没有对应的任意命令。
- `retainSkills / setCommitmentDestination / multiplyCommitment` 修改同一检定的投入及清理账本；收回、原区返回和弃置只能执行一条去向。
- `replaceAsset / canDiscardAsset / canReturnAsset` 检查控制权、永久、不可弃及离场限制。替换在支付弃牌费用和离场钩子后再选新牌；后续选择暂停不撤销已支付的费用。
- `markAbilityBonus / notifyPlacedAsset` 按资产实例及轮次记录触发能力加成；结算来源采用可恢复的临时调用帧，结束后清除。加成记录为纯 JSON，读档校验其轮次、数值和字段；旧存档缺少字段时保持原状。
- `investigationPhaseStarts / roundEnds / testInitiated / testEnds / assetDamageAssigned` 均有实际引擎调用点。无本批订阅者时不增加旧战役的选择或标记，既有逐步回放作为回归门禁。
- 额外投入费用在手牌和原区投入入口共用 `commit-rules.js`；候选、资格及支付使用同一计算。显式强制投入可免额外费用，普通可选投入继续支付。

阿曼达公开放置的下方牌有声明式 `beneathPublic` 标识，其他玩家及演出快照能收到对应卡面；普通宿主默认只给所有者卡号。未揭示钥匙、其他私密原区与私人混乱标记仍遵守 [P4 投影契约](interactions.md)。

首个调查阶段的轮换在起始换牌完成后触发，换牌候选只有原来的五张起始手牌，第六张牌在之后抽取。深海低语抽到后留在手中，进入轮换时必须优先放到下方。

## 开放边界

`ticInvestigators` 包独立开放，五位调查员可以在既有可玩战役中选人和构筑。十一张专属卡只作为对应调查员的构筑依赖，不进入一般卡池。原有 AI 随机选人池与既有自动构筑卡池保持稳定，真人可显式选择新调查员。

`ticPlayer` 已在 [P6](players.md) 独立完成一般玩家卡验收。`ticCampaign` 继续仅目录收录，八章完整行为、冒险指南和战役推进仍属于 P7–P8；调查员及玩家卡开放不表示《印斯茅斯暗潮》战役可以启动。

## 验证与证据

在 Mod 目录运行。先完成所有源码改动和必要的既有账本复算，再生成当前源码验收；运行期间哈希变化会阻止确认。

```powershell
npm run cards:check
node tools/verify-tic.mjs --node
npm run test:tic:interactions:browser
node tools/verify-tic.mjs --p4-regression
node tools/verify-tic.mjs --p5-replay
npm run plan:tic:primitives
node tools/audit-tic-interactions.mjs --write
node tools/audit-tic-investigators.mjs --write
npm run audit:tic
npm run audit:tic:primitives
npm run audit:tic:interactions
npm run audit:tic:investigators
npm run audit:tic:check
npm run docs:check
```

Node 用例覆盖逐人合法／非法构筑、能力、旧印、专属依赖、多人窗口、JSON 暂停恢复及负面路径。浏览器经真实大厅 HTTP 通路验证五人构筑开局、阿曼达下方牌与戴克斯特卡面主动能力，另回归 P3/P4、固定指南入口和剧本行动归属。仅戴克斯特定向交互使用测试进程内的种子状态，生产 Mod 没有测试入口。

P5 行为改动前的基线为 `tests/fixtures/replay/tic-p5-baseline.json`；其 SHA-256、P4 完成时的快测与验收快照证据保存在 `audit/tic-p5-baseline.json`。原始 P0/P4 基线均保留。最终结果写入 `audit/tic-{node-acceptance,interactions-browser,interaction-regression,investigator-replay,investigators}.json`；过程日志与截图位于大厅根目录 `artifacts/migration/tic/p5/` 和 `artifacts/migration/tic/reports/`。
