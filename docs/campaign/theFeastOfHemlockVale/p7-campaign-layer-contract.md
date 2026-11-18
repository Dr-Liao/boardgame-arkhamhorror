# FHV P7 战役层契约（content/campaigns/theFeastOfHemlockVale 战役流程）

本契约约束「战役层」worker（1 人）：把参考实现的战役流程移植为内容层模块，**不碰引擎与注册表**。
主线由主进程负责：`content/registered.js` 注册、`content/packs/fhvCampaign/manifest.js` 升 playable、
可用性/浏览器/账本/文档。

## 1. 参考来源（只读）

- `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Campaign/Campaigns/TheFeastOfHemlockVale.hs`（25KB：`nextStep`/`doStep`/`CampaignStep` 各分支、结局与记录）
- `.../Campaigns/TheFeastOfHemlockVale/CampaignSteps.hs`（12 个 ScenarioStep 卡号）
- `.../Campaigns/TheFeastOfHemlockVale/Helpers.hs`（18KB：`codex`/居民关系/传家宝/勘察整备/天数推进/疲劳等）
- `.../Campaigns/TheFeastOfHemlockVale/Key.hs`（战役记录键与标签）、`TokenHelpers.hs`（混乱标记）
- 英文指南：`参考资源/.../frontend/src/locales/en/theFeastOfHemlockVale/base.json`（战役规则、4 段序曲、幕间、结局、法典、居民）
- 已有的本地事实源：`audit/fhv-scope.json#campaignFlow`（steps/guide/narrativeOnlySteps/surveyScenarios/surveyTimes/nightOptions）、
  `content/campaigns/theFeastOfHemlockVale/{shared.js,chapters.js,story-access.js,card-data.js}`、
  `content/campaigns/theFeastOfHemlockVale/story-text.js`（正文读取物）。

## 2. 结构范本（只读）

- 战役层范本：`content/campaigns/theScarletKeys/{parts.js,flow.js,prologue.js,interludes.js,epilogue.js,records.js,manifest.js}`；
- 测试范本：`tests/tsk-campaign-flow.test.mjs`、`tests/tsk-story.test.mjs`、`tests/tsk-campaign-*.test.mjs`；
- 引擎通用能力（只读参考，不修改）：`src/campaign/{campaign.js,campaign-flow.js,campaign-parts.js,campaign-effects.js,part-flow.js,story.js,record-sets.js}`、
  `src/engine/{resident-record.js,survey-preparation.js,scenario-calendar.js,chaos-bag.js,scenario-runtime.js}` 等。

## 3. 交付物（只写这些文件）

1. `content/campaigns/theFeastOfHemlockVale/parts.js` — 纯常量/纯函数：
   - 12 个场景 step（含 4 段叙事序曲 `welcomeToHemlockVale`/`dawnOfTheSecondDay`/`dawnOfTheFinalDay`/`preludeTheFinalEvening`）；
   - 三天三夜时间轴（`surveyTimes: day1/night1/day2/night2/day3`）、五个勘察场景与「按未勘察区域选择」规则、
     夜 1/夜 2 选择（`theTwistedHollow`/勘察；`theLongestNight`/勘察）、夜 3 固定 `fateOfTheVale`；
   - `nextStep` 语义（参考 `Campaign.hs#nextStep` 逐字镜像）、状态报告/记录读取辅助、正文键解析辅助。
2. `content/campaigns/theFeastOfHemlockVale/flow.js` — 可序列化流程图 `FHV_FLOW`（节点：序曲/勘察章/夜章/幕间/结局，
   `nextStep` 路由、`upgradeWindows`、`noUpgrade` 窗口、经验结算、惊动/失败分支）+ `campaignFlowExtras`
   （`recordSchema/recordDefaults/recordLabels/unlock/chaosBagTransitions`）+ `validateFhvFlow`。
3. `content/campaigns/theFeastOfHemlockVale/prologue.js` — `campaignStart` 初始化：
   战役混乱袋、居民记录/法典初始状态、勘察轨道、传家宝、未花费经验、起始线索保留等（通过既有 `src/campaign|src/engine` API）。
4. `content/campaigns/theFeastOfHemlockVale/interludes.js` — 4 段叙事序曲 + 三个白日活动（`day_of_rest`/`day_of_rain`/`day_of_the_feast`）
   + 夜探分支 + 幕间/居民访问/法典触发/购牌升级窗口；正文一律走 `story-access.js` 的 section 键（不写死中文）。
5. `content/campaigns/theFeastOfHemlockVale/epilogue.js` — 结局判定（按居民关系/法典/勘察结果/山谷命运记录分支出 `victory|defeat` 与各结局文本）。
6. `content/campaigns/theFeastOfHemlockVale/records.js` — 记录键/标签/默认值/写入读点（Key.hs + base.json#campaignLog + Helpers 读点），
   暴露 `FHV_RECORD_SCHEMA`、`FHV_RECORD_LABELS`、`FHV_RECORD_DEFAULTS`。
7. `content/campaigns/theFeastOfHemlockVale/manifest.js` — 更新为 playable 元数据：`status:'playable'`、`scenarioIds`（12）、
   `flow` 引用、`recordSchema/recordDefaults/recordLabels`、`interludeHandlerId`、`unlock`、`resolutionIds`、`chaosBags`；
   不在本文件写注册表/大厅入口。
8. 测试（内容层，不 import engine.js 加载整局；若必须调用引擎钩子用轻量桩）：
   - `tests/fhv-campaign-flow.test.mjs`（标题以 `P7 campaign ` 开头）：12 场景 step 顺序、三天三夜路由、勘察选择合法性、
     夜 1/夜 2 分支、夜 3 固定终章、升级窗口/noUpgrade、经验与结局分支、flow 图确定性；
   - `tests/fhv-story.test.mjs`（标题 `P7 story `）：story-text 生成物可读、章节 sections/chineseGaps 与 import 工具 --check 一致、
     各场景 intro/setup/resolution 键存在（按 scope guideKeys）；
   - `tests/fhv-campaign-records.test.mjs`（标题 `P7 records `）：记录 schema 与 Key.hs/base.json#campaignLog 覆盖、默认值、
     章末写入与结局读取、居民/法典/传家宝/未花费经验键齐全。

## 4. 约束

- `shared.js` 归主进程维护：需要新增战役层常量时在 `parts.js` 里声明，不改 `shared.js`/`chapters.js`/`card-data.js`/
  `story-access.js`/`story-text.js`（story-text 由 `tools/import-fhv-story.mjs` 生成）。
- 不修改：`src/**`、`content/registered.js`、`content/packs/**`、`tools/**`、`docs/**`、`audit/**`、`content/scenario-guides.js`、
  `web/**`、测试注册表；只写 §3 文件与 3 份测试。
- 中文正文只来自 story-source 自译层（可能仍缺译）：正文键缺失/缺译时返回空串并在 note 标注，不写死中文。
- 每章定向夹具不能代替真实大厅路线（P7 浏览器验收由主进程完成）；你只负责内容层与测试。
- 完成后输出 JSON：`{"flowNodes":N,"records":N,"tests":{"passed":N,"total":N},"simplified":[],"notes":"<=400 字符"}`。
