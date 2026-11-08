# 战役卡审计 C · 失落之峰 + 古者之城（08596–08647）notes

- 审计员：campaign-auditor-c（task-6）；只读审计，未修改 `games/arkhamhorror/**`。
- 输入：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/README.md`、`scope/shards.json#campaign-auditor-c`、`bundles/<code>.md` ×52、`chapter-bundles/{toTheForbiddenPeaks,cityOfTheElderThings}.md`、
  `screen/{integrity,flags-readpoints,keyword-coverage,tests-coverage,known-deviations,duplication}.json`、`audit/eote-scope.json`、参考实现 Haskell/locale。
- 交付：`findings.json`（52 卡 verdict+clauses+file:line；2 章 scenarios；D5 复用问题；跨分片提示）、本 notes、`_line-evidence.txt`、`_screen-filtered.json` 等过程产物（`tools/` 内）。

## 一句话结论

**52/52 卡有逐卡结论；match 2（仅两张 no-behavior 参考卡 08596/08621），approximation 6，gap 44，blocked 0；issues 96 条（high 65 / medium 23 / low 8）。**
两章都已在生产组合根注册（`content/registered.js:105-106,132`，status=playable），但**真实引擎路径可玩性严重不足**：
失落之峰核心「攀登/从下方进入」与「探险支援」链路没接上，古者之城「数值钥匙取得」与「议程 2→R2」缺失导致流程跑不通；
两章专属诡计在真实遭遇结算中**完全不结算**。单卡测试只测 behavior 钩子，掩盖了这些断点。

## 最高优先级（建议 Lead 汇总时重点复核）

1. **两章 8 张专属诡计在真实对局零效果（high，最严重）**
   - 08610/08611/08612/08613、08644/08645/08646/08647 条目只有 `treacheryRule.resolveKind`；
     `src/engine/treachery-tokens.js:113-124` 只认 `entry.encounterResolve` / `treacheryRule.test` / `effect.kind==='campaignRule'`，
     而两章 `definition.js` 的 `treacheryDefinition`（`content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js:110-117`、`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js:121-127`）**没有 `entryRevelation:true`**（其它 EOTE 章有，如 `theHeartOfMadnessPart1/definition.js:151`），
     `behavior.resolveEncounter` 唯一调用点是 campaignRule 分支。→ 抽到只显示文本，无任何效果。
   - 测试直接直调 `behavior.resolveEncounter`（peaks test:252-276、city test:201-220），所以全绿但掩盖了断点。
2. **两章遭遇牌库都缺共享遭遇组（high）**
   - `ENCOUNTER_DECK` 只展开本章卡（peaks 14 张 `content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js:133-139`；city 20 张 `content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js:130-137`），
     `requiredEncounterGroupIds` 仅注册期校验（`content/schema.js:281-283`），引擎只用 `scenario.encounterDeck`（`src/engine/setup.js:807-815`）。
   - 参考 gather：peaks 6 组 / city 按版本 7 组（`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/.../ToTheForbiddenPeaks.hs:187-192`、`CityOfTheElderThings.hs:334-341...`）；
     city 的三套 gather/setAside 数据在 `shared-encounters.js:117-136` 与参考**逐组一致但无运行时读点**。
   - 对照同循环 `iceAndDeathPart1/definition.js:107-120` 用 GATHER_GROUPS 扫描 `encounterCode` 展开的方式 → 建议上收共享助手。
3. **古者之城数值钥匙没有玩家入口 → 幕 1 目标不可达 → 流程死锁（high）**
   - Keys 特别规则（fast 取得 / action 转交 / 淘汰落地）只实现为 `behavior.claimKey/giveKeys/placeControlledKeyAtLocation` 纯函数（`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:180-201`），
     未进 `actions`（`:256-293`）；`_shared.js:842-847` 的通用「拿钥匙」是**彩色钥匙**原语（`scenario-keys.js:104-140`）且未挂到 08621。
   - 幕 1 三个版本都要花 2+2 把符号钥匙 → 真实对局无法完成；测试用 `behavior.claimKey` 直调（city test:144-158）绕过。
4. **失落之峰攀登「从下方进入」未接权威移动（high，影响 08600–08606）**
   - `behavior.locationEntered` 读 `climbState.enterFromBelow`（`content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js:189-199`），但权威移动（`src/engine/movement.js:236-249`）不调用 `eote-climb.ascend`；
     `ascend` 只经 `api.mechanics.climb`（`api-mechanics.js:176-183`）暴露、无内容层调用者；全仓调用点仅测试。
   - 6 张山地的强制效果（弃 3 抽弱点/敏捷+掉落/1 伤/1 恐/洗 Tekeli/横置支援）在真实对局永不触发。
5. **失落之峰探险支援永不入场 + 结局记录写错（high）**
   - 7 件 Expedition 支援全部只进 `SET_ASIDE_CODES`（`content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js:142-146`），setup 不按 `suppliesRecovered` 放到 level-0，引擎也不自动生成 scenario.storyAssets（`setup.js:645`）；
     08599 的 [action] 与山顶撤退胜利区因此不可用。
   - `behavior.resolution`（`content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js:348-350`）只写 `theInvestigatorsScoutedTheMountainPass`；参考 R1 应写 `TheTeamClimbedToTheSummit`、R2 `TheTeamFoundAnotherWayThroughTheMountains`（后续幕间 II 读它：`interludes.js:52`），且 Supplies 划掉/XP 未实现。
6. **古者之城版本选择只做了一半（high）**
   - `actsForVersion` 只用于默认 v1（`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js:185-196`）；setup 文本固定 v1（`:205-213`）；`SET_ASIDE_BY_VERSION/REMOVED_BY_VERSION`（`:143-153`）无读点；
     版本判定未实现参考的伙伴票（`CityOfTheElderThings.hs:242-277`），`theInvestigatorsScoutedTheCityOutskirts` 无写点 → 08625/08626/08628/08629、v2/v3 setup 在真实战役不可达。
7. **古者之城议程 2 背面 (→R2) 未实现（high）**
   - 08623 无 `onReveal`，`behavior.finalResolution` 无调用者；最后议程耗尽只走 `checkOutcome`（`harm-threat.js:354-361`，仅全灭才结束）→ R2 不可达、「被引导到隐秘隧道」记录不写。
8. **古者之城地点放置绕过 placeLocation（high）**
   - `behavior.setupLocations` 直接 clone 推入 17 个地点（`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:83-140`）：`maxClues` 缺失（`revealLocation` 用 maxClues 恢复 → 揭示后线索变 0）、初始线索未按未揭示=0 处理、起始地点未揭示、地点入场/胜利点钩子未派发。
9. **Declared-but-unread 的敌人/地点规则（D4 核心，逐卡见 findings）**
   - 08609 `blocksAscendWhileEngaged`、08641 `blocksKeysWhileReady`、08642 `spawn:"anyEmpty"/onSpawnDoom/onDefeatDoom/parley`、08643 三条强制、
     08634 `doubleKeyTokenModifier`、08637 `frostForcedDamage`、08640 `frostForcedHorror`、08630 `blocksClueDiscovery`、08629 `forcedOnEnemyEnter`（全仓 grep 已确认仅条目自身）。
   - 08607 `cluesOnlyByInvestigation` **嵌套位置错误**（写在 `locationRule.flags` 内，引擎读顶层 `locationRule.cluesOnlyByInvestigation`，`locations.js:377-380`）→ 山顶限制不生效。
   - 08608/08609 的 X 数值：cards-data 用 -2 表示 X，但 behavior 返回 +Level 被引擎**相加**（`enemies.js:136/154`、`rules-state.js:9-13`）→ 实际 -2+Level；正确口径参照 `darkSideOfTheMoon/behavior.js:539-543`（X - enemy[stat]）。
10. **7 件 Expedition 剧情支援（08614–08620）能力零实现（high）**
    - 条目只有 `uses/usesType/flags`（file 头注释声称「行为在 behavior 读 flags 分派」，实际 behavior 无能力读点；`sledgeSearchTop6/cancelsTekeliWeakness/radioUseOffstageExpeditionAssets` 全仓仅条目自身）。
    - 账本 `status=verified` 与现状不符 → **虚假 verified**（连同「永不入场」双重失真）。

## 逐卡覆盖表（verdict）

| 段 | code | verdict |
| --- | --- | --- |
| 参考卡 | 08596 | match（token 两档由 `chaos.js` 实现；setup token 缺口记章级） |
| 失落之峰 | 08597,08598 | gap（正面强制 afterMove 未接线） |
| | 08599 | approximation（行动/目标/背面已实现；支援链缺失） |
| | 08600–08606 | gap（enterFromBelow 效果代码存在但引擎不触发；背面 blocksUntilBelowClear 已接线） |
| | 08607 | gap（线索仅调查发现未生效；frost/撤退/背面已实现） |
| | 08608,08609 | gap（X 数值错；08609 交战禁上升缺失） |
| | 08610–08613 | gap（真实遭遇不结算；08613 近似披露不足） |
| | 08614–08620 | gap（能力零实现） |
| 参考卡 | 08621 | match（token 两档由 `chaos.js` 实现；Keys 特别规则/ setup token 缺口记章级） |
| 古者之城 | 08622,08623 | gap（自由行动不等价；08623 背面 R2 缺失） |
| | 08624–08626 | gap（幕背面缺洗混/星之恐怖等） |
| | 08627–08629 | gap（幕 2 行动效果未实现；08629 forced 未接线） |
| | 08630 | gap（blocksClueDiscovery/技能选择/+5 缺失） |
| | 08631 | gap（实现成加 frost，记录键错） |
| | 08632,08633,08636,08638,08639 | approximation（选择/发现语义/记录键等偏差） |
| | 08634,08637,08640 | gap（locationRule.flags 强制未接线） |
| | 08641–08643 | gap（敌人强制/封锁规则未接线） |
| | 08644–08647 | gap（真实遭遇不结算；08645 自动失败/08646-47 frost 强制缺） |

## D3（章节可跑通）要点

- setup/幕议程/结局读点存在（`setup.js:795-799`、`reveal.js:151-162`、`phases.js:268-282`、`act-agenda.js:183/326-372`），
  但真实 runthrough 断点：古者之城钥匙不可得（幕 1 卡）→ 隧道不揭示 → 幕 2 卡；议程 2 也无法结束（R2 缺失）。
  失落之峰可走完幕/议程，但攀登强制、议程移动归还线索、探险支援、Tekeli-li 牌库、结局记录均失真。
- gatherSets 与 `audit/eote-scope.json` 对账：peaks 6 组、city v1/v2/v3 与参考逐组一致（✓ 数据），
  但 **运行时都没有把它们并入遭遇牌库**（✗）。
- 两章的 setup 与参考实现另有 5–7 处缺失：`+1 [elder_thing]` token、Hard/Expert 初始 doom、勘察记录的起始线索修正/发现、伙伴序幕分支、Tekeli-li 牌库初始化、city 版本撤卡（benign/frostbitten/possessed/reawakened/terror）。
- 08596/08621 是 no-behavior 参考卡：其 token 文本确实由 `chaos.js` 实现，**不存在「账本 verified 但实际无卡面行为」**问题；但依附的章节 setup token 步骤缺失。

## D4（原语）要点

- 高价值未接线（flags-readpoints unread 逐项复核，全仓 grep 确认，非通用 dispatcher 误报）：
  `08629 actRule.forcedOnEnemyEnter`、`08630 locationRule.blocksClueDiscovery`、`08634 flags.doubleKeyTokenModifier`、
  `08637 flags.frostForcedDamage`、`08640 flags.frostForcedHorror`、`08641 enemyRule.blocksKeysWhileReady`、
  `08642 enemyRule.spawn/onSpawnDoom/onDefeatDoom/parley`、`08643 takesKeyOnEngage/readiesOnKeyControlled/placesKeyOnLeave`、
  `08609 blocksAscendWhileEngaged`、`08608 moveDownToBelow`（行为里按卡号字面量分支实现，声明未读）、
  `08607 summitResign`（行为按 summit id 硬编码）、`08615/08617/08619` 的剧情支援 flags。
- `studyHistory/discernShoggoths/hiddenPower/returnTekeliWeaknesses/removeElderThingTokens` 这些 rule-value **不算未接线**：
  它们作为 `keyActions/actTwoActions` 的 action 名由 `actKey:/actTwo:` 通用分派消费（`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js:332-351`，city test:190 覆盖）；
  **但 actTwoActions 的效果本体未实现**（只花钥匙+日志，见 08627–08629）。
- 所有「声明即接线」检查以真实引擎读点为准：`card-rules.js` 的 `locationRuleFor/actRuleFor/agendaRuleFor/enemyRuleFor` 本身按整块返回，
  但键是否被消费必须逐键 grep；本报告已区分「通用分派（算接线）」与「无读点（未接线）」。

## D5（复用）要点

- 两章 behavior 复制同类工具（moveBelow / dropExpeditionAssetsOf / nearest-enemy-moves-and-attacks / record helper），建议上收 EOTE 共享原语。
- 数值钥匙存在两套：`eote-city.js` 的 `city.keys`（api-mechanics:184-191）与 `scenario-keys.js` 的 value 实体；本章只用后者，前者在本章零使用点。
- 城市地图「看行/列」两套读点（grid-map.lookRow/lookColumn vs eote-city.visibleOnRow/visibleOnColumn）都未真正接到自由行动。
- 遭遇卡结算模式（TREACHERY_HANDLERS/resolveEncounter）在 peaks/city/heartOfMadnessPart1 各写一遍；
  gather→deck 展开模式 iceAndDeathPart1 与 peaks/city 不一致，应上收。
- simplified 复核（属 B 分片）：08560/08561/08562/08565/08566/08567/08571/08572 在 `known-deviations.json` +
  `audit/eote-all-card-acceptance.json` 有披露（pending primitive p7-08560），条目只声明 flags（如 `08560.js:15 forcedAfterInvestigate`），
  对应 readpoint 不存在（grep `shroudPlus1AndCannotLeave` 仅条目 + `tests/eote-scenario-fatalMirage.test.mjs:142` 断言 flag 字符串）→
  **披露在、实现仍缺**；建议 B 分片按「声明未接线 medium」登记（不属 C 分片 verdict）。

## 测试与断言强度

- 运行：`node --experimental-test-isolation=none --test tests/eote-scenario-toTheForbiddenPeaks.test.mjs tests/eote-scenario-cityOfTheElderThings.test.mjs` → **20/20 通过（约 1.0s）**。
- 强度评估：**hooks-only**。两份测试都自建 state（手工 locations/chaosBag）与 apiStub，直调 behavior 方法；
  没有 `startScenario/placeLocation/move/drawEncounter/advanceAct/advanceAgenda` 真实链路。
  因此无法发现：攀登不接线、afterMove 不接线、诡计不结算、支援不入场、共享组缺失、城市地点 maxClues/reveal 失真、版本幕牌库未换、R2 不结束。
- 另：peaks test 用 `chapter.manifest.chaosBags?.standard`（undefined → 空袋），chaos bag 相关断言不具代表性。

## 机械线索使用说明（哪些照抄会错）

- `integrity.json` 对 08614–08620 报 `entry-no-code` + `no-implemented-flag` 是**误报**：
  这些条目实际有 `"code"` 与 `"implemented": true`（`08614.js:12,14`），只是键名带引号导致筛查正则漏判（low，建议修筛查器）。
- `flags-readpoints.json` 的 `actRule.studyHistory` 等 rule-value 属通用分派消费（不算未接线）；`actRule.forcedOnEnemyEnter` 等才是真未接线。
- `keyword-coverage.json` 对本分片 0 命中（无候选），未提供额外线索。
- `tests-coverage.json` 多数卡为 `none/file-only`（场景测试标题不含卡号），与实测 hooks-only 结论一致。

## 过程产物

- `_line-evidence.txt` / `_line-evidence.json`：52 条条目 + 两章 definition/behavior/chaos + 引擎读点的行号证据表。
- `_screen-filtered.json`：`screen/*.json` 中本分片条目（integrity/flags-unread/known-deviations 等）。
- `tools/`：数据与生成脚本（`findings-data.mjs`、`build-findings.mjs`、`line-evidence.mjs` 等）。
