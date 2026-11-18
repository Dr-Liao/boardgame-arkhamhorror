# 《铁杉谷盛宴》调查员及专属依赖（P5 交付说明）

本文件说明 P5（规范第 5 步：调查员及专属依赖，M1）的交付口径、构筑规则与验收边界。
机器可复算账本在 `audit/fhv-investigators.json`，Node 证据在 `audit/fhv-node-acceptance.json#investigators`，
浏览器证据在 `audit/fhv-investigators-browser.json`，回归在 `audit/fhv-regression.json`。

## 1. 五位调查员

| 卡号 | 调查员 | 职阶 | 关键能力 | 专属依赖 |
| --- | --- | --- | --- | --- |
| 10001 | 威尔森·理查德 Wilson Richards | 守卫者 | 每轮首张 `[[Tool]]` 支援减 1 费、`[[Tool]]` 支援检定 +1、旧印交换场上与手牌 `[[Tool]]` | 10002《应急手段》×2、10003 弱点 |
| 10004 | 凯特·温斯罗普 Kate Winthrop | 探求者 | 开局 10005《磁通量稳定器》（未激活面）在场；快速把线索移到无线索的 `[[Science]]`／`[[Tool]]` 支援；带线索支援离场线索落地点；旧印把线索移回自身 | 10005、10005b、10006、10007、10008 |
| 10009 | 亚历山德拉·佐兹 Alessandra Zorzi | 流浪者 | 每回合额外一次谈判专用行动；旧印 +2，成功后自动躲避所在地点或已揭示连接地点的非精英敌人 | 10010《哄骗》、10011 弱点 |
| 10012 | 鸣神琥珀 Kōhaku Narukami | 神秘学家 | 回合开始时向混乱袋加入较少的一方祝福／诅咒（平局自选）或移除各 2 枚获得额外行动；旧印 +2 并加入各 1 枚 | 10013《真幻记述》、10014 弱点 |
| 10015 | 汉克‧萨姆森 Hank Samson | 幸存者 | 承接同地点其他调查员与盟友的伤恐；将要被击败时治愈全部伤恐并翻面为绑定坚毅面（10016a 或 10016b 朝上） | 10017《一身是胆》、10018 弱点、10016a/10016b |

引擎接线（按「声明即接线」逐项有读点）：

- `investigator.elderSign` + 条目 `elderSign.resolve`：五人旧印统一走能力层（`turn-flow.js#elderSignEffect`），
  `onSuccess` 走检定结算内的 DSL 读点（`tests.js`）。
- `investigator.firstAssetOfRound`：威尔森每轮首张 `[[Tool]]` 减费（`cost.js#firstAssetDiscount`），
  旧印交换由 `api.swapControlledAssetFromHand` 按印刷费用与可用槽位校验。
- `investigator.startsWith`：凯特开局以 10005（未激活面）在场（`setup.js`）；`api.flipAsset` 翻面保留
  在场实体、标记与附属；`assetCluesPlaced` 窗口触发绑定检索与活跃面反应。
- `api.bonded.shuffleCopyIntoDeck`：绑定池只取选定副本，牌库/弃牌堆同源（`bonded.js`）。
- `api.transferControlledClues`：支援线索转移校验归属、特质与容量；带线索支援离场由
  `asset-clues.js#returnAssetClues` 统一回落到地点。
- `investigator.restrictedAction = { kind: 'parley' }`：回合开始授予谈判专用额外行动
  （`turn.js` / `restricted-actions.js`）；`parley.js` 提供谈判事件与谈判行动性质。
- `flags.assignInvestigatorHarmAtLocation`：汉克承接盟友与同地点调查员的伤恐（`harm-assignment.js#redirectAllyHarm`）；
  濒败替换走 `api.scenario.replaceLethalHarmWithForm`（清除既有伤恐、按需禁止治疗、读档后保持），
  绑定坚毅面由 `investigator-form.js` 与 `restoreInvestigatorForm` 恢复。
- `chaosTokens.rank/payMixed` 与 `api.revealRankedTokenInstead`：鸣神琥珀的祝福／诅咒操作与
  《真幻记述》在 `beforeChaosTokenReveal` 窗口替换揭示标记。

## 2. 构筑规则

- 五人的牌组范围完全由印刷 `deckOptions` 数据驱动：职阶范围、等级、特性（`[[Tool]]`／`[[Science]]`／
  `[[Blessed]]`／`[[Cursed]]`／`[[Occult]]`／`[[Spirit]]`／`[[Innate]]`）、文本匹配
  （亚历山德拉的「Parley.」）与限张（威尔森 Improvised/Upgrade 至多 5、汉克 Spirit/Innate 至多 10）
  全部沿用 `web/deck-rules.js` 的通用匹配器。
- 牌组大小由卡面 `deckRequirements.size` 决定：汉克 35 张，其余 30 张。
- 专属签名卡与专属弱点由 `deckRequirements.signatureCards` 强制带入（`buildDeck` 校验数量），
  在 `availability.js` 标记 `dependencyOnly`，不进入一般构筑池；绑定面（10005b/10006/10007/
  10016a/10016b）不入牌组，只由绑定原语带入。
- 五人没有次级职阶选择、没有构筑期额外经验；调查员包内 20 条全部 `rulesImplemented=true`、
  `deckbuilding=false`（调查员由选人开放，不可「构筑」）。
- 随机基础弱点沿用既有基础弱点池（P6 才把本循环一般玩家卡与 5 张基础弱点纳入构筑池）。

## 3. 边界

- P5 只开放 `fhvInvestigators` 包（10001–10018 与 10005b/10016a/10016b，共 20 条）：
  调查员可选、专属依赖随牌组带入；
- 一般玩家卡（`fhvPlayer` 包 10109+ 等）与战役包（八章/序曲/共享遭遇）仍 `catalog-only`，
  分别属 P6 与 P7–P8；
- AI 随机选人池不改（不会出现「因为收录新循环导致旧 replay 的 AI 选人漂移」），
  既有 golden replay 与行为基线零漂移；
- P0 冻结的 `audit/fhv-baseline.json` 保持不动；P5 只新增 `audit/fhv-investigators*.json` 与
  Node 验收的 `investigators` 段（`audit/fhv-scope.json` 按当前包状态重新生成，P0 冻结的重放/快速基线不变）。

## 4. 验收命令

```powershell
npm run test:fhv:investigators          # 5 位调查员逐人 Node 验收 + 专属/绑定依赖五人共同口径
npm run test:fhv:investigators:browser  # 浏览器：5 人 × 桌面 1440 / 移动 390
npm run verify:fhv:node                 # Node 验收账本（含 investigators 段）
npm run verify:fhv:regression           # fast 无新增失败 + replay 零漂移
npm run plan:fhv:investigators          # 生成 audit/fhv-investigators.json
npm run audit:fhv:investigators         # 只复算不重写（证据漂移即失败）
```

退出门禁：`audit/fhv-investigators.json#status = verified`（五人 verified、Node/浏览器/回归/边界全真），
且 `fast` 失败集合仍等于 P3 收口时冻结的既有失败清单（EOTE 2 项，按 P3/P4 记账口径）。

## 5. 已知近似与边界披露

P5 未使用 `simplified: true`；下列已实现行为与卡面存在可复核的差异或依赖后续阶段补原语，逐条登记。
账本仍为 `verified` 的依据是：每条都在条目 `note:` 与测试中显式声明，且不伪称等价；引擎缺口统一
记录为后续 P6/P7 的原语候选，不阻塞调查员开放。

| 卡号 | 近似／缺口 | 当前实现与读点 | 后续 |
| --- | --- | --- | --- |
| 10003 仓促修补 | 「触发你控制支援上的能力时基础技能值设为 0」没有声明式“把基础技能值设为 X”的修正读点（现有修正只有加值与下限） | 按印刷基础技能值逐技能扣减，条件为本次检定的来源是本人控制的支援（与威尔森 +1 同一来源读点）；对 `inv.statOverrides` 的临时基础覆盖不抵消 | P6 补「基础技能值覆盖」原语后改为声明式 |
| 10002 应急手段 | 「手牌中没有可执行 [action] 能力的 [[Tool]]／[[Weapon]]」只能在 resolve 内判断（criteria 无能力表读点） | 反应可能被询问一次；此时只横置、不弃牌 | P6 补「手牌能力表」条件读点 |
| 10004 凯特 | `transferControlledClues` 的特质过滤读实例 `asset.traits`，真实支援实例没有该字段 | 10004 用 `api.countControlled({trait})`（印刷 + 运行时 add:trait）筛候选，只传 `emptyTarget` | P6 引擎修正特质读点后恢复传 traits |
| 10004 凯特 | `investigator.freeAction` 只在本人回合的行动枚举里出现，其他玩家窗口不枚举 | [fast] 在正常调查阶段可用；与 09008 等既有调查员同一限制 | P7 统一玩家窗口枚举 |
| 10005 磁通量稳定器 | 「检索 1 张以太电流」有 10006（战斗）/10007（躲避）两个同名面 | 两副本都可取时由玩家选择（默认 10006），不写死固定面 | 保留（更贴近卡面） |
| 10009 亚历山德拉 | `autoEvadeNonElite` 只枚举同地点敌人，无距离参数 | 旧印成功后在条目内按「所在地点或已揭示连接地点」逐候选用现有 `evade{auto}` 结算 | 若第三张卡需要同范围，合并进效果原语 |
| 10009 亚历山德拉 | 引擎没有「谈判已结算」窗口；`actionResolvedAtLocation` 上下文不带行动种类 | 萨马科纳的回合首次谈判毁灭用条目级 `trackActionHistory` + `inv.actionHistory`（仅当 10011 在调查员区域或战役记录牌组中时记账） | P7 补 `parleyResolved` 窗口或窗口上下文 `actionKind` |
| 10009 亚历山德拉 | `cannot:parley` 是实体级限制，附属在敌人上的哄骗仍可按「附属敌人」谈判 | 仅限制直接以萨马科纳为实体的谈判 | P6 补「按被附属敌人判定」的谈判限制读点 |
| 10009 亚历山德拉 | 玩家卡敌附属不是能力窗口来源，宿主离场时也不进弃牌堆 | 哄骗随宿主敌人一起离场消失；失败时仍按条目 resolve 弃置 | P7 与 09025/09027 统一处理敌附属清理 |
| 10009 亚历山德拉 | 异地基础躲避没有远程目标读点 | 哄骗的躲避模式只在 `doEvade` 接受时出现（同地点交战／巨大／连接地点） | P6 补远程躲避目标 |
| 10012 鸣神琥珀 | 能力层没有写 `state.campaign.chaosBag` 的入口；`chaosTokens.add/payMixed` 只写当前袋 | 加入／支付只改当前袋，与既有 07x 祝福诅咒玩家卡同口径；规则上祝福／诅咒在关卡结束回供应堆 | 如需跨关一致性，P7 暴露战役袋写入口 |
| 10012 鸣神琥珀 | `turnBegins` 被 `triggerReaction` 与 `reactionWindow` 各派发一次；选择「放弃」会看到第二个相同提示 | 用 `limit:{scope:'perWindow'}` 保证同一窗口只结算一次 | P6 去重回合开始窗口 |
| 10012 鸣神琥珀 | `beforeChaosTokenReveal` 只在技能检定的抽标记循环打开 | 《真幻记述》只替换技能检定揭示的标记（非检定的“揭示标记”效果不覆盖） | P7 若出现非检定揭示再扩展读点 |
| 10015 汉克 | 濒败替换按 P2 原语声明为 `forced`（印刷为 `[reaction]`，可选） | 用 `stillLethal`（按存储上限）复核后才替换，避免被快速卡救回后误翻面 | P6 若补可选濒败窗口再改为 reaction |
| 10017 一身是胆 | 没有「把伤恐移动到敌人」的原语 | 逐点从汉克移除（原始移动语义，不触发治疗窗口、不受禁疗影响）并 `api.damageEnemy` 等量伤害，上限取敌人剩余生命 | P6 补 `moveHarmToEnemy` |
| 10015 汉克 | `assignHarm` 的 direct 伤害不会分给声明承接的调查员 | 承接同地点调查员与盟友的**普通**伤害／恐惧（含`redirectAllyHarm` 路径）按 P2 口径实现；直接伤害仅限盟友 | P6 补「可承接他人直接伤害」读点 |
| 10015 汉克 | `finishScenario` 会恢复所有调查员形态，坚毅面与禁疗不跨场景保留 | P5 内单场景与存档往返正确；跨章由战役流程决定 | P7 战役流程补形态跨章保留规则 |
| 10018 爹爹在哪儿 | 窗口监听扫描不含 `enemy.attachments`，附在敌人上的弱点无法只靠自身响应回合结束 | 回合结束 1 点直接恐惧镜像在三张汉克面上，criteria 读取敌人附属中的 10018 | P6 修 `hasWindowListener` 扫描敌附属后搬回 10018 |
| 10018 爹爹在哪儿 | 玩家卡敌附属在宿主被击败时不进弃牌堆 | 弱点随宿主敌人一起离场消失 | P7 与哄骗/09027 统一处理 |
| 全员 | 开局/构筑期没有 `investigator.forms`/bonded 注册读点（形态由 `bondedCards` 与 `10016a/b` 条目驱动） | 濒败替换与恢复走 `investigator-form.js`，无需额外声明 | 保留 |

以上缺口不改变 P5 退出门禁：五人逐人证据完整、`audit/fhv-investigators.json#status = verified`；
近似项已在本文件与条目 `note:` 中披露，后续阶段补原语时收敛。

