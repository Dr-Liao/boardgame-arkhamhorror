# 《铁杉谷盛宴》战役迁移（P7 交付说明）

P7 交付战役层 + 12 个场景单元（4 段叙事序曲 + 5 个勘察关 + 2 个夜章 + 终章）、301 条战役记录
（291 个单卡条目 + 10 张 `type=scenario` 参考卡不入条目）、18 个共享遭遇组、240 个战役记录键、
1462 条中英文剧情/指南正文与 12 份阅读者指南。逐章证据见 `audit/fhv-scenario-acceptance.json`，
浏览器证据见 `audit/fhv-scenarios-browser.json`。

## 1. 分层与文件

| 层 | 文件 | 说明 |
| --- | --- | --- |
| 战役层 | `content/campaigns/theFeastOfHemlockVale/{parts,flow,prologue,interludes,epilogue,records,manifest}.js` | 35 节点流程图、三天三夜时间路由（`hemlockDate`＝`day:period`）、4 段序曲整备、5 个勘察关按未勘察区域选择、夜 1/夜 2（勘察或《扭曲空洞》/《最长一夜》）、夜 3 终章、升级窗口/noUpgrade、经验与结局、240 个记录键 |
| 场景层 | `content/campaigns/theFeastOfHemlockVale/scenarios/<id>/{definition,layout,behavior,chaos,index}.js` | 12 个场景：布置、地点/网格/轨道、双面地点与敌人-地点、独立牌库（岩中恐怖/山洞/树林/追击区/深渊）、幕/议程正反面、混乱符号、法典、结局与记录 |
| 遭遇卡 | `src/cards/encounter-entries/theFeastOfHemlockVale/<chapter>/<code>.js`、`_shared/<group>/<code>.js` | 291 个单卡条目（数据型 + 行为型），归属由 `tools/encounter-entry-placement.mjs` 复算一致 |
| 正文/指南 | `content/campaigns/theFeastOfHemlockVale/story-text.js`（生成物）、`story-source/**`（自译层）、`web/scenario-guides/<id>.json` | `tools/import-fhv-story.mjs` 生成 9 文件 1462 叶（en 来自参考工程、zh 来自自译层，`chineseGaps=0`）；`tools/build-fhv-guides.mjs` 生成 12 份指南（0 缺译块） |
| 共享层 | `content/campaigns/theFeastOfHemlockVale/{card-data,story-access,scenarios/index}.js`、`content/packs/fhvCampaign/manifest.js`、`content/registered.js` | `fhvCampaign` 升 `playable`，12 个场景进生产组合根，大厅可启动 |

## 2. 场景与状态机

- 12 个场景 id：`welcomeToHemlockVale`、`writtenInRock`、`hemlockHouse`、`theSilentHeath`、
  `theLostSister`、`theThingInTheDepths`、`theTwistedHollow`、`dawnOfTheSecondDay`、
  `theLongestNight`、`dawnOfTheFinalDay`、`preludeTheFinalEvening`、`fateOfTheVale`。
- 三天三夜：`1:day → 1:night → 2:day → 2:night → 3:day → 3:night`；白天整备保留线索/资源/手牌并
  准备下一次勘察（`survey-preparation.js`）；跳过白日勘察走调度重抽（`interludes.js`）；夜 1/夜 2 二选一；
  夜 3 固定 `fateOfTheVale`。四个 `*Prep` 幕间开放购牌，勘察/夜章/终章 `noUpgrade`。
- 记录：240 键（`records.js#FHV_RECORD_SCHEMA`，含居民关系等级/笔记/划除、法典、勘察区域、传家宝、
  疲劳、未花费经验与 12 章结局键），章节 `recordReads/recordWrites` 全部 ⊆ schema。
- 居民与法典：11 位居民（`_shared/residents`），关系等级 + 笔记 + 划除；法典 1–18（地点/居民/时段条件），
  引擎读点 `scenario-calendar.js#resolveCodex`；章节事件桥（`<chapter>Codex*` / `ResidentParley`）。

## 3. 逐卡口径

- 291 个单卡条目：数据型（地点/幕/议程/剧情资产）只声明身份与印刷数值；行为型（敌人/诡计/剧情资产）
  声明 `enemyRule`/`encounterRule`/`treacheryRule`/`abilities`/`flags`，规则细节在章节 behavior 读点。
- 近似逐条披露：章节 `SIMPLIFIED`/`behavior.approximations` + 条目 `note`；不写假等价、不新增状态字段。
- 未接线原语已登记（P8 前原语批次）：玩家支援附属遭遇卡的行动枚举、敌人伤害值实体修正、
  `brilliance` 计数白名单等。

## 4. 验收命令

```powershell
node tools/plan-fhv-campaign.mjs --check       # 分片/条目队列复算
npm run test:fhv:scenarios                     # 12 章 + 战役层（流程/正文/记录）Node 测试
node tools/import-fhv-story.mjs --check        # 正文生成物复算（chineseGaps=0）
node tools/build-fhv-guides.mjs --check        # 12 份指南复算（0 缺译块）
node tools/audit-fhv-scenarios.mjs --check     # 逐章账本复算（模块/清单/指南/测试/条目/注册/流程/记录/浏览器）
npm run test:fhv:scenarios:browser             # 真实大厅路线，桌面 1440 / 移动 390 各 12 章
npm run verify:fhv:node                        # Node 验收账本（含 campaign 段）
npm run verify:fhv:regression                  # fast 无新增失败 + replay 零漂移
npm run cards:check                            # 索引/一卡一文件/条目合规（含 R1/R2/R3）
node tools/replay-fixtures.mjs --compare tests/fixtures/replay/golden-replays.json
npm run test:fast                              # 全量快速回归（既有 EOTE 2 项单独记账）
```

退出门禁：12 章逐章行为（章测试 + 一卡一条目 + 近似披露）与中英文指南均有证据；
`audit/fhv-scenario-acceptance.json#status = verified`；`fhvCampaign` 升 `playable` 且大厅可启动；
章内定向夹具不代替真实大厅路线（浏览器账本为独立证据）；战役发布验收（完整合法路线、四档难度、
存档恢复、在线/隐私/权限/断线）留 P8。

## 5. 验收结果（P7 收口时实测）

- Node：12 章场景测试同进程 407 例 + 战役层流程/正文/记录 19 例（含终章引擎回归
  `tests/fhv-campaign-engine.test.mjs`：最终夜结算不再递归、真实推进到《山谷的命运》）全绿；
  `audit/fhv-node-acceptance.json` 的 `campaign` 段同步记录。
- 浏览器：真实大厅 → 调查准备 → 出发准备 → 牌桌 → 关间结算/幕间/战役选择 → 下一章，
  桌面 1440×900 与移动 390×844 各 12 章，共 24/24 通过、52 张截图
  （`audit/fhv-scenarios-browser.json#status=passed`、`checks.desktop=true`、`checks.mobile=true`）。
- 逐章账本：`audit/fhv-scenario-acceptance.json#status=verified`，16 项门禁全真（场景测试/12 章
  verified/章内卡条目/指南覆盖与中文化/291 张遭遇卡覆盖/18 个共享组/战役可启动/流程与记录/浏览器
  双视口/正文与指南复算/文档）。
- 卡片：291 个计划内单卡条目 + 1 个章节参考卡数据条目（`fateOfTheVale/10651.js`，scope=`scenario`，
  供本章符号/参考卡读取；不进 291 计划账本）全部一卡一文件，`cards:check` /
  `cards:encounter-check` 通过。
- 回归：全量 `test:fast` 仅保留既有 2 项 P8 EOTE 失败（与 P3 基线一致），replay 与基线逐条一致；
  `verify:fhv:regression` 新增失败 0。

## 6. P8 发布验收（完整迁移确认）

- **总账本**：`audit/fhv-migration.json`（`tools/audit-fhv.mjs --check` 逐字节复算；14 项门禁全真，
  `status: verified`、`playable: true`、`launchEnabled: true`、`earlyAccess: false`、
  `equivalenceCertified: true`；`releaseAcceptance.status = complete`、`deferred = []`）。
- **逐卡**：`audit/fhv-all-card-acceptance.json` 441 行（战役 301 / 调查员与依赖 20 / 玩家 120；
  missing 0、blocked 0；近似逐卡披露、数据型战役卡由章 behavior 承接）。
- **完整战役 E2E**：`tests/fhv-p8-campaign.test.mjs` 8 例（真实 `createGameState`）：两条三天三夜路线
  （勘察顺序不同、夜 1 扭曲空洞/夜探、夜 2 最长一夜/夜探）、居民关系/笔记/传家宝跨章、最终夜 R3
  失败→尾声 defeat、四档难度、4 处关键选择 JSON 往返、同 seed replay 65 步零 diff。
- **发布浏览器**：`audit/fhv-release-browser.json`（3 phase × 桌面 1440 / 移动 390）：真实大厅选战役/选人/
  自动构筑/开局/序曲整备与带支援入场/法典交互/逐日推进/升级窗/终章与尾声，online phase 覆盖多人、AI、
  隐私、权限边界与断线恢复；截图逐张 sha256 入账。
- **素材**：`audit/fhv-assets.json` —— 441/441 图像解析可解析（本地 441、中文 440、unresolved 0），
  运行时对 `参考资源/` 真实读取 0 条，远程回退可用；已知素材项逐条 `disclosed`。
- **回归**：`verify:fhv:node`、`verify:fhv:regression`（fast 无新增失败）、`replay-fixtures --compare`
  零漂移；`cards:check` / `cards:encounter-check` / `audit:entries` / `build-presentation --check` /
  `docs:check` 全部通过。
- **披露**：`remaining` 仅列 108 张近似行为卡（逐卡 note/章节 approximations）与 195 张数据型战役卡
  （章 behavior + 章测试承接）；无阻塞卡、无待实现原语、无未披露近似。

### P8 收口修复（存档恢复）

- src/engine/setup.js#unknownCardCodes：战役进行中的存档会把关卡 StepCode（如《铁杉谷盛宴》10677a/10679a）当作未知玩家卡号，导致「存档管理 → 读取此存档」禁用；P8 发布浏览器验收在第二日黎明存档实测该缺陷。修复为放行 scenario.stepCode/	imeMarker.stepCode/storyFaces[].code 等内容身份卡号，并在 	ests/fhv-campaign-engine.test.mjs 增加「第二日黎明 JSON 存档 → migrateState 可读」回归。
