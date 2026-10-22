# 卡牌保真度 P0 修复报告（24/24）

> 对应 [card-fidelity-todo.md](card-fidelity-todo.md) 的 P0 高严重度清单（快照 2026-10-22 02:22）。
> 本报告记录每张卡的修复落点与验证用例；行为验证以卡面文字为准，不以"有条目/有字段"为准。

## 门禁结果

- `npm run test:fast`：**2258 / 2258 通过**（新增 41 例 P0 回归）。
- `npm run cards:check`：5 / 5 通过（467 张单卡文件与索引一致）。
- `npm run replay:fixtures`：13 局 golden replay 全部重放出相同指纹。
- `node tools/audit-abilities.mjs --write`、`node tools/hardcode-audit.mjs --write`：基线已随实现更新，`architecture-guard` 通过。

## 逐卡结果

| 卡号 | 名称 | 修复内容 | 验证 |
| --- | --- | --- | --- |
| 02012 | 吉姆的小号 | 修复 `healHorrorNearby` 的未定义 `effect`；多目标时按 `api.choice` 选择治愈对象 | `card-fidelity-p0` 02012（2 名候选人） |
| 03047a | 陌生人（火焰） | 背面把男子移动回前厅并重新收录进 `state.enemies`；补混乱袋/恐惧/灾害；击败与弃掉两条路径共用 | `card-fidelity-p0` 03047a/b/c 两条路径 |
| 03047b | 陌生人（淤泥） | 同上；灾害恐惧放在移动的出发地点 | 同上 |
| 03047c | 陌生人（洪水） | 同上；被弃掉路径补三行效果；灾害「每轮仅限一次」改为按地点能力计数 | 同上 |
| 03087 | 拜亚基的猎杀 | 揭示顶 X 张并打印给玩家；从揭示的拜亚基中选择并真正抽取（生成/交战），其余洗回；征兆→1 恐惧 | `card-fidelity-p0` 03087 |
| 03102 | 锈蚀 | X=地点隐藏值；按印刷费用合计弃多张（场上/手牌）；弃够即停；合计不足时不弃并涌动 | `card-fidelity-p0` 03102 两例 |
| 03108 | 解剖图表 | 改为 `played` + `fast` 事件；`playCondition` 剩余神智≥5；非精英敌人 -2/-2 持续到当前调查员回合结束 | `card-fidelity-p0` 03108 两例 |
| 03121 | 埋藏的真相 | 当前议程条目 `skipMythosDoom`，神话阶段跳过放毁灭 | `card-fidelity-p0` 03121/22/23 |
| 03122 | 洗劫宅邸 | 同上 | 同上 |
| 03123 | 不能揭开的秘密 | 同上 | 同上 |
| 03182a | 丹尼尔·契斯特菲尔德 | 受到恐惧时若有 1 点未分配给他→1 伤害；离场→移出游戏 | `card-fidelity-p0` 03182a 三例 |
| 03200 | 真相幻影 | skull=场上毁灭总数（普通封顶 5）；cultist 失败移动未交战拜亚基；tablet 取消投入技能卡效果与图标（-3/-4）；elder_thing 失败按差值失资源 | `card-fidelity-p0` 03200 四例 |
| 03221 | 风琴手 | `cannot:beDamaged`；猎手移动后再结算一次猎手（每轮一次）且本阶段不能攻击 | `card-fidelity-p0` 03221 两例 |
| 03221b | 风琴手 | `cannot:beDamaged`；敌军阶段结束未交战则远离最近调查员（优先无调查员地点），交战则解除交战 | `card-fidelity-p0` 03221b |
| 03234 | .41短口手枪 | `damageOnSuccessBy` 在结算 weaponBonus 之前并入；+1 伤害实际生效；额外行动按 turn 记账 | `card-fidelity-p0` 03234 |
| 03240 | 苍白面具 | skull=到起始地点的地点数（普通封顶 5）；cultist 攻击减伤（困难不造成伤害）；tablet 重整/攻击食尸鬼或灵怪；elder_thing 检索并抽取 | `card-fidelity-p0` 03240 四例 |
| 03241b | 死亡鬼灵 | 横置时攻击伤害 -1；躲避失败后它攻击你 | `card-fidelity-p0` 03241b 两例 |
| 03268 | 建议 | 取消攻击改为能力层反应（原来 `legacyReaction` 从未被枚举），花费 1 充能取消非精英攻击；主动躲避声明 `countsAs:'evade'` | `card-fidelity-p0` 03268 |
| 03317 | 疯狂漩涡 | 背面四选一；检定失败必须改选未选过的选项；昏倒选项在新密谋放 1 毁灭 | `card-fidelity-p0` 03317 两例 |
| 03332 | 哈斯塔（黄衣之王） | 仅剧情效果（source=encounter）可伤害；敌军阶段开始按玩家顺序攻击所有调查员（无视地点）；恐惧溢出→1 伤害 | `card-fidelity-p0` 03332 三例 |
| 03334 | 哈斯塔（褴褛之王） | 猎物=剩余神智最高；无剩余神智者攻击/躲避时 +1/0/-1/旧印视为自动失败；恐惧溢出→1 伤害 | `card-fidelity-p0` 03334 两例 |
| 04104 | 枪法如神 | 在 `activateFirearmFight` 窗口改写本次攻击：改指连接地点、忽略反击、未交战 +1 伤害；没有同地点目标也可激活 | `card-fidelity-p0` 04104、`tfa-player-acceptance` M2-B |
| 04156 | 挥金如土 | 改为支援 `free` 能力：花 3 资源+横置，本次检定 +2，成功返 3 资源 | `tfa-player-acceptance` M2-B high roller |
| 04273 | 陈旧猎枪 | 伤害改为 +2（合计 3）；skull/autofail 卡膛并自动失败；卡膛期间攻击不可用；新增 `[action]` 清除卡膛 | `phase5-migration` 5c-6（含卡膛流程） |

## 引擎/内容层改动摘要

- `src/engine/tests.js`：新增 `autoFailOnTokens`；03334 的「无剩余神智→自动失败」；技能卡取消投入（复用 `cancelCommitted`）。
- `src/engine/combat.js`：攻击窗口提前到目标判定前；支持把攻击改指连接地点；`marksmanship` 伤害、`damageOnSuccessBy` 顺序、横置减伤、卡膛、躲避失败反击、恐惧溢出后的伤害读点。
- `src/engine/ability-exec.js`：窗口上下文被取消后不再继续枚举同窗口反应。
- `src/engine/ability.js`：条目字段 `skipMythosDoom` / `removeFromGameOnLeave` / `horrorOverflowDamage`。
- `src/engine/enemies.js` / `assets.js` / `turn.js` / `moves.js` / `effects.js` / `skill-effects.js`：对应读点与目标枚举。
- `src/cards/encounter-abilities.js`：03047a/b/c、03087、03102、03121/22/23、03182a、03221/03221b、03241b、03317、03332、03334 的非玩家条目。
- `content/campaigns/thePathToCarcosa/{carcosa-chaos.js, scenarios/curtainCall, aPhantomOfTruth, dimCarcosa}`：混乱标记表、灾害每地点上限、风琴手敌军阶段行为、哈斯塔敌军阶段攻击。

## 说明

- 03121/03122/03123 的「线索放到敌人后翻成毁灭」目前由唯一会往敌人身上放线索的两条路径（03144、03145）直接结算为毁灭，结果与翻面一致；中央化钩子留给 P1 机制任务。
- 本次修复完成后 [card-fidelity-todo.md](card-fidelity-todo.md) 已无未完成项：P0 24 项、P1/P2/P3 共 235 项全部勾选（核心包 0、敦威治 0、卡尔克萨 0、失落时代 0 未完成）。
