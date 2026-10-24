# TCU P8 · 共享遭遇组（10 组 / 23 卡）实现规格

> 范围：`agents_of_azathoth`、`anettes_coven`、`city_of_sins`、`inexorable_fate`、
> `realm_of_death`、`silver_twilight_lodge`、`spectral_predators`、`the_watcher`、
> `trapped_spirits`、`witchcraft`（`music_of_the_damned` / `secrets_of_the_universe` 属 P8-cosmos）。
> 事实源：`scenario-inventory.json` 的 `groups[]`（卡号/张数/类型）、`src/cards/cards-data.js`
> 的中文卡面（`textZh`）与英文卡面（`text`）、参考实现
> `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/{Enemy,Treachery}/Cards/TheCircleUndone/<Group>/*.hs`
> 与 `{Enemy,Treachery}/CardDefs/TheCircleUndone/*.hs`。
>
> 卡号以 `scenario-inventory.json` 为准：本批共 **23 张**（9 敌人 + 14 诡计；任务描述里的
> 「8 敌人 + 15 诡计」是约数，实际以目录 9/14 为准）。

## 1. 交付物与写范围

```text
content/campaigns/theCircleUndone/encounter-rules.js        # 共享钩子（唯一跨章规则层）
src/cards/encounter-entries/theCircleUndone/_shared/<group>/<code>.js   # 23 张单卡条目
tests/tcu-shared-encounters.test.mjs                        # 35 例钩子级验收
artifacts/migration/tcu/p8/specs/shared-encounters.md       # 本文件
artifacts/migration/tcu/p8/chapters/shared-encounters.status.json
```

不写：`src/cards/encounter-entries/_shared.js`（全局，Lead 独占；条目统一用
`../../../_shared.js`）、`src/cards/encounter-entries/index.js`（Lead 合并后重建）、
两章/其他 worker 的目录、引擎、`content/registered.js`、`tests/suites.mjs`。

## 2. 架构约定

1. **跨章规则只写一份**：9 章 `behavior.js` 用 `{ ...encounterRules, id, ... }` 展开；
   覆盖同名钩子时必须显式调用 `encounterRules.<hook>(...)`。文件头注释列了 19 个会被覆盖的钩子。
2. **单卡行为只写条目**：卡片行为放在条目的 `enemyScript` / `encounterResolve` / `threatAction` /
   `enemyRule` / `enemyStatRule` / `enemySpawnRule` / `treacheryRule`（纯数据）上；
   `encounter-rules.js` 只做**分派**与组级共享规则，不写卡号条件分支（内容层卡号字面量不增长）。
3. **函数不能放 `enemyRule`/`treacheryRule`**：这两个字段会被 `card-data.js` 的
   `encounterDefinitions()` 并进场景定义，`setup.js` 对定义做 `structuredClone`，函数会直接抛错。
   条目里需要函数的钩子只放 `enemyScript` / `encounterResolve` / `threatAction`（独立读点，不进定义）。
4. **引擎边界**：`encounter-rules.js` 只 import `cards-data.js`、`card-rules.js`、`campaign/mementos.js`；
   需要引擎能力时用钩子参数 `api`（`scenarioRuntime`）。

## 3. 共享钩子表（encounter-rules.js）

| 钩子 | 语义 | 分派到条目 |
| --- | --- | --- |
| `afterTest` | 闹鬼失败窗口（只 fight/evade；investigate 由引擎自动结算，避免双结算）+ 记录每轮首次检定 | — |
| `canFightEnemy` / `canEvadeEnemy` | 幽灵敌人在非幽灵地点的目标限制（按剧本有无幽灵地点自动启用，可覆盖） | — |
| `enemySpawned` | 入场强制 + 敌人脚本 | `enemyScript.onSpawn`、`enemySpawnRule.doomOnSpawn` |
| `enemyMoved` / `enemyDamaged` / `enemyAttackResolved` | 移动 / 受伤 / 攻击后强制 | `onMoved` / `onDamaged` / `onAttackResolved` |
| `enemyDefeated` | 「改为不弃掉」替代击败 | `onDefeated`（返回 true = 替代） |
| `enemyPhaseEnd` / `mythosEnded` | 敌军阶段结束 / 神话阶段结束强制 | `onEnemyPhaseEnd` / `onMythosEnd`、`enemySpawnRule.doomAtMythosEnd` |
| `enemyStatModifier` | 敌人攻击/躲避常驻修正（攻击/躲避值） | `enemyStatRule.fightEvadePerWitchInDiscard`、实例 `roundFightEvadeBonus` |
| `statModifier` | 威胁区「每轮第一次检定 -1」 | `treacheryRule.firstTestStatModifier` |
| `turnBegins` / `turnEnded` | 威胁区回合开始/结束强制 | `treacheryRule.turnBeginsHaunted` / `turnEndTest` |
| `roundEnded` | 「放在密谋牌库旁」的轮末弃掉、敌人轮末强制、每轮实例标记清理 | `treacheryRule.discardAtRoundEnd`、`enemyScript.onRoundEnd` |
| `encounterDrawn` | 遭遇牌库耗尽检测 + 强制 | `enemyScript.onEncounterDeckEmpty`、`treacheryRule.encounterDeckEmptyForced` |
| `resolveEncounter` | 诡计显现结算 | 条目 `encounterResolve` |
| `encounterActions` / `performEncounterAction` | 威胁区 [action] + 敌人谈判/遭遇行动 | `threatAction`（含 `autoSuccessWhen`）、`enemyScript.encounterAction/performEncounterAction` |

辅助导出（章节可复用）：`original`、`activeInvestigators`、`here`、`recordsFor`、`traitsOf`、
`hasTrait`、`isSpectralLocation`、`hauntedAt`、`resolveHauntedOnFailure`、`locationDistance`、
`nearestEnemyWithTrait`、`doomOn`、`enemyRuleReads`、`watcherHuntedSeats`/`isHunted`/`markHuntedSeat`/
`clearHuntedSeat`/`watcherTaken`/`markWatcherTaken`/`watcherSummary`、`agendaAside`/`agendaAsideCount`/
`placeAgendaAside`/`removeAgendaAside`、`discardEncounterTop`、`witchEnemyEncountersInDiscard`、
`isSpellOrRelicSource`、`spectralTargetRestricted`/`spectralEnemyTargetBlocked`。

## 4. 逐组逐卡落点

### agents_of_azathoth（05088–05089）
- **05088 阿撒托斯的吹笛手**：`enemyRule.prey='lowestSanity'`；`enemyScript.onEnemyPhaseEnd`
  攻击其所在地点未与其交战的每位调查员（不区分重整/横置）。
- **05089 魔鬼的笛声**：涌动（印刷文本解析）；`encounterResolve`：吹笛手在场→其地点与连接地点
  各 1 恐惧；否则放到 `scenarioZones.agendaAside`；第 3 张时弃 3 张并从场外生成吹笛手与猎物交战。

### anettes_coven（05090–05091）
- **05090 女巫集会学徒**：显现（`onSpawn`）弃遭遇牌库顶 2 张；牌库因此耗尽→取遭遇弃牌堆顶
  [[巫术]]（Hex）卡牌，放回牌库顶后走 `api.drawEncounter` 抽牌管线。近似：被剧本效果生成的
  学徒也结算显现（记入 approximations）。
- **05091 女巫集会的女祭司**：`enemyStatRule.fightEvadePerWitchInDiscard={cap:3}`（共享
  `enemyStatModifier` 读遭遇弃牌堆的 [[女巫]]敌人数量）；`onEncounterDeckEmpty` 重整并攻击
  所在地点每位调查员。

### city_of_sins（05098–05099）
- **05098 邪恶往昔**：威胁区 + 重复时涌动；`encounterDeckEmptyForced`（2 恐惧 + 意志(3) 成功弃掉）；
  `threatAction` 意志(3) 弃掉。
- **05099 百年秘事**：意志(5)，失败每点弃遭遇牌库顶 1 张（空则洗回弃牌堆）；弃到 [[诅咒]] 诡计
  → 调查员与每个 [[盟友]] 支援 1 点直接伤害。

### inexorable_fate（05107–05108）
- **05107 恐怖夜色**：意志(4)，失败放到 `agendaAside`；失败 ≥3 点涌动；牌库旁第 3 张→弃 3 张、
  每位调查员 3 恐惧。
- **05108 愚人的命运**：险境（印刷解析）；无复制品→进威胁区；有复制品→二选一：
  直接伤害 2 / 另一张上放 1 毁灭（用 `api.choose`，目标选项稳定 id）。

### realm_of_death（05105–05106）
- **05105 苦痛之地**：威胁区 + `turnBeginsHaunted`（回合开始结算闹鬼）+
  `turnEndTest{willpower,3}`（回合结束检定成功弃掉）。
- **05106 雾中身形**：涌动 + 显现结算所在地点每个闹鬼能力（`api.haunted`）。

### silver_twilight_lodge（05095–05097）
- **05095 秘社新信徒**：生成任意无人地点（`enemyRule.spawnAnyEmpty`，引擎通用分支）；冷漠（印刷解析）；
  `enemySpawnRule.doomOnSpawn=1`；谈判意志(2) 成功清空毁灭（`enemyScript.encounterAction/perform…`）。
- **05096 守密人**：生成任意无人地点；冷漠/反击（印刷解析）；`enemySpawnRule.doomAtMythosEnd=1`；
  谈判智识(3) 成功清空毁灭。
- **05097 秘社玄仪**：最近的 [[异教徒]] 敌人上放 1 毁灭，并给该实例 `roundFightEvadeBonus={round,+2}`
  （攻击/躲避走共享 `enemyStatModifier`，谈判在 05095/05096 条目里读同一标记）；无异教徒→涌动。

### spectral_predators（05100–05102）
- **05100 冥府之雾**：`prey='mostClues'`（近似，见 §5）；冷漠/猎手（印刷解析）；
  `onSpawn/onMoved/onDefeated` 用 `api.grantHaunted` 给所在地点授予「闹鬼 - 冥府之雾攻击你」并随移动迁移。
- **05101 暗影猎犬**：`prey='lowestAgility'`；猎手/反击；`onAttackResolved` 结算所在地点每个闹鬼能力。
- **05102 黑暗中的低语**：放到 `agendaAside` + `api.grantHaunted({locationId:'all'})` 给每个地点
  「闹鬼 - 受到 1 点恐惧」；`treacheryRule.discardAtRoundEnd` 由共享 `roundEnded` 弃掉并撤销授予。

### the_watcher（05086–05087）
- **05086 幽灵看守人**：警戒/猎手（印刷解析）；`onDefeated` 返回 true 替代击败：治愈所有伤害、
  解除交战、横置、`preventReady={from,rounds:1}`（本轮补给阶段不重整）、重新加入 `state.enemies`。
- **05087 看守人的攫噬**：治愈看守人 3 点、重整、猎手步移动、与抽到本卡的调查员交战并攻击。
- 跨章记录读点：`youAreBeingHunted`（座位）/`wasTakenByTheWatcher`（卡号）由 `mementos.js` 读写，
  `encounter-rules.js` 暴露 `watcherHuntedSeats/isHunted/markHuntedSeat/clearHuntedSeat/watcherTaken/
  markWatcherTaken/watcherSummary`，章节只在产生/清除追捕时调用。

### trapped_spirits（05103–05104）
- **05103 怨灵**：猎手（印刷解析）；`onDamaged` 记录伤害来源；`onDefeated`：若为伤害击败且来源
  非 [[法术]]/[[遗物]] → 替代弃掉，附属到所在地点并授予「闹鬼 - 将怨灵生成在本地点」；
  其余情况正常弃掉。
- **05104 被困的灵魂**：敏捷(3)，失败按差额受伤；「投入卡牌前先结算闹鬼」无引擎钩子（见 §5）。

### witchcraft（05092–05094）
- **05092 恶魔之音**：意志(3+遭遇弃牌堆同名张数)，失败每点随机弃 1 手牌，弃不掉的每张二选一
  1 恐惧/1 伤害。
- **05093 崩毁离析**：威胁区 + `firstTestStatModifier=-1`（共享 `statModifier` 只在本轮第一次检定期间生效）；
  `threatAction` 意志(3)，所在地点有横置 [[女巫]] 敌人时自动成功。
- **05094 苦痛折磨**：威胁区 + `threatAction` 意志(3)（同上自动成功）；「不能触发控制卡牌的
  [action] 能力」无引擎读点（见 §5）。

## 5. 显式简化与缺口（同步写入 status.json）

| 卡 | 缺口/近似 | 处理 |
| --- | --- | --- |
| 05090 | 敌人「显现」没有通用窗口，用 `enemySpawned` 承载；剧本效果生成的学徒也会结算 | approximations：时点近似 |
| 05094 | 「不能触发你控制的卡牌上的 [action] 能力」引擎只有免费能力/地点能力禁止读点 | gap：`simplified:true` |
| 05100 | 「猎物 - 所在地点线索最多的调查员」引擎 PREY_RANK 只能表达「线索最多的调查员」 | approximation：`prey:'mostClues'` |
| 05104 | 「投入 1+ 张牌时作为额外费用结算闹鬼」无投入费用钩子 | gap：`simplified:true` |
| 05096/05095 | 「如果可以」的毁灭放置限制（CannotPlaceDoomOnThis）无通用读点 | approximation：无条件放置 |
| 05099 | 弃遭遇牌库顶不结算被弃牌的显现/生成（无「弃牌并结算」通用入口） | approximation |
| 幽灵敌人 | 「不能与之交战」没有引擎钩子，只能禁攻击/躲避（`canFightEnemy/canEvadeEnemy`） | gap：记入各章 `scenarioGaps` |
| 05103 附属 | 怨灵作为地点附属用 `location.attachments` 表示，不再作为敌人实体；重新生成由闹鬼能力完成 | approximation |
| 05087 | 敌军阶段三步用「猎手步→交战→攻击」承载；「猎物 - 你」只影响本次目标选择 | approximation |
| 05088 | 强制攻击在敌军阶段结束后追加，不替代正常敌军阶段攻击 | approximation（卡面为额外强制） |

## 6. 幽灵目标限制口径（给 9 章 worker）

- 默认：`state.scenario.locations` 里存在幽灵地点（`spectral:true` 或 `back`）的剧本才启用；
  只有幽灵界的章节（死亡门前 / 罪恶报应 / 序章）会命中。
- 覆盖：`scenario.spectralTargetLimit = true/false`，或开局写
  `state.scenarioFlags.spectralTargetLimit`。
- 判定：敌人有 `Spectral` 特性且调查员/敌人所在地点不是幽灵地点 → `canFightEnemy/canEvadeEnemy`
  返回 false（引擎还会给出不可用原因文案）。
- 「不能交战」无引擎钩子：需要时章节在 `enemyCannotAttack` 或自身规则里处理，并在 `scenarioGaps` 记录。

## 7. 测试证据（tests/tcu-shared-encounters.test.mjs，35 例，全绿）

覆盖：导出/钩子表面、23 条目完整性；闹鬼失败窗口（fight 触发、investigate 不重复、成功不触发）；
幽灵目标限制（阻断/幽灵地点放行/无幽灵地点剧本/覆盖开关）；看守人记录读写；10 个组每张卡的
enemyScript / encounterResolve / threatAction / 共享钩子分支各至少 1 例；3 张「放在密谋牌库旁」
（05089/05102/05107）的放置与轮末/第 3 张清理；遭遇牌库耗尽的两种强制；`JSON.stringify` +
`deepEqual` 的存档往返与同路线确定性。

## 8. Lead 合并清单

1. 合并后重建 `src/cards/encounter-entries/index.js`（本批 23 文件）；
2. 确认 `tests/encounter-entries.test.mjs` 的 `TOP_LEVEL` 含 `'theCircleUndone'`（Lead 已改）；
3. 内容层卡号字面量守卫（`CONTENT_CARD_CODE_BASELINE`）：`encounter-rules.js` 实测 0 个 5 位卡号字面量
   （全部行为经条目读点分派），本批不增加该守卫计数；
4. `tests/suites.mjs` 与 `tests/node-suite.mjs` 登记 `tcu-shared-encounters.test.mjs`（Lead 做）。
