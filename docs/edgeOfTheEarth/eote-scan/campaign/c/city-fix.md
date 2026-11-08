# 古者之城（City of the Elder Things · 08621）P0 修复证据

- 任务：task-3（city-elder）· 范围：P0-6 / P0-12 / P0-8 的 City 部分 + 08629「声明即接线」。
- 验收口径：真实生产组合根（`tests/eote-p8-fixture.mjs` → `content/registered.js`）的
  `createGameState → startScenario → legalMoves → applyMove / advanceAgenda / drawEncounter`，
  不用 api stub 直调 `behavior.*` 冒充。
- 结论：**23/23 真实引擎探针 PASS；`node --test tests/eote-scenario-cityOfTheElderThings.test.mjs` 17/17 全绿。**

## 1. 逐项状态

| 项 | 根因 | 修复（file:line） | 真实引擎证据 |
| --- | --- | --- | --- |
| **P0-12** 地点剧本行动 `options.resolve is not a function` | `api.test(seat, skill, difficulty, {source, resolve})` 把 options 对象传成引擎第 4 参（引擎签名 `(seat, skill, difficulty, resolve, skillBonus?, source?, options?)`，`src/engine/scenario-runtime.js:657`） | `content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:732`（08644）、`:749`（08645）、`:801`（隧道）、`:823`（石桥）全部改为 `test(..., resolveFn, 0, {type:'scenario',...})`；另修 08645 自动失败读点 `:558`、真相开端难度按印刷「地点钥匙+控制钥匙」`:732` | 探针 `P0-12.1–12.3`：石桥 `loc:bridgeDiscover` 在真实 `legalMoves`，`applyMove` 无 TypeError 且 `state.lastTestResult.success` 已结算；`P0-12.4`：秘境隧道 `loc:tunnelInvestigate` 同上（clues 2→1） |
| **P0-6** 钥匙无玩家入口 → 幕 1 不可达 | keys 特别规则只实现为纯函数，未进引擎 `actions()/performAction` 契约；`checkObjectives` 不发起 `advanceAct` | `behavior.js:384`（actions：`key:claim` 快速 0 行动点 / `key:give` 1 行动点，条件=地点无线索、持有钥匙、同地点有另一位调查员；08641 `blocksKeysWhileReady` 读点 `:60`）、`:441`（performAction 分派；give 目标经真实选择事务 `api.choice`）、`:329`（checkObjectives 达成后调用 runtime 真实 `advanceAct()`）、`:361`（淘汰时把钥匙放到地点） | 探针 `P0-6.1–6.4`：真实调查清空线索后 `legalMoves` 含 `key:claim`（actions=0）/`key:give`，`applyMove` 均成功且钥匙控制权正确转移。`P0-6.5–6.7`：2×elderthing+2×tablet → 真实 `actKey:studyHistory`/`discernShoggoths` → `actIndex 0→1`、`hiddenTunnelRevealed=true`、隐秘隧道地点 `revealed=true`、放一边的修格斯组洗回（encounterDeck 31→34） |
| **P0-6** 议程 2 背面 R2 未实现 | 08623 无 `onReveal`；最后一张议程耗尽只走 `checkOutcome`（仅全灭结束） | `src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08623.js:15` 声明 `agendaRule.onReveal: "resolution2"`；`behavior.js:310` agendaReveal 通用 `resolution*` 分支：写记录 + 用真实 `finishScenario` 结束；`behavior.js:580` 结局记录按参考 `CityOfTheElderThings.hs ScenarioResolution`（R1→Found / R2→Guided，互不混写） | 探针 `P0-6.10–6.11`：真实 `advanceAgenda` 两次 → `resolution=resolution2`，`campaign.records.theTeamWasGuidedToTheHiddenTunnel=true` |
| **P0-8** City 4 张专属诡计真实遭遇零结算 | `definition.treacheryDefinition` 缺 `entryRevelation`；引擎只认 `entry.encounterResolve` / `treacheryRule.test` / `effect.kind==='campaignRule'`（`src/engine/treachery-tokens.js:113-124`） | `definition.js:125-133`：诡计定义改用 `card-data.js#encounterDefinitions`（印刷 `entryRevelation/surge/peril`）+ 显式 `effect:{kind:'campaignRule'}`，交给 `behavior.resolveEncounter → TREACHERY_HANDLERS` | 探针 `P0-8.08644/45/46/47`：真实 `engine.drawEncounter` 结算后 08644 恐惧+3、08645 伤害+3、08646/08647 进威胁区（修复前全部零结算） |
| **P0-8** 遭遇牌库缺共享组 | `definition.encounterDeck` 只有 20 张本章卡；`requiredEncounterGroupIds` 无运行时读点 | `definition.js:140-202`：按印刷 setup v1/v2/v3 的 gather/setAside/removals 数据（参考 `CityOfTheElderThings.hs DoStep 1/2/3`）用卡表 `encounterCode + quantity` 展开；`behavior.js:211` `modifyDeck` 按 `flags.cityVersion` 收窄为当版真实牌库并把放一边的组写入 `scenarioZones.setAside`；`behavior.js:672-711` 幕 1 背面把放一边的组 + 遭遇弃牌堆真实洗回 | 探针 `0.1/0.2`：v1 真实牌库 31 张（含 elderThings/miasma/namelessHorrors/penguins/lockedDoors 共享组），setAside=4（修格斯×3 + 星之恐怖），removed=1；`P0-6.7`：act1 背面后牌库 31→34。单测覆盖 v1/v2/v3 三套（17/17 内） |
| **08629** `actRule.forcedOnEnemyEnter` 声明无读点 | 全仓仅条目自身 | `behavior.js:376-380` 接既有引擎钩子 `enemyMoved` / `enemySpawned`；`:623` 实现 `defeatElderThingsAtLocation`（修格斯/精英敌人进入地点 → 击败该地点所有古老者），读 `enemy` 印刷 traits | 探针 `08629.1`：真实 `runtime.moveEnemy` 触发引擎 `enemyMoved` 读点后，该地点古老者被击败（从 `state.enemies` 移除） |
| 附带（使真实路径可跑） | setup 地点裸数据（无 revealed/maxClues/shroud）、起始地点不揭示；版本幕牌库未切换；Tekeli-li 牌库/额外 token 未初始化 | `behavior.js:97`（preScenarioSetup：按记录/投票选 v1/v2/v3 并换 `actsForVersion`）、`:115`（地点带 `revealed/maxClues/帷幕`，起始地点揭示，scoutedOutskirts 半线索）、`:211`（见上）、`:224`（v1/v2 setup 加 1 个 [elderthing] token、Hard/Expert 初始 doom）；`definition.js:79-100`（地点显式带印刷 shroud；隐秘隧道 `cluesFixed=2`） | 探针 `0.3`：起始地点 `revealed=true`、`shroud=3`、`clues=2`（真实调查可用）；单测版本选择三套幕牌库/牌库同步 |

## 2. 复现命令与关键输出

```powershell
# 真实引擎探针（生产组合根；输出同时落盘 UTF-8）
cd G:\boardgame-hall-ai\games\arkhamhorror
$env:CITY_PROBE_OUT = "$PWD\docs\edgeOfTheEarth\eote-scan\campaign\c\_probe-city.out.txt"
node docs/edgeOfTheEarth/eote-scan/campaign/c/_probe-city.mjs
# → 23/23 PASS; FAIL=(none)
#   PASS P0-12.2 石桥 applyMove 无 TypeError/options.resolve :: ok
#   PASS P0-6.1 legalMoves 含钥匙取得（claim） :: rules=...,key:claim,...
#   PASS P0-6.4 give applyMove 成功 :: otherKeys=1
#   PASS P0-6.7 幕 1 目标达成后真实推进 :: actIndex=1（tunnel revealed, deck 31→34）
#   PASS P0-6.10 议程 2 背面推进到 R2 :: resolution=resolution2
#   PASS P0-8.08644..08647 真实遭遇结算产生落地效果
#   PASS 08629.1 修格斯进入地点后击败该地点的古老者（声明已接线）

# 章节测试（17 例：钩子 + 真实引擎路径）
node --test tests/eote-scenario-cityOfTheElderThings.test.mjs
# → # tests 17 / # pass 17 / # fail 0
```

回归（同轮跑过、全绿）：
`node --test tests/eote-p8-registration.test.mjs`（6/6）、
`node --test tests/eote-p8-campaign.test.mjs`（9/9，含完整主线 8 章）、
`node --test tests/eote-scenario-shared.test.mjs tests/eote-campaign-flow.test.mjs`（36/36）。

## 3. 对复核意见的说明（verifier 20:55 两条）

1. **「setup 后 legalMoves `scenarioActions=[]` / 没有钥匙行动」**：当前版本 setup 后真实
   `legalMoves` 的剧本行动至少含 `loc:bridgeDiscover` / `loc:bridgeTravel`（起始地点是石桥，
   v1），见探针 `P0-12.1`。**钥匙取得（claim）按印刷特别规则只在「该地点没有线索」时是合法
   快速能力**（`cityOfTheElderThings.json#specialRules.Keys`：*If a location with a key on it has
   no clues*），setup 时 16 张城市景观各带 1 个线索（×人数），因此 setup 瞬间不会出现 claim；
   真实调查清空线索后 claim 立即出现在 `legalMoves`（探针 `P0-6.1`，actions=0），`applyMove`
   成功（`P0-6.2`）。give 需要「已控制钥匙 + 同地点另一位调查员」，同样在上述前置满足后出现
   （`P0-6.3/6.4`）。
2. **「City v1 缺 shoggoths 组」**：v1 印刷 setup 原文是 *Gather … Shoggoths … / Set aside the
   Shoggoths encounter set*，即**先 gather 后放一边**，不在初始遭遇牌库里；幕 1 背面再洗回
   （参考 `SprawlingCityV1.hs AdvanceAct` → `shuffleSetAsideEncounterSet Shoggoths`）。探针
   `0.2` 证明修格斯×3 在 `scenarioZones.setAside`，`P0-6.7` 证明 act1 背面后真实洗入
   （`encounterDeck` 31→34）。v2 的放一边组是 Creatures in the Ice、v3 是 Shoggoths，均按印刷。
   `definition.ENCOUNTER_DECK`（manifest/审计静态声明）是三套 setup 的并集，包含全部
   `requiredEncounterGroupIds` 组；运行期由 `behavior.modifyDeck` 收窄。

## 4. 遗留风险 / 未覆盖

- **版本入口**：只有 `theInvestigatorsScoutedTheCityOutskirts` 记录 → v2；v3 需
  `scenarioFlags.cityVersionVote`（伙伴投票规则未迁移，属「伙伴入场」大项）。v2/v3 的幕牌库、
  遭遇牌库、起始地点已按版本切换并有单测。
- **manifest 的多版本静态声明**：`scenario.encounterDeck` 是三版本并集（不同版本互斥/重叠的
  setAside 无法在单一 manifest zone 里精确表达）；运行时以 `modifyDeck` 为准。若后续审计工具
  需要按版本对账，建议在工具侧读 `ENCOUNTER_DECK_BY_VERSION`。
- **全灭 noResolution**：参考实现是 `NoResolution → push R2`（同样记录 Guided）；当前引擎只
  有单一 resolution key，本任务未改 `noResolution` 的战役流程（保留现状，只保证 R1/R2 语义），
  如需按参考补齐可在 resolution 钩子里把 noResolution 视为 R2（会影响幕间 III 记录，需 Lead 裁决）。
- 探针中「幕 1 目标的 4 把钥匙」用引擎 `scenario-keys` 写入口布置（避免为清 4 个地点线索反复
  endTurn 被 Mythos 敌人借机攻击击杀）；**真实 claim 入口**已由同一探针 `P0-6.1–6.4` 与测试
  第 14 例单独验证，两者合并即「入口可用 + 目标可达」。
- `content/campaigns/edgeOfTheEarth/card-data.js#location()` 的全局 shroud 缺失属 task-1（P0-4）
  范围；City 已在 `definition.js` 显式带 `shroud` 兜底，两者不冲突。
