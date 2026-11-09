# P4 交互、投影与验收

本阶段交付可供 P5–P7 卡牌与章节复用的交互通路。它不开放调查员、卡牌或章节；完整中英章节指南与实际剧情分支仍在 P7。完成状态由[交互审计](../../../audit/tic-interactions.json)和[总审计](../../../audit/tic-migration.json)复算。

## 服务端选择

卡牌描述子通过 `ctx.api.interactions` 发起选择；场景中的钥匙、封印和载具操作也可经 `scenarioRuntime(...).mechanics.interactions` 调用。选择必须运行在规则事务中，浏览器只提交当前 `legalMoves` 中的 `choose`，不发送自造的机制命令。

| 接口 | 行为与边界 |
| --- | --- |
| `seal(seat, sourceId, {tokens, count, optional})` | 从真实袋内实体中选择恰好指定数量；同面多枚保持独立候选。确认前不封印。 |
| `release(seat, sourceId, {count, optional})` | 只选择指定来源封印的实体，确认后回袋。 |
| `keys(seat, operation, options)` | `claimKey / giveKeys / spendKey`。取得检查地点线索；转交先选钥匙再选同地点接收者；支付默认放到提示卡区域。未揭示钥匙在选项中不含颜色，取得成功才揭色。 |
| `vehicle(seat, operation, options)` | `enterVehicle / leaveVehicle / driveVehicle`。遵守本轮上下车限制、容量、驾驶资格、相邻地点与乘客进入限制。需要交接时由玩家选驾驶者；全部确认后才整体移动或离车。 |
| `commit(seat, {host, from, retain, optional, cardType})` | 卡牌 API 专用：借用权威投入校验，非法图标、来源和资格不产生候选。原区可为宿主下方或弃牌堆；可按印刷类型收窄。`retain` 在下方投入时返回宿主，从弃牌堆投入时结束回手。 |
| `returnCommitment(seat, {optional, cardType})` | 在成败判定前选择本人的一张已投入实体返回手牌，可按印刷类型收窄。移除其图标与成功奖励读点，结束时不再次弃置或返回原区。 |

`selectMechanic` 在同一事务中记录选中／撤选和确认步骤；客户端拿到的选项 ID 为不含隐藏值的序号。重建事务时重新枚举候选，伪造索引、过期选择 ID、其他座位回答由现有选择校验拒绝。暂停状态与凭据均可 JSON 往返。

`optional:true` 允许取消整个机制效果，且在最终确认前没有机制写入；已经由卡牌描述子支付的印刷费用仍遵守卡牌规则。强制效果必须传 `optional:false`，不会产生取消选项。调用方在描述子条件／章节行动枚举中使用权威资格检查；不能把“效果无候选时返回 false”当成无条件展示可支付的行动。空候选不创建无法回答的待决选择。

## 公开信息与隐私

`src/integration/mechanic-view.js` 是本批投影读点，不向客户端发送原始 `scenarioFlags.mechanics`。

| 公开模型 | 发给玩家的内容 |
| --- | --- |
| `water` | 已揭示地点的等级、调查员的有效等级和本回合空气风险／直接伤害提示。地图徽记与展开条使用同一份投影。 |
| `keys` | 场上公开持有区域与已知颜色。未揭示实体统一为 `unrevealed`；保留区／移除区的钥匙清单不发送。 |
| `vehicles` | 当前地点、容量、运行状态、驾驶者、乘客，以及观察者上下车的不可用原因。 |
| `beneath` | 宿主、座位与公开张数；默认仅所有者有 `codes`，补充卡面进入私有补丁。P5 阿曼达明确声明公开的下方牌有 `public` 标识，向其他座位及演出快照共享对应卡面。 |
| `tokens` | 当前检定按实体下标排列的揭示序列；私人检定只给本人，公开求助后按既有共享检定规则展示。 |

演出快照采用同样的接收者掩码，不能因为中间态动画把其他座位的下方牌或私人标记带出去。隐藏嫌疑人／藏身处答案、未来路牌顺序、未触发记忆和条件剧情仍保留在权威私有状态；已恢复的公开日志与已经到达的剧情才使用既有战役投影。P7 的内容作者必须遵守这个存储边界，不能把未揭示答案先写进公开日志。

私人标记也不能通过“袋内少了哪一枚”反推：非回答者看到的袋内多重集包含暂时隐藏的实体，顺序不对外提供推断信息。嵌套检定仅展示当前帧，外层仍待决的实体继续掩码；封印候选始终由权威状态枚举，不从这个展示多重集计算。

## 界面与固定入口

新选择面板复用现有按钮、卡牌详情、标记图案、主题和面板间距。候选能选中／撤选、看卡面、确认或按规则取消。提交期间禁用重复操作；请求失败保留同一选择，可重试。Esc 可取消可选效果；详情 Esc 关闭后返回原详情按钮，效果取消后返回来源实体。

移动端与桌面使用同一份服务端候选。选项区可以滚动，确认／取消可见；选择层位于浮动音乐控件上方。特殊原区卡牌复用装备区的“下方牌”卡排，而不是另建牌桌布局。

幕／议程行动继续经 `scenario.scriptCards` → `scriptCardOwner` → `legalMoves / scriptActionHints` → 剧本书和卡片入口。不可用提示保留原因；地点与敌人动作不冒充幕／议程行动。P4 用已有真实大厅章节验收这个通路，TIC 各章的实际行动仍随 P7 单卡与章节接入。

“关卡设置”仍位于剧本书右侧、混乱提示卡下方，特别规则优先、后续与结局默认折叠；读取失败可重试，Esc 返回入口。P4 验收组件位置、阅读、语言与键盘行为，不把组件通过当成 TIC 八章完整指南已经交付。

## 验证与证据

```powershell
node tools/verify-tic.mjs --node
npm run test:tic:interactions:browser
node tools/verify-tic.mjs --p4-regression
node tools/audit-tic-primitives.mjs --write
node tools/audit-tic-interactions.mjs --write
node tools/audit-tic.mjs --write
npm run audit:tic:primitives
npm run audit:tic:interactions
npm run audit:tic:check
```

浏览器验收通过真实大厅、HTTP 请求和规则引擎提交；`tools/run-tic-interactions-browser.mjs` 只在本次测试服务器的 Mod 包装器中装入确定性夹具。生产 Mod 不读取测试标记、不注册测试卡、不增加调试 HTTP 入口。另跑既有剧本行动与完整指南浏览器用例，并刷新 P3 中英文规则书的证据。

修改行为前采集的 P4 回放基线保存在 `tests/fixtures/replay/tic-p4-baseline.json`，来源与快测记录见 `audit/tic-p4-baseline.json`。P4 回归要求快测零失败，并与这份基线逐步完全一致；原 P0 基线另行保留，不重写来消除变化。源码、界面、样式或验收用例改变后，旧证据会失效，需要重验。

Node、浏览器和回归报告分别为 `audit/tic-node-acceptance.json`、`audit/tic-interactions-browser.json`、`audit/tic-interaction-regression.json`；截图位于大厅根 `artifacts/migration/tic/p4/screenshots/`。测试数量和实际通过结果从报告读取，不在本文件冻结。
