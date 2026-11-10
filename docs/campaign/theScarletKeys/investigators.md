# 《绯红密钥》调查员及专属依赖（P5 交付说明）

本文件说明 P5（规范第 5 步：调查员及专属依赖）的交付口径、构筑规则与验收边界。
机器可复算账本在 `audit/tsk-investigators.json`，Node 证据在 `audit/tsk-node-acceptance.json#investigators`，
浏览器证据在 `audit/tsk-investigators-browser.json`，回归在 `audit/tsk-regression.json`。

## 1. 六位调查员

| 卡号 | 调查员 | 职阶 | 关键能力 | 专属依赖 |
| --- | --- | --- | --- | --- |
| 09001 | 卡森·辛克莱 Carson Sinclair | 守卫者 | 额外行动只能用于授权同地点调查员立即行动（每轮每人一次）、投入他人检定记账 | 09002《如你所愿》×2、09003 弱点 |
| 09004 | 文森特·李 Vincent Lee | 探求者 | 治疗伤害后把场外《术后恢复》加入手牌、开局按人数场外预置 | 09005、09006×4、09007 |
| 09008 | 基玛尼·琼斯 Kymani Jones | 流浪者 | 快速交战已横置敌人；躲避已横置非精英时加智识，超额弃敌；开局额外 5 经验 | 09009、09010 |
| 09011 | 阿米娜·齐达内 Amina Zidane | 神秘学家 | 打出支援减 3 费并以 1 毁灭入场（每轮一次） | 09012、09013、09014 |
| 09015 | 达雷尔·西蒙斯 Darrell Simmons | 幸存者 | 开局柯达在场；技能检定期间花 1 证据降难度 2（每次检定一次） | 09016、09017 |
| 09018 | 查理·凯恩 Charlie Kane | 中立 | 3 个额外盟友槽；横置盟友加技能值；旧印重整盟友 | 09019、09020 |

引擎接线（按「声明即接线」逐项有读点）：
- `investigator.elderSign` + 条目 `elderSign.resolve`：六人旧印统一走能力层（`turn-flow.js#elderSignEffect`）。
- `investigator.restrictedAction = { kind: 'crossSeatAction' }`：回合开始授予受限额外行动（`turn.js`），
  `freeAction` 原语按 `cost.action + restrictedKind` 扣额度（`moves.js` / `actions-extra.js`）；
  卡森的能力用通用 `api.beginImmediateAction` 让队友立即行动。
- `investigator.freeAction.resolve`：调查员主动/快速能力（基玛尼快速交战、达雷尔花证据、查理横置盟友），
  支持 `duringOwnSkillTest` 只在本人检定期间出现。
- `investigator.extraSlots`：额外槽位（查理 3 个盟友槽，`assets.js#canEquip`）。
- `investigator.setup.setAsideSignature`：开局场外签名卡（文森特，`setup.js`）；
  `investigator.startsWith`：开局在场资产（达雷尔的柯达，沿用既有读点）。
- `damageHealed` 窗口（本轮补登记）：治疗伤害后的反应（文森特）。
- `assetExhausted` 窗口（本轮新增）：支援被横置后的反应（邦妮·沃尔什 09019）。
- `beforePlayCost` 上下文补 `cardType`：条目判定「支援」不再依赖卡号前缀（阿米娜减费）。
- `commit` 投入他人检定记账（`tests.js#noteCommitToOther`）：卡森弱点 09003 的轮末强制读点。

## 2. 构筑规则

- 六人由 `deckOptions` 数据驱动：职阶范围/等级/特性/文本匹配全部沿用 `web/deck-rules.js` 的通用匹配器。
- **次级职阶选择**（通用，非按人名写死）：`faction_select` 选项组按「需要选定的职阶数」判定；
  卡森 1 选（seeker/mystic/survivor 的 0–1 级事件/技能，至多 10 张）、查理 2 选（5 职阶选 2，0–2 级）。
  - 合法性：`web/deck-rules.js#factionSelectErrors` 对命中该选项组的牌只允许单一职阶组合；
  - 自动构筑：`src/deck/deckbuilding.js#factionSelectPlan` 先按卡池份数选出 N 个职阶再过滤卡池；
- 基玛尼额外 5 经验：`content/campaigns/theScarletKeys/investigator-data.js#TSK_BONUS_XP` 进入构筑预算；
- 专属依赖由 `deckRequirements.signatureCards` 强制带入（`buildDeck` 校验 `signatureFor`/quantity），
  在 `availability.js` 标记 `dependencyOnly`，不进入一般构筑池。

## 3. 边界

- P5 只开放 09001–09020：调查员可选、专属依赖随牌组带入；
- 一般玩家卡 09021–09128 与战役卡 09501+ 仍 `catalog-only`（`tskPlayer`/`tskCampaign` 清单保持 catalog-only），
  战役与十章流程仍属 P7–P8；
- AI 随机选人池不改（不会出现「因为收录新循环导致旧 replay 的 AI 选人漂移」）。

## 4. 基线重采说明（一次性、已登记）

P5 注册 20 张卡条目并开放调查员后，`state` 的卡牌定义投影发生变化：既有整局 replay 的逐步骤指纹
（`JSON.stringify(state)` 口径）随之变化，这属于**内容投影变化**而非规则行为变化。按 TDE P10 先例
一次性重采并重签：

| 文件 | 处理 | 说明 |
| --- | --- | --- |
| `tests/fixtures/replay/tsk-baseline.json` | 重签 | 与 `golden-replays.json`（未改动的行为基线）保持同源；`replay-fixtures --compare` 零漂移 |
| `tests/fixtures/replay/eote-p8-baseline.json` | 重采 | EotE P8 逐步骤指纹包含卡牌定义投影，重新采集（同一固定脚本、同 seed） |
| `tests/fixtures/replay/tic-p8-baseline.json` | 重采 | 同上（`tools/replay-tic-fixtures.mjs --write`） |
| `audit/eote-{scope,mechanism-scan,scenario-acceptance}.json` | 重签 | 来源/场景账本随本机工作区同步重签；既有冻结失败集合保持不变 |
| `audit/tde-migration.json` | 重签 | 引用的 golden replay 内容哈希重签 |

行为门禁仍以 `replay-fixtures --compare tests/fixtures/replay/tsk-baseline.json` 与既有 13 局 golden replay 为准。

## 5. 验收命令

```powershell
node --test tests/tsk-investigator-09001.test.mjs tests/tsk-investigator-09004.test.mjs `
  tests/tsk-investigator-09008.test.mjs tests/tsk-investigator-09011.test.mjs `
  tests/tsk-investigator-09015.test.mjs tests/tsk-investigator-09018.test.mjs `
  tests/tsk-investigator-signatures.test.mjs        # Node：逐人能力/旧印/构筑/专属依赖
node tools/run-tsk-investigators-browser.mjs         # 浏览器：6 人 × 桌面/移动
node tools/verify-tsk-regression.mjs                 # fast 无新增失败 + replay 零漂移
node tools/audit-tsk-investigators.mjs --write       # 生成 audit/tsk-investigators.json
node tools/audit-tsk-investigators.mjs --check       # 只复算不重写
```

退出门禁：`audit/tsk-investigators.json#status = verified`（六人 verified、Node/浏览器/回归/边界全真），
且 `fast` 失败集合仍等于 P0 冻结基线。
