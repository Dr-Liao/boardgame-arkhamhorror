# 万象无终通用原语

原语规格由 tools/tcu-primitive-spec.mjs 维护；完成状态由 audit-tcu-primitives.mjs 枚举代码接口并实跑测试计算。卡牌只经描述子和 ctx.api 写状态。

## P2.1 闹鬼结算

接口：`scenarioRuntime.haunted(seat, { locationId, times, kind, source })`。

失败检定的三类来源（调查/攻击/躲避）由剧本设置决定；结算顺序由玩家选择，全部可被 haunted 窗口取消。

验证：`tests/tcu-primitives-haunted.test.mjs`。

## P2.2 幽灵界第二遭遇牌堆

接口：`scenarioRuntime.extraDeck(id, codes) / drawExtra(seat, id) / shuffleExtra(id, codes) / discardExtra(id, n)`。

公开张数进观察投影；抽牌复用显现管线；洗回与弃牌走同一份顺序日志。

验证：`tests/tcu-primitives-spectral-deck.test.mjs`。

## P2.3 幽灵地点与翻面

接口：`scenarioRuntime.flipLocationToSpectral(id, seat) / locationIsSpectral(id)`。

双面幽灵地点用 back 数据翻面并保留线索/毁灭；单面幽灵地点声明 spectral: true；非幽灵地点的目标限制由章节的 canFightEnemy 读 isSpectral 实现。

验证：`tests/tcu-primitives-spectral-location.test.mjs`。

## P2.4 塔罗牌组（22 张大阿卡纳）

接口：`scenarioRuntime.tarot({ count, mode, take })`。

剧本级牌组，不建 05 卡号；确定性洗牌走 randomValue；22 张唯一、正逆位、抽取/选择、存档往返。

验证：`tests/tcu-primitives-tarot.test.mjs`。

## P2.5 阵法（多技能合成检定）

接口：`performTest(state, seat, ['willpower','intellect'], difficulty, { actionKind: 'circle' })`。

2–4 个技能值相加再投入；不新增 ability kind，借 actionKind 钩子；单技能调用零行为变化。

验证：`tests/tcu-primitives-circle.test.mjs`。

## P2.6 序章无牌组故事调查员

接口：`campaign effect { type: 'storyInvestigators', codes }`。

1–4 人、重复选择、未选者划掉、无牌组（不能抽牌/弃牌）、存档与观察投影不含隐藏牌库。

验证：`tests/tcu-primitives-story-investigators.test.mjs`。

## P2.7 通用谈判

接口：`描述子 { kind: 'action', actionKind: 'parley', target: { kind: 'location' } }`。

敌人/地点/剧情资产都能声明；借机攻击豁免沿用既有 actionKind；补「带谈判的卡」构筑筛选。

验证：`tests/tcu-primitives-parley.test.mjs`。

## P2.8 绑定（场外绑定集合）

接口：`api.bonded.code(seat) / api.bonded.return(seat, code)`。

绑定副本不计入 30 张；入场检索 3 张、1 张入手 2 张洗回；离场收回。

验证：`tests/tcu-primitives-bonded.test.mjs`。

## P2.9 塔罗槽位补全与开局入手

接口：`modifiers [{ target: 'add:slot', value: 'tarot' }] + 开局入手效果`。

额外槽位走 add:slot（不是 slot:tarot）；「高塔」禁止投入单独读点。

验证：`tests/tcu-primitives-tarot-slot.test.mjs`。

## P2.10 Memento / 看守人记录与战役资产入牌组

接口：`campaign effect { type: 'addCampaignCardToDeck', code, deck }`。

Memento/看守人用 string[] 记录，不新增引擎状态；战役资产入牌组不占 30 张。

验证：`tests/tcu-primitives-campaign-records.test.mjs`。

## P2.11 裂口与地点布尔状态

接口：`scenarioRuntime.addBreach(id, n) / setLocationFlag(id, flag, value)`。

裂口沿连接传播；骷髅值 = 裂口 + 毁灭；火盆点燃/熄灭决定推进哪一版幕。

验证：`tests/tcu-primitives-location-state.test.mjs`。

## P2.12 异端者多面与放逐

接口：`scenarioRuntime.flipEnemy(enemy, code) / banishEnemy(enemy)`。

「不能以任何方式被击败」走 enemyCannotBeDefeated 读点；放逐进胜利区而不是弃牌堆。

验证：`tests/tcu-primitives-enemy-faces.test.mjs`。

## P2.13 Cosmos / 未知地点牌库

接口：`scenarioRuntime.cosmos({ take, count })`。

面朝下地点牌库：抽 X 选 1、在场单位一并搬走、Void 地点可洗回。

验证：`tests/tcu-primitives-cosmos.test.mjs`。

## P6 直觉牌库（调查员专属牌库）

接口：`hunchDeck.reveal / returnCard / playDiscount（读点：inv.hunchDeck / inv.hunchRevealed）；「如同手牌」由 play-channels 原语的 hunch 通道统一处理：entries/windowEntries（普通行动+反应/收尾/能力窗口）、entryError（区域/弱点/费用门控）、takeToHand（清标记+折扣取牌）、actionTake（dispatch 普通行动）`。

11 张洞察事件（含悬案）；调查阶段开始揭示并视作手牌，打出 -2 资源；快速事件在对应反应窗口（如「证据！」击败敌人后）与收尾玩家窗口同样按 -2 资源打出；能力层 fromHand 事件同样可打出；阶段结束仍未打出则洗回；悬案改为进入威胁区域。

验证：`tests/tcu-investigators.test.mjs`、`tests/turn-end-window.test.mjs`、`tests/play-channels.test.mjs`、`tests/card-interactions.test.mjs`。

## P10.1 分离资源池与费用来源

接口：`api.availableResources / spendResources / bankResources / withdrawBanked`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.2 立即行动与原回合恢复

接口：`api.beginImmediateAction`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.3 忽略费用结算指定能力及其条件子句

接口：`api.cardAbilityOptions / resolveCardAbility`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.4 揭示时取消并替换混乱标记

接口：`api.replaceChaosToken`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.5 控制者被击败时转交支援

接口：`transferOnControllerDefeat`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.6 个人日志与跨关卡弱点升级

接口：`api.progressWeakness`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。

## P10.7 记录调查员陷入疯狂

接口：`scenarioRuntime.driveInsane`。

补完阶段新增的通用读写点；状态由实际API枚举、代码文件哈希与规则事务测试复算。

验证：`tests/tcu-completion.test.mjs`。
