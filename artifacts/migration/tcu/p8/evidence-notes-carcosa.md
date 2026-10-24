# P8 证据结构调研：卡尔克萨（Carcosa）逐章验收 + 浏览器证据

> 只读调研，产出给 P8（TCU 9 章）实现用。范围：
> `content/campaigns/thePathToCarcosa/**`、`tools/audit-carcosa*.mjs`、`audit/carcosa-*.json`、
> `tests/carcosa-*.test.mjs`、`tests/tfa-scenario-acceptance.test.mjs`、`playwright*.config.mjs`、
> `tools/playwright-tcu-reporter.mjs`、`audit/tcu-browser-acceptance.json`、`tests/tcu-*.browser.mjs`、
> `tools/audit-tcu.mjs`、`audit/tcu-migration.json`、`content/registered.js`、`content/schema.js`、
> `tests/suites.mjs`、`tests/node-suite.mjs`、`docs/tcu-migration-roadmap.md` §7.3/§8/§11、`docs/tcu-rules.md`。
> 现状：TCU 只有 `shared.js / chapters.js / manifest.js / keywords.js`，9 章仍是 `catalogChapters` 占位，
> `assertLaunchable('theCircleUndone')` 必须失败；P8 已产出的输入有
> `artifacts/migration/tcu/p8/scenario-inventory.json`（9 章 + 21 组的逐卡清单）与
> `artifacts/migration/tcu/p8/location-map.json`（每章 `.hs` 文件名 + sha256）。

---

## 1. 卡尔克萨战役内容：文件、形状、与 TFA 的结构差异

### 1.1 文件清单（`content/campaigns/thePathToCarcosa/`）

| 文件 | 行/字节 | 形状与职责 |
| --- | --- | --- |
| `manifest.js` | 158 行 / 6.8K | 战役清单 + **声明式 flow**：`flow.start='prologue'`，节点类型 `story / scenario / interlude / choice / branch / end`；效果是纯数据 `record(key,value)`、`increment(key,amount)`、`{resolution:{scenarioId,value}}` 条件、`branch`、`replaceChaosFamily`、`recordUnion`、`experience`、`campaignRuleFlag`、`privateStory`。顶层键：`schemaVersion id name nameEn contentVersion 0.2.0 minRulesVersion n4.2 status playable requiredPackIds ['core','carcosaCampaign'] scenarioIds unlock chaosBags recordLabels recordSchema interludeHandlerId resolutionIds ['victory','defeat'] campaignWeaknessTransferRecord 'pallidMaskBearer' flow`。序章被折进 `curtainCall`（只记录一次），幕间 I/II 是 `type:'choice'` 节点，尾声是 `privateStory`。 |
| `shared.js` | 69 行 / 3.3K | `CHAOS_BAGS`（easy15/standard15/hard16/expert17，符号三骷髅、不含 cultist/tablet/elderthing）、`chapters`（`id code name sourceName` 8 条）、`recordTypes`（41 键）/`recordDefaults`、`VIP_INTERVIEWED_CODES`/`VIP_SLAIN_CODES`。 |
| `chapters.js` | 42 行 | `buildCatalogChapter(id)` 图鉴占位工厂；**当前是死代码**——`content/registered.js` 导入的是 `scenarios/<id>/index.js` 真模块。 |
| `card-data.js` | 120 行 | 从 `src/cards/cards-data.js` 派生的数据层：`printed / location / stages / encounterCards / encounterDefinitions / encounterDeck / storyCards / identitiesFor / carcosaCards`。`encounterDefinitions()` 里 `rulesPending: false` 是**自证**；关键词布尔（aloof/hunter/massive…）由印刷文本正则推出，`prey/hiddenRule/threatEffect/doomPerInvestigator` 读 `card-rules.js` 条目。 |
| `carcosa-chaos.js` | 219 行 / 10.9K | **战役级**混乱表：`carcosaChaosToken(scenarioId,state,inv,token,api)` 八章共用一份 switch（简单/困难差值、封顶 5、`drawAnother`、`cancelCommitted`、`attackDamageReduction` 等），`carcosaChaosAfterTest(...)` 结算「失败后」的符号后果；辅助 `doomInPlay / locationDistance / stepTowardNearestInvestigator / searchGhoulOrGeist`。 |
| `encounter-rules.js` | 295 行 / 14.3K | **跨章共享遭遇钩子** `encounterRules`：`moveError`（苍白面具共同付线索）、`enemyStatModifier`（国王敕令）、`spawnLocation/spawnFailed/enemyDamageAllowed/enemyEngaged/enemySpawned/enemyDefeated/enemyAttackResolved/hunterMove/afterEvade/locationWillFlip/locationFlipped` 一律转发 `enemyScriptFor/locationRuleFor/treacheryRuleFor`，另有 `encounterActions/performEncounterAction`（尖柱、恶灵作祟、苍白面具、地下墓穴讲师、身后暗影）、`resolveEncounter`、`turnEnded`、`doomCleared`、`locationLeft`、`roundEnded`。每章 behavior 用 `{...encounterRules, id, ...}` 展开。 |
| `story-text.js` | 58K | 生成物（`tools/import-carcosa-story.mjs`）。导出 `CARCOSA_STORY_TEXT`：`source prologue{title,epigraph,common,lola} introductions{8 章: title/common/分支键} resolutions{8 章: noResolution?/r1..r5 段落数组} interludes{interludeOne,interludeTwo} possessedEpilogue{title,paragraphs,private}`；再导出裁剪版 `storyText`（prologue、interludeOne、interludeTwo、possessedEpilogue）供 manifest 与 `dimCarcosa/behavior.js` 使用。 |
| `presentation.js` | 17 行 | 只放 `HIDDEN_LOCATION_ART`（02285–02292 隐藏地点背面共图）。 |
| `story-roles.js` | 15 行 | `CARCOSA_STORY_ROLES`：lola/五位 VIP 的「提供的信息」→ 卡号。 |
| `scenarios/<id>/index.js` | 25 行 | 装配：`export {scenario, identities, layout, behavior}` + `manifest = scenarioManifest(scenario, identities, {campaignId, status:'verified', layout, requiredPackIds, requiredEncounterGroupIds, requiredMechanicIds, setAsideAliases, recordWrites, behaviorIds})`，末尾 `manifest.contentVersion='1.0.0'`。 |
| `scenarios/<id>/definition.js` | 2.5–4.9K | `encounterGroups`（**snake_case** 遭遇组 id）→ `encounterCards()` → `deckCards`（剔除 setAside）→ `encounterDefinitions([...deck, setAside…])` 再 `Object.assign` 修个别敌人关键词；`scenario = {id, originalCode, name, intro, setup, startLocation, setAsideLocations, locations, acts, agendas, enemies, treacheries, encounterDeck, resolutions}`；幕/议程用 `stages(codes,'act'|'agenda')` + `actRuleFor(...).objective` + `reveal:{type:'campaignRule'}`；`identities = identitiesFor(scenario)` + `bindScenarioIdentities(scenario, identities)`。 |
| `scenarios/<id>/layout.js` | 15 行 | 只做展示坐标：`layoutFor(scenario, {locationId:{x,y}})`，`edges` 由规则连接推导（schema 校验 edges ⊆ connections）。 |
| `scenarios/<id>/behavior.js` | 10–25K | 只放钩子：`setupPlan`（`{locations,setAside,removed}`）、`setupLocations/setupEnemies`、`resolveChaosToken`、`locationEntered/locationLeft/locationLeaveTest/locationLeaveFailed`、`turnEnded/roundEnded`、`actReveal/agendaReveal`、`enemyPhaseEnd/enemyDiscarded/enemyDefeated`、`afterTest`、`actions/performAction`、`allResigned`、`resolution`、`storyResolutionKey`（把 `noResolution` 映射到 r1/r2 之类），其余转发共享 `encounterRules` 或 `card-rules` 条目。 |

### 1.2 与 TFA 的结构差异

- TFA 把战役级机制**拆成更多文件**：`keywords.js`、`interludes.js`（幕间效果表）、`record-labels.js`、`supplies.js`、`tfa-chaos.js`（13.8K）、`story-text.js` 125K；Carcosa 只有 `carcosa-chaos.js`、`encounter-rules.js`，幕间效果直接写进 `manifest.flow` 的 `choice.options[].effects`，`recordLabels` 复用 `content/campaigns/research-records.js`，另有 `presentation.js` / `story-roles.js` 两个「从引擎里搬出来的声明表」。
- TFA 每章 `definition.js` 4.6–10K、`behavior.js` 9.7–58K（章内自足）；Carcosa 2.5–4.9K / 10–25K，**通用逻辑集中在 `encounter-rules.js` + `carcosa-chaos.js`**。
- TFA 的 `scenarios/<id>/index.js` 额外声明 `implementedEncounterCodes`（审计用它兜底）；Carcosa 不声明，直接读条目 `implemented`（`src/cards/card-rules.js` 的 `implementedFor`）。
- 两者都保留 `chapters.js` 图鉴工厂，但注册入口都是真模块（`content/registered.js`）。
- Carcosa 的 `storyText` 是裁剪层（4 键：prologue/interludeOne/interludeTwo/possessedEpilogue），manifest 只依赖稳定键；TFA 的 `storyText` 是 8 键（`prologue / interludeOne..Five / resupplyPoint / epilogue`），九章导入正文直接读 `TFA_STORY_TEXT.introductions`。

**Carcosa 更好的地方（TCU 应继承）**

1. 战役级 `tcu-chaos.js` + `encounter-rules.js` 避免九章复制粘贴；`resolveChaosToken` 是单一入口，审计只需 `typeof === 'function'`。
2. `card-data.js` 把「印刷文本」收敛到 `cards-data.js` 一处（`printed()`），definition 不手抄卡文。
3. `scenarioManifest` + `scenarioZoneReport` 是共享契约：区域守恒、重复入牌、卡池数量都在加载期抛错，审计可复算。
4. flow 是**可审计的声明式数据**（record/increment/replaceChaosFamily/recordUnion/privateStory），幕间效果不埋在函数里。
5. `audit-carcosa-all-cards.mjs` 用 `spawnSync(node --test --test-reporter=core-test-reporter)` **实跑**验收、再生成运行时模块（`src/cards/carcosa-campaign-acceptance.js`），这是路线图 §8.3(2) 点名要抄的模式。
6. 逐章账本简单、确定性、带 4 个文件 sha256，`--check` 逐字节。TFA 的 `literalCardBehavior` 靠手写 `SCENARIO_GAPS` 表 + `testSource.includes`，坏账源头。

**Carcosa 的坏账（TCU 必须修）**

- `tools/audit-carcosa-scenarios.mjs` 把 `sourceLocked / literalCardBehavior / saveReplay` 硬编码 `true`，`browserAcceptance` 硬编码 `false`；`status` 计算时**排除** `browserAcceptance`。路线图 §1.4 第 2 条已点名这个自相矛盾。
- 账本无 `gaps / pendingEncounterCodes / testFile`（这三个只有 TFA 有）；TFA 有但 `literalCardBehavior` 8/10 章为 false。
- `rulesPending:false` 是自证字段，不是证据。
- `audit-carcosa.mjs` 的 `remaining` 是**手写数组**（只有一条），不做计算 → TCU 明令禁止。

---

## 2. 卡尔克萨审计工具（可作为模板的部分）

### 2.1 `tools/audit-carcosa-scenarios.mjs`（93 行，P8 的直接模板）

输入（全部运行时计算，不读冻结 JSON）：

- `content/campaigns/thePathToCarcosa/shared.js` 的 `chapters`（id/code/name）。
- 动态 `import('../content/campaigns/thePathToCarcosa/scenarios/<id>/index.js')` → `{scenario, identities, layout, behavior, manifest}`。
- `content/scenario-manifest.js` 的 `scenarioZoneReport(scenario, manifest)`。
- `story-text.js` 的 `CARCOSA_STORY_TEXT.introductions[chapter.id]` / `.resolutions[chapter.id]`。

12 项检查当前实现（逐字）：

| check | 当前判据 |
| --- | --- |
| `sourceLocked` | `true`（硬编码） |
| `identityRegistered` | `Object.values(identities)` 每个 category 的每个 identity 都有 `originalCode` 且 `identityStatus === 'mapped'` |
| `setupAndZones` | `manifest.zones.encounterDeck.length > 0 && Array.isArray(manifest.zones.setAside)` |
| `actsAndAgendas` | `scenario.acts.length > 0 && scenario.agendas.length > 0` |
| `locationsAndConnections` | locations 非空且每个 `Array.isArray(location.connections)` |
| `encounterBehaviors` | enemies/treacheries 每张 `!rulesPending` |
| `literalCardBehavior` | `true`（硬编码） |
| `chaosEffects` | `typeof behavior.resolveChaosToken === 'function'` |
| `resolutionsAndRecords` | `Object.keys(scenario.resolutions).length > 0 && manifest.resolutionIds.length === 该数` |
| `storyText` | 导入 intro 段落拼接 > 20 字、逐段非空且无 HTML；每个结局键要么有导入段落（>20 字、无 HTML），要么 `key==='noResolution'` 且 `typeof behavior.storyResolutionKey === 'function'` |
| `saveReplay` | `true`（硬编码） |
| `browserAcceptance` | `false`（硬编码） |

输出形状：`{schemaVersion:1, campaignId, milestone:'M3', generatedFrom:'original-campaign-only', status, productionGate:'playable', items:[{id, code, name, status, checks{12}, inventory{locations,acts,agendas,enemies,treacheries,encounterCards,setAsideCards,resolutions[]}, fileHashes{definition.js,layout.js,behavior.js,index.js}}]}`。`status` = 除 `browserAcceptance` 外全真 → `verified`。CLI：`--write` 写、`--check` 逐字节比对（漂移抛错）、无参打印；`--write/--check` 后打印 `M3 scenario ledger: X/8 verified; production=...`。

### 2.2 `tools/audit-carcosa.mjs`（286 行）＝「多组账本」生成器

- 输入：`contentRegistry`（三包/战役/关卡状态）、`ALL_CARDS`、`web/rulebook-data.js` 的 `RULES`、以及**读** `audit/carcosa-scenario-acceptance.json` 与 `audit/carcosa-all-card-acceptance.json`；`参考资源/...ThePathToCarcosa` 的 374 个 `.hs` 与 9 个中文剧情 JSON 全部算 sha256 写进 `sources`。
- 产物 `audit/carcosa-migration.json` 顶层 18 键：`schemaVersion milestone campaignId status playable launchEnabled earlyAccess equivalenceCertified verifiedScope catalog investigators chapters sourceRoot sources resources confirmations tests remaining`。
- `confirmations` 6 组：`investigators / playerCards / allCards / scenarios / keywords / rulebook`；`confirmations.scenarios = {status, items:[{id,status,checks{12},evidence[]}]}`，item 状态 = 12 项全真；`evidence` 是**字符串路径数组**（源 `.hs`、账本 `#chapterId`、`scenarios/<id>/index.js`、`tests/carcosa-<id>.test.mjs`、`tests/carcosa-literal-behavior.test.mjs`）。
- 末尾 `assertMigrationConfirmations(report, chapters.map(c => c.id))`（`content/migration-confirmation.js`）强校验：每组 items 非空、id 不重复且与内容清单同序、`checks` 12 个布尔齐全、`status` 必须是 `verified|pending` 且与 checks 一致、`verified` 必须有非空 `evidence`；`playable && !(三组全真) && earlyAccess !== true` 直接抛错。
- CLI：`--write / --check`（逐字节），`--check` 漂移抛「迁移清单或参考来源已漂移」。

### 2.3 `tools/audit-carcosa-all-cards.mjs`（163 行）＝「实跑 + 生成模块」模板

- `spawnSync(process.execPath, ['--test', '--test-reporter=./games/arkhamhorror/tools/core-test-reporter.mjs', ...5 个验收测试], {cwd: repoRoot, env:{...process.env, DSH_HOME: artifacts/carcosa-all-cards/audit-home}, maxBuffer:64MB})`。
- `tools/core-test-reporter.mjs`（10 行）只吐 `{type,name,file,line,skipped,todo}` 的 JSON 行；任何非 `test:pass` / skipped / todo → 退出 1，不写盘。
- 断言总量（383 / 268 / 95）——**数量断言防止范围悄悄缩水**。
- 逐卡 entries：`{code,name,type,pack,partition,status,evidence:[{file,test}]}`；ledger 顶层 `{schemaVersion,profile{id,scope,basis,pendingPolicy,availability,inheritedProfiles,sources},summary{total,verified,pending,investigator,player,campaign,testsPassed},testFiles[{file,sha256}],entries[]}`（实测 383/383、20/95/268、421 条用例）。
- 同时写 `src/cards/carcosa-campaign-acceptance.js`（`PROFILE + SHA256 + verified/pending Set + carcosaCampaignCardVerified(code)`），`--write` 之外一律逐字节比对、过期即 `throw Acceptance artifact stale`。

### 2.4 `tools/audit-carcosa-player.mjs`（115 行）

同模式，额外哈希 `implementationFiles`（`content/packs/carcosaPlayer/effects.js`、`manifest.js`、`src/deck/availability.js`、`src/engine/effects.js`、`src/engine/engine.js`）；对每张卡要求**至少一条逐卡用例**，且用例名不能只是「目录/存在/可构筑/处理器」（`if (titles.every(title => /目录|存在|可构筑|处理器/.test(title))) throw`）——这就是「不许用卡号出现充数」的可执行版本。

---

## 3. Carcosa 多组账本的确切结构（TCU 要照抄的字段）

### 3.1 `audit/carcosa-migration.json`（18 键，多组结构）

```jsonc
{
  "schemaVersion": 1,
  "milestone": "C4",
  "campaignId": "thePathToCarcosa",
  "status": "<contentRegistry.getCampaign().status>",
  "playable": true,                 // ['playable','verified'].includes(status)
  "launchEnabled": true,
  "earlyAccess": true,
  "equivalenceCertified": false,
  "verifiedScope": "<一句话中文范围声明，写明哪些组已验收、哪些仍待>",
  "catalog": { "total": 329, "campaign": 215, "investigatorsAndSignatures": 19,
               "playerCards": 95, "printedRecords": 383, "linkedFaces": 54,
               "verified": 383, "pending": 0 },
  "investigators": ["03001", "..."],
  "chapters": [ { "id", "code", "name", "status", "catalogReferenceOnly" } ],
  "sourceRoot": "参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham",
  "sources": [ { "path": "...hs", "sha256": "..." } ],          // 374 条
  "resources": { "cardCatalog", "storySourceRoot", "storySources":[{path,sha256}],
                 "localImageRoot", "imagePaths":[], "imagePolicy" },
  "confirmations": {
    "investigators": { "status", "items":[{ "id","name","status","checks{9}","signatureCodes","runtimeDependencyCodes?","evidence[]" }] },
    "playerCards":  { "status","total","constructible","basicWeaknesses","ledger","checks{5}","evidence[]" },
    "allCards":     { "status","total","verified","pending","ledger","runtimeGate","pendingCodes[]","evidence[]" },
    "scenarios":    { "status", "items":[{ "id","status","checks{12}","evidence[]" }] },
    "keywords":     { "status", "items":[{ "id","printed","ruleId","cardCodes[]","status","checks{5}","evidence[]" }] },
    "rulebook":     { "status", "requiredRuleIds[]", "checks{campaignOverview,scenarioMechanics,keywordEntries,cardLinks,desktopBrowser,mobileBrowser}", "evidence[]" }
  },
  "tests": ["games/arkhamhorror/tests/....test.mjs"],
  "remaining": ["..."]             // carcosa 是手写；TCU 必须计算
}
```

### 3.2 `audit/carcosa-scenario-acceptance.json`（逐章明细，8 章）

```jsonc
{
  "schemaVersion": 1,
  "campaignId": "thePathToCarcosa",
  "milestone": "M3",
  "generatedFrom": "original-campaign-only",
  "status": "verified",
  "productionGate": "playable",
  "items": [{
    "id": "curtainCall",
    "code": "03043",
    "name": "谢幕",
    "status": "verified",                 // pending | verified（不含 browserAcceptance）
    "checks": {                           // 固定 12 键、固定顺序（= content/migration-confirmation.js SCENARIO_MIGRATION_CHECKS）
      "sourceLocked": true, "identityRegistered": true, "setupAndZones": true,
      "actsAndAgendas": true, "locationsAndConnections": true, "encounterBehaviors": true,
      "literalCardBehavior": true, "chaosEffects": true, "resolutionsAndRecords": true,
      "storyText": true, "saveReplay": true, "browserAcceptance": false
    },
    "inventory": {
      "locations": 10, "acts": 5, "agendas": 2, "enemies": 6, "treacheries": 13,
      "encounterCards": 32, "setAsideCards": 8,
      "resolutions": ["noResolution", "r1", "r2"]
    },
    "fileHashes": { "definition.js": "<64hex>", "layout.js": "<64hex>",
                    "behavior.js": "<64hex>", "index.js": "<64hex>" }
  }]
}
```

TCU 需要在此基础上**加** `gaps: string[]`、`pendingEncounterCodes: string[]`、`testFile: string`（路线图 §8.2 明列），并建议再加
`fallbacks: string[]`（剧情/文案回退，与行为简化分开，避免把 `literalCardBehavior` 拖红）、
`sources: [{path,sha256}]`（本章 `.hs`）、`evidence: string[]`（给 `assertMigrationConfirmations` 用）、
`notes: {checkId: string[]}`（每条 false 的可读原因）。

### 3.3 逐卡账本形状（P8 之后 P10 要照抄的）

- `audit/carcosa-all-card-acceptance.json`：`{schemaVersion, profile{id,scope,basis,pendingPolicy,availability,inheritedProfiles,sources}, summary{total,verified,pending,investigator,player,campaign,testsPassed}, testFiles[{file,sha256}], entries[{code,name,type,pack,partition,status,evidence[{file,test}]}]}`。
- `audit/carcosa-player-acceptance.json`：同上 + `implementationFiles[{file,sha256}]`，entry 多 `class/level/basicWeakness`。

---

## 4. 推荐设计：`tools/audit-tcu-scenarios.mjs`

### 4.1 事实源（全部运行时计算；一条事实一个来源）

| 输入 | 用途 |
| --- | --- |
| `content/campaigns/theCircleUndone/shared.js` 的 `chapters` | 章节顺序、`id/code/name`、**P8 需补 `sourceName`**（`DisappearanceAtTheTwilightEstate` 等，用于 `.hs` 定位） |
| `artifacts/migration/tcu/p8/scenario-inventory.json` | 每章逐卡清单（`chapterGroup.byType`、`cards[].code/type/name/text/mechanisms`）、21 组归属——用于 inventory 与 `pendingEncounterCodes` 的**范围** |
| `artifacts/migration/tcu/p8/location-map.json` | 每章 `{file, sha256}`——`sourceLocked` 的基线；工具仍应直接对 `参考资源/.../TheCircleUndone/<file>.hs` 复算 sha256。**注意覆盖不是 9/9**：`Scenario/Scenarios/TheCircleUndone/` 有 9 个 `.hs`（含 `DisappearanceAtTheTwilightEstate.hs`），`Location/CardDefs/TheCircleUndone/` 只有 8 个（序章无独立地点定义），`location-map.json` 的 `chapters` 也只有 8 个键 |
| 动态 `import('content/campaigns/theCircleUndone/scenarios/<id>/index.js')` | `scenario/identities/layout/behavior/manifest` |
| `content/scenario-manifest.js` `scenarioZoneReport` | 区域守恒、重复入牌、卡池数量（会 throw） |
| `src/cards/card-rules.js`：`implementedFor / actRuleFor / agendaRuleFor / locationRuleFor / enemyScriptFor / treacheryRuleFor / encounterResolveFor` | `literalCardBehavior` / `encounterBehaviors` 的**事实** |
| `src/cards/encounter-abilities.js`：`NON_PLAYER_ABILITY_CODES`、`nonPlayerEntryFor` | 条目是否真存在（不是「卡号出现在文件里」） |
| `content/campaigns/theCircleUndone/story-text.js`（P9 生成；P8 用 `try import` 兜底） | `storyText` |
| `audit/tcu-browser-acceptance.json`（**只读，runner 生成**） | `browserAcceptance` |
| `tests/tcu-<kebab>.test.mjs` | `saveReplay`、逐卡覆盖、`testFile` |

### 4.2 12 项检查的精确算法（TCU 版）

| check | 算法（全部返回 boolean + 可读 `notes`） |
| --- | --- |
| `sourceLocked` | ① `ALL_CARDS[chapter.code].type === 'scenario'`；② `参考资源/.../Scenario/Scenarios/TheCircleUndone/<sourceName>.hs` 必须存在；③ `Location/CardDefs/TheCircleUndone/<sourceName>.hs` 若存在则一并记哈希（序章 `disappearanceAtTheTwilightEstate` 没有该文件，**不能因此判 false**）；④ 所有取到的 sha256 写进 item `sources`（`--check` 逐字节兜底漂移）；⑤ `scenario.originalCode === chapter.code`。参考资源缺失 → `false` + note（不静默通过） |
| `identityRegistered` | Carcosa 原判据（每个 identity 有 `originalCode` 且 `identityStatus === 'mapped'`）**加**：`manifest.locations.every(l => identities.locations[l.id].originalCode === l.frontCode)`、`identities.scenario[scenario.id].originalCode === scenario.originalCode` |
| `setupAndZones` | `zoneReport.encounterCards > 0`、`Array.isArray(manifest.zones.setAside)` 且每个 setAside 卡号在 `ALL_CARDS`、`typeof behavior.setupPlan === 'function'` 或 `setupLocations`；章节测试必须有两份同 seed 状态 `deepEqual`（setup 确定性） |
| `actsAndAgendas` | acts/agendas 非空 + 每张 `reveal` 存在 + `typeof behavior.actReveal === 'function'` 且 `typeof behavior.agendaReveal === 'function'`（TFA 的强口径）+ 卡号在 inventory.byType 里 |
| `locationsAndConnections` | locations 非空、每个 `connections` 是数组且目标存在（schema 已查）、`startLocationId` 在集合里、`layout.edges ⊆ connections`（schema 已查）、TCU 幽灵地点：`normalizeScenarioSpectralLocations` 后 normal/spectral 成对出现（否则 `false` + note） |
| `encounterBehaviors` | ① enemies/treacheries 每张 `!rulesPending`；② 每张 `effect.kind === 'campaignRule'` 的诡计必须满足 `encounterResolveFor(code) \|\| implementedFor(code)`（照 `tests/encounter-handler-guard.test.mjs`）；③ 每个敌人 `fight/evade/health` 有限；④ 有 campaignRule 卡时 `typeof behavior.resolveEncounter === 'function'` |
| `literalCardBehavior` | `pendingEncounterCodes` = 本章 inventory 中 `enemy/treachery/location/act/agenda/storyAsset` 类型且 `!implementedFor(code)` 的卡号；`coveredCodes` = 本章测试通过用例名里正则 `\b(05\d{3}[a-z]?)\b` 命中的卡号；`uncovered` = 应有逐卡证据但未覆盖的卡号（至少 enemy/treachery 必须覆盖）；`literalCardBehavior = pendingEncounterCodes.length===0 && behaviorGaps.length===0 && uncovered.length===0`。**禁止**用 `rulesPending`、文本非空、函数源码含卡号 |
| `chaosEffects` | ① `typeof behavior.resolveChaosToken === 'function'`；② `content/campaigns/theCircleUndone/tcu-chaos.js` 导出 `tcuChaosToken`/`tcuChaosAfterTest` 且对 4 个符号 × standard/hard 返回数字 `delta`（用最小 fixture 调用）；③ `CHAOS_BAGS` 每档 13 枚、`skull×2`；④ 章节测试含印刷取值断言 |
| `resolutionsAndRecords` | ① `Object.keys(scenario.resolutions).length > 0`；② `manifest.resolutionIds` 与键集合、顺序一致；③ `typeof behavior.resolution === 'function'`；④ 每个结局键在章节测试名中出现（`r1|noResolution`…）；⑤ 每个 `manifest.recordWrites` 键在 `shared.recordTypes`（否则 `assertContentBundle` 已先抛）且 `behavior` 写入的键 ⊆ recordWrites（章节测试断言记录落库） |
| `storyText` | ① P9 后有 `TCU_STORY_TEXT.introductions[chapter.id]`：段落拼接 > 20 字、逐段非空、无 `<...>`；② 每个结局键：优先导入段落；否则若 `behavior.storyResolutionKey(state,key)` 返回的键有导入段落则用它（**解析目标键**，不是只查函数存在）；否则用 `scenario.resolutions[key]` 摘要（> 20 字、无 HTML）并写 `fallbacks`；③ 私密尾声（若有）标 `private` |
| `saveReplay` | 从**实跑结果**算：`spawnSync(node --test --test-reporter=./tools/core-test-reporter.mjs, [9 个章节测试])` 的结果里，本章至少一条 `type==='test:pass'` 且名字匹配 `/存档|回放|重放|往返|replay/i`；同时要求本章测试里有 `deepEqual` 型确定性断言（由用例本身保证）。**不用** `testSource.includes` |
| `browserAcceptance` | 读 `audit/tcu-browser-acceptance.json`：`generatedBy` 含 `playwright`、`status==='passed'`；本章在 `tests[]` 里有 `scenarioId===id && viewport==='desktop' && status==='passed'` 与 mobile 各一条；`screenshots[]` 里 desktop/mobile 各一张且**文件在仓库里真实存在**（`artifacts/tcu-migration/…`，`base:'repo-root'`）。文件缺失 → `false`，绝不手写补 |

### 4.3 输出 JSON（建议）

```jsonc
{
  "schemaVersion": 1,
  "campaignId": "theCircleUndone",
  "milestone": "M3",
  "generatedFrom": "original-campaign-only",
  "generatedBy": "tools/audit-tcu-scenarios.mjs",
  "status": "pending",                 // 9×12 全真才 verified
  "productionGate": "development",     // 与战役实际状态一致，不写 playable
  "shared": { "encounter-rules.js": "<sha>", "tcu-chaos.js": "<sha>", "card-data.js": "<sha>" },
  "nodeAcceptance": { "command": "node --test --test-reporter=./tools/core-test-reporter.mjs <9 files>",
                      "status": 0, "tests": 0, "passed": 0, "failed": 0, "ok": true,
                      "files": ["tests/tcu-....test.mjs"] },
  "browser": { "path": "audit/tcu-browser-acceptance.json", "status": "passed",
               "generatedBy": "playwright + tools/playwright-tcu-reporter.mjs",
               "spec": "tests/tcu-scenarios.browser.mjs" },
  "summary": { "total": 9, "verified": 0, "pendingChecks": { "theWitchingHour": ["saveReplay"] },
               "pendingEncounterCodes": 0, "gaps": 0, "fallbacks": 0 },
  "items": [{
    "id", "code", "name", "status",
    "checks": { /* 12 键，顺序 = SCENARIO_MIGRATION_CHECKS */ },
    "notes": { "literalCardBehavior": ["..."] },
    "inventory": { "locations","acts","agendas","enemies","treacheries","storyAssets",
                   "encounterCards","setAsideCards","inPlayCards?","resolutions":[] },
    "pendingEncounterCodes": [], "gaps": [], "fallbacks": [],
    "testFile": "tests/tcu-the-witching-hour.test.mjs",
    "sources": [{ "path": "参考资源/.../TheWitchingHour.hs", "sha256": "..." }],
    "fileHashes": { "definition.js","layout.js","behavior.js","index.js" },
    "evidence": ["参考资源/.../TheWitchingHour.hs",
                 "games/arkhamhorror/audit/tcu-scenario-acceptance.json#theWitchingHour",
                 "games/arkhamhorror/content/campaigns/theCircleUndone/scenarios/theWitchingHour/index.js",
                 "games/arkhamhorror/tests/tcu-the-witching-hour.test.mjs"]
  }],
  "remaining": ["..."],
  "gaps":    ["..."]
}
```

### 4.4 CLI 与 `remaining`

- `--write` / `--check` / 无参打印，与 `audit-carcosa-scenarios.mjs` 同构；`--check` 逐字节比对（**LF**，见 `docs/testing.md` 的换行陷阱）。
- 打印：`M3 scenario ledger: 9 developing · 12 checks · N/M verified · pending encounter cards K · browser desktop/mobile`。
- `--check` 只负责「不许手改 / 不许漂移」；12 项是否全真由 `audit-tcu.mjs` 的 gate 决定（P8 阶段允许 `status:'pending'`）。
- `remaining` 逐条计算（不写死）：
  1. 每章每个 false check：`<id>: <checkId>`（`notes[checkId]` 拼在括号里）；
  2. `gaps` 逐条；
  3. `pendingEncounterCodes` 按章汇总（`<id> 还有 N 张遭遇卡未实现：codes...`）；
  4. `fallbacks` 逐条（剧情正文待 P9）；
  5. 缺浏览器证据：`先跑 npm run test:tcu:browser`；
  6. `!assertLaunchable` 时一条：`大厅实机路径待 P10（9 章与三包需 verified）`。

### 4.5 与 `tools/audit-tcu.mjs` / `audit/tcu-migration.json` 的接线

按 P7 玩家卡的做法（`tools/audit-tcu.mjs:637-661`）：

```js
const scenarioRun = spawnSync(process.execPath, [SCENARIO_ACCEPTANCE_TOOL_PATH, '--check'],
  { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv })
const scenarioLedger = readJson('audit/tcu-scenario-acceptance.json')
```

然后：`confirmations.scenarios` 由 **ledger items** 生成（id/status/checks/evidence/gaps/testFile），绝不复制冻结结论；
`verifiedScope.scenarios = items.length===9 && items.every(i => Object.values(i.checks).every(Boolean))`；
新增 gate `scenariosVerified`；`remaining` 吸纳 ledger 的 `remaining`；`evidence.files` 加 ledger/tool/章节测试哈希；
`tests` 用现有 `readdir` 正则 `^tcu-.*\.test\.mjs$` 自动收录章节测试，另外把 `tests/tcu-scenarios.browser.mjs` 加进
`BROWSER_SPEC` 的 `.concat(...)`（`tools/audit-tcu.mjs:716-720`）。

---

## 5. 浏览器验收：现状、启动方式、JSON 形状、坑

### 5.1 配置与启动器

- `playwright.config.mjs`（基础，全循环共用）：`testDir: ./tests`、`testMatch: '**/*.browser.mjs'`、`workers:1`、`channel:'msedge'`（复用系统 Edge，不下载内核）、`baseURL: http://127.0.0.1:8799`、`webServer: {command:'node server.js', cwd: <repoRoot>, env:{BOARDGAME_PORT, DSH_HOME: games/arkhamhorror/test-results/browser-home}}`。
- `playwright.tcu.config.mjs`：`...base` + `reporter: [['list'], [tools/playwright-tcu-reporter.mjs]]` + `metadata:{milestone:'P4', campaignId:'theCircleUndone'}`。
- 脚本现状：`test:tcu:rules:browser`（只跑 `tcu-rules.browser.mjs`）、`test:tcu:interactions:browser`（跑 rules + interactions）。**没有**一个脚本同时跑三个 spec。

### 5.2 浏览器里怎么「真开局」

1. `page.goto('/index.html')` → 点 `.bg-card`（文本 `诡镇奇谈`）→ 对话框 `调查准备设置` → `开始新游戏` → `POST /api/start` `{modId:'arkhamhorror', settings:{...}}`。
2. 仓库根 `server.js` 转给 mod：`games/arkhamhorror/index.js:268-269`
   `createState(settings, players) { return createGameState({...settings, campaignHub: settings.legacyAutoStart !== true}, players) }`
   - `campaignHub:true`（默认）→ 进入 `.ah-hub` 战役大厅，再用 `hubSelectScenario` / `hubBeginScenario` 选关（见 `src/engine/hub.js:247-263`、`src/engine/dispatch.js:292`）。
   - `legacyAutoStart:true` → **跳过大厅直接进第一关**（`scenarioOrder[0]`），播「故事导入 → 密谋揭示 → 换牌」。
3. `createGameState` 第一行就是 `contentRegistry.assertLaunchable(settings.campaignId || listCampaigns()[0].id)`（`src/engine/setup.js:305`）；`content/schema.js:10` `LAUNCHABLE = {playable, verified}`；`development` **不可启动**。
4. 大厅列表 `campaignListForUi`（`content/registry.js:75-78`）只保留 `assertLaunchable` 通过的战役 → `development` 的 TCU **不会出现在大厅**。
5. 因此**不存在** dev-only 启动开关：本仓库里没有 `window.__DSH_BOOT__`（那是 DSH Web GUI 壳的全局，不是这个大厅）、没有 debug hook、没有 dev 查询参数；测试能进游戏只有两条路——真服能启动的战役，或拦截 `**/api/start` 用 Node 建好的 session 顶包。

测试里的三种既有写法：

- **真服 + 改设置**：`page.route('**/api/start', r => r.continue({postData: JSON.stringify({...body, settings:{...body.settings, seed, playerCount, legacyAutoStart:true}})}), {times:1})`（`choices.browser.mjs:3-28`、`campaign.browser.mjs:4-13`）。
- **本地建 session + 顶包**：`createGameState(...)` → `viewState/legalMoves/viewEvents` → `route.fulfill('**/api/start', {json:{ok:true,session}})`、`**/api/session?*` 同款、`**/api/move` 直接 `applyMove`（`play-freeze.browser.mjs:12-28`、`p3-table.browser.mjs`、`p5-map.browser.mjs`）。
- **组件级 harness**：`tcu-interactions.browser.mjs` 在真实页面上 `import('/mods/arkhamhorror/tcu-ui.js')` + `page.evaluate(harness, payload)`，payload 由 Node 侧引擎/原语现场产出；文件头注释已诚实声明「不是实机路径，实机路径 P8 后补」。

`tcu-rules.browser.mjs` 用的是真服（`start()` = 大厅 → 调查准备设置 → 开始新游戏 → `.ah-hub`），因为规则书在大厅就能开（F1），不依赖 TCU 可启动。

### 5.3 报告器与 JSON 形状

`tools/playwright-tcu-reporter.mjs`（91 行）：

- `onTestEnd`：只收 `spec` 匹配 `/tcu-.*\.browser\.mjs$/` 的用例 → `{title, spec, file, viewport, expectedStatus, status, retry}`（`viewport` 由标题里是否含 `mobile` 决定）；截图来自 annotation `{type:'screenshot', description:<绝对路径>}` → `{name: '<spec 去 .browser.mjs>-<viewport>', path:<repo 相对>, base:'repo-root', viewport, spec}`。
- `onEnd`：排序 → `checks.desktopBrowser = passed && 有 desktop 用例 && 有 desktop 截图`，mobile 同理 → 写 `audit/tcu-browser-acceptance.json`：`{schemaVersion, generatedBy:'playwright + tools/playwright-tcu-reporter.mjs', spec:'tests/tcu-rules.browser.mjs', specs:[...], milestone:'P4/P5', campaignId, status, screenshotBase:'repo-root', checks{desktopBrowser,mobileBrowser}, tests[], screenshots[]}`。
- 现有产物：6 条用例、4 张截图、`specs:[tests/tcu-interactions.browser.mjs, tests/tcu-rules.browser.mjs]`、两个 check 均 true。
- `tools/audit-tcu.mjs:426-459` 消费它：`reportPresent / generatedByRunner / specReported / statusPassed / tests / rulesDesktop / rulesMobile / interactionsDesktop / interactionsMobile / screenshotsComplete`（截图必须真实存在于仓库根 `artifacts/`）。

**必须修的三个坑（P8 加 `tests/tcu-scenarios.browser.mjs` 时会踩）**

1. **顶包覆盖**：报告器每次 `onEnd` 无条件重写同一个 `audit/tcu-browser-acceptance.json`。单独跑 `tcu-scenarios.browser.mjs` 会把 rules/interactions 证据抹掉 → `audit-tcu.mjs` 的 `rulebookVerified`/`interactionsVerified` 直接变 false。解决：① 新增 `"test:tcu:browser": "playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs"` 并规定账本只由这一条命令生成；② 报告器改成**合并**：`onEnd` 先读旧 JSON，保留 `spec` 不在本次 `specs` 里的 tests/screenshots，再重算 checks（排序后逐字节稳定）。
2. **无法归章**：`name` 只由 spec+viewport 生成（9 章 × 2 视口会重名），tests/screenshots 都没有 `scenarioId`。解决：用例里 push `{type:'scenario', description: chapter.id}` annotation，报告器写进 `tests[].scenarioId` / `screenshots[].scenarioId`，`name` 改用截图文件 basename；顶层 `spec` 改为 `specs.length===1 ? specs[0] : 'tests/tcu-*.browser.mjs'`（现在硬编码成 rules，语义已错）。
3. **截图路径**：必须落在仓库根 `artifacts/tcu-migration/`（`../../../artifacts/...` 相对 `tests/`），因为审计按 `base:'repo-root'` 解析；放 `test-results/` 不算证据（`test.info().attach` 会被复制进 `test-results/`，不要用）。

### 5.4 P8 可用的「真实路径」两种方案

**方案 A（P8 推荐，可复现且不谎报状态）**：Node 侧合成可启动包 + 真引擎建局，浏览器顶包。

```js
// tests/tcu-scenarios.browser.mjs（示意）
import { registerContentBundle } from '../content/registered.js'
import * as tcuCampaignPack from '../content/packs/tcuCampaign/manifest.js'   // status 改 playable 的副本
import * as chapter from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/index.js'
import { manifest as campaign } from '../content/campaigns/theCircleUndone/manifest.js'

registerContentBundle({
  packs: [{ ...tcuCampaignPack.manifest, id: 'tcuP8Pack', status: 'playable' }],
  campaigns: [{ ...campaign, id: 'tcuP8Campaign', status: 'playable',
    scenarioIds: ['theWitchingHour'], unlock: { theWitchingHour: [] },
    requiredPackIds: ['core', 'tcuP8Pack'],
    flow: { start: 'theWitchingHour',
            nodes: { theWitchingHour: { type: 'scenario', scenarioId: 'theWitchingHour', next: 'end' },
                     end: { type: 'end' } } } }],
  scenarios: [{ ...chapter, manifest: { ...chapter.manifest, id: 'theWitchingHour',
    campaignId: 'tcuP8Campaign', status: 'playable',
    requiredPackIds: ['core', 'tcuP8Pack'], requiredEncounterGroupIds: [],
    requiredMechanicIds: [] } }],
})
// ⚠️ ESM 提升：必须在 registerContentBundle 之后**动态** import 引擎
const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')
const state = createGameState({ campaignId: 'tcuP8Campaign', legacyAutoStart: true,
  playerInvestigator: '05001', seed: `tcu-p8-${id}` }, [{ seat: 0, role: 'human', name: 'player' }])
// settle pendingChoice（换牌/选人）→ session = {sessionId, modId, modName, players, render:{kind:'cards'},
//   state:{...viewState(state,0), legalMoves: legalMoves(state)}, events: viewEvents([],0)}
await page.route('**/api/start', r => r.fulfill({ json: { ok: true, session } }))
await page.route('**/api/session?*', r => r.fulfill({ json: { ok: true, busy: false, session } }))
await page.route('**/api/move', r => { applyMove(state, 0, r.request().postDataJSON().move); /* 重算 session */ })
await page.goto('/index.html'); /* 点卡 → 开始新游戏 → 跳过演出 */
// 断言章节名/地点/幕/议程可见；截图 artifacts/tcu-migration/p8-<chapter>-<viewport>.png
test.info().annotations.push({ type: 'scenario', description: id })
test.info().annotations.push({ type: 'screenshot', description: shot })
```

- 真实的部分：真引擎建局（setup/遭遇牌堆/混乱袋/地点/幕议程）、真浏览器渲染、真 legalMoves 提交、真截图。
- 合成的部分：包/战役状态（为绕过 `assertLaunchable`）。
- 必须在账本 `fallbacks`/`remaining` 记一条：`大厅实机路径（playable 后的真入口）属 P10`。
- 参考先例：`tests/carcosa-pending-encounters.test.mjs:12-58`（`registerContentBundle` + **之后**才 `await import` engine）、`tests/play-freeze.browser.mjs`（顶包 + 本地 applyMove）。

**方案 B（P10 才有）**：把战役 + 9 章 + 三个包提到 `playable`，用 `tfa-rules.browser.mjs:9-16` 的 `start()` 进大厅，再 `hubSelectScenario`，这才是路线图 §8.4 的「大厅可见 + 桌面/移动通过 → playable」。

---

## 6. `tools/audit-tcu.mjs` 现在怎么算 milestone / verifiedScope / gate / remaining

现状（P7 完成态，`audit/tcu-migration.json` 32 键）：

- `milestone: 'P7'`、`stage`、`generatedBy:'tools/audit-tcu.mjs'`、`docs`（`tools/audit-tcu.mjs:897-904`，硬编码常量）。
- `verifiedScope`（`:921-930`）：`{milestone:'P4–P7', keywords, rulebook, interactions, investigators, scenarios:false, playerCards, story:false}`——**`scenarios` 与 `story` 是硬编码 false**。
- `confirmations.scenarios: []`（`:944`）——P8 的落点。
- gate（`:724-859`）共 19 组，全部 `pass` 才 `pass`；与剧本相关的四组现在都是「必须不可启动」：
  - `campaignCatalogOnly`（`:760-765`）：`status==='catalog-only' && scenarios.length===9`；
  - `chaptersNotLaunchable`（`:767-770`）：9 章都 `catalog-only && !launchable`；
  - `launchBlocked`（`:766`）：`assertLaunchable` 抛错才算 pass；
  - `packsByPhase.campaign`（`:738-742`）：`status==='catalog-only'` 且 `rulesImplemented === STORY_INVESTIGATOR_CODES.length`（4）。
- `remaining`（`:862-893`）是**计算**的（这是 TCU 的既有优点），但与剧本相关的四条是写死措辞：
  - `:870-871` `<N> 章仍是 catalog-only（P8 剧本）：逐章 12 项验收尚未建立`；
  - `:881` `<N> 张战役卡没有单卡行为：M3（P8）逐章验收`（N = 237 − campaign pack `rulesImplemented`，现为 233）；
  - `:890-891` 交互实机路径待 P8；
  - 另有 `:886` 记录键 < 64（P9）。
- `readyJson/--check`：`:1067-1083`，逐字节比对，漂移打印变化键名。

### 6.1 P8 必须改的确切位置

| 位置 | 改动 |
| --- | --- |
| `tools/audit-tcu.mjs:55-90` 常量区 | 加 `SCENARIO_LEDGER_PATH='audit/tcu-scenario-acceptance.json'`、`SCENARIO_ACCEPTANCE_TOOL_PATH='tools/audit-tcu-scenarios.mjs'`、`SCENARIO_SPEC_PATH='tests/tcu-scenarios.browser.mjs'`、`SCENARIO_LEDGER_TEST_PATH='tests/tcu-scenario-acceptance.test.mjs'`、章节测试 glob |
| `:144-160`（`scenarios` 映射） | 每章加 `gaps/pendingEncounterCodes/checks` 摘要（从 ledger 读），保持「不复制冻结结论」——`scenarios` 仍从 `contentRegistry` 生成，只补 ledger 的计算结果 |
| `:470` 之后（规则书/交互块之后） | 新增 `// ---- 剧本（P8 · M3）`：`spawnSync(node tools/audit-tcu-scenarios.mjs --check)` + `readJson(SCENARIO_LEDGER_PATH)` + `scenarioItems`（9）+ `scenarioPending` + `scenarioStatus` |
| `:637-661` | 照玩家卡模式（先实跑工具、再读它刚校验过的账本） |
| `:724-859` gate | ① 新增 `scenariosVerified`（9 项、12 检查、ledger 哈希、浏览器证据）；② `campaignCatalogOnly` 改名/放宽为「未启动」：`status ∈ {catalog-only, development} && launchBlocked`；③ `chaptersNotLaunchable` 接受 `development` 且要求 `assertLaunchable` 仍失败；④ `packsByPhase.campaign` 改成 `status ∈ {catalog-only, development}` + `rulesImplemented` 由条目计算；⑤ `packsByPhase.pass` 同步 |
| `:862-893` remaining | 删掉 4 条写死措辞，改为吸纳 ledger `remaining`（每章每 check、gaps、pendingEncounterCodes、缺浏览器证据）；保留「大厅实机路径属 P10」一条 |
| `:897-957` 报告 | `milestone:'P8'`、`stage:'第 5 步：批量迁移内容 · M3 剧本'`、`verifiedScope:{milestone:'P4–P8', scenarios:<计算>}`、`confirmations.scenarios:{status, items}`（item 满足 `assertMigrationConfirmations` 的 12 检查 + `evidence`） |
| `:1019-1046` evidence.files | 加 `decisions`：`SCENARIO_LEDGER_PATH`、`SCENARIO_ACCEPTANCE_TOOL_PATH`、`SCENARIO_LEDGER_TEST_PATH`、9 个章节测试、`tests/tcu-scenarios.browser.mjs`、`content/campaigns/theCircleUndone/scenarios/**` 之外再哈希 `tcu-chaos.js`/`encounter-rules.js` |
| `:716-720` tests 清单 | 现有 `^tcu-.*\.test\.mjs$` 会自动收章节测试；把 `SCENARIO_SPEC_PATH` 加进 `.concat(...)` |

另外三处**非 audit** 但同一次提交必须改：

- `content/registered.js:30-34, 55-61`：9 个 `import * as` 真模块替换 `...catalogChapters`（否则重复 ID 或仍是占位）。
- `content/packs/tcuCampaign/manifest.js:37`：`rulesImplemented: implementedCodes.has(code)` 的 `implementedCodes` 目前只有 4 位故事调查员；P8 必须改成由条目计算（`NON_PLAYER_ABILITY_CODES` / `implementedFor` 的 05 段），否则 `remaining` 永远有「233 张战役卡没有单卡行为」。
- `content/campaigns/theCircleUndone/shared.js`：`chapters` 补 `sourceName`；`recordTypes` 补齐 9 章 `recordWrites` 用到的键（`assertContentBundle` 会对未声明键直接 fail——**P8 与 P9 的硬边界**）。
- `tests/tcu-migration.test.mjs:71-86, 91`：现在断言 `catalog-only` + `milestone==='P7'`，P8 改成 `development` + 仍 `assertLaunchable` 失败 + `milestone==='P8'`。

---

## 7. 测试分层与 `npm run test:tcu:scenarios`

- **唯一分层清单**是 `tests/suites.mjs`（`FAST_TESTS / SLOW_TESTS / ASSET_TESTS`），`tests/node-suite.mjs` 是串行入口（逐行 `import './x.test.mjs'`）；`tests/suite-manifest.test.mjs` 强制：三个 tier 不重叠、tier 集合 == node-suite 集合 == 磁盘上所有 `*.test.mjs`（除它自己）。**新增 1 个 `.test.mjs` 必须同时改两处**，否则任何 tier 一开跑就红。
- tier 执行：`tools/run-tests.mjs <tier>` = `node --test tests/suite-manifest.test.mjs <该 tier 文件...>`（先跑守卫，再并行跑文件；`fast` 约 94s）。
- 浏览器 spec 不进 suites（`testMatch:'**/*.browser.mjs'` 自动发现）。
- 建议 P8 新增 10 个 `.test.mjs`（1 ledger + 9 章）全部放 `FAST_TESTS` + `node-suite.mjs`；单章测试照 `tests/carcosa-opening.test.mjs` 的写法（直接 import 章节模块、自造 state、seeded `setupApi`、两份状态 `deepEqual` 证明确定性、`resolveChaosToken`/`resolution` 断言记录落库），每个 < 1s。
- `package.json` 建议：

```jsonc
"test:tcu:scenarios": "node --test tests/tcu-scenario-acceptance.test.mjs tests/tcu-disappearance-at-the-twilight-estate.test.mjs tests/tcu-the-witching-hour.test.mjs tests/tcu-at-deaths-doorstep.test.mjs tests/tcu-the-secret-name.test.mjs tests/tcu-the-wages-of-sin.test.mjs tests/tcu-for-the-greater-good.test.mjs tests/tcu-union-and-disillusion.test.mjs tests/tcu-in-the-clutches-of-chaos.test.mjs tests/tcu-before-the-black-throne.test.mjs",
"audit:tcu:scenarios": "node tools/audit-tcu-scenarios.mjs --check",
"audit:tcu:scenarios:write": "node tools/audit-tcu-scenarios.mjs --write",
"test:tcu:scenarios:browser": "playwright test --config playwright.tcu.config.mjs tcu-scenarios.browser.mjs",
"test:tcu:browser": "playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs",
"test:tcu": "node --test tests/tcu-migration.test.mjs tests/tcu-rules.test.mjs tests/tcu-interactions.test.mjs tests/tcu-investigators.test.mjs tests/tcu-player-m2-1.test.mjs tests/tcu-player-m2-2.test.mjs tests/tcu-player-m2-3.test.mjs tests/tcu-player-m2-4.test.mjs tests/tcu-player-ledger.test.mjs tests/tcu-scenario-acceptance.test.mjs"
```

（`test:tcu` 目前**不存在**，而路线图 §8.1/§8.2 与发布门禁都引用它——P8 顺手补上。）

`tests/tcu-scenario-acceptance.test.mjs` 应断言：ledger `milestone==='M3'`、`generatedFrom==='original-campaign-only'`、items id 顺序 == `chapters`；每项
`Object.keys(checks)` 严格等于 `content/migration-confirmation.js` 的 `SCENARIO_MIGRATION_CHECKS`（防 12 项漂移）；`fileHashes` 4 键 64hex；
`inventory` 各项 > 0；`Array.isArray(gaps/pendingEncounterCodes)`；`existsSync(item.testFile)`；
`spawnSync(node tools/audit-tcu-scenarios.mjs --check).status === 0`；
`literalCardBehavior === (pendingEncounterCodes.length===0 && gaps.length===0 && uncovered.length===0)`；
`browserAcceptance` 与 `audit/tcu-browser-acceptance.json` 独立重算结果一致（账本不能自说自话）。

---

## 8. 差距与风险（会让 12 项「无法验证」的具体条件 + 务实选项）

| # | 风险 / 会让检查失效的条件 | 务实选项 |
| --- | --- | --- |
| 1 | **`sourceLocked` 依赖仓库外 `参考资源/`**（不在 `games/arkhamhorror` 内；clean checkout 可能没有）。Carcosa/TFA 审计已同样依赖它。另：`Location/CardDefs/TheCircleUndone` 只有 8 个文件，序章没有地点定义文件，不能按 9/9 硬判。 | 直接对 `参考资源/.../TheCircleUndone/<sourceName>.hs` 复算 sha256；`Scenario/Scenarios` 必查、`Location/CardDefs` 可选；缺失时判 `false` + note，绝不默认 true。已提交的 `artifacts/migration/tcu/p8/location-map.json` 只作交叉核对（不是事实源，且只覆盖 8 章）。 |
| 2 | **`literalCardBehavior` 不可用「卡号出现」充数**（路线图 §8.3(5)）。TCU 234 张战役卡若只声明 `implemented` 而没有逐卡用例，检查会永远 false。 | 用「通过用例名里的卡号」作为覆盖证据（Carcosa `carcosa-literal-behavior.test.mjs` 的标题风格），并要求 `implementedFor(code)`；两者缺一即 `false` 并进 `pendingEncounterCodes`/`uncovered`。分批推进：M3-1 三章先全绿，其余章 `pending`。 |
| 3 | **`saveReplay` 用 `testSource.includes('JSON.stringify')` 就是 TFA 坏账**。 | 用 `spawnSync` 实跑章节测试 + 用例名匹配 `/存档|回放|重放|往返|replay/i`；再加一条硬要求：章节测试内含两份同 seed 状态 `deepEqual`（setup/结局确定性）。 |
| 4 | **`browserAcceptance` 会被单 spec 运行覆盖**（报告器无条件写同一文件），且无法按章归属。 | 先改报告器：合并旧 JSON + `scenario` annotation → `scenarioId` + `name` 用路径 basename；规定 `npm run test:tcu:browser` 一条命令生成；审计校验截图文件真实存在。 |
| 5 | **大厅实机路径在 P8 不可达**：`assertLaunchable` 只认 `playable|verified`，`campaignListForUi` 过滤非启动战役，`createGameState` 直接抛。 | P8 用方案 A（合成可启动包 + 真引擎 + 顶包）拿真渲染证据，`fallbacks` 记「大厅路径待 P10」；P10 用方案 B 换真入口并删掉该条。**不要**为 P8 提前把战役改成 `playable`（路线图 §11.2/§11.3 明确禁止）。 |
| 6 | **`storyText` 依赖 P9**：P8 若 `import story-text.js` 会直接构建失败；若全用摘要又等于没验收正文。 | P8 只依赖 `scenario.intro`/`scenario.resolutions` 摘要（Carcosa 的 definition 就带摘要），P9 落地后 `storyText` 自动优先用导入正文；摘要回退写 `fallbacks`（**不要**写 `gaps`，否则 `literalCardBehavior` 被剧情拖红——`gaps` 只留行为简化）。用 `behavior.storyResolutionKey` 解析目标键后再验证段落，而不是只查函数存在。 |
| 7 | **`recordTypes` 键不够会让注册直接失败**：`assertContentBundle` 对 `recordWrites/recordReads` 的每个键要求已在 `campaign.recordSchema`。P8 写九章必然用到大部分 64 键。 | P8 在 `shared.js` 补键与类型（路线图 §7.6 已给清单），P9 只补中文 label 与剧情；`remaining` 继续算「记录键 < 64」直到 P9。 |
| 8 | **`encounterBehaviors` 的 `rulesPending` 是自证**；`campaignRule` 诡计若没落点会静默无事发生。 | 用 `tests/encounter-handler-guard.test.mjs` 同一判据：`effect.kind==='campaignRule'` ⇒ `encounterResolveFor(code) \|\| implementedFor(code)`。 |
| 9 | **幽灵地点/双面地点**：TCU 大量 normal/spectral 成对地点，若 `locations` 只写一半、或 `locationVariants` 运行期换位，`locationsAndConnections`/`identityRegistered` 会假绿。 | 审计要求 normal/spectral 成对 + `frontCode/backCode` 与 `identities` 一致；运行期变体必须有章节测试覆盖（参考 TFA `theCityOfArchives` 的 gap 教训）。 |
| 10 | **账本漂移**：`fileHashes` 让任何 behavior 改动都要 `--write`；Windows CRLF 会导致 `--check` 永久 fail。 | 账本一律 LF 写出（`docs/testing.md` 已有警告）；重生成顺序（沿用 P7 的脚本命名）：章节测试绿 → `npm run audit:tcu:scenarios:write` → `npm run audit:tcu`（= `audit-tcu.mjs --write`）→ `npm run audit:tcu:check`。 |
| 11 | **`assertMigrationConfirmations` 的 `status` 语义**：item `verified` 必须 12 项全真（含 `browserAcceptance`）。P8 若某章浏览器证据缺失，item 只能是 `pending`，`confirmations.scenarios.status` 也就 `pending`。 | 让 gate 与 milestone 分离：P8 的完成判据是「9 章 `development` + 12 项有证据（`pending` 项列清原因）」，`status:'verified'` 留给 P10；`verifiedScope.scenarios` 由 12 项计算，别手写。 |
| 12 | **P8 输入已存在但非事实源**：`p8/scenario-inventory.json` / `location-map.json` 是 `develop/gen-*.mjs` 生成的派生物。 | 审计只把它们当「范围清单」交叉核对（数量、卡号集合），卡文与实现状态仍从 `cards-data.js` + 条目读；生成脚本改动会让账本 `sourceLocked` 哈希漂移，正好被 `--check` 抓到。 |
