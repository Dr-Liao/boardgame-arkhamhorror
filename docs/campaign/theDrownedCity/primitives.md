# 沉没之城 P2 原语

本轮已测试三级淹没、混乱袋密封、实物翻面、附属牌通道和跨章记录。逐个机制的接口、引擎读点、适用卡号和测试证据见 [原语计划](../../../audit/tdc-primitive-plan.json)。

| 接口 | 行为 |
| --- | --- |
| `transferOnControllerDefeat: 'nearest'` | 败退处理按地图距离过滤尚在场的调查员。并列最近时由领队选择。脱节地点的距离记为无限。移交保留同一支援实例及其计数、横置状态和所有者。 |
| `mechanics.map.configure({ adjacency: 'rows' })` | 仅连接相差一行的格子。隔离格子和显式连接沿用现有地图规则。通过 `mechanics.map.relocate(cells)` 改位置后重算连接，地点 ID、在地点上的实物和计数原地保留。 |
| `mechanics.scenarioDecks.take(id, count, { from: 'bottom' })` | 从底向上返回至多 `count` 张牌。由受信任的调用方放置或逐张结算。默认从牌库顶取牌。 |
| `mechanics.scenarioDecks.discard(id, code, { recycleWhenEmpty: true })` | 将已结算的牌写入该牌库的弃牌区。牌库已空时，以对局随机源重洗其弃牌。 |
| `mechanics.progress.claim(track, seat, option)` | 按进度组保存调查员与选项的一对一分配。使用战役调查员 ID 保存进度，座位换人后按新身份查找。 |
| `mechanics.progress.forSeat(track, seat)` | 向规则调用方返回当前调查员的选项和进度。存储表及去重标识从观察投影中移除。 |
| `mechanics.progress.change(track, seat, amount, receipt?)` | 存储非负进度，并支持结算重试去重。调用方使用稳定的结算标识区分章次和触发事件。 |
| `mechanics.progress.settle(track, seat, receipt, resolve)` | 在选择事务内以当前调查员的选项及进度结算一次，保存回执用于重入和重试。 |

多部位敌人通过 `scenarioRuntime.linkEnemyParts(bodyId, partIds)` 连接同地点的在场实体。主体持有位置和交战关系，战斗与躲避选择部位。敌人正常攻击合计在场部位的伤害及恐惧，部位的反击与警戒使用各自数值。成功躲避横置并解除主体的交战。翻面保留部位 ID，主体移出游戏时部位一同移出。关系存档拒绝孤立部位、重复关联以及混合蜂拥或敌人地点结构。

专项测试运行 `npm run test:tdc`。新原语正常、非法和存档路径记录于 [专项测试](../../../tests/tdc-primitives.test.mjs)。

## P7 共用运行层

| 接口 | 行为 |
| --- | --- |
| `treacheryRule.test.skills` | 显现者从至少两项不同技能中选一项检定。继续支持原有的单项 `skill` 声明。 |
| `treacheryRule.test.fail = { kind: 'discardChosenByAmount', max }` | 失败后弃掉至多 `max` 张牌，按失败差值计数，使用通用的弃牌选择与手牌保护。 |
| `mechanics.map.nearest(from, eligible)` 和 `mechanics.water.nearestTargets(from, amount)` | 依据图上连接找出所有并列最近的合法地点。水位查询使用已有锁定和最低、最高水位规则。 |
| `mechanics.scenarioDecks.revealChooseDraw(id, seat, count, { discardTo: 'scenario' })` | 从独立牌库选出的牌交给真实遭遇管线，取消后在同一牌库重抽，无效选择不改变牌堆。 |
| 独立牌库中的遭遇附属 | 本次抽出的实体附属保留原牌库与牌号，读档或转移宿主后仍保留来源。弃置时按原牌库结算。 |
| `mechanics.map.place(id, x, y, { ports })` 与 `mechanics.map.rotatePorts(id, turns)` | 正交地图可为地点指定方向出口。相邻格子的几何连接需要对应的两端开放，旋转后立即重算合法移动和寻路。显式连接及地点上的实体继续保留。 |
| `{ recordCount: { key, atLeast } }` | 战役节点读取声明为 `string[]` 的跨章记录，按去重后的数量匹配分支。 |
| `mechanics.startingAdjustments.defer(seat, { receipt, scenarioId?, resources?, clues? })` | 给当前调查员登记下次入场的资源或线索调整。指定章节时可跨过其他章节，同一调查员的同一回执只生效一次。替换调查员不会继承该回执。 |

以原创场景和实际事务验证上述读点，运行 `npm run test:tdc:p7`。

## P7 第二轮共享/逐章原语（2026-11-20）

第二轮把上一批 pending 请求里可落引擎的部分落地，并让内容层按「声明即接线」消费：

| 接口 / 声明键 | 行为与读点 | 消费者 |
| --- | --- | --- |
| `api.scenario.setEnemyKeywords(enemy, ['hunter'], { enabled, throughRound })` | 可编辑关键词扩展 hunter；turn.js#enemyHasHunter 先读 keywordOverrides，过期自动回印刷值 | 11724 朝圣者领袖（共享） |
| `threatEffect.cannotTriggerAbilityTraits` / `flags.cannotTriggerCardAbilitiesWithTraits` | 威胁区卡按特性禁止触发 action/free/reaction 能力（forced 不受影响）；读点 ability-rules.js#descriptorUsable | 11752 地狱机械（共享） |
| 地点附属的 `modifiers`（audience: 'here'） | 附属于地点的卡把修正作用到同地点调查员；读点 modifiers.js#modifierSourceRows | 11731 迷蒙长者（共享） |
| `scenarioBehavior.enemyLeftPlay(state, enemy, reason, api)` | 敌人非击败离场（discarded/setAside/removed）统一钩子；与 enemyDiscarded 择一消费 | 11549 水下寄生虫、11580 带鳞寄生虫 |
| `encounterResolve(state, inv, card, api, { location, encounteredFrom })` | 遭遇抽牌来源 deck/discard/search 透传（api.drawEncounter 可用 from 显式声明） | 11632–11634 符文诡计 |
| `scenarioBehavior.spawnLocation(state, code, defaultLocation, engagedSeat, runtime)` | 生成落点覆盖（最近淹没地点 / 最高层无调查员 / 与猎物交战） | 11605/11606/11637 |
| `enemyRule.cannotBeDamaged` / `enemyRule.cannotBeExhausted` | 按当前面条目动态读取；换面失效、文本空白失效；读点 enemy-restrictions.js + combat/actions/scenarioRuntime | 11702–11704 克苏鲁部位 |
| `scenarioBehavior.enemyFaceFlipped(state, enemy, from, to, api)` | api.flipEnemy 换面成功（changed）后的强制窗口 | 11702–11704 翻面强制 |
| `locationRule.reachConnectingEnemies` | 位于该地点可攻击/躲避直接相连地点的敌人（moves.js 目标枚举 + validateMove） | 11699/11700 屋顶 |
| `replaceChaosTokens(state, count, mapper, { permanent })` / `lowerChaosToken` / `{ type: 'lowerChaosTokens', count, by }` | 混乱袋按当前内容逐枚降档（-7/-8 与符号不变，战役袋同步） | 幕间 IV Toe the Line |
| `doomKeptOnAgendaAdvance: 'storyAssets'` | 议程推进时保留剧情资产（神器）上的毁灭 | 11674 城市之下 |
| flow `choice` 节点 `perInvestigator: true` + `afterChoiceEffects` | 逐 active 调查员询问同一组选项，答案写 flow.history.choices；handler 落账 | Interlude I 领任务 / No Place Like Home 逐人创伤 |

第二轮仍未落地（保持近似并登记在各章 `engine-needs/` 与 `artifacts/migration/tdc/p7/PRIMITIVES.md` 排队区）：storyAsset 主动能力激活（11550/11568/11581/11582/11638/11611）、离开宿主地点的强制检定（11576）、地点条件性移动额外费用（11571）、攻击期间线索加伤（11690/11691a）、星之眷族关键词/猎物覆盖与文本空白（11688）、合成地点 xsky schema、地点不可离场（11648–11652）、地点进入费用（11623）、下一章维护禁资源（11611）、部分结算钩子。
