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
