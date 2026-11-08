# P4 交互、投影与验收（《地球边缘》）

本阶段交付可供 P5–P7 卡牌与章节复用的交互通路。它不开放调查员、卡牌或章节：P4 只验收通用接口，调查员与卡牌字面行为仍在 P5–P7 逐项确认，八章指南与剧情分支仍在 P7。完成状态由[交互审计](../../audit/eote-interactions.json)复算。

## 服务端选择

EotE 的交互全部经 `ctx.api.interactions` 发起，浏览器只提交当前合法动作中的 `choose`，不发送自造的机制命令。选择必须运行在规则事务中：确认前不写状态，取消（`optional`）在写入前返回，强制效果没有取消项，空候选不创建无法回答的待决选择。

| 接口 | 行为与边界 |
| --- | --- |
| `frost.add(seat, count)` / `frost.pay(seat, count)` | 加入受 8 枚物理池限制；支付优先选封印区寒霜、不足再选袋内实体，多选恰好 count 枚；池满/不足返回 false 且不产生选择或部分写入。 |
| `partners.setup(seat, {roster, count})` | 开局伙伴选派：候选来自内容层名册（引擎不写卡号/不建状态），确认后返回所选伙伴卡号，由内容层按名册初始化战役状态。取消返回 null 且不写。 |
| `seals.place/recover/activate/assign/unplace(seat, …)` | 五封印生命周期选择：持有→放置（门/高塔）、地点休眠→取回、激活一次、放置到高塔、取下重置。候选由权威 `campaign.eote.seals` 枚举；非法阶段返回 false，不产生半写状态。 |
| `keys.take/place/move/swap(seat, …)` | 古城钥匙的取得、放置、移动与交换；键名对浏览器不透明（uiKey 序号），未揭示/隐藏信息不出现在候选标签；缺省目的地时产生 destination 选择。 |
| `tekeli.shuffle(seat, {count, destination})` | 忒咳哩-哩隐藏洗入：默认不出现任何选择、不返回卡号；需要时间选择去向时传 `destination:null`，产生 4 向（库底/本人牌库/任意调查员牌库/弃牌堆）destination 选择。牌库顺序与卡面不返回。 |
| `deckTop.reveal(seat, {public})` / `deckTop.card(seat)` | 牌库顶揭示只写私有状态；非本人或非公开不投影卡号。打出走既有 `deckTop` play channel 的合法动作。 |
| `crossSeat.grant/clear/choose(seat, …)` | 跨座位代打：先登记授权（同地点、指定卡号、可选费用分摊元数据），再选择队友手中实体；控制权与分费在调用方（P5 调查员能力）。 |
| `supply.assign/drop/recover(seat, …)` | 探险物资指派/掉落/回收：指定接收者时单阶段，否则先选物资再选同地点接收者；回收的唯一权威仍为 `campaign.records[SuppliesRecovered]`。 |
| `discipline.select/flip(seat, …)` | 演武选择必须注入确定性 `random`（可复现）；翻面走既有物理换面管线。P4 验收选择事务与投影，构筑入口在 P5。 |

`selectMechanic` 在同一事务中记录选中/撤选与确认步骤；客户端拿到的选项 ID 为不含隐藏值的序号。伪造索引、过期选择 ID、其他座位回答由既有选择校验拒绝；暂停状态与凭据可 JSON 往返。

## 公开信息与隐私

`src/integration/mechanic-view.js#mechanicView(state, observer)` 是本批投影读点，不向客户端发送原始 `scenarioFlags.mechanics.eote` / `campaign.eote`：

| 投影 | 发给玩家的内容 |
| --- | --- |
| `eote.frost` | 寒霜池上限与剩余数量（袋内 + 揭示 + 封印共用 8 枚），不发送池内实体清单。 |
| `eote.partners` | 伙伴名册的**公开**状态：卡号、伤害、恐惧、safe/mia/eliminated/resolute；不发送未到达章节的隐藏抽选结果。 |
| `eote.seals` | A–E 封印的公开状态（休眠/激活/放置者座位/地点），不发送未公开的剧本放置意图。 |
| `eote.tekeli` | 仅牌库张数；不发送牌库顺序、卡面或“刚洗入的是哪张”。 |
| `eote.deckTop` | 只发送给牌库顶揭示者本人（或公开揭示）；其他座位完全收不到该字段。 |
| `eote.crossSeat` | 只发送给被授权的座位；授权卡号列表在这一机制里对该座位公开，其他座位不可见。 |
| `eote.disciplines` | 场上公开的演武面与卡号；命运重担只在需要公开读点时投影。 |
| `eote.supplies` | 每位调查员携带数量与场上掉落数量的汇总，不发送隐藏持有者以外的内容。 |

演出快照（`mechanicSnapshot` / `maskMechanicSnapshot`）使用同样的接收者掩码：牌库顶与跨座位授权在快照里按观察者裁剪，不能因为中间态动画把其他座位的私有信息带出去。未揭示城市景观、营地随机失踪抽选与条件剧情仍保留在权威私有状态，P7 内容作者必须遵守这个存储边界，不能把未揭示答案先写进公开日志。

## 界面与固定入口

- 寒霜揭示：连续揭示的标记按实体下标展示，第二枚寒霜的自动失败在结算提示中给出；`[data-eote-frost]` 显示池剩余/上限。
- 伙伴面板：`[data-eote-partners]` 展示每位伙伴的伤害/恐惧与 safe/mia/eliminated/resolute 状态。
- 封印/高塔：`[data-eote-seals]` 展示封印状态与放置位置；放置选择复用现有按钮、卡牌详情与主题。
- 忒咳哩-哩：`[data-eote-tekeli]` 只显示张数；洗入/去向选择是普通待决选择，不展示牌面。
- 牌库顶：`[data-eote-deck-top]` 只对本人显示牌名，打出入口复用 play channel 的既有合法动作。
- 跨座位：`[data-eote-cross-seat]` 展示授权来源与候选卡，控制权/费用分摊在 P5 能力中接线。
- 演武/物资：`[data-eote-disciplines]`、`[data-eote-supplies]` 展示公开汇总。
- 所有选择面板复用现有 `.ah-mechanic-choice` 组件：候选可选中/撤选、看卡面、确认或按规则取消；提交期间禁用重复操作；请求失败保留同一选择可重试；Esc 可取消可选效果并恢复焦点。
- 幕/议程行动继续经 `scenario.scriptCards → scriptCardOwner → legalMoves / scriptActionHints` → 剧本书与卡片入口；不可用提示保留原因。P4 用已有真实大厅章节验收该通路，EotE 各章实际行动仍随 P7 接入。
- “关卡设置”仍位于剧本书右侧、混乱提示卡下方，特别规则优先、后续与结局默认折叠；读取失败可重试，Esc 返回入口。P4 验收组件位置、阅读、语言与键盘行为，不把组件通过当成八章完整指南已交付。

## 验证与证据

```powershell
node tools/verify-eote.mjs --node                      # 含 tests/eote-interactions.test.mjs
node tools/run-eote-interactions-browser.mjs           # 真实大厅/HTTP/规则引擎 + 测试专用夹具
node tools/verify-eote.mjs --regression                # test:fast + replay 对比
node tools/audit-eote-interactions.mjs --write         # 交互审计账本
node tools/audit-eote-interactions.mjs --check         # 逐字节复算
node tools/audit-eote-primitives.mjs --write           # P4 interaction.* 回填 done
```

浏览器验收通过真实大厅、HTTP 请求和规则引擎提交；`tools/run-eote-interactions-browser.mjs` 只在本次测试服务器的 Mod 包装器中装入确定性夹具，生产 Mod 不读取测试标记、不注册测试卡、不增加调试 HTTP 入口。Node、浏览器与回归报告分别为 `audit/eote-node-acceptance.json`、`audit/eote-interactions-browser.json`、`audit/eote-regression.json`；截图位于大厅根 `artifacts/migration/eote/p4/screenshots/`。测试数量与实际通过结果从报告中读取，不在本文件冻结。

P4 不修改既有 replay 行为：`tests/fixtures/replay/eote-baseline.json` 仍为逐局比对基线（`audit/eote-baseline.json` 记录其 sha256）；若后续交互改动导致快照行为变化，必须新采 P4 基线并保留 P0 基线，不得重写旧基线来消除变化。
