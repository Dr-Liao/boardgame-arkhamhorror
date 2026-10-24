# P8 序章 spec：disappearanceAtTheTwilightEstate（05043）

> 状态：先写 spec（2026-10-24），随后按本文件的「钩子映射」落代码。
> 规则事实源：`参考资源/.../Scenario/Scenarios/TheCircleUndone/DisappearanceAtTheTwilightEstate.hs`
> （337 行）+ `Act|Agenda/Cards/TheCircleUndone/DisappearanceAtTheTwilightEstate/*.hs` +
> `Location/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` + `Campaigns/TheCircleUndone/{Key,Helpers}.hs`。
> 文案事实源：`frontend/src/locales/zh/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate.json`。
> 引擎事实源：`src/engine/{setup,story-investigators,tarot,locations,act-agenda,campaign-flow}.js`（只读）。

## 1. 参考实现怎么跑（setup → 每一步）

Haskell `setupDisappearanceAtTheTwilightEstate`：

1. `gatherSets`：收齐 8 个遭遇组 —— 本章组 `DisappearanceAtTheTwilightEstate`（只有 05043–05049：
   scenario/agenda/act/scenario、4 位故事调查员，**没有敌人/诡计**）+ `InexorableFate`(05107/05108) +
   `RealmOfDeath`(05105/05106) + `SpectralPredators`(05100/05101/05102) + `TrappedSpirits`(05103/05104) +
   `TheWatcher`(05086/05087) + 核心 `ChillingCold`(01167/01168)。**At Death's Doorstep 组只取 7 张幽灵地点**（05078–05084）。
2. `placeLocations`：放置 7 张幽灵地点（Haskell 顶部署名地图，见 §3）。
3. `theSpectralWatcher`：把幽灵看守人（**05086**，不是任务描述里的 05085；05085 是死亡门前的约瑟夫·梅吉尔）放到入口大厅。
4. `investigatorSetup`：每位玩家按所选故事调查员卡背面执行（见 §4）。在**选人之后**。
5. `shuffleRemainder`：余下遭遇卡洗入遭遇牌库。
6. `theSpectralRealm` 提示：本场景只用 7 张带 `Spectral` 特性的地点。
7. 剧本没有自己的地点；`startLocation` = 入口大厅（05078）。

序章选人发生在 `LoadScenario`/`PreScenarioSetup` 之前：每位玩家从 4 位中立故事调查员里选 1 位
（不可重复），少于 4 人时把未选者从「失踪人口」记录里划掉；每人**从塔罗牌组抽 1 张正位牌**并
按 §5 表写记录（同一张牌不能给两个角色）。之后才做 `Setup`（地点/看守人/调查员设置）。

剧情流程：序章 = 纯生存。幕 1a「失踪事件」没有可推进目标（只是尽可能多发现线索）；议程 1a
「审判·XX」没有毁灭阈值——**调查员被击败时**才推进议程，结算 1b 写该角色命运记录后翻回 1a，
且不因推进移除毁灭。全员被击败/撤退 → 结局 `noResolution`。

## 2. 我们的钩子映射

| 参考实现 | 我们（TCU 引擎） |
| --- | --- |
| `gatherSets` + `shuffleRemainder` | `definition.js` 用 `encounterCards([...])` 收集、剔除开局入场/放在一边的卡后 `encounterDeck(...)`；`modifyDeck` 按**已选故事调查员**逐张移除设置卡（§4），不写死 |
| `placeLocations` | `behavior.setupLocations` 返回 7 个地点 id；`layout.js` 只放坐标 |
| `theSpectralWatcher` | `behavior.setupEnemies` 用 helper 生成 05086 到 `entryHall`；`manifest.setAsideAliases=['05086']`、运行时 `scenarioZones.setAside` 移除 |
| 选 4 位故事调查员 | `definition.js` `scenario.storyInvestigators = { codes, crossOutUnused:true, setupCards }`（P2.6；`setup.js:571` 读 `sc.storyInvestigators`） |
| 划掉未选者 | `preScenarioSetup` 写 `state.campaign.records.missingPersons` = 已选者卡号（string[] 无 crossedOut 字段，见 §6 gap） |
| 每人抽 1 张正位塔罗 + 写记录 | `preScenarioSetup`：`api.tarot.build()`（22 张唯一、注入随机）→ 按座位顺序 `api.tarot.draw(seat,{orientation:'upright'})` → `content/campaigns/theCircleUndone/tarot.js` 的 `applyPrologueTarotResult` |
| 按 arcana 写 4 个 string[] 记录 + 证据计数 | tarot.js `PROLOGUE_TAROT_RESULTS`（22 行，见 §5） |
| `PreScenarioSetup` 的选人/引言 | 选人由引擎 P2.6 完成；引言用 `scenario.intro`（zh locale 正文） |
| 调查员卡背设置（§4） | `behavior.setupEnemies`（地点已铺好之后）+ `modifyDeck`（移除牌）+ `preScenarioSetup`（资源/起始区域/缺失记录） |
| 幕 1a 强制：被消除者线索放到幕上 | `behavior.investigatorEliminated` 返回 truthy 接管（引擎否则把线索放地点）：线索累加到 `state.acts[0].clues`，清空 `inv.clues`；撤退（resigned）同样算 eliminated |
| 幕 1b：记录被追捕、翻回 1a | `05045` 条目 `actRule.onReveal` 写 `youAreBeingHunted`；`behavior.actIndexAfterAdvance` 返回 0 实现「翻回 1a」 |
| 议程 1a 强制①毁灭后伤害/恐惧 | `behavior.doomPlaced`（payload 形状 `{target, amount, agenda}`）：≥5 毁灭时 2 点，否则 1 点；`api.choose` 二选一；setup 期间不触发（`scenarioFlags.setupComplete`） |
| 议程 1a 强制②被击败→推进议程 | `behavior.investigatorEliminated` 内直接结算 1b（不调 `api.advanceAgenda`，避免引擎清毁灭/推进序号）：按击败来源写 4 个记录之一，日志展示 1b 文本；**不移除毁灭**、`agendaIndex` 保持 0 |
| `ScenarioResolution`：`noResolution` + 证据=幕上线索 | `behavior.resolution('noResolution')`：`records.piecesOfEvidenceWereLeftBehind += 幕上线索总数`，`{award:false}`（序章无 XP）；未知 key 抛错 |
| 骷髅标记：简单/普通 −3，困难/专家 −5；攻击/躲避失败且骷髅 → 结算所在地点每条闹鬼 | `behavior.resolveChaosToken` 返回 `{delta:-3|-5}`；`behavior.afterTest` 在 `!success && result.token==='skull' && skill∈{combat,agility}` 时 `api.haunted(seat)` |
| 闹鬼能力在地点上 | `definition.js` 每个幽灵地点写 `haunted:[...]`（P2.1 闭集子句，见 §3） |

## 3. 地点（7 张幽灵地点，数据来自 AtDeathsDoorstep.hs + 卡池）

全部 `spectral: true` 单面幽灵地点（P2.3 数据形状），复用 At Death's Doorstep 的幽灵面卡号；
`clues` 为**每名调查员**（卡池无 cluesFixed）。坐标按 Haskell 顶部署名地图：

```text
.             .          office         .             .
billiardsRoom trophyRoom victorianHalls masterBedroom balcony
.             .          entryHall      .             .
```

| id | code | 名 | 符号 | 印刷连线 | 帷幕/线索 | 胜利 | 坐标 | 闹鬼（P2.1 子句） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| entryHall | 05078 | 入口大厅 | square | t | 3 / 0 | 0 | (4,4) | 无（有 `[action]：撤退`） |
| victorianHalls | 05079 | 维多利亚式宴会厅 | t | square,star,triangle,heart | 4 / 0 | 0 | (4,2) | `loseAction` 1 |
| trophyRoom | 05080 | 纪念品陈列室 | triangle | t,diamond | 2 / 1 | 0 | (2,2) | `loseResource` 2 + `overflowHorror` |
| billiardsRoom | 05081 | 台球室 | diamond | triangle | 3 / 1 | 1 | (0,2) | `choice`：discardAsset 1 / damage 1 |
| masterBedroom | 05082 | 主卧 | heart | t,moon | 3 / 1 | 1 | (6,2) | `placeClue` 1 |
| balcony | 05083 | 露台 | moon | heart | 1 / 1 | 0 | (8,2) | `damageAssets` 1 |
| office | 05084 | 办公室 | star | t | 4 / 2 | 2 | (4,0) | `discardChosen` 1 |

`linkSymbolLocations` 解析出的邻接：entryHall↔victorianHalls；victorianHalls↔{office,trophyRoom,masterBedroom}；
trophyRoom↔billiardsRoom；masterBedroom↔balcony。7 个地点全部放置入场（无 setAside 地点）。

入口大厅印刷 `[action]：撤退…` → 地点条目 05078 的 `locationRule.actions/performAction` 提供 `api.resign(seat)`
（该卡与死亡门前共用，条目归 W-shared / 死亡门前的 `_shared/at_deaths_doorstep/`；本章只做**运行时转发**：
若索引里没有 05078 条目，本文件 `behavior.actions` 提供同名兜底按钮，见 §6 gap）。

## 4. 4 位故事调查员（05046–05049，卡背设置）

`scenario.storyInvestigators.setupCards` = **起始游戏区域**的资产卡（引擎 `setup.js:215` 直接入场）：
Gavriella `.45自动手枪(01016)`+`体能训练(01017)`；Valentino `良好人脉(05028)`；
Penny `深挖(01077)`+`刀子(01086)`+`手电筒(01087)`；Jerome 无。

`preScenarioSetup`（资源）与 `setupEnemies`（地点/敌人/诡牌）按已选者逐个结算：

| 调查员 | 起点 | 设置效果 | 资源 | 起始游戏区域 | 起手牌 |
| --- | --- | --- | --- | --- | --- |
| 05046 加弗瑞拉 | victorianHalls | 看守人 05086 上放 1 点伤害；找 1 张 `愚人的命运(05108)` 放入威胁区域 | 1（非 5） | 01016+01017（手枪 2 弹药） | 6 张固定 |
| 05047 杰罗姆 | office | `冥府之雾(05100)` 生成在 office；`朦胧之雾(01168)` 附属到 office | 3 | 无 | 10 张固定 |
| 05048 瓦伦蒂诺 | billiardsRoom | `暗影猎犬(05101)` 与其交战；`恐怖夜色(05107)` 放到密谋牌库旁 | 10 | 05028 | 7 张固定 |
| 05049 佩妮 | balcony | `怨灵(05103)` 与其交战；`黑暗中的低语(05102)` 放到密谋牌库旁 | 2 | 01077+01086+01087（手电筒 2 补给） | 7 张固定 |

实现细节：
- 这些设置卡必须先**从遭遇牌库移除**（`modifiedDeck` 里按已选者依次删 1 张；运行时记
  `scenarioZones.setAside`）——与 Haskell「Search the gathered cards…」一致，未选者的卡仍留在遭遇牌库。
- 威胁区：`api.threat(seat, code)`（05108 进加弗瑞拉威胁区）。
- 交战的敌人：`api.spawnEngaged(code, locationId, seat)`（05101 / 05103）。
- 附属到地点：`01168` 是核心共享条目，直接按条目语义写 `location.fog/shroudMod` 近似（见 §6 gap ②）。
- 「密谋牌库旁」的 05107/05102：写入 W-shared 的共享区 `state.scenarioZones.agendaAside`
  （`encounter-rules.js` 的 `placeAgendaAside(state, code)`；轮末清理由 `encounterRules.roundEnded` 通用分支处理）。
- **起手牌**：故事调查员没有牌组，引擎的 P2.6 原语把 `hand` 清空并跳过换牌；本实现把卡背固定起手牌
  直接写进 `inv.hand`（纯卡号字符串，引擎手牌本来就是卡号数组），不洗牌、不换牌。见 §6 `scenarioApproximations`。

## 5. 22 张大阿卡纳塔罗表（`content/campaigns/theCircleUndone/tarot.js`）

开局 `api.tarot.build()`（22 张唯一、随机只走 `randomValue`），随后**每人抽 1 张正位**（抽走即离堆，
同一张牌不会给两人）。结果写 `state.campaign.records`（shared.js 已登记类型）：

| arcana | 牌（中/英） | 记录（string[] push 调查员卡号） | 证据 +N |
| --- | --- | --- | --- |
| 0 | 愚者 The Fool | disappearedIntoTheMist | 2 |
| 1 | 魔术师 The Magician | disappearedIntoTheMist | 0 |
| 2 | 女祭司 The High Priestess | disappearedIntoTheMist | 0 |
| 3 | 女皇 The Empress | wasClaimedBySpecters | 3 |
| 4 | 皇帝 The Emperor | wasClaimedBySpecters | 3 |
| 5 | 教皇 The Hierophant | wasClaimedBySpecters | 3 |
| 6 | 恋人 The Lovers | wasClaimedBySpecters | 3 |
| 7 | 战车 The Chariot | wasClaimedBySpecters | 5 |
| 8 | 力量 Strength | wasClaimedBySpecters | 5 |
| 9 | 隐士 The Hermit | wasClaimedBySpecters | 5 |
| 10 | 命运之轮 Wheel of Fortune | wasPulledIntoTheSpectralRealm | 2 |
| 11 | 正义 Justice | wasPulledIntoTheSpectralRealm | 2 |
| 12 | 倒吊人 The Hanged Man | wasPulledIntoTheSpectralRealm | 2 |
| 13 | 死神 Death | wasPulledIntoTheSpectralRealm | 4 |
| 14 | 节制 Temperance | wasPulledIntoTheSpectralRealm | 4 |
| 15 | 恶魔 The Devil | wasPulledIntoTheSpectralRealm | 4 |
| 16 | 高塔 The Tower | wasPulledIntoTheSpectralRealm | 4 |
| 17 | 星星 The Star | wasPulledIntoTheSpectralRealm | 6 |
| 18 | 月亮 The Moon | wasPulledIntoTheSpectralRealm | 6 |
| 19 | 太阳 The Sun | wasTakenByTheWatcher | 3 |
| 20 | 审判 Judgement | wasTakenByTheWatcher | 3 |
| 21 | 世界 The World | wasTakenByTheWatcher | 5 |

中文结果文案取 zh locale 的 `intro.<ArcanaEnum>`（如 `intro.TheFool0` = 「0: {name} 消失在迷雾之中。留下了2个证据。」）；
tarot.js 提供 `prologueResultText(arcana, name)` 用 `{name}` 替换。

**Witching Hour 占卜表**（`TheWitchingHour.hs:190-222`，Return To 的 8 张 Campaign Reading，
固定牌序）：theWitchingHour=节制XIV(14)、atDeathsDoorstep=正义XI(11)、theSecretName=隐士IX(9)、
theWagesOfSin=倒吊人XII(12)、forTheGreaterGood=教皇V(5)、unionAndDisillusion=恋人VI(6)、
inTheClutchesOfChaos=战车VII(7)、beforeTheBlackThrone=命运之轮X(10)。tarot.js 只导出数据与纯查询
（`WITCHING_HOUR_DIVINATION` / `witchingHourDivination(scenarioId)`），供 w-witch 只读 import。

## 6. 显式简化：`scenarioApproximations`（等价承载）与 `scenarioGaps`（真未实现）

P8 口径（Lead 2026-10-24 更新）：**卡面子句完全没实现**才进 `behavior.scenarioGaps`（必须清零才能
development）；**用战役 JSON 状态/单章逻辑忠实承载卡面语义**的等价实现进 `behavior.scenarioApproximations`
（进账本 remaining，不阻塞 literalCardBehavior）。本章 `scenarioGaps = []`，下列 1–7 是 approximations：

1. **议程 1b 的「翻回 1a」**：引擎议程是数组，没有 revert 原语。本实现不调用 `api.advanceAgenda`
   （它会清毁灭、agendaIndex++ 导致剧本提前结束），而是在 `investigatorEliminated` 里直接按 1b 结算
   （写记录、日志展示 1b 文案），`agendaIndex` 保持 0、毁灭不移除。视觉上议程始终显示 1a。
2. **击败来源判定近似**：引擎不记录「被哪个敌人/效果击败」。用 `beforeEnemyHarm` 记
   `scenarioFlags.lastAttacker[seat] = {code, traits, round}` 近似：
   本轮最后攻击者为幽灵看守人(05086) → wasTakenByTheWatcher；攻击者带 `Monster` 特质 → wasClaimedBySpecters；
   议程 1a 自身伤害/恐惧击败（结算时打 `agendaHarmSeat` 标记）且场上毁灭 ≥7 → disappearedIntoTheMist；其余 → wasPulledIntoTheSpectralRealm。
3. **失踪人口「划掉」**：记录类型是 `string[]`（无 crossedOut 字段），`missingPersons` 只存已选者卡号，
   未选者不出现；后续章节读到的语义与 Haskell `getRecordedCardCodes`（排除划掉项）一致。
4. **起手牌**：卡背固定起手牌直接写 `inv.hand`（卡号），不经引擎抓牌管线；不触发「抽牌」窗口。
5. **起始游戏区域弹药/补给标记**：`newPlayerAssetInstance` 的初始 uses 按卡面 `uses` 生成；手枪 2 弹药、
   手电筒 2 补给在 `preScenarioSetup` 里显式覆盖（纯 JSON）。
6. **朦胧之雾(01168)**：核心共享条目按 `location.fog/shroudMod` 近似（与核心实现一致），不建独立附属实例。
7. **幕 1b 的「记录你被追捕」**：参考实现是 boolean 记录；本仓库 `youAreBeingHunted` 类型为「被追捕座位
   string[]」，写全体在场座位（P2.10 读点 `isBeingHunted` 语义不变）。
8. **共享组卡**（theWatcher/spectralPredators/trappedSpirits/inexorableFate/realmOfDeath/chillingCold）
   的逐卡行为归 W-shared（已落 `_shared/<group>/` 条目 + `encounter-rules.js` 共享钩子）；本章只负责布置、
   调用 `...encounterRules` 与 `resolveEncounter` 分派，`literalCardBehavior` 依赖这些条目 + 索引重建。
9. **序章证据计数**：参考实现结局用 `recordCount`（=set）把证据覆盖为幕上线索数；既然本实现固定走
   塔罗路径（塔罗已累加证据），结局改为**累加**幕上线索，避免覆盖塔罗结果（与 zh 引言「统计遗留证据总数」一致）。

## 7. 验收要点（tests/tcu-prologue.test.mjs，≥20 例）

- manifest：id/status `development`/7 地点/1 幕 1 议程/resolutionIds=[noResolution]/requiredEncounterGroupIds；
- 身份：7 地点 originalCode=05078–05084、幕 05045、议程 05044；
- 塔罗：22 行完整性（每个 arcana 恰 1 行）、记录映射、证据累加、确定性（同种子同结果）、
  唯一性（4 人抽 4 张互不相同、抽走不重复）、记录类型 string[]；
- 故事调查员：配置校验（4 码、crossOutUnused、setupCards 合法）、missingPersons 写入已选者、
  1–4 人不同组合的设置（移动/敌人/威胁/资源/起始区域）；
- 布置：7 地点、看守人在入口大厅、遭遇牌库不含 05086 与已选调查员的设置卡、确定性；
- 幕/议程：被消除者线索进幕、议程毁灭伤害二选一（≥5 时 2 点）、被击败写命运记录 + 不推进 agendaIndex；
- 混乱：标准骷髅 −3、专家骷髅 −5、失败攻击/躲避骷髅触发 haunted；
- 结局：noResolution 写证据、无 XP、未知 key 抛错；
- 存档：`JSON.parse(JSON.stringify(state))` + `deepEqual`（字面出现两串）与同种子同状态字符串；
- 测试文件内字面包含 `scenarios/disappearanceAtTheTwilightEstate/`。
