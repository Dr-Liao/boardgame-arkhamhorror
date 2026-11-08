# P5 调查员及专属依赖（《地球边缘》）

本批范围为五位正式调查员、9 张专属卡与 8 张双面永久演武（合计 17 张专属依赖）。逐人状态由[调查员审计](../../audit/eote-investigators.json)复算并汇入 P8 总审计；[路线图](README.md)只有在当前源码的 Node、浏览器与回放门禁通过后才勾选。

本阶段不开放一般玩家卡（P6）与战役/章节（P7–P8）；`eoteInvestigators` 包独立开放，五位调查员可在既有可玩战役中选人与构筑，专属依赖只随对应调查员强制带入，不进入一般构筑池。

## 逐人范围

| 调查员 | 专属依赖 | 实现与验收重点 |
| --- | --- | --- |
| `08001` 丹妮拉·雷耶丝 | `08002` 机修工的扳手、`08003` 黑帮暴徒 | 敌人攻击你后（非你引发的趁乱攻击，攻击被取消也算）反应：对敌人 1 伤害或自动躲避；旧印 +1，本轮被攻击过则改为自动成功；扳手 fast 强制同地点敌人攻击你，攻击「上次回合结束后攻击过你的敌人」+2 战斗 +1 伤害；黑帮暴徒的攻击不可取消且伤害/恐惧视为直接。 |
| `08004` 诺曼·威瑟斯 | `08005` 伊波恩之书、`08006` 预示者 | 牌库顶常驻揭示（对本人）；每轮一次以 -1 费把牌库顶当作手牌打出；顶牌揭示到弱点时强制抽取；旧印 +X（X 为顶牌费用）并可交换顶牌与手牌；伊波恩之书 fast 换顶 / fast 把顶牌投入同地点检定；预示者置于牌库顶后封锁抽牌与操纵，可用 2 行动弃置。 |
| `08007` 蒙特雷·杰克 | `08008` 可靠的长鞭、`08009` 被埋葬的秘密 | 回合结束按「本轮起始地点与当前地点」距离结算：距离 1 得 1 资源或抽 1 张，距离 ≥2 两者都做；旧印 +1，距离 ≥1 时得资源或抽牌；长鞭 fast、以敏捷进行攻击，成功可横置自动躲避或 +1 伤害；被埋葬的秘密进入威胁区、可调查地点时不能移动、调查成功弃置（失败可 2 恐惧洗回）。 |
| `08010` 陈丽丽 | 8 张双面演武 `08011a/b`–`08014a/b` + `08015` 命运重担 | 构筑：潜修者 0 / 守卫者 1–5 / 中立 0–5 / 最多 5 张其他 0 级守卫者、禁 `[[Firearm]]`；开局选择 1 张演武，每累计 15 经验可加 1 张不同演武，每张配 1 张命运重担。开局全部演武以 Unbroken 面进场；Unbroken 面主动行动后翻到 Broken 面；Broken 面轮末按四组条件翻回；旧印 +2 且本次检定结束后翻回一张 Broken 演武；命运重担显现时二选一（翻 Broken 且本轮不可翻回 / 1 伤害 1 恐惧）。 |
| `08016` 鲍勃·詹金斯 | `08017` 精明的交易、`08018` 贪婪 | 同地点调查员可向你揭示其手中 `[[道具]]`；每回合 1 个只能用于代打同地点队友手中道具的额外行动（归牌主控制，双方可分摊费用）；旧印每控制 1 张 `[[道具]]` +1；精明的交易令 `[[道具]]` 费用 -1，且打出时可置于同地点任一调查员控制下；贪婪按资源数追加恐惧。 |

平行版本（`98007` 平行诺曼、`90062` 平行蒙特雷及其替换专属 `98008/98009/90063/90064`）不属于本循环 403 条记录，保持 catalog-only；审计账本 `reprints.parallelVersions` 记录该边界，不用「已有同名/平行版本」冒充本批完成。

## 共用读点与存档

P5 新增读点集中在 `src/engine/eote-investigator-support.js`（引擎钩子）与 `src/deck/{availability,deckbuilding}.js`、`web/deck-rules.js`、`content/campaigns/edgeOfTheEarth/investigator-data.js`：

- **可选扩展/声明式字段**：`investigator.tracksAttacks`（攻击历史）、`investigator.roundEvents`（本回合事件记账）、`investigator.deckTop`（常驻揭示配置）、`flags.weaknessStaysOnDeckTop` / `flags.locksDeckWhileRevealed` / `flags.activatableWhileOnDeckTop`（预示者）；只对声明者写入状态，既有 13 局 golden replay 的调查员不受影响。
- **回合事件**：`inv.roundEvents = {damage,horror,tests,handTwoPlus,enemyAtLocation}`，轮初重置；伤害/恐惧在 `applyHarm`、检定在 `performTest`、手牌与同地点敌人在抽牌/行动结算后采样。读点供陈丽丽四张 Broken 面的轮末条件使用。
- **攻击历史**：`inv.attackedSinceTurnEnd=[{enemyId,round,kind}]`，敌人攻击结算后写入（含被取消攻击），调查员回合结束时清空。
- **牌库顶**：`syncPassiveDeckTop(state,seat)` 在开局、轮初、抽牌后同步；强制效果抽掉被揭示的弱点（`flags.weaknessStaysOnDeckTop` 的预示者除外）；`commitDeckTop` / `flipAfterNextTest` / `grantFreeActions` 经 `ctx.api` 暴露；封锁期间 `drawCards` 短路。
- **构筑**：`availability.js` 打开 5 位调查员与 17 张专属依赖（`dependencyOnly`）；陈丽丽的演武选择（`options.disciplines`，XP 门控 `options.xp`）在 `signatureAndWeaknesses` 与 `web/deck-rules.js#validateDeckRules` 双处同口径；AI 随机选人池（`PLAYABLE_INVESTIGATOR_CODES`）不变。
- 新状态字段经 `validateInvestigatorMechanics`/存档迁移读点校验；旧存档缺少字段时保持原状。

## 开放边界

`eoteInvestigators` 独立开放（playable），调查员由大厅选人、专属卡只作依赖；`eotePlayer` 仍 catalog-only（P6），`eoteCampaign` 与八章仍 catalog-only（P7–P8），大厅不出现该战役入口。调查员及玩家卡开放不表示《地球边缘》战役可以启动。

## 验证与证据

在 Mod 目录运行。先完成源码改动与必要的既有账本复算，再生成当前源码验收；运行期间哈希变化会阻止确认。

```powershell
node tools/build-card-index.mjs --write            # 新增 22 张单卡文件后重建索引
node --test tests/eote-investigator-*.test.mjs     # 逐人 Node 验收
node tools/run-eote-investigators-browser.mjs      # 真实大厅选人/构筑/开局浏览器验收
node tools/verify-eote.mjs --node                  # 含五位调查员测试
node tools/verify-eote.mjs --regression            # test:fast 无新增失败 + replay 零漂移
node tools/audit-eote-investigators.mjs --write    # P5 调查员账本
node tools/audit-eote-investigators.mjs --check
node tools/audit-eote-primitives.mjs --check
node tools/audit-eote-rules.mjs --check
node tools/audit-eote-interactions.mjs --check
```

Node 用例覆盖逐人合法/非法构筑、旧印、能力、专属依赖、多人窗口、JSON 暂停恢复与负面路径；浏览器经真实大厅 HTTP 通路验证五人构筑开局与能力/状态投影，另回归 P3/P4 既有面板。生产 Mod 不注册测试卡、不增加调试 HTTP 入口。逐人结论写入 `audit/eote-investigators.json`；过程日志与截图位于大厅根 `artifacts/migration/eote/p5/` 与 `artifacts/migration/eote/reports/`。
