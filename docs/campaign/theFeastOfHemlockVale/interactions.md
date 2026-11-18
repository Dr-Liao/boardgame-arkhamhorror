# 《铁杉谷盛宴》新增交互与界面（P4 交付说明）

本文件说明 P4（规范第 4 步：新增交互与界面）的交付口径。机器可复算账本在
`audit/fhv-interactions.json`，浏览器证据在 `audit/fhv-interactions-browser.json`，
回归证据在 `audit/fhv-regression.json`；引擎交互事务在 `src/engine/fhv-interactions.js`，
观察投影在 `src/integration/mechanic-view.js`，界面在 `web/mechanic-ui.js` 与 locale 片段。

## 1. 七组交互

| 交互 | 引擎事务 | 界面/选择 | 真实入口 |
| --- | --- | --- | --- |
| 法典触读与条件段落 | `interactions.fhv.codex.read/entries` | 摘要显示条目名、可读/已读；选择面板只列当前记录下可结算的条目；未触发条目的分支条件与正文永不进投影 | 卡面/地点条目在 P7 调用 `api.interactions.fhv.codex.read(seat, { effect })`；一次性限次由 `resolveCodex` 落账 |
| 三天三夜与居民演进面板 | 投影 + `campaign.records` 读数 | 当前日/时段 + 地点特质的局部昼夜；九位居民关系等级与笔记；划除居民不再投影笔记 | 场景 setup 调用 `api.mechanics.calendar.set`；剧情效果调用 `api.mechanics.residents.*` |
| 序曲整备与下一次勘察 | `interactions.fhv.survey.prepare/chooseNext/parcel` | 保留 1 张非起始支援 + 弃手牌到开手上限的两步选择；整备结果摘要（每座位手牌**张数**、保留支援、资源、线索）；下一场勘察关卡选择 | `src/engine/campaign-flow.js` 的序曲结算已改用 `fhvSurvey` 机制选择操作（服务端 requestChoice），P7 战役流程消费整备包裹 |
| 网格空位与地点滑动 | `interactions.fhv.grid.place/slide` | 摘要显示网格坐标与观察者相邻空位；放置选择只列正交空位；无空位直接返回 false 不留面板；滑动方案原子提交 | 场景效果（P7）调用 `grid.place`（走 `placeLocation` 管线）与 `grid.slide`（`relocateGridCells`） |
| 矿车与道岔 | `interactions.fhv.rail.steer/advance/status` | 摘要在车位置/朝向/脱轨与道岔/废料标记；前进多出口时选择方向，道岔只列垂直出口 | 场景效果调用 `api.interactions.fhv.rail.*`（底层为 P2 载具与轨道原语） |
| 敌人-地点双重交互与猎杀袋 | `interactions.fhv.predation.draw` + P2 原语 | 地点详情同时投影地点面（调查/连接）与敌人面（战斗/躲避/生命）读数，并同时给出两套动作按钮；猎杀袋只投影剩余张数 | `legalMoves` 已同时产出调查/移动与攻击/躲避（P2 `enemy-location`）；猎杀袋抽取由内容调用 `predation.draw` |
| 坚毅形态与线索搬移 | `interactions.fhv.investigatorState.form/transferClue` | 坚毅面二选一（带生命/理智读数）；线索搬移只列符合特质/空目标条件的受控支援 | 汉克濒败替换（P5）调用 `form`；凯特能力（P5）调用 `transferClue`（底层 `transferControlledClues`） |

所有选择走服务端 `requestChoice` / `selectMechanic` 的 opaque `pick:N` / `confirm` / `cancel`，
浏览器只提交服务端合法动作；空强制候选直接返回 false、不产生 pending choice（无软锁）；
取消发生在任何写入之前（`prepareSurvey` 只在全部选择完成后一次性写整备包裹）。

## 2. 隐私与投影

- 法典：投影只有 `{id, name, resident, available, used}`；未触发条目的分支条件、小节正文、
  居民条件明细均不进入观察投影；选择候选也只出现「当前记录下可结算」的条目。
- 三天三夜：只投影当前日与时段（以及按地点特质的局部判定），不投影任何未来分支内容。
- 猎杀袋：只投影剩余张数；袋内标记面不进入观察投影（合法抽取后由事件公开）。
  `src/integration/scenario-interactions.js` 的食梦者「滋生袋」专题条已按袋 id 收窄，
  不会把其它循环的独立袋标记面拼进投影。
- 序曲整备：只投影每座位手牌张数与保留支援/资源/线索；手牌卡号属于私有信息，不进投影。
- 网格/轨道/敌人-地点/调查员形态是桌面公开状态；敌人-地点的读数与动作全部来自服务端
  legalMoves 与观察投影，客户端不计算规则。
- `maskMechanicSnapshot` 对 FHV 字段无需二次掩码（投影本身只含公开读数）。

## 3. 既有交互回归

P4 配置同时跑两条通用证据 spec（与 TIC/EotE/TSK P4 同一口径）：

- `script-actions-tfa.browser.mjs`：幕／议程/剧本行动归属（`scriptCard`）在新增 FHV 交互接入后
  仍正确，桌面与移动各一条；
- `scenario-guides.browser.mjs`：固定「关卡设置」入口（剧本书右侧、混乱提示卡下方）、
  「特别规则优先／后续剧情与结局默认折叠」、指南加载失败重试与键盘焦点恢复。

FHV 自己的完整冒险指南与 scriptCard 内容属于 P7；P4 只复用并回归既有入口。

## 4. 验收命令

```powershell
node tools/verify-fhv.mjs --node                                    # P2 原语 + P3 规则 + P4 交互事务 Node 测试
node tools/verify-fhv.mjs --regression                              # fast 无新增失败 + replay 精确一致
node tools/run-fhv-interactions-browser.mjs                         # 7 组 × 2 视口 + 两条通用证据 spec
npm run plan:fhv:interactions                                       # 生成 audit/fhv-interactions.json
npm run audit:fhv:interactions                                      # 只复算不重写（证据漂移即失败）
npm run test:fhv:interactions                                       # 交互事务与账本 Node 验收
```

退出闸门：新增交互已通过浏览器验收（`audit/fhv-interactions.json#status = verified`），
再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

回归取证说明：`node tools/verify-fhv.mjs --regression` 运行 fast 分层时排除
`tests/fhv-rules-ledger.test.mjs` 与 `tests/fhv-interactions-ledger.test.mjs` 两个「账本自检」文件
（它们断言账本与源码逐字节一致，在账本生成前必然失败），基线为 P3 收口时登记的既有失败清单；
账本生成后另行执行全量 `npm run test:fast` 作为最终验收并留档。

## 5. 边界

- P4 只交付交互与界面，不开放内容：战役、调查员与一般玩家卡仍为 `catalog-only`；
- 测试夹具 `tests/fhv-interaction-fixture.mjs` 只在验收进程内使用，不进生产组合根、不注册内容；
- 法典条目正文、章节目录与完整指南正文仍在 P7；汉克/凯特等调查员能力接线在 P5，
  但 P4 事务与面板已就位，P5–P7 只调用 `api.interactions.fhv.*`，不再各拼界面。
- 回归基线与 P3 收口时一致：`audit/fhv-regression.json` 记录既有失败（EOTE 账本漂移）与
  新增失败 0；P4 不掩盖其它循环的既有问题。
