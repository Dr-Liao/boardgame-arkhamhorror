# EOTE D4/D5 原语合规与复用横切审计（Lead）

## 结论摘要

- **D4 门禁全部通过**：compliance / dead-primitives / mechanism-scan / scope / migration 五项 --check exit 0；R1 直写 0、R2 重印双实现 0、R3 playCondition 缺口 0；引擎卡号字面量 100 处**全部是注释引用或 availability 依赖表**，无行为级卡号分支。
- **D4 重大问题：207 条「声明但无读点」**（171 条在账本 verified 卡上，36 条在 simplified 卡上）。其中 **49 条是规则调度值字符串**（如 08629 actRule.forcedOnEnemyEnter=defeatElderThingsAtLocation、08624 actRule.studyHistory/discernShoggoths、08557–08573 flags 记录的处理类型名）——调度值零出现即意味着对应规则处理函数不存在，属 high。138 条是规则/flag 字段名（verified 卡），需卡级复核是否由其他数据表实现。
- **D5 复用缺失 4 簇**：9 张附身队员谈判敌人（08535–08543，94–97 行×9，token 相似度 0.82–0.89）、5 张「支援资源支付」玩家卡（08120–08124，相似度 0.926）、2 组双卡模板（08693/08694、08117/08119）。
- **重印**：4 条跨循环同文（08004↔98007、08057↔60379、08058↔60384、08073↔12073）均只实现一次、其他卡号无 entries 文件，符合「重印只实现一次」；`_reprint-aliases.js` 未登记这些跨包别名（这些包当前未开放，风险低）。

## 207 条 unread 声明分布

| 维度 | 数量 |
| --- | --- |
| unimplemented-dispatch | 49 |
| declared-without-read-point | 121 |
| test-references-key-not-implemented | 13 |
| dead-declaration-on-simplified-card | 20 |
| audit-references-key-not-implemented | 4 |

按卡状态：verified 171 条 / simplified 36 条。按 block：flags 156 / enemyRule 20 / actRule 14 / locationRule 8 / agendaRule 7 / treacheryRule 2。

### high 级调度值缺失（全部 49 条见 findings.json#d4）

- **08624 错综复杂之城(版本一)**（cityOfTheElderThings）：actRule.studyHistory、actRule.discernShoggoths
- **08625 错综复杂之城(版本二)**（cityOfTheElderThings）：actRule.studyHistory、actRule.hiddenPower
- **08626 错综复杂之城(版本三)**（cityOfTheElderThings）：actRule.discernShoggoths、actRule.hiddenPower
- **08628 追寻未知(版本二)**（cityOfTheElderThings）：actRule.returnTekeliWeaknesses
- **08629 追寻未知(版本三)**（cityOfTheElderThings）：actRule.removeElderThingTokens、actRule.defeatElderThingsAtLocation
- **08642 和蔼的古老者**（cityOfTheElderThings）：enemyRule.anyEmpty
- **08557 大本营**（fatalMirage）：flags.failBy1Take1HorrorForPlus1
- **08558 菲奥多西亚号甲板**（fatalMirage）：flags.harderShroudOrExtraAction
- **08559 大学礼堂**（fatalMirage）：flags.millDeckForTekeliliWeaknesses
- **08563 古老者厅室**（fatalMirage）：flags.shuffleTekeliliIntoDeck
- **08564 河景剧院**（fatalMirage）：flags.doubleEffectThenDiscoverClue
- **08568 凌乱宿舍**（fatalMirage）：flags.shuffleIntoDeckInsteadOfBottom
- **08569 戴尔的教室**（fatalMirage）：flags.heal1Horror
- **08570 医务室**（fatalMirage）：flags.damageTo6RemainingHealth
- **08573 奥斯曼前线**（fatalMirage）：flags.nonEliteAttackPlus2NoRetaliate
- **08669 原生质团**（theHeartOfMadnessPart1）：flags.nearestSealHolder
- **08672 无名存在**（theHeartOfMadnessPart2）：agendaRule.namelessInPlay
- **08608 星之恐怖**（toTheForbiddenPeaks）：enemyRule.moveDownToBelow
- **08714 威廉·戴尔教授**（shared:_shared）：flags.heal2Horror
- **08715 丹佛斯**（shared:_shared）：flags.draw2AfterTekeliliResolved
- **08716 伊里亚·阿什瓦克**（shared:_shared）：flags.evadeBase5ThenMayMove
- **08717 玛拉·辛哈医生**（shared:_shared）：flags.heal2Damage
- **08718 艾弗里·克莱普尔**（shared:_shared）：flags.cancelFrostRevealNewToken
- **08719 詹姆斯·“曲奇”·弗雷德里克斯**（shared:_shared）：flags.fightBase5NonEliteCannotAttackThisRound
- **08720 艾米·肯斯勒博士**（shared:_shared）：flags.investigateBase5LookTopCard
- **08721 罗尔德·埃尔斯沃思**（shared:_shared）：flags.blankNonWeaknessTreacheryText
- **08722 高田弘子**（shared:_shared）：flags.gain1ResourceMoveUpTo3
- **08733 戴尔的素描**（shared:_shared）：flags.draw3AnyFreeWindow
- **08737 高田的物品**（shared:_shared）：flags.gain3ResourcesDraw1RemoveFromGame

### 复现方式

```bash
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/mechanical-screen.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/triage-unread.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-analysis.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/entry-complexity.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-primitives-analysis.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/write-primitives-findings.mjs
```