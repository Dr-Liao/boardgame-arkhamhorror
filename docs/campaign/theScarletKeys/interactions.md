# 《绯红密钥》新增交互与界面（P4 交付说明）

本文件说明 P4（规范第 4 步：新增交互与界面）的交付口径。机器可复算账本在
`audit/tsk-interactions.json`，浏览器证据在 `audit/tsk-interactions-browser.json`，
引擎交互事务在 `src/engine/tsk-interactions.js`，投影在 `src/integration/mechanic-view.js`，
界面在 `web/mechanic-ui.js` / `web/mechanic-ui.css` / locale 片段。

## 1. 六组交互

| 交互 | 引擎事务 | 界面/选择 | 浏览器验收 |
| --- | --- | --- | --- |
| 隐匿迷你卡揭露 | `interactions.tsk.concealed.expose/reshuffle` | 摘要显示地点/位置/正反面状态；揭露选择只列「位置」，不泄露真身 | `P4 {desktop,mobile} 隐匿迷你卡揭露与空状态` |
| 绯红密钥变换 | `interactions.tsk.keys.shift` | 摘要显示持有者/当前面/本轮是否已变换；选择面板列可用密钥 | `P4 … 绯红密钥变换` |
| 空洞回收 | `interactions.tsk.hollows.recall` | 摘要显示空洞计数与卡号；回收选择后计数下降、清空后整段消失 | `P4 … 空洞回收` |
| 世界地图启程 | `interactions.tsk.map.embark` | 摘要显示当前位置/时间/已解锁节点/强制目的地；目的地选择含耗时与解锁状态 | `P4 … 世界地图启程与快捷旅票` |
| 定制升级勾选 | `interactions.tsk.customizable.upgrade` | 摘要显示等级/已勾选格数；多选勾选面板逐个确认 | `P4 … 定制升级勾选` |
| 跨座位即时行动 | `interactions.tsk.crossSeat.grant/take` | 摘要显示授权者→目标；授权后可执行并消耗 | `P4 … 跨座位即时行动` |

所有选择走服务端 `requestChoice` / `selectMechanic` 的 opaque `pick:N` / `confirm` / `cancel`，
浏览器只提交服务端合法动作；空候选直接返回 false、不产生 pending choice（无软锁）。

## 2. 隐私与投影

- 未揭露迷你卡：投影只有 `locationId` / `position` / `visible=false`，不含 `kind` / `decoy`；
  只有合法揭露后权威层才返回真身。
- 地图密档：投影只给已解锁/已读 key，不给正文；未解锁密档不出现。
- 异界牌库顺序：永不投影（`view.scenarioDecks` 只有张数）。
- 定制勾选：只投影 observer 本人的勾选；快照掩码再次删除他人的 `customizations`。
- 跨座位授权：只对授权者与被授权者可见（`crossSeat` 双向投影；快照按 observer 过滤）。
- `mechanic-view.js#maskMechanicSnapshot` 对 TSK 字段再掩码一次（动画快照不泄露）。

## 3. 既有交互回归

P4 配置同时跑两条通用证据 spec（与 TIC/EotE P4 同一口径）：

- `script-actions-tfa.browser.mjs`：幕／议程/剧本行动归属（`scriptCard`）在新增 TSK 交互接入后
  仍正确，桌面与移动各一条；
- `scenario-guides.browser.mjs`：固定「关卡设置」入口、特别规则优先/后续剧情折叠、指南加载失败
  重试与键盘焦点恢复。

## 4. 验收命令

```powershell
node tools/run-tsk-interactions-browser.mjs   # 6 组 × 2 视口 + 两条通用证据 spec
node tools/verify-tsk-regression.mjs          # fast 无新增失败 + replay 精确一致
npm run plan:tsk:interactions                 # 生成 audit/tsk-interactions.json
npm run audit:tsk:interactions                # 只复算不重写（证据漂移即失败）
node --test tests/tsk-interactions.test.mjs   # Node 交互事务验收
```

退出闸门：新增交互已通过浏览器验收（`audit/tsk-interactions.json#status = verified`），
再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

## 5. 边界

- P4 只交付交互与界面，不开放内容：战役、调查员与一般玩家卡仍为 `catalog-only`；
- 测试夹具 `tests/tsk-interaction-fixture.mjs` 只在验收进程内使用，不进生产组合根、不注册内容；
- 完整十章战役指南与逐章流程仍在 P7。
