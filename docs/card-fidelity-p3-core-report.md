# 卡牌保真度 P3 · 核心包批次报告

日期：2026-10-22。范围：核心包 23 张 P3 发现（[TODO](card-fidelity-todo.md) 核心包 0/185 剩余）。
本批次全部按印张文本验证，回归用例集中在 [card-fidelity-core-p3.test.mjs](../tests/card-fidelity-core-p3.test.mjs)，并保留原有验收用例。

## 逐卡

| 卡 | 修复 / 验证 |
| --- | --- |
| 01002 黛西·沃克 | 旧印「如果检定成功」改为成败判定后结算；失败不再出现抽牌询问。 |
| 01003 “倒霉蛋”奥图尔 | 限额键从 `state.round` 改为 `state.turnSerial`（每回合，而非每轮）。 |
| 01009 死灵之书 | `removeThreat` 读取 `threatCannotLeaveWhileCounters`；有恐惧时任何离场路径被拒。 |
| 01010 在逃中 | `enemyAttack` 顶部统一拦截非精英敌人（含反击、警戒、效果发起的攻击）。 |
| 01011 医院债务 | 验证：每轮两次上限、[fast] 不耗行动、轮末重置（既有 `core-n4b` 用例）。 |
| 01019 急救 | `targetedEffect` 声明 `chooseBy:'controller'`；伤害/恐惧由控制者选择。 |
| 01031 智慧古书 | 检索到的牌放回牌库顶后走 `drawCards`：弱点、抽牌窗口与日志都按「抽取」结算。 |
| 01055 飞贼 | `noOpportunityAttack` 从条目移到 [action] 描述子；打出资产仍引发借机攻击，行动豁免。 |
| 01063 新晋术士 | 检索必选（无 skip）且走抽牌管线；`onPlayDoom` 在 `newPlayerAssetInstance` 统一放置，覆盖所有入场路径。 |
| 01068 记忆抹消 | 删除抹消后的 `autoEngageAt`；只抹消文本，不自动交战。 |
| 01081 求生本能 | 「解除交战」改为 `disengageEnemy`，不再横置敌人；提示/日志同步。 |
| 01107 他们爬出来了！ | 删除强制移动后的 `autoEngageAll`；食尸鬼保持未交战直到下一次敌军阶段。 |
| 01117 丽塔·钱德勒 | +1 伤害改为可选 [reaction] 询问；战斗光环改用通用 `sourceTraitNotBlanked:'ally'` 条件。 |
| 01121b 假面猎手 | 线索费用新增 `engagedWithClueBlocker` 校验：交战期间不能支付 `cost.clues`。 |
| 01134 北区 | 进入新关卡时清空 `locationAbilityTeamUsed`（团队每场一次）。 |
| 01150–01156 阿卡姆密林 / 仪式地 | 连接按印张重排；补 `Woods` / `Cave` 特性；仪式地只连主道路。 |
| 01167 地窖寒风 | 验证：无可弃支援时改为 2 伤害；有支援时由玩家选择（既有条目）。 |

## 顺带修复

- 01055 打出资产仍引发借机攻击的回归用例加入 `core-story-acceptance`。
- 丽塔相关用例改为显式选择 `litaDamage` 的 `trigger`。
- golden replay 因 01107 自动交战移除而重采（notz 多局指纹变化，属预期行为差异）。

## 门禁

- `npm run test:fast`：2286/2286。
- `npm run cards:check`：6/6。
- `npm run replay:fixtures`：13 局指纹一致（重采后）。
- `audit-abilities --write`、`hardcode-audit --write`、验收账本哈希均已刷新。
