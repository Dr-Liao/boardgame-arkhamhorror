# P0-11 审计流水线「假绿」根因修复与 EOTE 账本重建记录

- 对象：扫描报告 §3 P0-11 / §5 / §5.1（`docs/edgeOfTheEarth/eote-scan/全量扫描报告.md`），共享任务板 `task-7`
- 执行：audit-pipeline（2026-11-08）
- 写入范围：`tools/audit-eote-*.mjs`、`tools/audit-card-entry-compliance.mjs`、`audit/eote-*.json`、`audit/card-entry-compliance.json`、`artifacts/migration/eote/**`、`tests/eote-all-cards.test.mjs`、`tests/eote-migration-ledger.test.mjs`、本目录
- 约束：不手工改任何账本证据；所有账本只能由生成器从真实测试/来源重新计算；不 git commit。

## 0. 结论速览

阶段 A（生成器根因修复，不依赖其他修复）已完成。用**账本内已有的实跑快照**复算即可证明修复后的生成器不再假绿：

| 指标 | 修复前账本（假绿） | 修复后生成器复算（现状未补测试） |
| --- | --- | --- |
| `audit/eote-all-card-acceptance.json` status | verified | **pending** |
| verified / simplified / no-behavior | 375 / 26 / 2 | **260 / 12 / 2** |
| missing / blocked | 0 / 0 | **115 / 14** |
| scenario-ledger 证据数 | 129（全部不可追溯） | **0**（回退要求引用文件含卡号） |
| gates.noMissingOrBlocked / everyBehaviorCardHasEvidence | true / true（假绿） | **false / false**（如实暴露） |

即：修复前被 scenario-ledger 假证据盖住的 **129 条**（115 verified + 14 simplified）全部暴露为 missing/blocked，与 `verify/player-b-verify.md` §3 的独立复算（129 条 scenario-ledger 全部指向 Heart Part2、0/129 含卡号）一致。

**阶段 B（2026-11-08 21:14–21:56，Lead 通知工作区稳定后）已全部执行完毕。最终状态（详见 §4）：**

| 指标 | 最终重建后 |
| --- | --- |
| all-cards | **pending**：verified 248 / simplified 12 / no-behavior 2 / **missing 127 / blocked 14**；262 条 evidence 全部可追溯、invalid=0；scenario-ledger 假证据 129→**0** |
| scenario 章卡池 | 8 章 39/55/39/94/42/50/39/43（unique；旧为 8×264 相同） |
| player | verified 115 + **simplified 54 条逐条披露**（`noSimplified` 空门禁已删除） |
| investigators | verified（9/9 checks；sha 漂移已重签） |
| R1 合规基线 | 149 → **164**（+15 检测补漏，非新增债务） |
| release / migration | **failed / pending**，`equivalence.certified=false`、`releaseAcceptance.equivalenceCertified=false`，附 `independentAudit`（旧 verified 声称不成立） |
| 门禁 | 15 项中 12 项 exit 0；all-cards/release/migration 的 `--check` 为「**逐字节一致但诚实未通过**」exit 1；3 个验收测试 18/18、全量 EOTE Node 508/508、verify-eote --node/--regression 均 passed |
| 基线 | `audit/eote-baseline.json` fastFailures 3→5（会话起始 6 条中 1 条由 P0-11 修复）；replay-eote-p8 基线按 Lead 重采（行为有意变化） |

**本仓 P8 旧账本声称 verified 的结论已被独立复核推翻（135/403 字面不可追溯、129 条 scenario-ledger 系统性错配、`noSimplified` 为空门禁）；重建后账本按可追溯证据如实登记，不再宣称行为等价。** 阶段 A/B 的完整统计、命令与残余风险见 §2、§4。

## 1. 根因修复清单（阶段 A）

### 1.1 `tools/audit-eote-scenarios.mjs`：章卡池 = 全卡池（P0-11 Bug 1）

- 旧实现 `:88-90` 内层 `flatMap(group => CAMPAIGN_CODES.filter(...))` **不使用 group**，每个 gatherSet 都返回全部 264 张战役卡 → 8 章 `cardCodes` 的 unique 集合完全相同（各 264），数组长度 1848/1848/1848/1848/1584/2640/1848/1848，`cardCoverageAssigned=15312`。
- 修复：`ENCOUNTER_GROUP_BY_SET`（组 id → encounterGroup）+ `CAMPAIGN_CARD_BY_CODE`（卡表 `encounterCode`）；每个 gatherSet 只取该组的卡，`gatherJust` 只取 `subsetCodes`。跨循环依赖组（AncientEvils/ChillingCold/LockedDoors/StrikingFear）不属于本循环卡池，返回空。
- 同时把恒为 `true` 的 `checks.cardEntries` 改成真实条件（非空且全部有条目文件），并新增门禁 `chapterCardsAssigned`：每章卡池非空、无重复、且不得混入该章 gatherSets 之外的组的卡（旧 bug 会被该门禁直接抓到）。
- 修复后（用当前 scope 复算）：章卡池 unique 数 = 39 / 55 / 39 / 94 / 42 / 50 / 39 / 43（合计 401，去重并集 246；比 264 少 18 张是 expeditionTeam/memorialsOfTheLost 两个战役级共享组，任何章节 gatherSets 都不引用它们——旧实现把它们塞进所有章节属于同一 bug 的一部分，不再错误归属）。

### 1.2 `tools/audit-eote-all-cards.mjs`：last-wins + 回退不校验 + gate 只看非空（P0-11 Bug 2/3）

- 旧实现 `:258-261` 用 `Map.set` last-wins：因每章都含全部 264 张卡，所有 code 最终映射到最后章 `theHeartOfMadnessPart2`；`:302-308` 回退只要求该章测试本次有 pass、**不要求文件含卡号**；`:429,470` 的 gate 只查 `evidence.length > 0` → 129 条不可追溯证据仍让 `withoutEvidence:0`/`everyBehaviorCardHasEvidence:true` 通过。
- 修复：
  - `chaptersByCode` 保留**全部候选章**（共享卡可属多章），回退时要求「该章测试文件本次有通过用例 **且文件含该卡号 token**」，否则不得作为证据；
  - 所有 ledger 回退（player/investigator/scenario）统一要求可追溯：标题命中需仍含卡号 token，文件型需文件含 token；移除 player-ledger 的「账本有条目 + m2-1 有 pass 即算证据」分支（另一处假绿）；
  - 每条 evidence 增加 `traceable`，记录增加 `traceable`；`summary.evidence.withoutTraceableEvidence` 与 gate `everyBehaviorCardHasEvidence` 改为检查可追溯证据；
  - 请求目录去重（同名请求在 mod 副本与大厅根目录各有一份时只记一次）。
- 证据文件 `_allcards-fix-probe.json`（用账本内 2026-11-08 实跑快照复算，不重跑测试）：129 条记录状态 `scenario-ledger → missing(115)/blocked(14)`；`evidenceKindFirstChoice = { strong:142, file:132, none:129 }`。

### 1.3 `tools/audit-eote-player.mjs`：noSimplified 空门禁（P0-11）

- 旧实现 `:71-73,91` 只看 `entry.simplified` flag，而 55/115 张卡的近似写在 `note:'approximation…'` 或源码注释里 → `simplified:false`、`noSimplified:true` 恒真。
- 修复：`detectSimplification()` 同时扫描 ①`entry.simplified`/`ability.simplified` flag、②条目对象里的 note/notes/approximation 等披露字段、③源码行/块注释中的近似声明；每条记 `simplified:true` + `simplification:{kinds,count,disclosures[]}`。
- gate `noSimplified` 删除，改为 `simplificationDisclosed`（每条 simplified 必须有披露明细）；`summary.simplified/simplifiedDisclosed` 如实计数。`status: verified` 语义明确为「有实跑逐卡测试证据」，不表示印刷等价（写进 `profile.basis`）。
- 现状复算（`buildPlayerAcceptance()`，测试尚未因工作区稳定而全绿，仅取披露判定）：**56/115 张被标记 simplified**（其中 12 张含正式 `note:` 字段，全部含注释披露），旧账本为 0。`tools/audit-eote.mjs` 的 `playerChecks.summary` 随之改为「115 张全部有测试证据 + 所有 simplified 均已披露」，不再要求 `simplified===0`。

### 1.4 `tools/audit-card-entry-compliance.mjs`：R1 漏检局部变量直写

- 旧 `STATE_ROOTS` 正则只认 `state/inv/location/enemy/act/agenda/asset/target/card` 字面前缀：`08008.js:30 whip.exhausted = true` 以及 `context.asset.x = ...` 都漏检（实证：`whip.exhausted` NO MATCH / 替换成 `asset.exhausted` 才 MATCH）。
- 修复：`collectTaintedIdentifiers()` 从状态根 / `context.<stateField>` 表达式做轻量污点传播（同文件 const/let/var 声明 + context 解构别名），再对「被污染标识符.字段 = ...」计为 R1；另加 `context.<stateField>.<field> = ...` 规则。工具改为可 import（导出 `entries/report`），CLI 用 main 守卫。
- 现状复算：R1 条目 **149 → 164**，新识别 **15 条存量违例**（`_r1-detect-probe.json`；逐条人工核对均为真实状态直写，无假阳性）：
  - EOTE：`08008`（`whip.exhausted`，即报告点名项）；
  - 其他循环存量（非本轮新增债务，随检测补漏一并入基线）：01174、02096、02142、02143、02146、02196、02197、02214、02256、03082、03097、04045、05045、05097。
- 基线处理：`audit/card-entry-compliance.json` 仍是旧基线（149），因此 `node tools/audit-card-entry-compliance.mjs --check` 现在**如实失败**并列出 15 条「新增违规」（阶段 A 不写基线；阶段 B 用 `--write` 重签，属检测范围扩大而非新增债务，工具 note 已注明）。

### 1.5 primitive 请求目录同步 + deferred 登记

- 现状：大厅根目录运行镜像 `G:\boardgame-hall-ai\artifacts\migration\eote\primitive-requests\`（43 文件，canonical）有 8 条 pending 的 P7 请求 `p7-08544/08546/08560/08587/08673/08679/08681/08682`；Mod 内 `games/arkhamhorror/artifacts/migration/eote/primitive-requests/` 只有 25 条旧请求，`p7-08560/p7-08587` 等缺失 → `tools/audit-eote.mjs` 与 `tests/eote-migration-ledger.test.mjs` 读 Mod 内目录，导致 `releaseAcceptance.deferred` 漏登记。
- 修复：把 8 条 canonical pending 请求同步进 Mod 内副本（25 → 33 文件；旧 25 条保留，避免丢历史披露）。`tools/audit-eote.mjs#buildDeferred` 增加 `need` 字段（新式请求没有 `primitive` 名，只有 need 描述，原样披露不编造）；`tools/audit-eote-release.mjs` 的 deferred 文案删除硬编码「25 条」。
- 阶段 B `node tools/audit-eote.mjs --write` 后，`audit/eote-migration.json#releaseAcceptance.deferred` 应逐条出现 `primitiveRequest:p7-08544…p7-08682`（另有 `pendingBehaviorRequests` 汇总项）。

### 1.6 `audit/eote-investigators.json` sha 漂移

- 现状（只读核对）：`audit/eote-investigators.json` 当前 sha256 = `aadf6fb3…`，且 `buildInvestigatorAudit()` 与磁盘逐字节一致（自身自洽）；但 `audit/eote-all-card-acceptance.json#sources.ledgers` 记录的旧 sha = `ee80f9ed…` → `tests/eote-all-cards.test.mjs:123`（复算必须与账本一致）真实失败。
- 结论：这不是 investigators 账本算错，而是 all-cards 账本在 investigators 账本重写后未重签。**不能手工改 JSON 证据**，只能阶段 B 用 `node tools/audit-eote-all-cards.mjs --write` 从实跑重签（届时会记录当前 `aadf6fb3…`）。

## 2. 阶段 A 的 `--check` 复算结果（如实暴露，不粉饰）

| 命令 | 阶段 A 结果 | 说明 |
| --- | --- | --- |
| `node tools/audit-card-entry-compliance.mjs --check` | **exit 1**：15 条 R1 新增违规（含 08008） | 正确的「检测补漏后暴露存量」；阶段 B `--write` 重签基线 |
| `node tools/audit-eote-scenarios.mjs`（无参打印） | status=pending；`chapterCardsAssigned=true`；章卡池 39/55/39/94/42/50/39/43 | 测试因其他 agent 正在改引擎/章节而失败（见 §3），卡池修复本身已复算通过 |
| `node docs/edgeOfTheEarth/eote-scan/verify/_allcards-fix-probe.mjs` | 全卡账本复算：missing 115 / blocked 14 / scenario-ledger 0 | 用账本内实跑快照复算，无需重跑测试；证据 `_allcards-fix-probe.json` |
| `node tools/audit-eote-all-cards.mjs --check` | exit 2（测试实跑失败/账本漂移） | 当前引擎源码正被并发修改（`src/engine/play-channels.js` 语法错误），实跑无 test:pass 事件；阶段 B 工作区稳定后重跑 |
| `node tools/audit-eote-player.mjs --check`、`audit-eote-investigators.mjs --check`、`audit-eote.mjs --check` | 暂不可用 | 同上，import 链被并发修改中的引擎文件阻断；阶段 B 重跑 |

**未做任何让 --check 变绿的手工改账本操作**：本阶段只改生成器与 primitive 请求文件副本，`audit/eote-*.json` 一字未动（可用 `git status`/sha 对照）。

### 2.1 live `--check` 预演（2026-11-08 20:50–20:57，引擎 import 已恢复；其他 agent 仍在并发编辑）

| 命令 | 实测 | 结论 |
| --- | --- | --- |
| `node tools/audit-card-entry-compliance.mjs --check` | exit 1：15 条 R1 新增（01174/02096/02142/02143/02146/02196/02197/02214/02256/03082/03097/04045/05045/05097/08008） | 与阶段 A 快照口径一致；阶段 B `--write` 重签基线 |
| `node tools/audit-eote-scenarios.mjs`（打印） | status=pending；`chapterCardsAssigned=true`；章卡池 39/55/39/94/42/50/39/43；7/8 章 verified（Peaks 的 P7 测试正被其他 agent 重写） | 卡池修复在 live 数据上复现；测试未冻结前 `scenarioTestsPassed=false` 属预期 |
| `node tools/audit-eote-player.mjs --check` | exit 1：`src/cards/eote-player-acceptance.js 与实跑测试不一致`（profile 文案改变 + 玩家测试正被并发修改） | 阶段 B 用 `--write` 重生成；live 中间态 verified 106/missing 9/simplified 54，非最终数 |
| `node tools/audit-eote-investigators.mjs --check` | exit 1：`audit/eote-investigators.json 与当前证据不一致` | 差异仅 `08004/08005` 条目 sha 被其他 agent 修改（status 仍 verified）；阶段 B 重签 |
| `node tools/audit-eote-all-cards.mjs --check` | **exit 2：账本漂移**（复算≠旧账本） | 生成器修复后的预期失败：旧账本仍是假绿快照 |
| `node tools/audit-eote.mjs --check` | exit 1：差异键 `status, primitives, confirmations, releaseAcceptance, gates, remaining, evidence, sources` | 预期失败：旧账本含旧假绿 + 场景模块 sha 已被并发修改 |
| `buildMigrationLedger()`（只读） | deferred=36：含 `primitiveRequest:p7-08544/08546/08560/08587/08673/08679/08681/08682`；`primitives.requests={total:33,pending:33}` | primitive 目录同步 + deferred 登记已在 live 复算中生效（尚未写盘） |
| `node tools/audit-eote-primitives.mjs --check` | exit 0（复算一致） | 本轮生成器修复未影响 primitive plan |
| `node tools/audit-eote-rules.mjs --check` / `audit-eote-interactions.mjs --check` | exit 0（复算一致） | 同上；阶段 B 预期无需重签 |
| `node tools/scan-eote-scope.mjs --check` | exit 0（复算一致） | scope 账本不受 P0-11 修复影响 |

> live 预演期间多个 agent 正在改测试/内容（如 08004/08005 条目、Peaks 测试、玩家测试 9 张暂缺通过用例），因此上表只用于证明「修复后会如实失败/如实降级」，最终数字以阶段 B 冻结工作区后的重建为准。

### 2.2 「旧账本声称 verified / 独立复核结论」对照（将同步写入 release/migration 账本说明）

| 项 | 旧账本声称（修复前，已签入） | 独立复核结论（`verify/player-b-verify.md` §3/§4、`_ledger-recompute.json`） | 修复后如实口径 |
| --- | --- | --- | --- |
| all-cards | verified：verified 375 / simplified 26 / missing 0 / blocked 0、`everyBehaviorCardHasEvidence=true` | 403 条中 **135 条字面不可追溯**（4 条 b 面假阳性 → 修正 131）；**129 条 scenario-ledger 系统性错配**（全部指向 `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs`、0/129 含卡号）；其中 **110 条卡号在任何 `tests/*.test.mjs` 都不出现**（96 verified + 14 simplified） | 回退必须文件含卡号 token；无证据的卡如实 missing/blocked；`everyBehaviorCardHasEvidence` 改查可追溯证据；gate/status 随之为 pending（如证据不全） |
| player | verified：115/115 verified、simplified 0、`noSimplified=true` | 55/115 条目源码注释自述 approximation、11–12 条有正式 `note:'approximation'`、0 条设 `simplified:true`；10 抽样 9 条明确矛盾 + 08117 行为近似 | 移除 `noSimplified` 空门禁，改为 `simplificationDisclosed`；现状 54–56 张如实标记 simplified（随修复进展变化），`verified` 仅表示有逐卡测试证据 |
| release / migration | `status: verified` / `passed`（P8 发布口径） | 上述两份账本都建立在此前假绿之上 → P8 的「逐卡行为等价」声称不成立 | `releaseAcceptance.equivalenceCertified=false`、`release.equivalence.certified=false`，并登记 `independentAudit` 结论；release/migration 状态如实降级为 pending/failed（阶段 B 重建后写入） |

> 结论（将写入 release 账本 `equivalence.independentAudit` 与 migration 账本 `releaseAcceptance.independentAudit`）：**本仓 P8 旧账本声称 all-cards verified / 115 玩家卡 noSimplified，独立复核为「135/403 字面不可追溯、129 条 scenario-ledger 系统性错配、noSimplified 为空门禁」——该 verified 结论不成立。** 修复后只按可追溯证据重建，不再宣称行为等价。



## 3. 阶段 A 环境限制（如实披露）

阶段 A 执行期间其余 7 个修复 agent 正在并发改 `src/engine/**`、`content/campaigns/edgeOfTheEarth/**`、`src/cards/**` 与测试：

- 执行早期 `src/engine/play-channels.js` 曾出现 `SyntaxError: Illegal return statement`（其他 agent 编辑中间态，20:48 已由 investigators 逐字节重建修复）；`content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js` 曾报 `definition.js does not provide an export named 'ENCOUNTER_DECK_BY_VERSION'`（编辑中间态）；
- `src/engine/engine.js` 因内容侧 `能力条目 08615` 注册校验错误短暂不可 import（heart-peaks 修复中，20:49 恢复）；
- 即使引擎恢复，测试/条目仍持续被并发修改（08004/08005 sha、Peaks 测试、玩家测试 9 张暂缺通过用例），任何 live 账本复算都只是中间态。

因此本阶段对账本语义的验证以「账本内已有实跑快照复算 + 只读探针」为主（§2），live `--check` 预演（§2.1）只作为「修复后必然如实失败/降级」的证据；没有抢先重建任何全量账本（符合任务书阶段 A 约定）。阶段 B 必须等 Lead 通知工作区稳定后再执行。

## 4. 阶段 B 重建记录（2026-11-08 21:14–21:56，Lead「集成改动已完成」后）

### 4.1 重建前后统计（before = 旧已签入账本；after = 本次 --write 产物）

| 指标 | 修复前（旧账本，假绿） | 重建后（如实） | 说明 |
| --- | --- | --- | --- |
| all-cards status | verified | **pending** | gate 由真实缺口决定，不再只看 evidence 非空 |
| all-cards verified / simplified / no-behavior | 375 / 26 / 2 | **248 / 12 / 2** | 旧 129 条 scenario-ledger 假证据清账 |
| all-cards missing / blocked | 0 / 0 | **127 / 14** | 141 张卡无逐卡可追溯证据，逐条登记原因 |
| evidence 构成 | strong 142 / file 132 / **scenario-ledger 129** | strong 142 / file 120 / **scenario-ledger 0** | 回退必须「引用文件含卡号 token」→ 不可追溯的 fallback 全部消失 |
| 证据可追溯性（独立复算 `_ledger-after-phase-b.json`） | 字面 135/403 不可追溯（129 条 scenario-ledger 全指向 HeartPart2、0/129 含卡号） | **262 条 evidence 全部可追溯、invalid=0**；141 张卡无证据照实 missing/blocked | 不再有「有证据但引错文件」的第三条路 |
| scenario 章卡池（unique） | 8 章各 **264**（数组 1848/…/2640，全章集合相同） | **39/55/39/94/42/50/39/43**（去重并集 246，不再相同） | `cardCoverageAssigned` 15312 → 401 |
| player verified / simplified / noSimplified | 115 / 0（只看 flag）/ true | **115 / 54（自述近似逐条披露）/ 门禁改为 simplificationDisclosed** | `verified` 只表示有逐卡测试证据，不等于印刷等价 |
| investigators | verified（存在 sha 漂移） | **verified（9/9 checks true，重签）** | 含 08004/08005 等条目 sha 更新 |
| R1 directStateWrite 基线 | 149 | **164**（+15 检测补漏；08008 `whip.exhausted` 等） | 检测范围扩大，非新增债务；基线 note 已写明 |
| release acceptance | passed | **failed**（missing=`allCards`；`equivalence.certified=false`） | 行为等价未认证，附 `independentAudit` |
| migration 总账本 | verified | **pending**（gates 17/19：`allCards=false`、`releaseAcceptance=false`；remaining=`gate:allCards`、`gate:releaseAcceptance`） | 不再声称 P8 逐卡等价 |
| releaseAcceptance.deferred | 28 | **36**（含 8 条新 p7 请求 + 3 条汇总项） | 新登记：`primitiveRequest:p7-08544/08546/08560/08587/08673/08679/08681/08682`；primitive 请求目录 Mod 副本 25→33 文件 |
| fast / replay 证据 | node acceptance passed（旧）、regression passed（旧） | **node passed 506/506（sourceStable）；regression passed（replay matches、fast 5 条既有失败、additions=[]）** | 重跑生成新鲜证据 |

### 4.2 最终门禁命令 → exit code（逐条实测，证据 `_phase-b-gates.json`）

| 门禁命令 | exit | 结果说明 |
| --- | --- | --- |
| `node tools/audit-card-entry-compliance.mjs --check` | 0 | R1/R2/R3 无基线外新增（基线已按检测补漏重签 164） |
| `node tools/scan-eote-baseline.mjs --check` | 0 | gitHead/rulesVersion/schemaVersion/replay/合规/12 项指标一致；fastFailures=5 条既有失败（见 §4.3） |
| `node tools/scan-eote-scope.mjs --check` | 0 | 复算一致 |
| `node tools/scan-eote-mechanisms.mjs --check` | 0 | 复算一致 |
| `node tools/audit-eote-primitives.mjs --check` | 0 | 复算一致（P2 new 23 项全部 done） |
| `node tools/audit-eote-rules.mjs --check` | 0 | 复算一致 |
| `node tools/audit-eote-interactions.mjs --check` | 0 | 复算一致 |
| `node tools/audit-eote-investigators.mjs --check` | 0 | 复算一致 · verified |
| `node tools/audit-eote-player.mjs --check` | 0 | 复算一致 · verified（54 条 simplified 披露） |
| `node tools/audit-eote-scenarios.mjs --check` | 0 | 复算一致 · 8/8 verified |
| `node tools/audit-eote-all-cards.mjs --check` | **1** | **账本逐字节一致**；gate incomplete（missing 127 / blocked 14 / simplified 12）——诚实状态，不是漂移 |
| `node tools/audit-eote-release.mjs --check` | **1** | **复算一致**；status=failed（missing=`allCards`）、`equivalence.certified=false`——诚实状态 |
| `node tools/audit-eote.mjs --check` | **1** | **复算一致**；status=pending（remaining=`gate:allCards`、`gate:releaseAcceptance`）——诚实状态 |
| `node --test tests/eote-all-cards.test.mjs tests/eote-migration-ledger.test.mjs tests/eote-migration.test.mjs` | 0 | **18/18 pass** |
| `node --test tests/replay-eote-p8.test.mjs` | 0 | 2/2 pass（新 replay 基线） |
| `node tools/verify-eote.mjs --node`（重建后期运行） | 0 | 506/506 pass、sourceStable=true（`audit/eote-node-acceptance.json#status=passed`） |
| `node tools/verify-eote.mjs --regression`（重建后期运行） | 0 | replayExitCode=0、fast 5 条既有失败、additions=[]（`audit/eote-regression.json#status=passed`） |
| 全量 EOTE Node：`node --experimental-test-isolation=none --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs` | 0 | **508/508 pass** |

### 4.3 Lead 侧集成交互与基线修订（本轮，已冻结）

- **replay-eote-p8 基线重采**：`docs/edgeOfTheEarth/eote-scan/repair/regen-eote-p8-baseline.mjs` 基于真实大厅脚本重采 `tests/fixtures/replay/eote-p8-baseline.json`（10 步/3 章；同 seed 两次指纹一致后写盘）。原因=六组 P0 修复有意改变 EOTE state 指纹，属合法基线更新；`verify-eote --regression` 的 replay 对比以新基线为准（实测 replayExitCode=0）。
- **`audit/eote-baseline.json` 重签**：fastFailures 3 → 5。相应把 `tools/scan-eote-baseline.mjs` 的 `FAST_FAILURES` 常量与 `PRE_EXISTING_FAILURES` 说明更新（Lead 裁决授权；fastFailures 由该工具承载）。会话起始控制跑 `docs/edgeOfTheEarth/eote-scan/repair-baseline-fast.txt`（6956/6947/6）中的 6 条里，`P8 eote all-cards 两次构建一致且与账本一致` 已由 P0-11 修复转绿并删去；其余 5 条按标题冻结：P10 账本 2 条、TIC P8 replay、`P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致`（TCU 来源漂移，含本轮 EOTE 已批准的 `src/campaign/campaign.js`（08059）哈希变化；不重签其他循环账本）、`已本地化的 UI 文件不再残留用户可见中文`（既有 web/music-player.js 音乐 mood 中文字段）。complianceBaseline 同步 149→164；replay/eote-baseline.json 的 sha 未改。
- architecture-guard 基线重锁（behaviorLines 32330→33734、content 卡号字面量 1132→1142）、eote-progression browser 结局键、两个卡牌索引重建、`audit/ability-coverage.json` 重生成（behaviorLines=33734 一致）——以上为 Lead 侧改动，本账本只随之重签来源哈希。
- `docs/edgeOfTheEarth/p8-release.md` 顶部新增「2026-11-08 P0 修复轮修订」诚实声明（P8 verified 结论被独立扫描推翻、本轮修复 P0-1..P0-13、下方 P8 段落仅作历史记录）；verify-eote 证据哈希按当前内容重签。
- 因修复轮改动来源，重签了 `audit/eote-scope.json`、`audit/eote-mechanism-scan.json`、`audit/eote-primitive-plan.json`、`audit/eote-rules.json`、`audit/eote-interactions.json`（`--check` 均 exit 0）。

### 4.4 残余风险（如实披露，不得视为已消除）

1. **141 张卡无逐卡可追溯证据**（127 missing + 14 blocked）：129 条旧 scenario-ledger 假证据已清账，但章节测试仍普遍不按卡号逐卡断言（原 110 条卡号在任何测试中不出现的核心问题未由本轮修复消除，只是不再伪证）。release `equivalence.certified=false`、migration pending。下一轮应把逐章测试改为真实引擎路径并按卡号断言；**禁止**用假证据回填 gate。
2. **14 张 blocked 卡依赖 pending P7 原语请求**（p7-08544/08546/08560/08587/08673/08679/08681/08682 等；deferred 36 条已逐条登记，Mod 内请求副本已同步）。
3. **player 115 verified 中有 54 张自述近似**（approximation note/注释逐条披露，`verified` 只表示有逐卡测试证据，不等于印刷等价）；08117 等无自述但行为近似的卡仍需下一轮规则等价性修复。
4. **R1 基线 164 条直写仍存在**（含 08008 `whip.exhausted`）：本轮只把「检测不到」改为「检测得到并登记」，条目仍需下一轮用引擎原语替换直写；基线只能减不能增。
5. **5 条非 EOTE 既有失败按标题冻结**（P10 账本 ×2、TIC P8 replay、TCU 账本漂移、i18n UI 中文）：不属本轮 P0-11 修复范围；TCU 漂移包含本轮已批准的 `src/campaign/campaign.js`（08059）改动与既有 web 改动，本轮不重签其他循环账本，按 Lead 裁决如实记录。
6. `audit/eote-all-cards.json` / `audit/eote-release-acceptance.json` / `audit/eote-migration.json` 的 `--check` 仍 exit 1——这是**诚实的「账本一致但状态未通过」**（命令输出「账本一致/复算一致」），不是漂移，不允许手改证据或降低可追溯性使其变绿。
7. 本仓 P8 旧账本的 verified 声称已被独立复核推翻（§2.2）；重建后账本仅证明「248 张有可追溯证据 / 54 张玩家卡披露近似 / 141 张待补证据」，不构成行为等价认证。

