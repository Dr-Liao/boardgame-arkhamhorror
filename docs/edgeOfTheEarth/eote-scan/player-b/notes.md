# player-auditor-b 审计笔记（EOTE 一般玩家卡 08079–08133，55 张）

范围：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json` 的 `player-auditor-b`（M2-3 `08079–08108` 30 张 + M2-4 `08109–08133` 25 张，含 4 张基础弱点 `08130–08133`）。
交付：`findings.json`（55 卡 verdict/clauses/file:line 证据/issues）、本笔记；辅助产物 `_digest.md`（55 卡卡面+条目源码带行号）、`_probe.mjs`/`_probe2.mjs`（真实引擎路径复现脚本）、`_screen-filtered.json` 等。

## 一、结论概览（findings.json summary）

- 55 卡：**match 21 / approximation 24 / gap 10 / blocked 0**；issues：**high 12 / medium 33 / low 20**。
- 证据口径：每卡逐子句对照 `cards-data` 卡面中英 vs 单卡条目源码；引擎读点逐条打开（api 定义、窗口 context、capability 读点、槽位/费用/治疗入口）；对可疑结论全部用真实引擎路径 probe（`node _probe*.mjs`）或 `tests/core-fixture.mjs` 复现。
- 测试：`cd games/arkhamhorror && node tests/eote-player-m2-3.test.mjs`（28 pass）+ `node tests/eote-player-m2-4.test.mjs`（35 pass），in-process 无 spawn。**测试全绿，但多张卡的测试用「手工构造 context/skillTest」直接执行描述子，掩盖了真实路径失效**（详见 §三）。
- D1 之外：所有声明字段都有字面读点（`flags-readpoints.json` 对本人分片 0 unread）；`primitive-compliance.json` 里引擎/内容出现的本人卡号**全部是注释**，无一行为级卡号分支（D4 卡号分支 0 条）。

## 二、Top findings（high，均可复现）

以下证据均为 `相对 mod 根路径:行号`；「probe」指 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b/_probe*.mjs` 用 `tests/core-fixture.mjs` 真实引擎路径复现。

1. **08102 保护魂灵：真实路径永不触发（high）** — `src/cards/entries/08102.js:14-16` 的 criteria 读 `context.asset.location` 与 `context.asset.traits`；真实 `assetLeavesPlay` 窗口的 `context.asset` 是裸实例 `{id,code,exhausted}`（`src/engine/card-defs.js:307-308`；窗口发射点 `src/engine/assets.js:397-401`），两字段恒 `undefined`。probe：真实 `reactionWindow('assetLeavesPlay', …, asset=裸实例)` 不提供该反应。测试 `tests/eote-player-m2-3.test.mjs:292-306` 手工塞 `asset:{traits:['Ally'],location:…}` 才过。
2. **08105/08107 破冰锥：真机不可用（high×2，整卡）** — criteria 读 `state.skillTest?.actionKind`（`src/cards/entries/08105.js:16`；`08107.js:21,25`），但 EotE 没有任何 `trackTestTarget` 声明，`performTest` 只在 typedTarget/options.actionKind 时写 `actionKind`（`src/engine/tests.js:166-180`；fight 只传 `testTarget`，见 `src/engine/combat.js:233`）。probe：真实战斗 + `playerWindow('test.beforeCommit')` 不出现该能力；伪造 `skillTest.actionKind='fight'` 才出现。测试 `tests/eote-player-m2-3.test.mjs:311` 正是伪造的。08086 的同类判据走 `context.actionKind`（`testInitiated` context 由 `tests.js:254` 写入）所以不受影响。
3. **08091 恩科西·马巴蒂：第二子句整条缺失（high）** — `src/cards/entries/08091.js:14-16` 自述省略「符号揭示改为查找并揭示咒印」；而引擎专用原语 `api.playerTools.setSigilToken` / `replaceRevealedToken`（`src/engine/api-misc.js:1418-1431` / `1432-1442`）已实现且有原语测试（`tests/eote-player-primitives.test.mjs:197-216`），`audit/eote-player-queue.json` 的 `m2-3-08091` 仍标 `done`。条目也未使用 `setSigilToken`。
4. **08081 有胆有识：伤害侧强制分配未接线（high）** — 印刷「非直接伤害/恐惧都必须先分配给 Plucky」。恐惧侧读 `assetEffect(...).composure`（`src/engine/harm-threat.js:163-165`，条目 `composure:true` ✓）；伤害侧读点是 **`flags.composureDamage`**（`harm-threat.js:160-162,165`，原语测试 `tests/eote-player-primitives.test.mjs:104`，queue `m2-3-08081=done`），本卡未声明该 flag。probe：伤害分配仍出现「由调查员承受」。
5. **08083 医学生：盟友支援目标伤害治疗失效（high）** — `src/cards/entries/08083.js:38` `api.healAsset(target, 1)` 把数字当 spec（签名是 `healAsset(card, spec)`，`src/engine/api-misc.js:759-768`）→ 治疗 0 伤害；仅 `addAssetHorror(target,-1)` 治恐惧（可把 horror 写成负数）。probe：盟友 damage 1→1、horror 1→0。测试 `tests/eote-player-m2-3.test.mjs:106-114` 只测调查员目标。
6. **08088 老旧的霰弹枪：eventPlayed 反应写成「永久 2 发 + 跨座位触发」（high，未披露）** — `src/cards/entries/08088.js:22-24` 在 `eventPlayed` 窗口 `api.setAssetUses(source, 2)`，无座位/地点限制、无恢复。probe：其他座位打出事件也把 uses 0→2，且再次触发仍为 2；等价于每打一张事件白得 2 发可花弹药。印刷是「打出事件期间视为 2」（作用域/持续性都不同），条目无 `note` 披露。对比参考实现 `参考资源/.../Asset/Assets/OldShotgun2.hs` 未实现该静态句。
7. **08130/08131 臂伤/腿伤：治愈子句不可用 + 替代能力移不走卡（high×2 每张）** — 条目自述「无 threatDamageSink」用 `free + discardSelf` 近似（`src/cards/entries/08130.js:13-15,29-31`；`08131.js:12-13,26-28`），但引擎 P6 已实现 `threatDamageSink`：`src/engine/harm-threat.js:702-740`（读点 721 `flags.threatDamageSink`）、`api-misc.js:231-240` 统一入口、原语测试 `tests/eote-player-primitives.test.mjs:85`。且该免费近似能力**不能把威胁区卡移走**：`discardSelf` 费用只处理 `inv.assets` / `inv.attachments`（`src/engine/ability-exec.js:178-189`），无 threat 分支；probe：使用后 `stillInThreat=true`，仅把卡号塞进弃牌堆，卡继续锁行动。修复：`flags: { threatDamageSink: true }` + 删除近似能力 + 补「healDamage 治愈→弃置」测试。
8. **08079 血债血偿：缺两处印刷限制（high）** — 「该攻击的伤害/恐惧不能分配给[[盟友]]支援」整句未实现（`src/cards/entries/08079.js:6-7` 自述；queue `m2-3-08079=rejected`），主效果反而因此变强；「Max 1 per attack」也未实现（`:14-22` 无 per-attack limit）。
9. **08084/08085 追踪：未印的精英排除（medium）** — `src/cards/entries/08084.js:33-34`、`08085.js:32-34` 过滤 `!enemy.elite`；印刷与参考实现均允许任意敌人（`参考资源/.../Event/Events/OnTheTrail1.hs:26`、`OnTheTrail3.hs:34`）。probe：只有精英敌人时打出后日志「没有可选的其他地点敌人」。附带确认「empty location」= 无调查员且无敌人，与参考 `Game.hs` 的 `EmptyLocation` 一致（实现正确）。

其余 medium 见 findings.json，重点类：08086/08097/08107/08112 的 P6 专用原语**已实现并测试但条目仍用旧近似**（stale approximation）；08100「two different actions」未去重（probe：移动两次）；08117/08119 单一治疗目标时自动花充能（违反 "may"）；08104/08106「instead of」写成追加；08113 每轮末流放（印刷：游戏结束/退场）；08098/08100 缺「During your turn」。

## 三、prior 账本虚报（重点复核项）

既有账本 `audit/eote-player-acceptance.json`：115 卡全 `status:"verified"`、`simplified:false`、`gates.noSimplified:true`；`audit/eote-player-queue.json` 中与本人分片相关的 9 条原语请求里 5 条标 `done`。

- **「无简化卡」不成立**：至少 08082/08086/08087/08089/08097/08104/08106/08112/08113/08117/08119/08120–08125/08130–08133 的条目自身 `note:`/头注释写着 approximation（`findings.json.priorLedgerChallenge.overclaims` 有完整列表）。
- **queue=done 但条目未接线**：`m2-3-08081`（composureDamage）、`m2-3-08086`（addAttackDamageBonus）、`m2-3-08091`（sigil 双原语）、`m2-3-08097`（lookAtLocation）、`m2-3-08107`（onTestSuccess）——引擎原语与 `tests/eote-player-primitives.test.mjs` 都在，`src/cards/entries/*.js` 仍走旧近似/缺子句。
- **测试「有证据」但语义错误**：08102 / 08105 / 08107 的测试用手工 context 或伪造 `skillTest.actionKind` 直接执行描述子，绕开真实窗口；08083 盟友目标分支、08084/08085 精英路径、08130/08131 治愈子句均无测试断言。
- 另：`08079`/`08087` 的 primitive request 被 `rejected`，但卡面整句缺失未在账本标注 simplified；08130/08131 的 `threatDamageSink` 请求在 queue 中查无记录（原语却已进引擎）。

## 四、D5 复用清单（同批/同模板复制）

按「同句规则只写一次 / 第三张停止写卡」口径（`games/arkhamhorror/AGENTS.md`）：

| 模板 | 证据 | 严重度 |
| --- | --- | --- |
| 08120–08124（先知先觉/一探究竟/好勇斗狠/技艺精湛/古物藏家）**5 份复制**，jaccard 0.926，仅特性数组/文案不同 | `screen/duplication.json` clonePairs；`src/cards/entries/08120.js:15-70` 等 5 文件 | medium |
| 08130–08133 四张基础弱点：锁定能力结构完全相同（3 个 capability + addEffect + info） | `08130.js:33-47`、`08131.js:31-47`、`08132.js:29-45`、`08133.js:27-43` | medium |
| 同一 P6 原语存在双实现/双别名：`api.addPendingTestBonus`（`src/engine/api-test.js:204-208`）与 `api.addTestPendingBonus`（`src/engine/api-misc.js:1014-1018`）函数体完全相同；本人分片 08120–24 用前者、08105/08107 用后者 | 两文件行号如上 | low（引擎层） |
| `api.locationName`（`src/engine/api-misc.js:752`）与 `api.locName`（`:754`）同义别名，本人分片内 08084/08093/08099 用 locName、08110/08118 用 locationName | 条目内已证 | low |
| 08084/08085 各自复制 `pathTo` BFS（`08084.js:10-26` / `08085.js:9-25`） | 两份逐字符同构 | low |
| 08090/08092（烙印）、08101/08103（占卜）、08109/08111（身形虚化）、08114/08115（珍贵记忆）、08094/08096（长柄大锤）、08098/08100（远古海图）、08104/08106（韦伯教授）、08108/08110（虚影易位） | 各自 source 近似对 | low |

引擎侧复用正面项：`sharedSlotGroup`（08127，`src/engine/assets.js:134-147`）、`restrictedSlots`（08128，`assets.js:166-197`）、`threatHorrorSink`/`redirectHeal`（08132/08133，`src/engine/harm-threat.js:636-665`）、`composure`（08081，`harm-threat.js:163-165`）都是声明式复用，方向正确。

## 五、机械线索复核结论（不照抄）

- `integrity.json`：本人分片 55 卡全部 `no-implemented-flag`（该口径噪声，玩家卡普遍无该字段，排除）；**08109–08133 的 `entry-no-code` 是假阳性**——这些条目用 `const code='08xxx'` + `export default { code, … }` 简写（如 `src/cards/entries/08130.js:17-20`），screen 只匹配 `code:'…'` 字面量。
- `keyword-coverage.json`：23 卡命中，逐条读引擎后**无一是真实缺失**——「检定」走 `api.test`/`performTest` 通用机制、「伤害/恐惧/治疗/弃牌」走 `applyHarm`/`healDamageFrom`/`discardChosen` 等统一入口、「快速」走 `fast`/`quickEventView` 通道（`src/engine/ability.js:1338-1354`）。
- `flags-readpoints.json`：本人分片 **0 条 unread**（全部声明字段有字面读点）。
- `primitive-compliance.json`：`engineLiterals` 20 条、`contentLiterals` 2 条，逐条打开均为**注释/包区间声明**（如 `src/engine/api-misc.js:235,1418,1432,1444,1490,1499,1510` 是原语注释；`content/.../shared.js:19` 是卡包区间）→ D4「引擎卡号分支」0 条。
- `duplication.json`：clonePairs 11 对、跨循环同文 4 组已人工确认为上表模板复制。
- `perceivability.json`：11 卡 `silent-ability-no-choice-no-log`——实际多数有 legalMoves 中文 label + 引擎日志/牌桌投影；仅 08079/08086/08087 的自动效果缺 `api.info`（low）。

## 六、测试与复现

```powershell
cd G:\boardgame-hall-ai\games\arkhamhorror
node tests/eote-player-m2-3.test.mjs     # 28 pass, 0 fail
node tests/eote-player-m2-4.test.mjs     # 35 pass, 0 fail
# 复现 high findings（真实引擎路径，in-process）：
cd G:\boardgame-hall-ai\games\arkhamhorror\docs\edgeOfTheEarth\eote-scan\player-b
node _probe.mjs    # 08130 threat 遗留 / 08088 uses / 08100 重复行动 / 08084 精英排除
node _probe2.mjs   # 08083 盟友治疗 / 08081 伤害分配 / 08088 跨座位
```

## 七、建议修复优先级

1. 接 P6 已就绪原语（一行级修复、账本可立即回真）：08081 `flags.composureDamage`；08086 `addAttackDamageBonus`；08091 `setSigilToken`+`replaceRevealedToken`；08097 `lookAtLocation`；08107 `onTestSuccess`；08112 `revealAdditionalTestToken`；08130/08131 `flags.threatDamageSink`。
2. 修真实路径 bug：08102 criteria 字段；08105/08107 actionKind 判据；08083 `healAsset` 参数；08130/08131 discardSelf 的 threat 分支（若仍保留近似）。
3. 规则偏差：08088 事件期 uses 作用域；08084/08085 精英过滤；08100「不同行动」；08117/08119「may」；08079 两处缺失限制；08098/08100 回合限制。
4. 账本：把 above 近似/缺失逐卡写入 `audit/eote-player-acceptance.json`（simplified/approximation），修正 `noSimplified` 门禁口径；queue 的 5 条 done 需回写条目后再算完成。
