# P7 战役章节、共享遭遇与战役流程验收（《地球边缘》）

P7 交付《地球边缘》八个章节单元、24 个遭遇组、完整战役流程、中英文指南和真实大厅验收。
本章记录实现边界、接线契约、验收命令与证据账本；逐卡/逐章结论以 `audit/` 账本复算为准，
本文件不手写会随实现漂移的测试数字。

- 战役入口：大厅可选《地球边缘》，从序幕开始，按主线推进至尾声；致命幻景可在幕间 I–III 可选再入。
- 战役清单：`content/campaigns/edgeOfTheEarth/manifest.js`（`status: playable`，含 `flow`、`recordSchema`、混乱袋）。
- 注册：`content/registered.js` 注册 `eoteCampaign` 战役与八个 `scenarios/<id>/index.js`；`content/packs/eoteCampaign/manifest.js` 为 playable（266 条战役记录）。
- 验收账本：`audit/eote-scenario-acceptance.json`、`audit/eote-scenarios-browser.json`、`audit/eote-scope.json`。

## 1. 章节单元

八个单元位于 `content/campaigns/edgeOfTheEarth/scenarios/<chapterId>/`，每个目录含
`definition.js`（内容数据）、`layout.js`（桌面坐标）、`behavior.js`（引擎钩子适配）、`chaos.js`
（混乱标记取值/后果）、`texts.js`（正文入口）、`index.js`（组装 `scenario, identities, layout,
behavior, implementedEncounterCodes, manifest`）。

| 章节 id | 名称 | 提示卡 | 专属遭遇组 | 指南段数（en，含共享篇段） |
| --- | --- | --- | --- | --- |
| `iceAndDeathPart1` | 亡命冰原 I | 08501 | theCrash | 55 |
| `iceAndDeathPart2` | 亡命冰原 II | 08501 | lostInTheNight | 38 |
| `iceAndDeathPart3` | 亡命冰原 III | 08501 | seepingNightmares | 31 |
| `fatalMirage` | 致命幻景 | 08549 | fatalMirage | 68 |
| `toTheForbiddenPeaks` | 失落之峰 | 08596 | toTheForbiddenPeaks | 51 |
| `cityOfTheElderThings` | 古老者之城 | 08621 | cityOfTheElderThings | 94 |
| `theHeartOfMadnessPart1` | 疯狂之心 I | 08648 | theGreatSeal | 79 |
| `theHeartOfMadnessPart2` | 疯狂之心 II | 08648 | stirringInTheDeep | 53 |

- 一卡一文件：战役内跨章复用条目在 `src/cards/encounter-entries/edgeOfTheEarth/_shared/<snake_group>/`，
  关卡专用条目在 `src/cards/encounter-entries/edgeOfTheEarth/<chapterId>/`。08596/08621 为
  `type=scenario` 参考卡（同 TDE 06063 口径），只作数据/身份，不建行为条目。
- 遭遇牌库、放一边、地点/幕/议程/敌人/诡计/剧情资产均由章节 `definition.js` 与单卡条目声明；
  `behavior.js` 只保留流程与共享钩子转发，不按卡号写分支（架构守卫 `test:fast` 复算）。
- 共享遭遇接线：`content/campaigns/edgeOfTheEarth/shared-encounters.js` 提供
  `chapterCardPool()`、`partnerRosterSpec()`、`memorialsSpec()`、`suppliesSpec()`、`tekeliDeckSpec()`、
  `SHELTER_BY_LOCATION_CODE`；16 个共享组由 `_shared/` 条目实现。

## 2. 战役流程

`content/campaigns/edgeOfTheEarth/flow.js` 导出可序列化 `flow`（47 节点）与 `campaignFlowExtras`：

- 序幕（4 段）→ 亡命冰原 I → 检查点 I（有失踪者：搜救 → II / 放弃 → 划去并跳检查点 II）
  → 亡命冰原 II → 检查点 II（逃进群山记录并跳 III / 坚守 → III）→ 幕间 I → 失落之峰
  → 幕间 II → 古老者之城 → 幕间 III → 疯狂之心 I → 检查点 III → 疯狂之心 II → 尾声。
- 致命幻景：三个幕间的门 choice 可进入，`fatalMirageReturn` 按 `completedStep` 回场
  （city 完成 → heart1、peaks 完成 → city，否则 → peaks），每次进入累加 `eoteFatalMirageEntries`。
- 检查点不开放升级；幕间开放升级。升级窗口在 `upgradeWindows` 声明，`interludeFlow: 'continuous'`
  让幕间子图连续读完（含再入幻景门）。
- 战役效果处理器在模块导入时注册：序幕初始化伙伴/物资/封印/伙伴状态镜像；检查点按营地庇护值
  分配失踪伙伴并写入 `eoteShelterValue/eoteMissingCount/eoteMissingPartners`；幕间同步被划去伙伴、
  发放查看奖励 XP；尾声按存活伙伴讲述组合后续（不泄露未达分支）。
- `eoteNextStep()` 与参考实现 `EdgeOfTheEarth.hs#nextStep` 逐条一致；`validateEoteFlow()` 在导入期自检，
  注册期 fail-closed。

## 3. 记录与伙伴/物资

- 记录键：`content/campaigns/edgeOfTheEarth/records.js` 的 `recordSchema` = 参考 `Key.hs` 56 项
  （lowerCamel，引擎记录键不允许下划线/大写首字母）+ 流程层 8 项 + 章节专用 17 项。
- 伙伴：9 位（安全面 08714–08722 / 坚毅面 08587–08595），`partnerStatusesFromRecords` 读取
  `eotePartnerStatuses`；纪念逝者 08730–08738 与 `claimMemorial` 配对。
- 物资 08614–08620、封印 A–E、营地庇护值 13 项由 `records.js` 常量与故事标签驱动。
- 资金/钥匙/寒霜：钥匙走 `src/campaign/eote-seals.js` / `eote-keys` 原语，寒霜是 chaos bag；
  这些不是战役记录，跨章节由场景级扩展与记录镜像共同承担。

## 4. 剧情与指南生成

- `tools/import-eote-story.mjs --write` 生成 `content/campaigns/edgeOfTheEarth/story-text.js`
  （8 章 469 段 = P0 指南 key 数，逐章 55/38/31/68/51/94/79/53；战役序幕/检查点/幕间/尾声/特别规则/
  记录标签；来源锁定 en/zh locale 6 文件，`--check` 逐字节复算）。
- 中文缺译按路径显式标记：`chapters[id].chineseGaps`（`missing`/`untranslated`）与生成物
  `meta.chinese`；运行时只显示已译正文，缺译显示「中文待补」，不以英文冒充中文。
- `tools/import-scenario-guides.mjs` 生成 `web/scenario-guides/<chapterId>.json` 八个指南文件
  （结构照既有产物：`locales.{zh,en}.{intro,setup,specialRules,story,resolutions}` + `chineseGaps`），
  供「关卡设置」面板按 `scenario.id` 加载；特别规则优先展示，后续剧情与结局默认折叠。
- `story-access.js` 是唯一读取入口（`chapterStory/chapterSection/storyText/storyParagraphsOf/
  flattenStory/flattenResolution/campaignStory/resolutionText`），章节 `definition.js`/`texts.js`
  不手抄正文。

## 5. 引擎接线契约

- 章节 `behavior.js` 必须导出引擎真实入口：`preScenarioSetup(state, events, api)` 与
  `setupLocations(state, events, helper)`（返回要由引擎 `placeLocation` 放置的 location id 数组）。
  本章 `setupScenario()` 自行建立全部地点状态时，`setupLocations` 调它后返回 `[]`，避免重复放置；
  使用引擎放置的章节（失落之峰/古老者之城/疯狂之心 I–II）在 `locationPlaced` 等钩子里完成设施/钥匙初始化。
- 章节 behavioral hook 仍走 `scenarioRuntime` 的窄接口；卡条目只读状态、写入只走 `ctx.api`，
  `npm run audit:entries` 复算 R1/R2/R3。
- 共享组登记在 `pack.encounterGroupIds`（24 组）与 `content/campaigns/edgeOfTheEarth/shared-encounters.js`；
  章节 `manifest.requiredEncounterGroupIds` 与 gather 表一致。

## 6. 验收命令与门禁

```bash
# 章节/共享/流程/故事 Node 测试
node --test tests/eote-scenario-*.test.mjs tests/eote-campaign-flow.test.mjs tests/eote-story.test.mjs

# 场景验收账本（实跑测试 + 章节模块 + 指南 + 浏览器账本 + 注册表交叉核对）
node tools/audit-eote-scenarios.mjs --write   # 生成 audit/eote-scenario-acceptance.json
node tools/audit-eote-scenarios.mjs --check   # 逐字节复算

# 真实大厅浏览器验收（桌面 1440 / 移动 390；8 章指南/flow/记录投影）
node tools/run-eote-scenarios-browser.mjs

# 剧情/指南生成与确定性
node tools/import-eote-story.mjs --check
node tools/import-scenario-guides.mjs

# 范围/机制/注册/架构
node tools/scan-eote-scope.mjs --check
node tools/scan-eote-mechanisms.mjs --check
node tools/build-encounter-index.mjs --check
node tools/build-card-index.mjs --check
```

门禁（全部要求）：

- 8/8 章 `verified`：章节模块可加载、地点/幕/议程/遭遇组完整、指南段数 = 生成物、逐章测试有
  `P7 <chapterId>` 证据。
- 264/264 战役行为条目（266 条记录减去 2 张参考卡）与 16 个共享组条目存在且注册。
- 战役注册为 `playable`，`assertLaunchable('edgeOfTheEarth')` 通过，大厅列表可见。
- 指南 469/469 段与 P0 指南来源对齐；中文缺译显式标记；`web/scenario-guides` 八个文件 generated。
- 浏览器账本 `passed`：桌面 + 移动真实大厅启动、8 章指南、章节间 flow、记录跨章投影；章内夹具
  不能代替真实大厅路线。
- `verify-eote --node` 全绿；`verify-eote --regression` 无新增失败且 13 局 replay 零漂移。

## 7. 已知边界（P7）

- 章节内部分印刷随机布置（失落之峰山腰、古老者之城布局/钥匙、设施槽）用确定性顺序 + 可注入
  shuffle 实现，测试可复算；棋盘随机性属 P8 发布层打磨范围。
- 少量地点特殊动作/子效果使用现有原语近似（如冻伤威胁计数、部分地点行动子结算），逐项写在
  章节 `behavior.scenarioApproximations` 与 `artifacts/migration/eote/primitive-requests/p7-*.json`；
  P7 账本不把它们计为「完全等价」。
- 中文正文为参考 zh locale 覆盖 260/469 present-needs-review、10 untranslated、199 missing；
  缺译保留 marker，补译走翻译批次流程，不在实现层机翻。
  **（2026-11-09 更新：翻译修复批次已补齐全部缺译，8 章 469/469、战役 258/258、指南 `chineseGaps=0`；
  见 [`translate/fix-batch.md`](translate/fix-batch.md)。以上为 P7 时点记录。）**
- 战役 P7 只承诺可启动、可完成主线流程与指南证据；P8 才做发布级全卡/全流程审计与随机性打磨。
