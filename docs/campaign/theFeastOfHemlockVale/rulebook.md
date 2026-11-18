# 《铁杉谷盛宴》关键词与规则书（P3 交付说明）

本文件汇总 P3（规范第 3 步：关键词与规则书）的交付口径。机器可复算的账本在
`audit/fhv-rules.json`（`confirmations.keywords` / `confirmations.rulebook`），
规则正文在 `web/fhv-rules.js`，关键词身份在 `content/campaigns/theFeastOfHemlockVale/keywords.js`。

## 1. 关键词清单（6 项，全部 verified）

关键词身份与 P1 机制扫描（`audit/fhv-mechanism-scan.json` 中 `keyword.elusive`、`keyword.dayNight`、
`keyword.patrol`、`keyword.alert`、`keyword.blessCurse`、`rulebook.codex` 六行）逐条一致：
`cardCodes` 用与扫描器相同的语料（卡牌正文、背面正文、定制栏与特质，不含卡名／副名）由判据复算，
不手写卡号；每个关键词的候选原语都已在 P2 原语计划中 `done`。

| 类别 | 关键词 | 规则条目 | 代表卡号 |
| --- | --- | --- | --- |
| 本循环新增 | 逃逸（Elusive） | `fhvElusive` | 10011、10014、10018、10022、10583a、10584a |
| 本循环新增 | 昼夜标记（Day／Night） | `fhvDayNight` | 10544、10570、10571、10581、10586、10602 |
| 本循环新增 | 铁杉谷法典（`[codex] X`） | `fhvCodex` | 10558、10559、10560、10565、10573、10607b |
| 已有通用 | 巡逻（Patrol） | `tskPatrol`（八循环注册的通用条目） | 10552、10564、10592、10601、10644a、10646 |
| 已有通用 | 警戒（Alert） | `alert`（基础规则条目） | 10022、10565、10625、10646、10664a、10700b |
| 已有通用 | 祝福／诅咒标记 | `fhvBlessCurse` | 10012、10013、10014、10019、10022、10024 |

- 新增关键词必须实现规则、测试与规则书条目；已有通用关键词只确认其在本循环卡面上的适用性，
  卡牌字面行为仍在 P5–P7 逐卡验收。
- P1 扫描里还有 `keyword.bonded`（绑定）：P3 清单未要求独立条目（绑定由 P5 调查员与 P6 玩家卡批次
  逐卡验收），账本 `confirmations.keywords.coverage.excluded` 显式登记了该项与理由，避免无来源省略。
- 关键词引擎行为读点（Node 测试会导入并断言存在）：
  `src/engine/enemy-keyword-movement.js`（`setEnemyKeywords` / `resolveElusive` / `resolveElusiveAfterAttack` /
  `normalizePatrolTarget` / `resolvePatrol` / `enemyHasAttackKeyword`）、
  `src/engine/scenario-calendar.js`（日期、法典）、`src/engine/matcher.js#duringPeriod`、
  `src/engine/resident-record.js`（关系等级、笔记、划除）、
  `src/engine/chaos-token-pool.js`（祝福／诅咒池、组合支付、战役疲劳替换）。

## 2. 规则书条目（11 条，中英双语，全部 verified）

`web/fhv-rules.js` 只写规则本身，不写实现、验证状态、界面操作或代码路径；条目注册进
`web/rulebook-data.js`（`ruleById` / `RULE_INDEX` / `matchingRules`），支持中文标题、英文标题与拼音首字母检索。

| 条目 | 中文标题 | 关联 |
| --- | --- | --- |
| `fhvCampaign` | 《铁杉谷盛宴》战役概览 | 三天三夜、勘察整备、法典、居民、混乱袋、昼夜、逃逸、网格 |
| `fhvTime` | 三天三夜与时间标记 | 战役概览、昼夜关键词、可游玩序曲与勘察整备 |
| `fhvDayNight` | 昼夜关键词（Day／Night） | 时间标记、战役概览、法典 |
| `fhvSurvey` | 可游玩序曲与勘察整备 | 战役概览、时间标记、经验与升级、卡组构筑 |
| `fhvCodex` | 铁杉谷法典（The Codex） | 居民关系等级与笔记、战役概览、时间标记 |
| `fhvResidents` | 居民关系等级与笔记 | 法典、战役概览、时间标记 |
| `fhvGrid` | 网格正交相邻 | 战役概览、线索与调查 |
| `fhvElusive` | 逃逸（Elusive） | 战役概览、交战、躲避 |
| `fhvBlessCurse` | 祝福与诅咒标记 | 印斯茅斯祝福标记、诅咒标记、混乱袋、战役概览 |
| `fhvFatigue` | 战役疲劳 | 混乱袋、战役概览、时间标记 |
| `fhvChaos` | 混乱袋与符号 | 基础混乱袋、战役概览、战役疲劳、时间标记 |

规则来源：锁定的英文战役指南 `frontend/src/locales/en/theFeastOfHemlockVale/base.json`
（`specialRules`、`newKeywords`、`additionalRulesAndClarifications`、`prelude1`–`prelude4`、`fatigue`）
与 `audit/fhv-scope.json` 的初始混乱袋、居民面、传家宝与时间标记登记。上游 `locales/zh/` 尚无本循环目录，
本批中文规则为**自译**，与英文正文逐段对应（`body` 与 `bodyEn` 段数一致）。

## 3. 卡文直达

- 每张 `10` 段卡（441 张，含关联面 `a`/`b`）至少连到 `fhvCampaign`（审计 `cardLinks.unlinked = []`）。
- 关键词卡按同一判据连到对应条目；判据与 `keywords.js` 的 pattern 同源，测试逐张反向核对。
- 章节参考卡（`10704`、`10501`、`10502`、`10523`、`10549`、`10569`、`10588`、`10605`、`10626`、`10651`）
  连到战役概览，并按类型连到 `fhvTime` / `fhvSurvey` / `fhvChaos`。
- 身份写在卡名或战役记录里的卡按卡号登记在 `web/ui-cards.js#rulebookReferences`：
  九位居民的剧情支援面／敌人面（`10693`–`10701b`）连 `fhvResidents` / `fhvCodex`，
  传家宝（`10713`–`10715`）连 `fhvResidents`，时间标记（`10675`/`10677`/`10679`）连 `fhvTime`。
- 章节与遭遇卡按类型连到本循环混乱符号条目 `fhvChaos`；幕／议程仍按通用规则连到 `script`。

## 4. 验收与证据

```powershell
node tools/verify-fhv.mjs --node              # P2 原语 + P3 规则数据 Node 测试与 replay 对比
node tools/verify-fhv.mjs --node --check      # 只校验证据文件与测试文件哈希一致
npm run test:fhv:rules:browser                # 桌面 1440 / 移动 390 × 中英阅读、返回与卡文直达（先跑浏览器，账本才会被规则审计纳入来源哈希）
npm run plan:fhv:rules                        # 生成 audit/fhv-rules.json（含 confirmations；在浏览器账本之后）
npm run audit:fhv:rules                       # 只复算不重写（关键词/规则/证据漂移即失败）
npm run test:fhv:rules                        # Node 验收：关键词清单、双语规则、441 卡文直达与账本复算
npm run audit:fhv:check                       # 总迁移账本复算（含 P3 合并与 replay 对比）
```

- `audit/fhv-rules.json`：`confirmations.keywords`（6/6 verified）与 `confirmations.rulebook`
  （11 条 verified），门禁全真；来源 SHA-256 全部登记。
- `audit/fhv-node-acceptance.json`：P2 原语与 P3 规则数据 Node 测试的通过标题、测试文件 SHA-256
  与 replay 对比结果（`tests/fixtures/replay/golden-replays.json`）。
- `audit/fhv-rules-browser.json`：浏览器用例全部通过（`desktop` / `mobile` / `zh` / `en` /
  `cardLink` / `noHorizontalScroll` 六项全真），截图在
  `artifacts/migration/fhv/reports/screenshots/`（桌面 1440、移动 390 × 中英 + 卡文直达）。
- `audit/fhv-migration.json`：P3 规则确认由 `tools/audit-fhv.mjs` 合并进总迁移账本，
  `confirmations.keywords` / `confirmations.rulebook` 与规则账本一致；战役仍为 `catalog-only`。
- 快速回归：`npm run test:fast` 记录为 `reports/p3-fast.log`，比对结果在 `reports/p3-fast-compare.json`
  （`newFailures = []`）。其中 2 项 HEAD 既有的 EOTE 账本漂移（场景模块哈希与 EOTE 场景验收账本不一致）
  在 P3 之前即存在，按 `reports/p3-preexisting-failures.json` 单独记账，不计入 P3 新增失败。
- 跨循环来源锁：`web/rulebook-data.js` 与 `web/ui-cards.js` 被 TDE/TCU 迁移账本锁定为来源；
  TDE 用 `node tools/audit-tde.mjs --write` 复算（仅两个来源哈希变化），TCU 只刷新
  `audit/tcu-migration.json#evidence.files` 的两项哈希，并由 `tools/check-tcu-audit-sources.mjs`
  与 `tests/tcu-migration.test.mjs`、`tests/tde-migration.test.mjs` 复核。
- 测试数量与耗时以 `node tools/run-tests.mjs fast` 与 `node tools/test-timings.mjs fast` 的实时输出为准，
  本文件不写死。

## 5. 边界

P3 只交付「关键词身份 + 规则条目 + 卡文直达 + 验收证据」。单卡字面行为仍在 P5–P7 逐卡实现；
规则书条目只描述 P2 已实现的通用规则（逃逸结算、昼夜门控、法典、居民关系、网格正交相邻、
巡逻／警戒、祝福诅咒池与战役疲劳），不描述未实现行为，也不把战役标记为可启动。
