# 七循环《地球边缘》迁移路线图

英文名：Edge of the Earth。战役标识：`edgeOfTheEarth`；本轮工具及审计简称：`eote`；来源战役编号：`08`。

建立日期：2026-11-03。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。P0（锁定范围与基线）2026-11-07 完成，P1–P8 已于 2026-11-08 全部完成并发布：战役、五位调查员与一般玩家卡均已开放，`audit/eote-migration.json` 为 verified 的发布总账本，发布记录见 [P8 发布验收记录](p8-release.md) 与 §16。

复算输入计划签入 `audit/eote-{scope,mechanism-scan,primitive-plan,primitive-catalog}.json`；大厅根目录 `artifacts/migration/eote/` 保存运行镜像与过程资料，继续忽略，不放开整个目录。

## 1. 依据与打勾规则

遵循[内容迁移规范](../arkham-content-migration.md)、[架构与修改约定](../../ARCHITECTURE.md)、[一卡一文件操作手册](../card-entry-files.md)、[卡牌模型](../card-model.md)和[完整冒险指南要求](../scenario-guides.md)。本文件补充本循环的执行范围，不重新定义通用协议。

- `[ ]`：未完成，或缺少验收证据；实现中、阻塞和待复核均保持未勾选。
- `[x]`：完成该项要求，并在旁边或对应审计账本登记证据路径与验证结果。
- 阶段总项只有在其子项和退出门禁全部通过后才能打勾；`blocked`、`rejected`、`simplified` 和提前开放的延后项均不算完成。
- 审计确认组仍只使用 `pending` / `verified`；本清单不代替 `confirmations` 和 `releaseAcceptance`。
- 更新时记录日期、执行命令、结果及报告位置；测试数量、耗时和 replay 指纹数量取实测值，不手工写死。

### 已完成的规划准备

- [x] 阅读现有迁移规范及冒险指南要求，确定六步顺序与逐章验收口径。证据：本文件引用的规范。
- [x] 对照本地来源确认八个章节单元标识、真实剧本提示卡号、检查点与战役推进顺序。证据：下文来源清单、§4 的章节表与流程。
- [x] 建立本循环独立文档目录、阶段路线清单和完成勾选约定。证据：本文件。

## 2. 来源、范围与交付位置

来源根目录为大厅仓库的 `参考资源/ArkhamHorror-main/`，只读，不直接修改：

| 内容 | 来源相对路径 | P0 要锁定的内容 |
| --- | --- | --- |
| 卡牌数据与中文卡名 | `frontend/public/cards*.json` | 本循环内容包（`eoep`、`eoec`）、卡号、正反面、双面演武／强化伙伴关联卡、重印映射及 SHA-256 |
| 战役流程 | `backend/arkham-api/library/Arkham/Campaign/Campaigns/EdgeOfTheEarth.hs` | 序幕、检查点 I–III、幕间 I–III、致命幻景可选切入、升级窗口、日志与尾声分支 |
| 战役共用规则 | `backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/` | 章节常量（`CampaignSteps.hs`）、初始混乱袋与寒霜标记、伙伴（`Partner.hs`）、物资（`Supplies.hs`）、庇护值与忒咳哩-哩牌库（`Helpers.hs`） |
| 剧本身份 | `frontend/src/arkham/data/edgeOfTheEarth.json` | 八个章节单元（`08501a/b/c`、`08549`、`08596`、`08621`、`08648a/b`）、真实提示卡号与单关设置项 |
| 卡牌及剧本行为 | `backend/arkham-api/library/Arkham/` 下相应 `CardDefs`、`Cards`、`Scenario/Scenarios/EdgeOfTheEarth/` | 卡文、特别规则和参考行为逐项对应，不把参考实现自动视为无缺陷 |
| 中文剧情与指南 | `frontend/src/locales/zh/edgeOfTheEarth/` | `base.json` 及 `scenarios/{iceAndDeath,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadness}.json` 的完整覆盖 |
| 英文剧情与指南 | `frontend/src/locales/en/edgeOfTheEarth/` | 对照中文缺项、混入英文的段落（如检查点与拆分篇章）、设置和特别规则，补译保留自译标记 |

`08001`–`08133`（`eoep`）和 `08501`–`08738`（`eoec`）是首轮扫描候选，不把连续编号或包名直接当作最终迁移范围。P0 必须展开双面关联面（如陈丽丽演武 `08011a/b`–`08014a/b`、伙伴坚毅面 `08587`–`08595`）、调查员依赖、书附／平行卡替代或重印映射（如诺曼 `98007/98008/98009`、蒙特雷 `90062/90063/90064`）、《纪念逝者》剧情奖励及跨循环重印；复用核心遭遇组只登记依赖，不重复归入本轮分片。

以下路径均相对 `games/arkhamhorror/`，是计划交付位置，尚未建立的文件不表示已实现：

| 产物 | 计划路径 |
| --- | --- |
| 战役与八章内容 | `content/campaigns/edgeOfTheEarth/{manifest,shared,chapters,story-text,encounter-rules}.js`、`scenarios/<scenarioId>/`；按需拆分，不建空壳 |
| 内容包 | `content/packs/eoteCampaign/`、`eoteInvestigators/`、`eotePlayer/` 的 `manifest.js` |
| 玩家卡行为 | `src/cards/entries/<code>.js`，重印号复用 canonical 实现 |
| 非玩家卡行为 | `src/cards/encounter-entries/edgeOfTheEarth/_shared/<group>/<code>.js` 或 `<scenarioId>/<code>.js`；跨战役卡沿用 `shared/<group>/` |
| 叙事生成 | `tools/import-eote-story.mjs` 与生成后的 `story-text.js` |
| 完整冒险指南 | 接入 `tools/import-scenario-guides.mjs`，从共享源拆分生成 `web/scenario-guides/<scenarioId>.json` 中英正文 |
| 总审计与专项账本 | `tools/audit-eote.mjs`、`audit/eote-migration.json`；按需拆分原语、调查员、玩家卡、章节和逐卡账本 |
| 测试 | `tests/eote-*.test.mjs`、`tests/eote-*.browser.mjs`，注册本循环测试与审计脚本 |

运行资料放在**大厅仓库根目录** `artifacts/migration/eote/`，不与 Mod 下的历史 `artifacts/` 混用。最少包含 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、`shards.json`、`primitive-requests/`、`workers/`、`reports/` 和 replay 基线。只有干净检出复算所需的最小输入可逐文件加入白名单；截图、日志和执行过程文件不签入。

卡图继续使用 `web/img/cards/` 与 `web/img/zh/cards/` 及既有远程回退，不另建循环专属卡图副本。

## 3. 阶段路线清单

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。其中 P5–P7 是规范第 5 步的不同内容批次；P8 是第 6 步。M0–M5 仅表示内容产物范围，不替代执行顺序。

### P0：锁定范围与基线（M0）

- [x] 扫描候选内容包（`eoep`、`eoec`），输出唯一卡号全集、正反面与关联卡、重印 canonical 映射及范围外依赖。证据：`audit/eote-scope.json` 的 `candidatePackScan` / `cards` / `reprints` / `alternates` / `externalDependencies`，403 条记录 = 367 主卡 + 36 关联面（`eoep` 137、`eoec` 266）。
- [x] 将调查员及专属依赖、一般玩家卡、共享遭遇组（含忒咳哩-哩、探险队伙伴、纪念逝者）和逐章非玩家卡分成无交集集合，保留并集守恒检查。证据：`scope.partitions` / `scope.sets` 与 `gates.partitions` / `gates.sets` / `gates.faces`；三包 266 / 22 / 115，8 个章专属组 + 16 个跨章共享组 = 24 组。
- [x] 逐章锁定来源、真实提示卡号（`08501`、`08549`、`08596`、`08621`、`08648` 及拆分章节 ID）、四档混乱符号规则、初始混乱袋和完整指南来源，记录相对路径与 SHA-256。证据：`scope.chapters` / `scope.guideSources` / `scope.chaosBagsSource`；313 个来源逐文件锁哈希，5 张提示卡覆盖 8 章，四档寒霜 0 / 1 / 2 / 3。
- [x] 记录起始提交、工作区已有改动、回归既有失败，以及引擎卡号字面量、`EFFECTS`、逃生原语和 R1/R2/R3 合规基线。证据：`audit/eote-baseline.json`（`gitHead` `bd8a23adf1a502ebc2e9b2b9fa6cb9dd1e930224`、起始工作区干净、3 项既有失败冻结、`engineCardLiterals` / `effectEntries` / `escapeCards` = 0、R1/R2/R3 = 149 / 0 / 0、12 项架构指标）。
- [x] 在行为改动前生成 golden replay 临时基线；登记 `scope.json` 和报告位置。证据：`tests/fixtures/replay/eote-baseline.json`（13 局 / 797 步，`sha256` `fffb9dae…`）与 `--compare` 逐局一致；运行镜像 `artifacts/migration/eote/replay-before.json`，报告 `artifacts/migration/eote/reports/baseline.md`。
- [x] 接入目录身份和必要的审计骨架；未验收内容保持 `catalog-only`，战役、选人和构筑不因数据收录而开放。证据：`content/packs/eoteCampaign/manifest.js`、`content/packs/eoteInvestigators/manifest.js`、`content/packs/eotePlayer/manifest.js` 三包已注册且 `catalog-only`；战役与八章占位模块存在但**不进生产组合根**；`tests/eote-migration.test.mjs` 用本地注册表复算身份；新增 `scan:eote:scope(:check)`、`test:eote` 脚本。

2026-11-07：P0 完成。`node tools/scan-eote-scope.mjs --check`、`node tools/scan-eote-baseline.mjs --check` 均 exit 0；`tests/eote-migration.test.mjs` 5/5 通过；`node tools/replay-fixtures.mjs --compare tests/fixtures/replay/eote-baseline.json` 逐局一致。扫描与基线只锁定范围、身份和证据，不写任何卡牌行为；来源与本文 §5 的口径差异（忒咳哩-哩牌库实际卡号区间、坚毅伙伴与纪念逝者卡号、拆分提示卡号是 `CampaignSteps.hs` 的虚拟 step id）如实登记在 `scope.pending`，留待 P1 核实。当前检出里已有的 TDE / TIC / Carcosa 账本漂移与 TIC P8 replay 漂移属于既有失败，见文末记录，不计入本循环。

退出门禁：来源可复算，集合无重叠无遗漏，现有 replay 可复现；此后来源漂移必须让 `--check` 失败。

### P1：扫描新增机制（规范第 1 步）

- [x] 全量扫描卡面、背面、规则、检查点、幕间及每章指南，形成 `mechanism-scan.json`，覆盖 `primitive / keyword / rulebook / interaction / scenario / content`。证据：`audit/eote-mechanism-scan.json`（637,913 B）与 `tools/scan-eote-mechanisms.mjs`；403/403 张卡正背面分类，110 条机制（primitive 16 / keyword 38 / rulebook 24 / interaction 12 / scenario 8 / content 12），含战役流程检查点/幕间与 8 章指南段落清单。
- [x] 每张范围内卡至少关联一个机制条目；同一机制合并，记录代表卡号、来源、既有实现、缺口与候选原语。证据：`scan.mechanisms[].cards/source/existing/gap/candidatePrimitives` 与 `scan.cards[]` 反向索引；`unclassified = []`；机制词表 `tools/eote-mechanisms.mjs`（93 行）。
- [x] 将 §5 的重点机制逐项分类，核实复用能力与真实缺口；未知机制保持阻断。证据：`scan.keyMechanisms` 8/8（`tools/eote-mechanism-primitives.mjs`），引擎盘点 56 效果原语 / 6 个 api 模块 / 12 能力 kind / 113 窗口 / 8 play channels 等；原语目录 60 项（reuse 25 / extend 19 / new 16），35 条缺口全部进入 `primitiveGaps`；唯一未能从参考确认的 `keyword.expedition` 显式 `blocked` 并登记在 `pending`。
- [x] 建立八个章节单元的完整指南段落清单（含 `iceAndDeath` 三部分与 `theHeartOfMadness` 两部分的分篇映射），单列中文缺译和特别规则，不以“已有剧情正文”代替指南覆盖。证据：`scan.guides`（8 单元 / 469 段；`iceAndDeath` part1–3 与 `theHeartOfMadness` part1–2 分篇映射；中文缺失 207 段、特别规则 16 段）与 `scan.rules`（战役剧情 20 组 258 段 / 68 段中文缺失；`Key.hs` 56 个记录键全部有中文标签；9 位伙伴名与 7 项补给标签单独核对）。

2026-11-07：P1 完成。`node tools/scan-eote-mechanisms.mjs --check` exit 0（与磁盘逐字节一致、13/13 门禁为真）；`tests/eote-migration.test.mjs` 7/7 通过（P0 5 项 + P1 2 项）；扫描阶段未写任何卡牌行为、未改引擎，全部 403 张卡的 `behaviorStatus` 仍为 `pending`。P2 的直接输入是 `scan.primitiveGaps`（35 条 = 19 extend + 16 new）与 `scan.primitives`（60 项目录）。

退出门禁：未分类卡为 0，所有原语缺口进入 P2；扫描阶段不批量写卡。

### P2：拆分并实现通用原语（规范第 2 步）

- [x] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels，先复用再新增。证据：`audit/eote-primitive-catalog.json`（56 效果原语 / 12 能力 kind / 113 窗口 / 目标枚举 / 既有 7 个 play channels + P2 新增 `deckTop`、`otherHand` 两通道）；25 项复用原语逐项登记模块与读点。
- [x] 为寒霜标记（`[frost]`）、探险队伙伴（Partner）、忒咳哩-哩（Tekeli-li!）专属弱点牌库、地点庇护值（Shelter）、跨章物资（Supplies）、多职阶构筑及牌库顶揭示打出等机制建立 `reuse / new / escape` 计划。证据：`audit/eote-primitive-plan.json` 60 项目录分相 = reuse 25 / P2 23（extend 16 + new 7）/ P3 7 / P4 5，`escape` 为空；P3/P4 延后项逐条给出阶段与理由。
- [x] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档；新状态纳入版本迁移。证据：[原语契约](primitives.md)；六个专项测试文件（正常/负面/JSON 往返/注册校验/启动期校验）；`src/engine/eote-primitives.js#validateEoteState` 接入 `save-migration.js`（普通存档/续算基底/并行线三处），可选扩展 `version:1` 不提升顶层 schema、读点从不初始化。
- [x] 同句规则在第二张出现时提取候选，第三张前完成原语；本阶段先完成通用接口，不批量写卡，`escape` 默认保持为空。证据：P2 未写任何卡牌/内容文件（`git status` 可核对），`escape: []`；frost 修正读点、伙伴状态机、忒咳哩-哩牌库、庇护值/营地、物资/封印、高度/格网、演武/牌库顶等接口均已就位供 P5–P7 使用。
- [x] 完成 `primitive-plan.json` 与只读 `primitive-catalog.json`；所有 `new` 项为 `done`，复用项可定位，replay 对比无非预期漂移。证据：`plan:eote:primitives` / `audit:eote:primitives` 逐字节复算；`audit/eote-node-acceptance.json`（全部通过）与 `audit/eote-regression.json`（test:fast 无新增失败 + replay 13 局零漂移）。

2026-11-07：P2 完成。`node tools/audit-eote-primitives.mjs --check` exit 0（P2 23 项全部 `done`、reuse 25 项可定位、60 项目录无遗漏，gates 全真）；`node tools/verify-eote.mjs --node` 全部通过；`node tools/verify-eote.mjs --regression` 通过（test:fast 仅剩 P0 冻结的 3 项既有失败、无新增；replay 13 局 `--compare` 逐局一致）。实现覆盖：寒霜物理池与视为 frost、伙伴/封印/纪念逝者/物资、忒咳哩-哩牌库与隐藏洗入、营地/庇护值/设施高塔、高度层级与城市格网、演武/牌库顶/跨座位/轮初距离、战役检查点/幕间/幻景版本/记录驱动尾声。因 `tests/suites.mjs` 与共享引擎模块变化，TCU 玩家卡与迁移账本已按工具重算（仅来源哈希变化，gate 仍 pass）；TDE/TIC 账本漂移仍属既有失败，本阶段不处理。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

### P3：关键词与规则书（规范第 3 步，M4）

- [x] 对照全部卡面与指南确认关键词、时机词及已有关键词在本循环的适用性，逐项登记代表卡号。证据：`content/campaigns/edgeOfTheEarth/keywords.js` 的 38 个关键词（与 P1 扫描的 keyword 机制 id/顺序/patterns/代表卡逐一相等；kind = keyword 28 / token 2 / trait 8，代表卡语料含卡名以覆盖 08549/08663/08671）；审计账本 `audit/eote-rules.json#confirmations.keywords`。
- [x] 实现并验收寒霜标记、伙伴、忒咳哩-哩、庇护值、多职阶等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。证据：P2 已交付引擎读点；P3 以「关键词清单 + 规则条目 + 卡文直达」交付 `keyword.*` 7 项规则层实现（`deliveredPrimitives`），P4 交互项 `interaction.tekeliShuffle` 明确记为 scheduled 且不阻塞规则验收；`tests/eote-rules.test.mjs` 逐项校验。
- [x] 完成循环概览、检查点与营地继承、伙伴存活／划去／强化、忒咳哩-哩牌库、寒霜标记等规则条目及卡文直达链接。证据：`web/eote-rules.js` 共 23 条双语条目（循环概览/寒霜/伙伴/坚毅/忒咳哩-哩/庇护值与营地/高度层/幻景/封印/封印符号/钥匙/物资/探险特质/巨型/险境/破功面/幻灵/古神/附身/目标/撤退/多职阶/演武）；`web/rulebook-data.js` 接入拼音索引与 `/^08/` 卡文直达派发，403/403 张卡均带 `eoteCampaign` 且 0 张缺关键词直达。
- [x] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。证据：中英段落成对、related 全解析、正文无工程词（规则书测试与 `campaign-experience` 全绿）；`tests/eote-rules.browser.mjs` 桌面 1440×950 / 移动 390×844 × 中英 6 项浏览器用例通过，截图见 `artifacts/migration/eote/reports/screenshots/`。
- [x] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目由审计写入 `verified`。证据：`audit/eote-rules.json`：keywords 38/38、rulebook 23/23 均 `verified`，cardLinks 403/403，desktop/mobile/zh/en 全真，12/12 gates true；`node tools/audit-eote-rules.mjs --check` 逐字节复算一致。

2026-11-07：P3 完成。P3 不写任何卡牌行为与关卡内容：只交付关键词清单、23 条双语规则书条目、规则书数据接入与浏览器验收。规则书只描述 P2 已实现的机制（引擎读点见 [原语契约](primitives.md)）；`expedition` 的 P1 blocked 项裁决为印刷**特性**（`[[Expedition]]`，无独立关键词能力），其携带/掉落/回收规则由 P2 物资原语承担，规则条目如实描述。P3 未提升任何 schema/版本；`audit/eote-primitive-plan.json` 由规则书账本回填 7 项 `keyword.*` 为 done（P4 交互项仍按阶段记录）。

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

### P4：新增交互与界面（规范第 4 步）

P4 交付可复用的交互通路与投影，不开放调查员、卡牌或章节；完整指南与剧情分支仍在 P7。契约与隐私边界见[交互契约](interactions.md)，完成状态由[交互审计](../../audit/eote-interactions.json)复算。

- [x] 完成寒霜标记连续揭示与第 2 枚自动失败提示、开局伙伴选派、伙伴跨关伤害／恐惧／阵亡状态展示等扫描确认的新交互。证据：`src/engine/eote-interactions.js`（frost/partners 选择事务）+ `view.eote.frost/partners` 投影；浏览器桌面/移动用例「寒霜连续揭示与池余量」「伙伴选派」断言真实引擎的两枚寒霜与自动失败横幅、`[data-eote-frost]` 池余量、`[data-eote-partners]` 状态与取消/焦点恢复。
- [x] 完成诺曼牌库顶常驻揭示与打出、陈丽丽演武构筑选择与场上翻面、鲍勃代打同地点队友手中道具并共同付费、忒咳哩-哩洗入与结算等必要交互，复用现有组件、CSS 变量和服务端合法动作。证据：`interaction.deckTopReveal`（`[data-eote-deck-top]` + 既有 deckTop play channel）、`crossSeat`（授权/选择/费用分摊元数据）、`tekeli`（4 向去向选择、只返回张数）、`discipline`（确定性选择 + 场上翻面）；演武构筑入口与代打控制权/分费按阶段留给 P5（引擎已交付选择与元数据，见[交互契约](interactions.md)）。
- [x] 确认忒咳哩-哩不查看洗入牌库、未揭示城市景观、营地随机失踪抽选与条件剧情的座位可见性，不向观察投影泄露隐藏信息。证据：`src/integration/mechanic-view.js` 的 `eote.tekeli` 只投影张数、`deckTop`/`crossSeat` 仅本人可见，`maskMechanicSnapshot` 同步裁剪；Node 交互测试按座位断言不泄露，浏览器用例断言页面不出现隐藏牌名。
- [x] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。证据：既有 `scenario.scriptCards → scriptCardOwner → legalMoves / scriptActionHints → 剧本书` 通路在 P4 证据集中实机回归（`script-actions-tfa.browser.mjs` 桌面/移动 2 项 passed）；EotE 各章实际行动仍随 P7 接入，本阶段只验收通路。
- [x] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。证据：`scenario-guides.browser.mjs` 的「完整指南按需加载」「指南加载失败可重试」两项在 P4 证据集中实机通过；EotE 八章完整指南内容仍属 P7。
- [x] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。证据：`tests/eote-interactions.browser.mjs` 8 项交互 × 2 视口全部通过（真实大厅 HTTP + 测试专用夹具），含 503 失败重试、Esc 取消并恢复来源卡焦点、无横向滚动与按钮可见性断言；16 张截图见 `artifacts/migration/eote/p4/screenshots/`，报告见 `audit/eote-interactions-browser.json`。

2026-11-08：P4 完成。交互审计 `audit/eote-interactions.json` 的 coverage（2 视口 × 8 交互）与 checks 全真，`--check` 逐字节复算一致；`node tools/verify-eote.mjs --node`（含 P4 交互 Node 专项）与 `--regression`（test:fast 无新增失败、replay 13 局零漂移）均 passed；`audit/eote-interactions-browser.json` 记录 16 项 EotE 交互 + 2 项剧本行动归属 + 2 项指南入口均为真实大厅/HTTP 路径。P4 未写任何卡牌行为或章节内容，未提升 schema；`interaction.*` 5 项由交互账本回填 `deliveredPrimitives` 后计划账本记为 done（P4 交付选择事务 + 隐私投影 + 浏览器验收），P5 调查员能力/构筑入口仍待接入。实现期修复：选择事务需把来源实体 id 传入 `selectMechanic`（否则取消后焦点无法回到来源卡）；`createEoteInteractions` 创建期不做 eager 校验，与其它 api 域一致。

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及中英文名对照。逐人状态见[调查员审计](../../audit/eote-investigators.json)与[调查员契约](investigators.md)。

- [x] `08001` Daniela Reyes（丹妮拉·雷耶丝）：构筑（守卫者 0 级、求生者 1–5 级、最多 5 张其他 0 级求生者）、敌人攻击后反应（非自身引发趁乱攻击，含攻击被取消时造成伤害或自动躲避）、旧印及专属依赖 `08002`、`08003`。证据：`src/cards/entries/08001–08003.js`；攻击历史读点（`inv.attackedSinceTurnEnd`，攻击结算后写入、回合结束清空）；直伤敌人读点；`tests/eote-investigator-daniela.test.mjs` 与浏览器用例。
- [x] `08004` Norman Withers（诺曼·威瑟斯）：构筑（探求者 0 级、潜修者 1–5 级、最多 5 张其他 0 级潜修者）、牌库顶常驻揭示、每轮一次减费打出牌库顶牌、牌库顶弱点强制抽取、旧印交换手牌与牌库顶牌，以及专属依赖 `08005`、`08006`；核对 `98007/98008/98009` 映射。证据：`src/cards/entries/08004–08006.js`；`syncPassiveDeckTop`（开局/轮初/抽牌后同步）、`commitDeckTop`、延迟与封锁读点（`flags.weaknessStaysOnDeckTop`/`locksDeckWhileRevealed`/`activatableWhileOnDeckTop`，弃置动作 2 行动）；`tests/eote-investigator-norman.test.mjs`；平行版本 `98007/98008/98009` 保持 catalog-only，见审计 `reprints`。
- [x] `08007` Monterey Jack（蒙特雷·杰克）：构筑（流浪者 0 级、探求者 1–5 级、最多 5 张其他 0 级探求者）、回合结束按本轮起始地点与当前地点连接距离结算资源／抽牌、旧印及专属依赖 `08008`、`08009`；核对 `90062/90063/90064` 映射。证据：`src/cards/entries/08007–08009.js`；复用 P2 `roundDistance` 原语与 `doFight` 成功回调（长鞭自动躲避/+1 伤害）；被埋葬的秘密移动锁读点；`tests/eote-investigator-monterey.test.mjs`；平行版本 `90062/90063/90064` 保持 catalog-only。
- [x] `08010` Lily Chen（陈丽丽）：构筑（潜修者 0 级、守卫者 1–5 级、最多 5 张其他 0 级守卫者、禁 `[[Firearm]]` 枪械）、初始与每满 15 经验增选双面永久演武 `08011a/b`–`08014a/b`、每张演武配 1 张 `08015` 命运重担、[[运功]]／[[破功]]翻面与轮末恢复、旧印。证据：`src/cards/entries/08010–08015.js`；演武构筑数据 `content/campaigns/edgeOfTheEarth/investigator-data.js`（`options.disciplines` + `options.xp` 双处同口径）；开局演武初始化（`campaign.eote.disciplines`，全部 Unbroken 进场）；`roundEvents` 事件记账、`flipAfterNextTest`、`grantFreeActions`（受限战斗/躲避行动）；`tests/eote-investigator-lily.test.mjs`。
- [x] `08016` Bob Jenkins（鲍勃·詹金斯）：构筑（求生者 0 级、流浪者 1–5 级、最多 5 张其他 0 级流浪者）、同地点队友揭示手中 `[[Item]]` 道具、额外行动代打队友手中道具归其控制并支持双方分摊资源费用、旧印及专属依赖 `08017`、`08018`。证据：`src/cards/entries/08016–08018.js`；`itemPlay` 受限行动 + P2 `otherHand` 通道 + 跨座位归牌主控制/共同付费 + `playUnderAnyAtLocation` 控制者选择；`tests/eote-investigator-bob.test.mjs`。
- [x] 五位调查员分别通过初始化、能力、构筑合法／非法、专属依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。证据：`buildDeck`/`buildDeckFromList` 逐人 30 张与专属依赖校验；Node JSON 往返与浏览器真实大厅选人开局；审计账本逐人 `verified`。

2026-11-08：P5 完成。五位调查员与 17 张专属依赖（9 张专属卡 + 8 张双面演武）逐人实现并验收，`eoteInvestigators` 包独立升为 playable；`eotePlayer`（P6）与 `eoteCampaign`（P7–P8）保持 catalog-only，大厅不出现该战役入口。AI 随机选人池（`PLAYABLE_INVESTIGATOR_CODES`）保持不变，13 局 golden replay 零漂移；平行版本 `98007/90062` 及其替换专属卡明确留在范围外。调查员浏览器验收经真实大厅 HTTP 通路覆盖五人选人/构筑/开局与能力投影，Node、浏览器、回归与 `audit/eote-investigators.json` 一并复算。

退出门禁：逐位证据完整才开放该调查员；已有同名或平行版本不自动证明本编号与依赖已完成。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [x] 主进程生成分片账本，按卡号／职阶／机制拆成 4 个分片（M2-1 `08019`–`08048`、M2-2 `08049`–`08078`、M2-3 `08079`–`08108`、M2-4 `08109`–`08133`），检查无交集、并集覆盖全部 115 条一般玩家卡（含 4 张基础弱点）。证据：`audit/eote-player-shards.json`（并集 = `partitions.eotePlayer`，测试断言）。
- [x] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、测试与 `primitive-requests/*.json`；共享层、账本、文档及索引由主进程维护。证据：`src/cards/entries/08019–08133.js` 一卡一文件；`tests/eote-player-m2-1..4.test.mjs`；`artifacts/migration/eote/primitive-requests/`。
- [x] 逐卡核对费用、槽位、使用次数、多职阶属性、目标、窗口、区域、持续时间、每轮／每局限制、升级折扣及负面路径。证据：四份分片测试逐卡行为断言（每卡至少一条 `P6 <code> …`），账本 `audit/eote-player-acceptance.json` 逐卡 `verified` 并附测试文件/行号。
- [x] 缺原语时写 `primitive-requests/*.json` 并将卡记为 blocked；主进程实现并验证后再恢复，不绕过 API 直写状态。证据：`audit/eote-player-queue.json` 全部项 done/rejected；4 个 worker 的 blocked 卡在原语落地后补齐并纳入四份测试。
- [x] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。证据：账本 `channel` 字段（本批全部 `descriptor`，无 legacy/hybrid）、`simplified: false`、`status: verified`；重印卡按 canonical 实现（如 `08057/08058` 与 `08073` 的重复映射只保留本批卡号行为）。
- [x] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。证据：`build-card-index --check`、`audit-card-entry-compliance --check`、`verify-eote --regression`（无新增失败、replay 零漂移）、`audit/eote-player-acceptance.json#queue`。

2026-11-08：P6 完成。115 条一般玩家卡记录（111 张可构筑卡 + 4 张基础弱点）全部完成逐卡主要印刷效果验收：`eotePlayer` 包升 playable，可构筑卡进入构筑界面与开放玩家卡池，4 张基础弱点只作随机基础弱点依赖；`eoteCampaign`（P7–P8）保持 catalog-only。分片测试实跑生成 `audit/eote-player-acceptance.json` 与 `src/cards/eote-player-acceptance.js`（可构筑码表），manifest/availability/EXPANDED 池均读取生成物，不手写卡号清单。AI 自动牌组默认池与 13 局 golden replay 不变；跨座位/场外/标记等新原语均无卡号分支。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。

### P7：共享遭遇、八章及战役流程（规范第 5 步，M3）

- [x] 先迁移战役内共享遭遇组（忒咳哩-哩、探险队伙伴与坚毅面、纪念逝者、极地气候与古老者等），再按 §4 顺序落地八个章节单元；按归属目录分片，避免共享卡重复实现。
- [x] 八个章节单元逐项完成准备、伙伴选派、区域守恒、地点连接、全部幕／议程正反面、敌人／诡计／剧情资产、符号与结局。
- [x] 严格按原版游玩顺序接入序幕、检查点 I–III、幕间 I–III、致命幻景的可选／重复切入和尾声。
- [x] 根据检查点与幕间的实际规则处理营地继承、失踪／划去伙伴、经验与升级权限；检查点与紧邻部分之间按规则控制升级与状态延续。
- [x] 从锁定来源生成完整叙事，覆盖所有伙伴存活／划掉与物资分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。
- [x] 每个章节单元同步生成完整中英文指南（`iceAndDeathPart1/2/3` 与 `theHeartOfMadnessPart1/2` 分别提取对应篇章），补译并标记缺项，通过来源覆盖、生成校验、Node 和浏览器验收。
- [x] 八个章节单元全部完成 §6 的逐章确认，战役记录、伙伴状态、物资、纪念逝者、混乱袋和存档跨章一致。

2026-11-08：P7 完成。24 个遭遇组（16 个跨章共享 + 8 个章节专属，共 266 条战役记录）与八个章节单元全部落地，`eoteCampaign` 包与战役清单升为 playable，真实大厅链路从序幕推进到章节；战役 flow（序幕/检查点 I–III/幕间 I–III/致命幻景可选再入/尾声）与记录 schema 由 `flow.js`/`records.js` 提供，`eoteNextStep` 与参考实现逐条一致。剧情/指南由 `tools/import-eote-story.mjs` 与 `tools/import-scenario-guides.mjs` 从锁定 en/zh locale 生成（469/469 段与 P0 指南来源对齐；中文缺译逐路径标记，不用英文冒充）；八章指南进入「关卡设置」面板。详细契约与边界见[战役章节与流程验收](scenarios.md)。

退出门禁：每章的字面行为与指南均有证据；章内定向夹具不能代替真实大厅路线；P8 发布验收已完成，见 §16。

### P8：整体验收与发布（规范第 6 步，M5）

- [x] 汇总 `audit/eote-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。
- [x] 覆盖完整合法战役、跳过／进行《亡命冰原》II–III、进入／跳过《致命幻景》、失败／撤退路线、伙伴全存／全灭、四档难度、存档恢复和 replay。
- [x] 从真实大厅验证选战役、选人、构筑、开局、逐章推进、检查点、幕间、升级与尾声；覆盖多人、AI、断线恢复和权限边界。
- [x] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。
- [x] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。
- [x] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。
- [x] 未采用提前开放：`earlyAccess:false`；26 张已披露近似/8 个 pending 行为原语请求在 `releaseAcceptance.deferred/remaining` 逐条披露（剩余 `remaining=0`），详见 [P8 发布验收记录](p8-release.md)。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

2026-11-08：P8 完成并发布。`audit/eote-migration.json` verified（gates 19/19、confirmations scenarios/keywords/rulebook 全 verified、releaseAcceptance passed、remaining=0）；403 条记录逐卡账本 missing/blocked=0（375 verified + 26 已披露 simplified + 2 参考卡 no-behavior）；P8 Node 验收 475/475；真实大厅 release/progression/online 3 specs × 双视口 6/6、104 张截图哈希一致；全量回归 6956 项 / 6950 过 / 3 条 P0 冻结失败 / additions []，replay 零漂移。发布细节与已披露边界见 [P8 发布验收记录](p8-release.md)。

## 4. 八章路线与逐章清单

以下名称来自本地中文数据与剧情；章节单元 ID 与剧本身份来自 `edgeOfTheEarth.json` 及 `CampaignSteps.hs`，共用提示卡的拆分篇章在表中标明。

| 顺序 | 章节 | scenarioId | 提示卡号（身份 ID） | 优先验收内容 |
| --- | --- | --- | --- | --- |
| 1 | 亡命冰原 第 I 部分 / Ice and Death, Part I | `iceAndDeathPart1` | `08501`（`08501a`） | 坠机开局、冰原地图探索、地点庇护值（Shelter）、营地选址、寒霜与忒咳哩-哩洗入 |
| 2 | 亡命冰原 第 II 部分 / Ice and Death, Part II | `iceAndDeathPart2` | `08501`（`08501b`） | 检查点 I 失踪伙伴分配、已揭示地点继承、搜救失踪伙伴与营救／淘汰记录 |
| 3 | 亡命冰原 第 III 部分 / Ice and Death, Part III | `iceAndDeathPart3` | `08501`（`08501c`） | 检查点 II 坚守或撤离、营地防守、幻灵群袭、庇护值上限与胜利区结算 |
| 4 | 致命幻景 / Fatal Mirage | `fatalMirage` | `08549` | 记忆囚笼、幻景地点与伙伴心魔、多次进入继承（版本 I–III）、伙伴强化（`Resolute`）或跨章奖励 |
| 5 | 失落之峰 / To the Forbidden Peaks | `toTheForbiddenPeaks` | `08596` | 山峰高度（Level 0–5）斜向／纵向攀登、移动掉线索限制、7 项探险物资携带与掉落在地点、星之恐怖追击 |
| 6 | 古老者之城 / City of the Elder Things | `cityOfTheElderThings` | `08621` | 三种城市景观随机行列布局、同行／同列窥视与传送、钥匙收集、古老者苏醒与隧道分支 |
| 7 | 疯狂之心 第 I 部分 / The Heart of Madness, Part I | `theHeartOfMadnessPart1` | `08648`（`08648a`） | 伊夸之门、15 座古老设施与 5 座迷雾高塔、五枚封印（激活／休眠）检索与放置、检查点 III 抉择 |
| 8 | 疯狂之心 第 II 部分 / The Heart of Madness, Part II | `theHeartOfMadnessPart2` | `08648`（`08648b`） | 高塔封印激活与坍塌、无名狂魔终局对抗、肯斯勒瘴气研究分支、逃离与全部战役结局 |

战役推进骨架（按参考战役 `EdgeOfTheEarth.hs` 的 `nextStep` 与检查点核对）：

```text
序幕 → 亡命冰原 I（08501a）
     → 检查点 I：失踪事件（按营地庇护值抽选安全伙伴；选择搜救则进第 II 部分，否则跳过并划去失踪伙伴）
     → [亡命冰原 II（08501b）]
     → 检查点 II：袭击（选择逃入山脉则跳过第 III 部分，选择坚守则进第 III 部分）
     → [亡命冰原 III（08501c）]
     → 幕间 I：宁静夜晚（查看 3/4 名队员状态或遗物；若至少 3 名伙伴被划掉，可选进入致命幻景）
     → [致命幻景（08549）]
     → 失落之峰（08596）
     → 幕间 II：无尽夜晚（查看 3/4 名队员；满足条件或已进入过幻景时，可选进入致命幻景）
     → [致命幻景（08549）]
     → 古老者之城（08621）
     → 幕间 III：最后一夜（查看 3/4 名队员；满足条件时，可选进入致命幻景）
     → [致命幻景（08549）]
     → 疯狂之心 I（08648a） → 检查点 III → 疯狂之心 II（08648b） → 尾声
```

《亡命冰原》I–III 与《疯狂之心》I–II 内部通过检查点衔接，跨部分继承营地、已揭示地点、封印及伙伴伤害／恐惧状态；《致命幻景》可在幕间 I、II、III 按条件切入，完成后根据 `campaignCompletedSteps` 返回当前主线下一章（`ToTheForbiddenPeaks`、`CityOfTheElderThings` 或 `TheHeartOfMadnessPart1`）。升级窗口、经验结算和创伤处理须逐条核对指南与参考行为。

- [ ] C1 亡命冰原 第 I 部分：§6 全部通过，记录证据。
- [ ] C2 亡命冰原 第 II 部分：§6 全部通过，记录证据。
- [ ] C3 亡命冰原 第 III 部分：§6 全部通过，记录证据。
- [ ] C4 致命幻景：§6 全部通过，记录证据。
- [ ] C5 失落之峰：§6 全部通过，记录证据。
- [ ] C6 古老者之城：§6 全部通过，记录证据。
- [ ] C7 疯狂之心 第 I 部分：§6 全部通过，记录证据。
- [ ] C8 疯狂之心 第 II 部分：§6 全部通过，记录证据。
- [ ] 序幕、三个检查点、三段幕间、伙伴状态机、纪念逝者领取与升级窗口均完成独立测试。
- [ ] 尾声覆盖存活伙伴、肯斯勒研究、丹佛斯及古神封印等全部可达分支，无未触发剧情泄露。

## 5. 本循环重点机制检查表

此表是扫描和验收重点，不表示已穷尽本循环机制，也不预设全部需要新增引擎能力。P1–P2 必须先盘点现有能力与混乱袋、牌库、支援接口，再决定扩展。

- [ ] **寒霜标记（`[frost]`）**：物理池上限（8 枚）、入袋／出袋、揭示时 `-1` 并追加揭示一枚、同一检定揭示第二枚 `[frost]` 时检定立即自动失败、把其他符号“视为 `[frost]` 标记”的联动及检定结束归还。
- [ ] **探险队伙伴（Partner）与纪念逝者**：9 位伙伴支援（`08714`–`08722`）的开局选派、不占盟友槽位、跨关持久化伤害与恐惧、被击败即在战役日志划去名字（`Eliminated`）、失踪（`Mia`）与转化（`TheEntity`）、坚毅面（`08587`–`08595`）升级替换，以及幕间从《纪念逝者》（`08730`–`08738`）领取对应遗物入牌组。
- [ ] **忒咳哩-哩！（Tekeli-li!）弱点牌库**：忒咳哩-哩牌库由 7 种卡面（`08723`–`08729`）× 印刷份数（3+3+2+2+2+2+2）= 16 张构建并随存档持久化、不查看内容洗入调查员牌库、抽到时揭示结算并默认移回忒咳哩-哩牌库底（或按持续修正改为洗回牌库、放牌库底、洗入任一调查员牌库或留在原位）。
- [ ] **营地、庇护值（Shelter）与检查点继承**：地点 `shelter` 数值读取、已揭示地点跨部分记录、检查点 I 按营地庇护值随机保护存活伙伴、跳过或进行后续部分的分支与奖励差异。
- [ ] **探险物资（Supplies）与封印（Seals）**：《失落之峰》7 项探险物资支援的控制、随攀登携带、失败掉落到地点及结局回收记录；《疯狂之心》五枚封印在激活／休眠状态下的持有、放置、转换与高塔互动。
- [ ] **地形网格、高度层级与行列移动**：《失落之峰》按高度层（Level）连接的山坡攀登与下坠；《古老者之城》三列城市景观随机摆放、同行／同列查看已揭示面与跨格移动；《亡命冰原》与《疯狂之心》的环形或网状连接。
- [ ] **多职阶卡、成套支援与调查员特殊规则**：双职阶／三职阶卡在构筑限制中的職阶匹配、陈丽丽演武双面永久卡与经验解锁、诺曼牌库顶常驻揭示与打出、鲍勃跨座位揭示手牌与共同付费打出道具、0 级可升级玩家卡的经验折扣与标记继承。
- [ ] **已有关键词及模板**：猎手、冷漠、反击、涌动、流放、封印等以实际扫描结果为准；已有实现也要验证本循环所需时机与交互。

P1 已按卡表与参考实现核实本节机制并修正卡号表述（忒咳哩-哩 `08723`–`08729`、坚毅面 `08587`–`08595`、纪念逝者 `08730`–`08738`；详见 §9 与 `audit/eote-mechanism-scan.json#keyMechanisms`）。

## 6. 每章完成模板

每章在 `confirmations.scenarios.items` 建立独立记录并复制本清单。各项必须附源码、行为测试或审计证据；只检索卡号、文本非空或条目存在均不足以通过。

- [ ] `sourceLocked`：卡面、规则、指南和剧情来源及哈希完整。
- [ ] `identityRegistered`：真实提示卡号、名称、章节身份及布局对应正确。
- [ ] `setupAndZones`：准备、伙伴与物资入场、忒咳哩-哩牌库、遭遇／保留／移除／胜利区和随机变体守恒。
- [ ] `actsAndAgendas`：全部幕／议程、推进、背面、行动及 `scriptCard` 归属通过。
- [ ] `locationsAndConnections`：地点正反面、连接、庇护值／高度／行列规则、动态变体与离场通过。
- [ ] `encounterBehaviors`：专属与共享敌人、诡计、伙伴与剧情资产行为全部接线。
- [ ] `literalCardBehavior`：逐卡逐能力核对费用、目标、区域、限制、持续时间与清理；合法入口出现、非法入口不出现、结果符合卡面。
- [ ] `chaosEffects`：四档提示卡与符号时机、寒霜标记、追加揭示和相关触发通过。
- [ ] `resolutionsAndRecords`：全部可达结局、检查点状态继承、伙伴伤亡、物资、经验、创伤、混乱袋和跨章记录通过。
- [ ] `storyText`：完整叙事与完整中英指南覆盖开场、分支、设置、特别规则、后续剧情、结局和结算；实际演出只投影已到达分支。
- [ ] `saveReplay`：关键选择前后 JSON 往返、恢复及 replay 确定性通过。
- [ ] `browserAcceptance`：真实大厅、桌面 1440／移动 390、指南入口位置、特别规则、折叠剧透、中英切换、重试与键盘操作通过。

## 7. 验证命令与记录方式

以下命令在 `games/arkhamhorror/` 执行。P0 的 baseline 必须先于行为修改，compare 在修改后执行；其余按对应阶段运行。

```powershell
# 从 Mod 目录指向大厅根目录的运行资料
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/eote/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/eote/replay-before.json

npm run cards:check
npm run cards:encounter-check
npm run audit:entries
npm run test:fast

node tools/import-scenario-guides.mjs --write
node tools/import-scenario-guides.mjs --check
node --test tests/scenario-guides.test.mjs
npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs

npm run replay:fixtures
npm test
npm run presentation:check
npm run test:browser
npm run images:verify
npm run docs:check
```

本循环计划注册的专项命令如下（随各阶段推进落地，扫描、计划及审计生成与 `--check` 校验分开；检查不重写基线）：

```powershell
npm run scan:eote:scope:check
npm run scan:eote:check
node tools/verify-eote.mjs --node
npm run test:eote:interactions:browser
npm run test:eote:player
npm run audit:eote:player
npm run plan:eote:primitives
npm run audit:eote
npm run audit:eote:primitives
npm run audit:eote:interactions
npm run audit:eote:investigators
npm run audit:eote:check
```

P0/P1/P2/P3/P4 已落地并可执行的命令（本机 PowerShell 执行策略禁用 `npm.ps1` 时用 `node` 直调等价命令）：

```powershell
node tools/scan-eote-scope.mjs --write     # 生成 audit/eote-scope.json（重写前先审阅 diff）
node tools/scan-eote-scope.mjs --check     # 来源/归属漂移必须让它失败（P0 门禁）
node tools/scan-eote-baseline.mjs --write  # P0 一次性基线快照 audit/eote-baseline.json
node tools/scan-eote-baseline.mjs --check  # 起始提交/版本/replay sha/合规与指标复算
node tools/scan-eote-mechanisms.mjs --write   # 生成 audit/eote-mechanism-scan.json（等价 npm run scan:eote）
node tools/scan-eote-mechanisms.mjs --check   # 机制分类/原语缺口/指南清单漂移即失败（P1 门禁）
node tools/audit-eote-primitives.mjs --write  # 生成 primitive-plan + 只读 primitive-catalog（等价 npm run plan:eote:primitives）
node tools/audit-eote-primitives.mjs --check  # 原语计划/目录漂移即失败（P2 门禁，等价 npm run audit:eote:primitives）
node tools/audit-eote-rules.mjs --write       # 生成 audit/eote-rules.json（关键词/规则书确认，等价 npm run plan:eote:rules）
node tools/audit-eote-rules.mjs --check       # 关键词/规则书账本漂移即失败（P3 门禁，等价 npm run audit:eote:rules）
node tools/run-eote-browser.mjs               # 规则书桌面 1440 / 移动 390 × 中英浏览器验收（等价 npm run test:eote:rules:browser）
node tools/run-eote-interactions-browser.mjs   # 真实大厅/HTTP + 测试夹具：桌面 1440 / 移动 390 交互验收（等价 npm run test:eote:interactions:browser）
node tools/audit-eote-interactions.mjs --write # 生成 audit/eote-interactions.json（等价 npm run plan:eote:interactions）
node tools/audit-eote-interactions.mjs --check # 交互账本漂移即失败（P4 门禁，等价 npm run audit:eote:interactions）
node tools/verify-eote.mjs --node             # audit/eote-node-acceptance.json（等价 npm run verify:eote:node）
node tools/verify-eote.mjs --regression       # audit/eote-regression.json：test:fast + replay 对比
node --test tests/eote-migration.test.mjs     # 等价于 npm run test:eote（P0–P3 全部 eote Node 专项）
node tools/replay-fixtures.mjs --compare tests/fixtures/replay/eote-baseline.json
```

### 阶段总览与证据登记

- [x] P0 范围与基线完成。
- [x] P1 机制扫描完成。
- [x] P2 原语完成。
- [x] P3 关键词与规则书完成。
- [x] P4 交互完成。
- [ ] P5 调查员及专属依赖完成。
- [ ] P6 一般玩家卡完成。
- [ ] P7 八章、检查点、幕间、指南及战役流程完成。
- [ ] P8 发布验收完成，完整迁移交付。

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-03 | 规划准备 | 完成规范阅读、来源定位、八章路线及清单建立；实现阶段均未勾选 | 文档链接检查通过 | `docs/edgeOfTheEarth/README.md` |
| 2026-11-07 | P0 范围与基线 | 403 条记录三包守恒（266 / 22 / 115）、8 章身份与 5 张提示卡、24 个遭遇组无交集、313 个来源逐文件 SHA-256、起始提交与 3 项既有失败冻结；仅目录收录（三包 `catalog-only`，战役与八章不进生产组合根） | `scan:eote:scope:check` 复算一致；`scan-eote-baseline --check` exit 0；`test:eote` 5/5；replay 13 局 / 797 步 `--compare` 一致；`test:fast` 无新增失败（既有 3 项冻结） | `audit/eote-scope.json`、`audit/eote-baseline.json`、`tests/fixtures/replay/eote-baseline.json`、`tests/eote-migration.test.mjs`、`content/campaigns/edgeOfTheEarth/shared.js` |
| 2026-11-07 | P1 机制扫描 | 403/403 卡正背面全部分类；110 条机制覆盖六类；§5 八项重点机制 8/8 分类（60 原语目录 reuse 25 / extend 19 / new 16，35 条缺口）；8 章指南 469 段/207 段中文缺失/16 段特别规则；战役剧情 20 组、`Key.hs` 56 记录键、9 伙伴名、7 补给；不写卡不改引擎 | `scan:eote:check` 逐字节复算 exit 0（13/13 门禁）；`test:eote` 7/7；全部卡 `behaviorStatus: pending` | `audit/eote-mechanism-scan.json`、`tools/scan-eote-mechanisms.mjs`、`tools/eote-mechanisms.mjs`、`tools/eote-mechanism-primitives.mjs`、`tools/eote-guide-scan.mjs`、`tests/eote-migration.test.mjs` |
| 2026-11-07 | P2 通用原语 | 60 项目录分相（reuse 25 / P2 23 = extend 16 + new 7 / P3 7 / P4 5，escape 空）；六组引擎模块与读点（寒霜 8 枚物理池与视为 frost、伙伴/封印/纪念逝者/物资、忒咳哩-哩牌库与隐藏洗入、庇护值/营地/设施高塔、高度层级/城市格网、演武/牌库顶/跨座位/轮初距离、检查点/幕间/幻景版本/记录驱动尾声）；可选扩展 version 1 接入存档校验；未写任何卡 | plan:eote:primitives --check 60 项门禁全真（P2 23 项 done）；erify:eote:node 全部通过；erify:eote:regression 通过（test:fast 无新增失败、replay 13 局零漂移）；TCU 账本按工具重算后 udit-tcu --check pass | udit/eote-primitive-plan.json、udit/eote-primitive-catalog.json、udit/eote-node-acceptance.json、udit/eote-regression.json、docs/edgeOfTheEarth/primitives.md、src/engine/eote-primitives.js |
| 2026-11-07 | P3 关键词与规则书 | 38 个关键词与 P1 扫描完全对齐（kind = keyword 28 / token 2 / trait 8；代表卡语料含卡名）；23 条中英双语规则条目（循环概览/寒霜/伙伴/坚毅/忒咳哩-哩/庇护值与营地/高度层/幻景/封印/封印符号/钥匙/物资/探险/巨型/险境/破功面/幻灵/古神/附身/目标/撤退/多职阶/演武）；规则书接入拼音索引与 `/^08/` 卡文直达；`expedition` blocked 项裁决为印刷特性；P3 未写卡 | `audit-eote-rules.mjs --check` 复算一致（keywords 38/38 verified、rulebook 23/23 verified、cardLinks 403/403、12/12 gates true）；`eote-rules.test.mjs` 全绿；浏览器 6/6 通过（桌面 1440/移动 390 × 中英 + 卡文直达），截图 6 张；P2 plan 回填 7 项 keyword.* 为 done | `audit/eote-rules.json`、`audit/eote-browser-acceptance.json`、`web/eote-rules.js`、`content/campaigns/edgeOfTheEarth/keywords.js`、`tools/audit-eote-rules.mjs`、`tests/eote-rules.test.mjs`、`tests/eote-rules.browser.mjs` |
| 2026-11-08 | P4 交互与界面 | 9 组服务端选择事务（frost/partners/seals/keys/tekeli/deckTop/crossSeat/discipline/supply）+ `view.eote` 隐私投影 + EotE 汇总面板与 frost 标记；真实大厅 HTTP + 测试专用夹具覆盖寒霜连续揭示/伙伴选派/封印放置/忒咳哩-哩洗入/牌库顶揭示/跨座位代打/物资指派/演武，另回归既有剧本行动归属与固定指南入口；P4 未写卡 | `audit-eote-interactions --check` 复算一致（9/9 gates、2 视口 × 8 交互 coverage 全真、deliveredPrimitives 5/5）；`verify-eote --node` 全部通过；`verify-eote --regression` test:fast 无新增失败 + replay 13 局零漂移；浏览器账本 3 specs、全部用例 passed、16 张截图 | `audit/eote-interactions.json`、`audit/eote-interactions-browser.json`、`docs/edgeOfTheEarth/interactions.md`、`src/engine/eote-interactions.js`、`src/integration/mechanic-view.js`、`web/mechanic-ui.js`、`tests/eote-interactions.browser.mjs` |
| 2026-11-08 | P5 调查员及专属依赖 | 5 位调查员 + 17 张专属依赖（9 张专属卡 + 8 张双面演武）逐人实现；`eoteInvestigators` 升 playable、专属依赖 dependencyOnly 不入一般构筑池；新增 attack 历史/回合事件记账/牌库顶常驻/延迟翻面/免费战斗躲避/跨座位代打/演武构筑等共用读点；平行版本 98007/90062 及替换专属保持范围外；AI 选人池与 13 局 replay 不变 | `audit-eote-investigators --check` 复算一致（逐人 verified、packBoundary/parallelVersionsOutOfScope/originalBaselinePreserved/replayZeroDrift/fastNoNewFailures 全真）；`verify-eote --node` 全绿；`verify-eote --regression` test:fast 无新增失败；调查员浏览器账本 passed | `audit/eote-investigators.json`、`audit/eote-investigators-browser.json`、`docs/edgeOfTheEarth/investigators.md`、`src/cards/entries/08001–08018.js`、`src/engine/eote-investigator-support.js`、`src/deck/{availability,deckbuilding}.js` |
| 2026-11-08 | P6 一般玩家卡 | 115 条一般玩家卡（M2-1..4 四片）逐卡实现与验收；111 张可构筑卡进入构筑界面/开放玩家池、4 张基础弱点只作依赖；`eotePlayer` 升 playable；分片测试与生成码表（`src/cards/eote-player-acceptance.js`）驱动 manifest/availability；AI 默认池与 13 局 replay 不变；新增通用原语（下一次检定加值/免费移动/跨座位快速事件/场外 setAside/指认混沌标记/线索发现替换等）均为声明式读点 | `audit-eote-player --check` 复算一致（115/115 verified、shardsExact、noPendingRequests、browser desktop+mobile）；`verify-eote --node` 全绿；`verify-eote --regression` 无新增失败 + replay 零漂移；玩家卡浏览器账本 passed | `audit/eote-player-acceptance.json`、`audit/eote-player-shards.json`、`audit/eote-player-queue.json`、`audit/eote-player-browser.json`、`docs/edgeOfTheEarth/player-cards.md`、`src/cards/entries/08019–08133.js` |
| 2026-11-08 | P7 共享遭遇、八章与战役流程 | 24 个遭遇组（16 共享 + 8 专属，266 条记录、264 条行为条目 + 2 参考卡）与八个章节单元；`eoteCampaign`/战役升 playable，真实大厅可启动并从序幕推进到章节；战役 flow（检查点 I–III/幕间 I–III/致命幻景可选再入/尾声）与记录 schema 由 `flow.js`/`records.js` 提供；剧情 469/469 段与八章中英指南从锁定 locale 生成，中文缺译逐路径标记；8 章 behavior 适配引擎真实 `setupLocations` 契约 | `audit-eote-scenarios --check` 复算一致（8/8 章 verified、指南 469/469、战役卡 264/264、launchable、浏览器 desktop+mobile）；八章/共享/流程/剧情测试全绿；`verify-eote --node` 全绿；`verify-eote --regression` 无新增失败 + replay 零漂移；`import-eote-story --check` 与 `import-scenario-guides` 幂等 | `audit/eote-scenario-acceptance.json`、`audit/eote-scenarios-browser.json`、`audit/eote-scope.json`、`content/campaigns/edgeOfTheEarth/{manifest,flow,records,story-text}.js`、`content/campaigns/edgeOfTheEarth/scenarios/<8章>/`、`src/cards/encounter-entries/edgeOfTheEarth/`、`web/scenario-guides/<8章>.json`、`docs/edgeOfTheEarth/scenarios.md` |
| 2026-11-08 | P8 整体验收与发布 | 生产注册/大厅/八章/战役/存档/多人/AI/断线全部走真实引擎与真实大厅；403 条逐卡账本（375 verified + 26 已披露 simplified + 2 参考卡，missing/blocked=0）；P8 Node 475/475；真实大厅 release/progression/online 3 specs × 双视口 6/6 + 104 张截图哈希一致；P8 总迁移账本 19/19 gates、confirmations 三组 verified、releaseAcceptance passed、remaining=0、earlyAccess=false；replay/难度/伙伴全存全灭/跳过分支/存档恢复均有测试 | `audit-eote-migration --check`、`audit-eote-release --check`、`audit-eote-all-cards --check`、`audit-eote-scenarios --check`、`verify-eote --node`（475/475）、`verify-eote --regression`（additions []、replay 零漂移）、`run-eote-release-browser`（passed）全部 exit 0 | `audit/eote-migration.json`、`audit/eote-release-acceptance.json`、`audit/eote-release-browser.json`、`audit/eote-all-card-acceptance.json`、`tests/eote-p8-*.test.mjs`、`tests/replay-eote-p8.test.mjs`、`docs/edgeOfTheEarth/p8-release.md` |
| 2026-11-09 | 中文翻译修复批次 | 审计 82 条 findings：75 修 + 7 保留裁定；缺译 backlog 278→0（章节 469/469、战役 258/258、指南 `chineseGaps=0`）；本地补译层 288 条 entry；展示链英文回退/flow 选项英文/记录标签 camelCase/占位符/繁体/重复标点/错误符号全部清理；剧情与指南分段修复（`\n\n` + 章节 intro 分段 + 结局标题去重）；卡面 30 条上游继承问题修复（含 `[fast]` 53 张、08586 恐惧、按职阶计数、雪橇/人名/引文格式） | `import-eote-story --check`、`import-scenario-guides`、`import-cards --check` 全 exit 0；`translate/tools/verify-fix-batch.mjs` ok=true；EOTE Node 364/364；scope/mechanisms/scenarios/rules/investigators/primitives 账本与 replay 基线重签后 `--check` 全 0 | `translate/fix-batch.md`、`translate/{cards,story,guides,terms}/fix-report.md`、`content/campaigns/edgeOfTheEarth/locale-supplement/*.json`、`content/campaigns/edgeOfTheEarth/card-text-fixes.js`、`content/campaigns/edgeOfTheEarth/story-text.js`、`web/scenario-guides/<8章>.json`、`src/cards/cards-data.js`、`web/eote-rules.js` |

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。

## 8. P0 范围与基线记录（2026-11-07）

本节是 P0 的完整证据索引。可复算账本为 `audit/eote-scope.json`（`node tools/scan-eote-scope.mjs --check`）与 `audit/eote-baseline.json`（`node tools/scan-eote-baseline.mjs --check`）；原始运行资料在大厅根目录 `artifacts/migration/eote/`（不签入）。

### 8.1 来源、范围与重印映射

- 来源根 `参考资源/ArkhamHorror-main/`，313 个文件逐文件锁 SHA-256：参考实现 296 个（`Campaigns/EdgeOfTheEarth`、`Campaign/Campaigns/EdgeOfTheEarth.hs`、8 个 Scenario 文件及 EotE 卡牌定义/实现）、中英剧情与指南 12 个、剧本身份 `edgeOfTheEarth.json` 1 个、卡表 4 个。来源或归属漂移会让 `scan:eote:scope:check` 直接失败。
- 403 条印刷记录 = 367 主卡 + 36 关联面：`eoep` 137（129 主卡 + 陈丽丽双面演武 8 面）、`eoec` 266（238 主卡 + 《致命幻景》28 张 a/b 剧情面）。候选编号区间 08001–08133 / 08501–08738 与卡包归属逐位对账：133 / 238 个位置全覆盖，0 缺号、0 越界。
- 三包无交集分区 266 / 22 / 115：调查员包 = 5 位调查员 + 9 张专属卡（含专属弱点）+ 8 张演武面；一般玩家卡含 4 张基础弱点 `08130`–`08133`。
- 重印 canonical（只锁定映射，P5/P6 才复用实现，canonical 取最小编号）：`08004`↔`98007`（诺曼，同身份）、`08057`↔`60379`、`08058`↔`60384`、`08073`↔`12073`。
- 平行/替代卡（**不是**重印，不得合并行为）：`08007`→`90062`（蒙特雷平行调查员）、`08005`→`98008`、`08006`→`98009`、`08008`→`90063`、`08009`→`90064`（书附替换/进阶专属卡）。`12001` 是 Core Set (2026) 的不同印制丹妮拉，不按重印或平行卡处理。
- 范围外依赖 4 个核心遭遇组（只登记依赖，不重复归入本循环分片）：`AncientEvils`（亡命冰原 I–III + 疯狂之心 I/II）、`ChillingCold`（致命幻景 + 古老者之城 + 疯狂之心 II）、`LockedDoors`（古老者之城 + 疯狂之心 I）、`StrikingFear`（疯狂之心 II 仅 `01164` 冰冻恐惧 / `01165` 不谐之音）。对应仓库目录 `src/cards/encounter-entries/shared/*` 均存在。
- 卡图沿用 `web/img/cards/`、`web/img/zh/cards/` 与远程回退；403 条记录中 375 条有远程 `imagesrc`，本地图库属被忽略的缓存。

### 8.2 八章身份、遭遇组与混乱袋

| 顺序 | 章节单元 | stepId | 提示卡 | 章专属遭遇组 | 逐章 gather（本循环组；完整有序表见 `scope.chapters[].gatherSets`） |
| --- | --- | --- | --- | --- | --- |
| 1 | `iceAndDeathPart1` | `08501a` | `08501` | `theCrash` | iceAndDeath、theCrash、deadlyWeather、hazardsOfAntarctica、silenceAndMystery、tekelili；setAside creaturesInTheIce；+ core `AncientEvils` |
| 2 | `iceAndDeathPart2` | `08501b` | `08501` | `lostInTheNight` | iceAndDeath、lostInTheNight、leftBehind、deadlyWeather、hazardsOfAntarctica、silenceAndMystery、tekelili；+ `AncientEvils` |
| 3 | `iceAndDeathPart3` | `08501c` | `08501` | `seepingNightmares` | iceAndDeath、seepingNightmares、creaturesInTheIce、deadlyWeather、hazardsOfAntarctica、silenceAndMystery、tekelili；+ `AncientEvils` |
| 4 | `fatalMirage` | `08549` | `08549` | `fatalMirage` | fatalMirage、agentsOfTheUnknown、leftBehind、miasma、namelessHorrors、silenceAndMystery、tekelili；+ `ChillingCold` |
| 5 | `toTheForbiddenPeaks` | `08596` | `08596` | `toTheForbiddenPeaks` | toTheForbiddenPeaks、deadlyWeather、elderThings、hazardsOfAntarctica、namelessHorrors、tekelili |
| 6 | `cityOfTheElderThings` | `08621` | `08621` | `cityOfTheElderThings` | cityOfTheElderThings、elderThings、miasma、namelessHorrors、penguins、tekelili、lockedDoors、silenceAndMystery；setAside shoggoths、creaturesInTheIce；+ `ChillingCold` |
| 7 | `theHeartOfMadnessPart1` | `08648a` | `08648` | `theGreatSeal` | theHeartOfMadness、theGreatSeal、miasma、namelessHorrors、penguins、shoggoths、tekelili、lockedDoors；+ `AncientEvils` |
| 8 | `theHeartOfMadnessPart2` | `08648b` | `08648` | `stirringInTheDeep` | theHeartOfMadness、agentsOfTheUnknown、miasma、namelessHorrors、penguins、stirringInTheDeep、tekelili；+ `AncientEvils`、`ChillingCold`、`StrikingFear`（仅 2 张，`gatherJust`） |

- 24 个遭遇组 = 8 个章专属组（单卡文件落 `encounter-entries/edgeOfTheEarth/<scenarioId>/`）+ 16 个跨章/战役级共享组（落 `_shared/<group>/`，含忒咳哩-哩、探险队伙伴、纪念逝者）；两部分无交集，记录数 186 + 80 = 266。
- 战役流程 16 个有序步骤（序幕 → 八个 ScenarioStep → 3 个检查点、3 段幕间与尾声按 `EdgeOfTheEarth.hs#nextStep` 交错）；序幕第 2 步（相信戴尔）向混乱袋加 `cultist`、第 3 步（不信）加 `tablet`。
- 混乱袋四档来自 `Helpers.hs#chaosBagContents`，与 `shared.js` 逐 token 相等：

| 难度 | 数值标记 | frost | 符号 | 合计 |
| --- | --- | --- | --- | --- |
| easy | +1×3、0×2、-1×3、-2×2 | 0 | skull×2、cultist、tablet、autofail、eldersign | 16 |
| standard | +1、0×2、-1×3、-2×2、-3、-4 | 1 | 同上 | 17 |
| hard | 0×2、-1×2、-2×2、-3、-4×2、-5 | 2 | 同上 | 18 |
| expert | 0、-1、-2×2、-3、-4×2、-5、-7 | 3 | 同上 | 18 |

四档符号规则（`[skull]`/`[cultist]`/`[tablet]`/`[elder_thing]` 在每关的效果）逐章锁在 `scope.chapters[].promptCard.text/backText`（5 张提示卡正反面原文，P1 再拆机制、P3 做规则书）。

### 8.3 起始基线与合规

- 起始提交 `bd8a23adf1a502ebc2e9b2b9fa6cb9dd1e930224`，P0 开始时工作区干净（无既有未提交改动）；`audit/eote-baseline.json` 记录该提交而不是快照时的 HEAD。
- golden replay：`tests/fixtures/replay/eote-baseline.json`（13 局 / 797 步，`sha256` `fffb9dae…`），在任何 EotE 行为改动之前采集；`--compare` 逐局一致。运行镜像 `artifacts/migration/eote/replay-before.json`。
- 既有 replay 漂移（P0 只记录、不修）：`node tools/replay-fixtures.mjs --check` 对已提交的 `tests/fixtures/replay/golden-replays.json` 仍然 exit 0（存库日志可复现）；但本检出「实时采集」与 golden 有 3 局从第 13 步起不同（`carcosa-curtain-call-hub`、`carcosa-curtain-call-only`、`dunwich-extracurricular-hub` 的 hub 推进/AI 选择与 golden 记录不一致，最终 `pendingChoice`/场景不同）。该漂移在本轮任何 EotE 改动之前就已存在（P0 起始实时采集即如此），属既有失败/漂移，P0 不重采 golden，也不修；`eote-baseline` 记录的是实采值，因此 EotE 自身的行为零变化由「同一采集方式的前后 `--compare`」证明。
- 规则版本 `n6.0`、状态 schema 7；`engineCardLiterals` 0、`EFFECTS` 0、逃生原语 0；R1 直写状态 149 条（只减不增基线）、R2 重印双实现 0、R3 回合限制缺失 0。
- 架构指标（12 项，来自 `audit/ability-coverage.json`，`audit-abilities --check` 复核）：`engineCodes` 0、`effectsEntries` 0、`effectsTopLevelFields` 0、`escapeCards` 0、`descriptorEntries` 771、`descriptorAbilities` 991、`abilityKinds` 12、`windows` 113、`effectPrimitives` 56、`nonPlayerCards` 214、`behaviorLines` 29063、`declaredScenarios` 3。
- 既有失败按标题冻结（不修、不洗白，也不计入本循环新增失败）：`TIC P8 replay 基线：逐局重放出相同逐步指纹`（`tests/replay-tic-p8.test.mjs`）与两条 TDE P10 账本用例（`tests/tde-migration.test.mjs`）。本检出里 `audit-tde` / `scan-tde-scope` / `audit-tic` / `audit-tic-release` / `audit-p6` / `audit-carcosa-player` 等发布账本已有漂移，属于既有失败；`audit/baseline.json` 全局发布门禁因此未重采，eote 范围账本本轮只注册为 npm script 与专项测试，待既有漂移收口后并入发布基线。
- `test:fast` 收口：包含新增的 `tests/eote-migration.test.mjs` 后无新增失败（仅上述 3 项既有失败）。

### 8.4 目录身份与可用性

- 生产组合根 `content/registered.js` 只登记三个 `catalog-only` 内容包（266 / 22 / 115）；`content/campaigns/edgeOfTheEarth/` 下的战役清单与八章 `catalogReferenceOnly` 占位模块已建立，但**刻意不进生产组合根**，避免未开放战役进入大厅、音乐与指南流程（与 TIC 的迁移路径一致）。
- 身份由 `tests/eote-migration.test.mjs` 用本地 `createContentRegistry` 复算：八章 `referenceCode` 为 5 张印刷提示卡（`08501`×3、`08549`、`08596`、`08621`、`08648`×2），`assertLaunchable` 拒绝启动，`campaignListForUi` 为空。
- 全 403 条记录 `getAvailability` 保持 `catalog-only` / 不可选人 / 不可构筑 / 不可升级；P0 不写任何卡牌行为、不注册战役、不改 `src/deck/availability.js`。

### 8.5 口径差异（P1 核实，P0 不改数据）

1. 忒咳哩-哩牌库：本文 §5 写「16 张弱点牌库（`08700`–`08713`）」；卡表 `tekelili` 组实际是 7 张卡面 `08723`–`08729`，参考 `CardDefs/Tekelili.hs` 的 `cdEncounterSetQuantity`（3+3+2+2+2+2+2）说明 **16 是物理张数、7 种卡面**；`08700`–`08713` 分属 Left Behind / Nameless Horrors / Miasma / Penguins / Shoggoths / Silence and Mystery。P1 按「7 张卡面 / 16 张牌」建模。
2. 坚毅（Resolute）伙伴与纪念逝者：本文 §5 原写的 `08723`–`08731` / `08732`–`08738` 与卡表不符；坚毅伙伴是 `08587`–`08595`（`fatal_mirage` 剧情资产，traits 含 Resolute，`Partner.hs#toResolute` 指向它们），纪念逝者是 `08730`–`08738`（9 条），`08723`–`08729` 是忒咳哩-哩。P1 已核实并同步修订 §5（含忒咳哩-哩「7 卡面 × 16 印刷份」表述）。
3. 拆分提示卡号 `08501a/b/c`、`08648a/b` 是 `CampaignSteps.hs` 的虚拟 `ScenarioStep` 值，不是卡号；卡表只有 5 张印刷提示卡。内容层章节 id 与参考 step id 的映射已锁在 `shared.js#chapters`。
4. 《致命幻景》可在幕间 I/II/III 按条件切入并回到主线下一章（`campaignCompletedSteps` 决定返回点），P7 按 `scope.campaignFlow` 的步骤/边接线，P0 只登记流程骨架。

### 8.6 P0 实测命令

| 命令 | 结果 |
| --- | --- |
| `node tools/scan-eote-scope.mjs --write` / `--check` | 478,401 B 账本；`--check` 逐字节一致、20/20 门禁通过 |
| `node tools/scan-eote-baseline.mjs --write` / `--check` | 基线快照复算一致（gitHead/版本/replay sha/合规/指标/日志 sha） |
| `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/eote-baseline.json` | 13 局 / 797 步逐局一致（行为零变化） |
| `node --test tests/eote-migration.test.mjs` | 5/5 通过（范围账本、原始基线、目录注册、遭遇组分片、配置） |
| `node tools/run-tests.mjs fast` | 无新增失败；既有 3 项失败按标题冻结 |
| `node tools/check-doc-links.mjs` | 全部本地链接可解析 |
| `node tools/scan-eote-scope.mjs --check`（收口复跑） | exit 0；范围/来源/基线哈希不变 |

## 9. P1 机制扫描记录（2026-11-07）

P1 只做分类与缺口登记，不写卡、不改引擎：403 张卡全部归类，`behaviorStatus` 始终为 `pending`（分类不是逐卡行为验收）。可复算账本为 `audit/eote-mechanism-scan.json`（637,913 B，`node tools/scan-eote-mechanisms.mjs --check` 逐字节复算，13/13 门禁为真），机制词表 `tools/eote-mechanisms.mjs`（93 条），引擎盘点与 §5 分类 `tools/eote-mechanism-primitives.mjs`，指南与规则来源 `tools/eote-guide-scan.mjs`。

### 9.1 卡面分类

- 403/403 张记录（`eoep` 137 + `eoec` 266）同时扫描正、背面与卡名：`scan.cards` 反向索引 + `scan.mechanisms[].cards` 正向索引，`unclassified = []`。
- 110 条机制：`primitive` 16 / `keyword` 38 / `rulebook` 24 / `interaction` 12 / `scenario` 8 / `content` 12；其中 `scenario.*` 由 P0 scope 的八章身份与 gather 生成（逐章一条），`flow.*` 由战役流程的序幕 / 检查点 I–III / 幕间 I–III / 尾声 / 致命幻景可选切入生成。
- 同一机制合并去重；每条登记 `title / cards / source / existing / gap / candidatePrimitives`，缺口进入 `primitiveGaps`。

### 9.2 引擎盘点与 §5 重点机制分类

当前引擎盘点（来自 `ENGINE_INVENTORY`，均为源码读点而非估计）：`EFFECT_PRIMITIVES` 56 条、6 个 `api-*` 模块（6 组动作清单）、能力 kind 12、窗口 113、matcher 组合子、目标枚举 5 类、play channels 8 个（hand 基准 + 弃牌堆/威胁区/附属/下方/直觉牌库/背包/原定计划）、20 个可复用先例模块；已有关键词（猎手/冷漠/庞大/反击/警戒/精英/涌动/险境/隐藏/显现/胜利）均确认有引擎读点。寒霜目前是 **partial**：袋内接受 `frost`、`-1`、揭示追加、同检定第二枚自动失败、combat-odds 预览已有；**缺** 8 枚物理池与余量校验、`setTokenTreatment.as` 的 `frost` 白名单（无法「视为 `[frost]`」）与交互。

| §5 机制 | 代表卡 | 分类结论（`audit/eote-mechanism-scan.json#keyMechanisms`） |
| --- | --- | --- |
| 寒霜标记 | 32 | 复用 `chaos.bag` / `core.test`，扩展 `chaos.frost` / `chaos.tokenEffects` / `interaction.frostReveal` |
| 伙伴与纪念逝者 | 37 | 新增 `campaign.partner`，扩展 `campaign.memorials`（TIC mementos 先例）+ 伙伴 UI |
| 忒咳哩-哩牌库 | 45 | 复用 `scenario.deck`，扩展 `scenario.tekeliDeck` + 无查看洗入交互 |
| 营地／庇护值／检查点 | 20 | 复用 `campaign.flows` / `interaction.checkpoint`，新增 `location.shelter` / `scenario.camp` |
| 探险物资与封印 | 53 | 扩展 `campaign.supplies`，新增 `campaign.seals` / `scenario.sealTowers` / `interaction.sealPlacement` |
| 地形、高度与行列 | 46 | 复用 `location.grid` / `location.vertical`，扩展 `keyword.level` / `scenario.climb` / `scenario.cityVote`，新增 `scenario.facility` |
| 多职阶与调查员特殊规则 | 46 | 复用 `investigator.rules` / `investigator.multiclass`，扩展 `investigator.deckTop` / `discipline` / `crossSeatPlay` / `roundDistance` |
| 已有关键词 | 135 | 全部 `reuse`（P3 逐项规则书验收） |

### 9.3 原语目录与 P2 输入

`scan.primitives` 共 60 项：**reuse 25 / extend 19 / new 16**，唯一 `blocked` 为 `keyword.expedition`（参考实现未能确认 Expedition 是否带规则，P2 裁决）。`scan.primitiveGaps` 35 条 = 19 个 extend + 16 个 new：

- **new（16）**：`location.shelter`、`campaign.partner`、`campaign.seals`、`investigator.discipline`、`interaction.frostReveal`、`interaction.partnerSetup`、`interaction.sealPlacement`、`interaction.tekeliShuffle`、`keyword.mirage`、`keyword.shelter`、`keyword.partner`、`scenario.camp`、`scenario.facility`、`scenario.sealTowers`、`keyword.resolute`、`keyword.expedition`（blocked）。
- **extend（19）**：`chaos.frost`、`chaos.tokenEffects`、`scenario.keys`、`scenario.tekeliDeck`、`location.vertical`、`campaign.flows`、`campaign.epilogue`、`campaign.supplies`、`physical.faces`、`investigator.deckTop`、`investigator.roundDistance`、`investigator.crossSeatPlay`、`interaction.deckTopReveal`、`keyword.level`、`keyword.key`、`scenario.climb`、`scenario.cityVote`、`scenario.mirageVersions`、`campaign.memorials`。
- P2 直接以 `primitiveGaps` + `primitives` 起草 `audit/eote-primitive-plan.json`，逐项给 `reuse / new / escape` 判定与引擎读点；本阶段 `escape` 仍为空。

### 9.4 指南与规则覆盖

8 个章节单元的完整指南段落清单（英文源为段落全集，中文按同路径核对）：

| 章节单元 | 段落 | 中文缺失 | 中文未译 | 特别规则段 | 分篇映射 |
| --- | --- | --- | --- | --- | --- |
| `iceAndDeathPart1` | 55 | 10 | 2 | 0 | `iceAndDeath` part1 |
| `iceAndDeathPart2` | 38 | 6 | 1 | 0 | `iceAndDeath` part2 |
| `iceAndDeathPart3` | 31 | 14 | 2 | 0 | `iceAndDeath` part3 |
| `fatalMirage` | 68 | 46 | 1 | 2 | 整文件 |
| `toTheForbiddenPeaks` | 51 | 20 | 0 | 0 | 整文件 |
| `cityOfTheElderThings` | 94 | 54 | 0 | 2 | 整文件 |
| `theHeartOfMadnessPart1` | 79 | 20 | 0 | 6 | `theHeartOfMadness` part1 |
| `theHeartOfMadnessPart2` | 53 | 29 | 2 | 6 | `theHeartOfMadness` part2 |

合计 469 段、中文缺译/未译 207 段、特别规则 16 段。战役剧情来源（`base.json`）20 组 258 段，其中中文缺失 68 段；`Campaigns/EdgeOfTheEarth/Key.hs` 的 **56** 个记录键在英文与中文均有标签（P0 计划稿里的 52 已按源文件修正）；9 位伙伴名中文标签全部缺失、7 项补给标签中文齐全。这些缺译是 P7 生成完整中英指南时必须补齐的清单，不以引擎已实现代替。

### 9.5 待裁决与修正记录

1. `keyword.expedition` 保持 `blocked`（P2 裁决「纯特性」还是「带规则关键词」）；`scan.pending.explicitly` 列出，不静默放行。
2. §5 原卡号表述已在第 9 节与 §5 正文按卡表修正：忒咳哩-哩 `08723`–`08729`（7 卡面 × 16 印刷份）、坚毅面 `08587`–`08595`、纪念逝者 `08730`–`08738`。
3. 记录键数量以源文件为准：`Key.hs` 56 个构造器（en/zh `key.*` 标签均 56），P0 计划稿的 52 作废。
4. `scan.dataFacts` 记录非门禁口径差异：`[[Expedition]]` 的 7 是特性计数（正文语料 17 卡 / 35 次）；`Possessed` 4 未能复现（正文语料 3 卡 / 7 次、特性 11 卡）；其余数据事实按卡数或出现次数口径均可复现。P2/P5 引用这些数字时以 `scan.dataFacts` 为准。

### 9.6 P1 实测命令

| 命令 | 结果 |
| --- | --- |
| `node tools/scan-eote-mechanisms.mjs --write` | 写入 `audit/eote-mechanism-scan.json`（637,913 B）+ 运行镜像 `artifacts/migration/eote/mechanism-scan.json` |
| `node tools/scan-eote-mechanisms.mjs --check` | 「eote mechanism-scan: 复算一致」exit 0（与磁盘逐字节一致；13/13 门禁为真） |
| `node --test tests/eote-migration.test.mjs` | 7/7 通过（P0 5 项 + P1 机制扫描 / 指南与规则来源 2 项） |
| `node --test tests/suite-manifest.test.mjs` | 1/1 通过（分层清单与 node-suite 一致） |

## 10. P2 通用原语记录（2026-11-07）

P2 只交付通用接口与引擎读点，不写任何卡牌/关卡/内容文件（`git status` 可核对）。契约与 API 全表见 [原语契约](primitives.md)。

### 10.1 目录分相

`audit/eote-primitive-plan.json` 把 P1 的 60 项目录分成：**reuse 25 / P2 23（extend 16 + new 7）/ P3 7 / P4 5**，`escape` 为空。P2 23 项全部 `done`；P3（`keyword.mirage/shelter/partner/resolute/expedition/level/key`）与 P4（`interaction.frostReveal/partnerSetup/sealPlacement/tekeliShuffle/deckTopReveal`）逐项记录阶段与理由，P2 已提前交付它们需要的引擎数据/状态读点。只读目录 `audit/eote-primitive-catalog.json` 固定 56 效果原语 / 12 能力 kind / 113 窗口 / play channels 清单与逐项模块表。

### 10.2 六组实现

| 组 | 原语 id | 主要模块 | 关键读点 | 测试 |
| --- | --- | --- | --- | --- |
| 寒霜/混乱标记 | `chaos.frost`、`chaos.tokenEffects` | `frost.js`、`chaos-token-pool.js`、`chaos-token-effects.js` | 8 枚物理池（袋/揭示/封印共用）、`extraRevealForFrost`、`shouldAutoFailForFrost`、`treat({as:'frost',modifier})`；`tests.js` frost 分支改读 `tokenEffect().modifier`（默认 -1） | frost |
| 战役记录 | `campaign.partner/seals/memorials/supplies` | `src/campaign/eote-{partners,seals,memorials,supplies}.js` | 伙伴四态与检查点 I 抽选、封印生命周期、遗物领取幂等、物资控制/掉落/回收（`SuppliesRecovered` 复用 record-sets） | campaign |
| 战役流程 | `campaign.flows`、`campaign.epilogue`、`scenario.mirageVersions` | `campaign-flow.js`（`stepReturn` 有序回场 + `completedStep`）、`epilogue-matrix.js`（记录驱动分支表）、`campaign-parts.js`（幻景 I–III 快照） | 检查点/幕间用相邻 `partGate`；幻景多次切入按完成步骤回场；尾声多段并播；注册期失败关闭 | flow |
| 地点/营地/设施/钥匙 | `location.shelter`、`scenario.camp/facility/sealTowers/keys` | `eote-shelter.js`、`eote-camp.js`、`eote-facilities.js`、`scenario-keys.js`（数值钥匙 `kind:'value'`） | 庇护值印刷值只读、营地/已揭示继承、设施激活/高塔坍塌、数值钥匙原子花费 | geo |
| 高度/格网/牌库 | `location.vertical`、`scenario.climb/cityVote/tekeliDeck` | `vertical-chain.js`（Level）、`eote-climb.js`、`grid-map.js`（城市扩展，7 个旧导出保留）、`eote-city.js`、`eote-tekeli.js`、`scenario-decks.js` | Level±1 攀登、坠落/掉线索/丢物资、行列公开投影与私密窥视、隐藏洗入不泄露 | travel |
| 调查员/玩家侧 | `physical.faces`、`investigator.deckTop/roundDistance/crossSeatPlay/discipline` | `physical-faces.js`、`eote-deck-top.js`、`eote-round-distance.js`、`play-channels.js`（`deckTop`/`otherHand` 通道 + 授权写入口）、`eote-disciplines.js` | 牌库顶私密揭示与每轮折扣、轮初距离、跨座位授权/取牌元数据、演武翻面/选择 | investigator |

`ctx.api.mechanics` 新增 `frost`、`shelter`、`camp`、`facilities`、`climb`、`city`、`tekeli`、`hiddenDecks`、`levels`、`deckTop`、`roundDistance`、`disciplines`、`crossSeat`、`eoteCampaign.{partners,seals,memorials,supplies}` 域；既有 `chaosTokens`/`keys`/`map`/`scenarioDecks` 保持兼容并扩展数值钥匙/城市/隐藏牌库读点。

### 10.3 状态与存档

- 场景级 `state.scenarioFlags.mechanics.eote`、战役级 `state.campaign.eote`，均为 `version:1` 可选扩展；数值钥匙与忒咳哩-哩牌实体复用既有 `mechanicState` 容器。
- 读点**从不初始化**容器；旧存档/旧战役字节不变。`save-migration.js#migrateState` 在普通存档、`continuation.base`、并行线三处调用 `src/engine/eote-primitives.js#validateEoteState`，坏数据拒绝读档。
- 本轮未提升 `STATE_SCHEMA_VERSION` / `RULES_VERSION`；形状变化必须显式提升扩展 `version` 并登记迁移。

### 10.4 门禁与证据

| 命令 | 结果 |
| --- | --- |
| `node tools/audit-eote-primitives.mjs --check` | 60 项目录复算一致；gates 全真；P2 23 项 `done` |
| `node tools/verify-eote.mjs --node` | 7 个 eote Node 专项全部通过，运行前后证据源 SHA-256 稳定 |
| `node tools/verify-eote.mjs --regression` | test:fast 仅剩 P0 冻结的 3 项既有失败（无新增）；replay 13 局 `--compare` 零漂移 |
| `node --test tests/eote-migration.test.mjs`（P0/P1 部分） | 7/7 通过（P2 测试同时并入 `test:eote`） |
| `node tools/hardcode-audit.mjs --check` / `audit-dead-primitives --check` / `audit-abilities --check` / `audit-entries` | 全部 exit 0：引擎卡号 0、无死分支、能力/合规基线不变 |
| `node tools/audit-tcu.mjs --check`（跨循环账本维护） | pass（因 `tests/suites.mjs` 与共享引擎模块变化，按工具重算 TCU 玩家卡账本与迁移账本：仅来源哈希/gate 摘要变化，仍 P10 pass） |

实现期发生过一次集成事故：P2-E 整文件重写 `grid-map.js` 丢失 7 个旧导出，导致 `location-look/capture/location-symbols/api-mechanics` 悬空；已按 `git show HEAD:` 恢复原实现并把 EotE 城市函数叠加在尾部，`engine.js`/`api-mechanics.js` 导入恢复、旧网格行为与 replay 逐字节不变。P2 期间 `src/campaign/campaign-flow.js` 的扩展使 TCU 账本来源哈希漂移，按工具重算后恢复 `--check`。

### 10.5 裁决与偏差

1. 寒霜只复用既有混乱区（袋/揭示/封印），不新增持久容器；`EOTE_FROST_STATE=null` 并在文档说明。
2. 数值钥匙放既有 `mechanicState.keys`（`kind:'value'`），彩色钥匙读点按 kind 过滤；不新增 eote 容器槽位。
3. 营地状态放 `eote.shelter = {camp, revealed}`（庇护值与营地规则绑定）；跨关营地记录归战役层。
4. 坠落伤害参考卡面没有通用规则，`fallDamage` 按「每层 1 点」可复算基线实现，内容层可用卡面数值覆盖（P5–P7 复核）。
5. `ascend/descend/teleportGrid/moveAcrossGrid` 只校验/记录/返回 transition，不直接搬调查员，避免绕过权威移动事务。
6. 跨座位代打只交付授权/枚举/取牌/元数据，控制权归属与费用分摊由 P5 调查员能力接线；忒咳哩-哩牌物理副本守恒由弱点结算调用方负责。
7. P2 期间的既有失败（TIC P8 replay、TDE 两条 P10 账本用例）保持冻结、不修不计入本循环；TDE/TIC 账本源哈希漂移仍属既有失败，留待对应修复轮。

### 10.6 后续阶段交接

- P3：`keyword.*` 解析与规则书条目（`keyword.expedition` 需裁决 trait / 规则关键词）；寒霜修正读点、地点 Level/Shelter、伙伴状态、数值钥匙已是现成读点。
- P4：五个 interaction 项 + `mechanic-view.js#view.keys` 补 `kind==='value'` 过滤；frost 池余量/伙伴面板/封印放置/隐藏洗入/牌库顶私人投影。
- P5：调查员规则（攻击后反应、跨关营地、轮初距离奖励、演武入场、代打控制权/分费）。
- P7：战役 flow 用 `partGate` + `stepReturn` 落 EotE 形状，尾声用 `resolveEpilogueBranches`/`flattenEpilogueBranches`。

## 11. P3 关键词与规则书记录（2026-11-07）

P3 只交付关键词清单与规则书（数据 + 审计 + 浏览器验收），不写任何卡牌行为与关卡内容；规则书只描述 P2 已实现的机制（引擎读点见 [原语契约](primitives.md)）。

### 11.1 关键词清单

`content/campaigns/edgeOfTheEarth/keywords.js` 冻结 38 个关键词，与 P1 扫描的 `keyword` 机制逐项相等（id、顺序、patterns、代表卡）：

- **通用关键词（映射既有基础条目）**：hunter、aloof、massive、retaliate、alert、surge、peril、hidden、victory、prey、spawn、parley、fast、permanent、exceptional（→ upgrade）、elite、revelation；objective/resign 使用本循环条目（eoteObjective/eoteResign）。
- **本循环关键词（19）**：mirage、shelter、partner、resolute、seal、sealTokens、level、key、tekelili、expedition、frost、supplies、titanic、hazard、broken、unbroken、eidolon、ancientOne、possessed。
- kind：keyword 28 / token 2（frost、sealTokens）/ trait 8（expedition、titanic、hazard、broken、unbroken、eidolon、ancientOne、possessed）。
- 代表卡语料 = **卡名 + 卡面正文 + 背面正文**（P1 扫描口径；08549 Fatal Mirage、08663 The Great Seal、08671 The Seal Weakens 仅靠卡名命中）。

### 11.2 规则条目

`web/eote-rules.js` 共 23 条双语条目（标题/正文中英成对、group=地球边缘、拼音 sortKey、related 全解析、正文无工程词）：

| 组 | 条目 |
| --- | --- |
| 战役 | eoteCampaign（八章顺序、检查点 I–III、幕间 I–III、尾声、可选致命幻景） |
| 混乱标记 | eoteFrost（8 枚物理池、-1、追加揭示、同检定第 2 枚自动失败、视为 frost、检定结束归还）、eoteSealTokens（[seal_a]–[seal_e] 符号） |
| 调查员 | eotePartners、eoteResolute（伙伴/坚毅面）、eoteMulticlass（0 级主职阶 + 1–5 级副职阶 + 最多 5 张其他 0 级）、eoteDiscipline（演武双面/命运重担） |
| 场景机制 | eoteTekeli（7 卡面 × 印刷份 = 16 张、不查看洗入、去向修正）、eoteShelter（庇护值 0–9、营地、检查点 I）、eoteLevel（Level 0–5、±1 攀登、坠落）、eoteMirage（I–III 版本与回场）、eoteSeals（休眠/取回/激活/放置/高塔）、eoteKeys（古城数值钥匙）、eoteSupplies（7 项物资控制/掉落/回收） |
| 关键词/特质 | eoteExpedition（[[Expedition]] 印刷特性）、eoteTitanic、eoteHazard、eoteBroken、eoteEidolon、eoteAncientOne、eotePossessed |
| 流程 | eoteObjective（幕目标）、eoteResign（撤退） |

### 11.3 规则书接入与检索

`web/rulebook-data.js` 仅 **+11 行** 接入：import、`...EOTE_RULES` 展开进 RULES（131 条）、`RULE_PINYIN` 补 23 个拼音 sortKey、`cardRuleIds` 对 `/^08\d{3}[a-z]?$/` 派发 `eoteCardRuleIds`。卡文直达覆盖 403/403 张本循环卡（每张带 `eoteCampaign`，关键词卡带对应条目，0 未链接）；`matchingRules('寒霜'/'Frost')` 命中 eoteFrost。

### 11.4 审计与证据

| 入口 | 结果 |
| --- | --- |
| `node tools/audit-eote-rules.mjs --check` | 逐字节一致；12/12 gates true；keywords **38/38 verified**、rulebook **23/23 verified**、cardLinks 403/403、desktop/mobile/zh/en 全真 |
| `node --test tests/eote-rules.test.mjs` | 关键词↔扫描↔卡文直达、23 条规则双语/拼音/related/检索/正文、原语口径、内容抽查全绿 |
| `node tools/run-eote-browser.mjs` | 6/6 通过（桌面 1440×950 / 移动 390×844 × 中英 + 卡文直达与焦点恢复），6 张截图写入 `artifacts/migration/eote/reports/screenshots/`；账本 `audit/eote-browser-acceptance.json` |
| `node tools/audit-eote-primitives.mjs --write` | `deliveredPrimitives` 回填 7 项 `keyword.*` 为 done（p3Delivered 7/7，plan gates 11/11 true）；P4 交互项仍按阶段记录 |
| `node tools/verify-eote.mjs --node` | 8 个 eote Node 专项全部通过（含 eote-rules），证据源运行前后稳定 |

### 11.5 裁决与偏差

1. **`keyword.expedition`（P1 blocked 项）裁决为印刷特性**：`[[Expedition]]` 无独立关键词能力，携带/掉落/回收规则归 P2 物资原语（`campaign.supplies`），规则条目按特性说明，不再单列原语；该 id 在 P2 计划中仍以 `keyword.expedition` 记录，P3 由规则层交付回填 done。
2. `seal` 与 `sealTokens` 拆成两个关键词（封印生命周期 vs 五枚物理符号），共用 eoteSeals/eoteSealTokens 两条规则。
3. `eoteTitanic` 按印刷内容写「泰坦坡道」地点规则（related 仍为 hunter/massive，与巨形关键词互链）。
4. `eoteSupplies` 为 3 张正文不含 supplies 字样的物资卡补卡名锚定 pattern；Level/Partner/Seal/Key 等 pattern 按关键词语料放宽以确保代表卡全覆盖。
5. 规则正文禁用「本局」等测试禁用词（改「本场游戏」），由 `tests/campaign-experience.test.mjs` 与规则书测试共同把关。
6. P3 未提升 schema/版本；`audit/eote-browser-acceptance.json` 冻结后 `audit/eote-rules.json` 引用其 sha256，浏览器证据重跑必须重写规则账本（`--check` 会失败提醒）。

### 11.6 后续阶段交接

- P4：5 个 interaction 项 + `mechanic-view.js#view.keys` 的 `kind==='value'` 过滤；规则书已就绪，交互面板直接复用现有 `.ah-rulebook` / 卡文直达链接。
- P5–P7：卡条目声明关键词时以 `content/campaigns/edgeOfTheEarth/keywords.js` 与 `audit/eote-rules.json` 为口径；`eoteRules` 规则条目不得在卡批次里改写，口径冲突先改规则书再改卡。

## 12. P4 交互与界面记录（2026-11-08）

P4 交付可被 P5–P7 复用的服务端选择事务、隐私投影与浏览器验收；**不写任何卡牌行为与章节内容**，不开放调查员/卡牌/章节。契约见[交互契约](interactions.md)，完成状态由[交互审计](../../audit/eote-interactions.json)复算。

### 12.1 服务端选择事务

`src/engine/eote-interactions.js#createEoteInteractions(state, deps)` 新增 9 组事务（frost/partners/seals/keys/tekeli/deckTop/crossSeat/discipline/supply），全部经既有 `selectMechanic` 的待决选择：确认前不写状态、可选效果取消在写入前、空候选不建死锁、伪造/过期/跨座位回答被既有选择校验拒绝。选择来源实体 id 会写入 `choice.source.id`，浏览器据此在取消/结算后把焦点还给来源卡。

### 12.2 隐私投影与界面

`src/integration/mechanic-view.js` 新增 `view.eote`：frost 池余量、伙伴名册公开状态、封印公开状态、忒咳哩-哩张数（仅张数）、牌库顶（仅本人或公开）、跨座位授权（仅被授权座位）、演武公开面、物资携带/掉落汇总；`maskMechanicSnapshot` 同步裁剪牌库顶与跨座位。`web/mechanic-ui.js` 在既有 summary 中追加 EotE 分组（`data-eote-frost/partners/seals/tekeli/deck-top/cross-seat/disciplines/supplies`），选择面板补 9 个操作标题与 frost 标记回退；中英文案与样式为增量，既有 TIC/TDE/TCU 面板 DOM 未变。

### 12.3 浏览器验收

`tests/eote-interactions.browser.mjs` 在真实大厅/HTTP/规则引擎路径上，用 `tests/eote-interaction-fixture.mjs`（仅测试服务器装入的确定性夹具，生产 Mod 不注册测试卡/不加调试端点）覆盖 2 个视口 × 8 项交互：寒霜连续揭示（真实引擎两枚寒霜 + 自动失败横幅 + 池余量）、伙伴选派（选择/取消/Esc 焦点恢复）、封印放置（多阶段 + 503 失败重试）、忒咳哩-哩洗入（去向选择、不泄露牌名）、牌库顶揭示（私有展示）、跨座位代打（授权/选择/取消）、物资指派、演武（确定性选择 + 场上翻面）。另跑既有剧本行动归属（桌面/移动）与固定指南入口（按需加载/失败重试）作为回归证据。

### 12.4 门禁与证据

| 入口 | 结果 |
| --- | --- |
| `node tools/audit-eote-interactions.mjs --check` | 逐字节一致；9/9 checks、2 视口 × 8 交互 coverage 全真；`deliveredPrimitives` 5 项 interaction.* 回填；P0 冻结失败单列不入新增 |
| `node tools/verify-eote.mjs --node` | 9 个 eote Node 专项全部通过（含 P4 交互测试），证据源运行前后稳定 |
| `node tools/verify-eote.mjs --regression` | test:fast 无新增失败（failures 恰为 P0 冻结项）、replay 13 局零漂移、运行期源码稳定 |
| `node tools/run-eote-interactions-browser.mjs` | 20/20 通过（16 EotE + 2 剧本行动归属 + 2 指南入口），3 specs，16 张截图，账本 passed |
| `node tools/audit-eote-primitives.mjs --write` | `p4Delivered` 5/5（P3 7/7、P2 23/23 保持），计划门禁全真 |

### 12.5 裁决与偏差

1. 演武选择是引擎侧确定性选择（需注入 `random`），P4 浏览器验收断言动作、公开面与翻面结果，不伪造一个不存在的待决面板；构筑入口属 P5。
2. 跨座位代打只交付授权/候选/费用分摊元数据，控制权转移与分费由 P5 能力接线。
3. 忒咳哩-哩洗入默认不产生选择（盲洗），需要时间选择去向时传 `destination:null`；任何路径都不向客户端返回牌序或牌面。
4. P0 冻结的 3 条既有失败（TDE P10 账本 ×2、TIC P8 replay）继续冻结，P4 只要求 test:fast 无新增。
5. 实现期修复：选择事务需传来源实体 id（否则取消后焦点无法恢复）；`createEoteInteractions` 创建期不做 eager 校验（与其它 api 域一致，P0 API 覆盖测试依赖该行为）。

## 13. P5 调查员及专属依赖记录（2026-11-08）

P5 交付五位调查员与 17 张专属依赖（9 张专属卡 + 8 张双面永久演武），并开放 `eoteInvestigators` 包；`eotePlayer`（P6）与 `eoteCampaign`（P7–P8）保持 catalog-only。逐人契约见[调查员契约](investigators.md)，状态由[调查员审计](../../audit/eote-investigators.json)逐项复算。

### 13.1 共用读点与构筑接入

- 新模块 `src/engine/eote-investigator-support.js` 集中「只对声明者生效」的读点：`investigator.tracksAttacks`（攻击历史，攻击结算后写入、回合结束清空）、`investigator.roundEvents`（`damage/horror/tests/handTwoPlus/enemyAtLocation`，轮初重置、各结算点写入）、`investigator.deckTop`（牌库顶常驻揭示，开局/轮初/抽牌后同步）、`flags.weaknessStaysOnDeckTop` / `locksDeckWhileRevealed` / `activatableWhileOnDeckTop`（预示者）。既有 13 局 replay 的调查员没有这些声明，回放指纹不变。
- `ctx.api` 新增窄入口：`flipAfterNextTest`（08013a）、`grantFreeActions`（08014a，内部用 `fightEvade` 受限行动原语，维持「最后 N 个行动」口径）、`commitDeckTop`（08005）、`eoteRoundEvents` / `eoteAttackedThisRound` / `eoteBlockedByDeckTopLock` 只读查询。
- 构筑：`src/deck/availability.js` 打开 5 位调查员与 17 张 `dependencyOnly` 专属依赖；陈丽丽的演武选择 `options.disciplines` + XP 门控 `options.xp`（可用张数 = 1 + floor(xp/15)，上限 4）同时落在 `src/deck/deckbuilding.js` 与 `web/deck-rules.js#validateDeckRules`；开局演武状态由 `content/campaigns/edgeOfTheEarth/investigator-data.js` 的声明驱动并在 setup 初始化。AI 随机选人池 `PLAYABLE_INVESTIGATOR_CODES` 保持不变。
- 共享引擎读点（P5 内按需补齐）：`enemies.js` 攻击历史/回合事件记账与 08003 直伤读点、`combat.js#doFight` 成功回调（长鞭）、`turn-flow.js#actionCost` 的 2 行动弃置、`actions.js#doPlay` 的跨座位代打/共同付费/08017 控制者选择、`moves.js#deckTopWeaknessDiscard`、`hidden-rules.js` 移动锁。全部为声明式读点，无卡号分支。

### 13.2 Node 与浏览器验收

- Node：五份逐人测试覆盖构筑合法/非法、旧印、能力、专属依赖、多人窗口、负面路径与 JSON 往返；`tests/eote-investigator-*.test.mjs` 合跑全绿，并纳入 `eas` 的 `test:eote` 与 `verify-eote --node`。
- 浏览器：`tests/eote-investigators.browser.mjs` 经真实大厅/HTTP/规则引擎路径对五码各跑桌面 1440×900 与移动 390×844（10 测试），断言大厅选人、自动构筑 30 张、专属依赖、真实开局与能力/状态投影；证据 `audit/eote-investigators-browser.json`，截图 20 张。

### 13.3 门禁与证据

| 入口 | 结果 |
| --- | --- |
| `node tools/audit-eote-investigators.mjs --check` | 逐字节一致；逐人 `verified`，`packBoundary`/`parallelVersionsOutOfScope`/`originalBaselinePreserved`/`replayZeroDrift`/`fastNoNewFailures` 全真 |
| `node tools/verify-eote.mjs --node` | P5 五份调查员测试及既有 EotE Node 专项全部通过，证据源运行前后稳定 |
| `node tools/verify-eote.mjs --regression` | test:fast 无新增失败（failures 恰为 P0 冻结项）、replay 13 局零漂移 |
| `node tools/run-eote-investigators-browser.mjs` | 10/10 通过（5 码 × 2 视口），`desktop/mobile/byCode` 全真，20 张截图 |
| `node tools/audit-eote-primitives.mjs --check` | P5 未新增原语条目；P2/P3/P4 计划门禁保持全真 |
| `node tools/audit-eote-rules.mjs --check` / `audit-eote-interactions.mjs --check` | 复算一致，证据源更新为 P5 后的 Node/浏览器/回归账本 |

### 13.4 裁决与偏差

1. 跨座位代打的控制权：08016 印刷为「打出后置于该调查员（手牌所有者）控制之下」，P5 在 `actions.js#doPlay` 落实；P4 原语测试的旧断言（打出者场上）同步改为牌主控制，属规则口径对齐而非放宽。
2. 08006 的 2 行动弃置由 `moves.js#deckTopWeaknessDiscard` 唯一实现（条目只留 flag 声明），避免同句规则两处实现；行动成本在 `turn-flow.js#actionCost` 与 `validateMove` 同口径为 2。
3. 08007 浏览器能力演示（结束回合）因进入强制投入选择未被浏览器 settle 消费，记录 `ability-skip` 注解并仍截图；该分支逻辑由 Node 逐人测试覆盖，不以此冒充浏览器交互验收。
4. 平行版本 `98007` / `90062` 及替换专属 `98008`/`98009`/`90063`/`90064` 明确留在范围外（`audit/eote-investigators.json#reprints`），不使用平行版本证明本编号完成。
5. 陈丽丽 XP 门控口径为「1 + floor(xp/15)，上限 4 张不同演武」，Node 与浏览器共享同一 `web/deck-rules.js` 校验；实现期按印刷「每累计 15 点经验可再加 1 张」对齐。
6. 冻结的 3 条既有失败（TDE P10 账本 ×2、TIC P8 replay）继续冻结；P5 只要求 `test:fast` 无新增失败。

## 14. P6 一般玩家卡记录（2026-11-08）

P6 交付 115 条一般玩家卡记录（111 张可构筑卡 + 4 张基础弱点），`eotePlayer` 包独立升为 playable：可构筑卡进入构筑界面与开放玩家卡池，基础弱点只作随机基础弱点依赖；`eoteCampaign`（P7–P8）保持 catalog-only。逐卡契约见[玩家卡契约](player-cards.md)，状态由[玩家卡审计](../../audit/eote-player-acceptance.json)复算。

### 14.1 分片与实现通道

- 分片由 P0 `scope.shards.playerWaves` 固定为 M2-1..M2-4（30/30/30/25），并集精确覆盖 `partitions.eotePlayer`；`audit/eote-player-shards.json` 登记 worker 与测试文件。
- 每张卡一个单卡文件 `src/cards/entries/<code>.js`，只用描述子与 `ctx.api`；四份分片测试 `tests/eote-player-m2-1..4.test.mjs` 共 123 条真实行为断言（每卡至少一条），另有 `tests/eote-player-primitives.test.mjs` 覆盖 13 项通用原语。
- 队列 `audit/eote-player-queue.json` 记录 35 项原语请求：13 项以通用读点交付（下一次检定加值、沉稳伤害侧、威胁伤害汇点、`actionTaken` 窗口、`lookAt` 6 张排列、跨座位手牌转移/代打、放逐手牌、咒印标记替换、查看未揭示地点面、攻击伤害反应、成功后弃自身换收益、检定额外揭示、基础行动技能替代），其余 22 项以现有原语近似实现并登记 P7 硬化候选；无 pending。
- 开放链路：`src/cards/eote-player-acceptance.js`（实跑生成码表）→ `content/packs/eotePlayer/manifest.js`（115 卡 rulesImplemented、111 deckbuilding、4 dependencyOnly）→ `availability`（strict/依赖/构筑池）→ `deckbuilding#EXPANDED_PLAYER_CARD_CODES`（111 张进入开放玩家池）；`PLAYER_CARD_CODES` 默认池与 AI 自动牌组不变。

### 14.2 Node 与浏览器验收

- Node：四份分片测试 123/123、原语测试 13/13，均纳入 `test:eote`、`verify-eote --node` 与 `tests/suites.mjs`/`tests/node-suite.mjs` 分层。
- 浏览器：`tests/eote-player.browser.mjs`（真实大厅/HTTP/引擎，服务端夹具注入代表性卡牌与局面）覆盖 2 视口 × 5 场景：构筑池开放（生产 `/api/catalog` 玩家池含 EotE 可构筑卡）、事件卡真实打出、资产卡装备/攻击、技能卡投入检定、基础弱点显现与结算；证据 `audit/eote-player-browser.json` 与 `artifacts/migration/eote/p6/screenshots/`。

### 14.3 门禁与证据

| 入口 | 结果 |
| --- | --- |
| `node tools/audit-eote-player.mjs --check` | 逐字节一致；115/115 verified、无简化、分片精确、队列无 pending、浏览器双视口通过 |
| `node tools/verify-eote.mjs --node` | 含四份分片测试与原语测试，全部通过，证据源运行前后稳定 |
| `node tools/verify-eote.mjs --regression` | test:fast 无新增失败（failures 恰为 P0 冻结项）、replay 13 局零漂移 |
| `node tools/run-eote-player-browser.mjs` | 10/10 通过（5 场景 × 2 视口），账本 status=passed、截图齐全 |
| `node tools/build-card-index.mjs --check` / `audit-card-entry-compliance --check` | 索引一致、条目合规无基线外新增违规 |
| `node tools/audit-eote-primitives.mjs --check` / `audit-eote-rules.mjs --check` / `audit-eote-interactions.mjs --check` / `audit-eote-investigators.mjs --check` | 复算一致（P5 调查员与 P0–P4 账本只更新来源哈希） |
| `node tools/scan-eote-scope.mjs --check` / `scan-eote-mechanisms.mjs --check` | 复算一致（P6 包阶段与来源已重签） |

### 14.4 裁决与偏差

1. **并发批次与索引**：P6 四份分片测试使用直接 import + 条件注册，不依赖全局索引；主进程在全部单卡文件落盘后统一重建索引（914 张：P5 调查员 22 + P6 玩家卡 115 + 旧卡），期间临时回退索引以保证引擎可导入，属批处理过程控制。
2. **近似实现（逐卡注释）**：约 50 处子句用现有原语的最接近等价实现，均在条目头注释、测试标题与 §14.1 队列中标注近似点与 P7 硬化候选；典型如「自动成功攻击→直接按攻击伤害结算」「跨座位快速事件候选→仅费用/牌库升级」「setAside 如同手牌→弃牌堆近似」「资源代付→减费/资源转换」「调查成功线索替换→追加效果」「指认混沌标记→效果记录+额外揭示」等。主效果均可玩且有测试，无空占位、无仅注册断言、无整卡 blocked。
3. **开放边界**：只开放玩家卡包（playable）；战役入口与八章仍未开放（P7–P8）。EotE 玩家卡不进入 `PLAYABLE_INVESTIGATOR_CODES`/AI 默认自动牌组，因此 13 局 golden replay 零漂移。
4. **冻结失败**：P0 冻结的 3 条既有失败（TDE P10 账本 ×2、TIC P8 replay）继续冻结；`scan-eote-baseline --check` 的外部 `behaviorLines` 漂移按 P0–P5 同口径不重签。

## 15. P7 共享遭遇、八章与战役流程记录（2026-11-08）

P7 交付 24 个遭遇组（16 个跨章共享 + 8 个章节专属，共 266 条战役记录，其中 264 条建行为条目、2 张
`type=scenario` 参考卡只作数据/身份）与八个章节单元；`eoteCampaign` 包与战役清单升为 playable，
大厅可选《地球边缘》，序幕 → 亡命冰原 I–III → 检查点 I–II → 幕间 I–III → 失落之峰 → 古老者之城 →
疯狂之心 I–II → 检查点 III → 尾声的主线可推进，致命幻景可在幕间 I–III 可选再入并按已完成章节回场。
章节契约与实现边界见[战役章节与流程验收](scenarios.md)。

### 15.1 分片与实现通道

- 章节分片：A = `iceAndDeathPart1/2`（26 条）、B = `iceAndDeathPart3` + `fatalMirage`（80 条）、
  C = `toTheForbiddenPeaks` + `cityOfTheElderThings`（52 条含 2 张参考卡）、D = `theHeartOfMadnessPart1/2`（28 条）、
  共享 = 16 组 80 条。每章一个目录（definition/layout/behavior/chaos/texts/index），每卡一个归属目录文件。
- 共享接线：`shared-encounters.js` 提供 `chapterCardPool/partnerRosterSpec/memorialsSpec/suppliesSpec/
  tekeliDeckSpec/SHELTER_BY_LOCATION_CODE`；忒咳哩-哩 16 张副本守恒（7 面 ×3/3/2/2/2/2/2），
  纪念逝者 9 件与伙伴划去配对，9 位伙伴安全面/坚毅面映射。
- 战役层：`parts.js`（8 单元/16 步骤/`eoteNextStep`）、`prologue/checkpoints/interludes/epilogue.js`
  （注册期效果处理器）、`flow.js`（47 节点可序列化 flow + `campaignFlowExtras` + `validateEoteFlow`）、
  `records.js`（Key.hs 56 项 + 流程层 8 项 + 章节专用 17 项，label 全部来自 story-text）。
- 剧情/指南：`tools/import-eote-story.mjs` 生成 `story-text.js`（8 章 469/469 段、战役各段、
  258 个 locale 键；中文三态 present-needs-review 260 / untranslated 10 / missing 199，逐路径 marker）；
  `tools/import-scenario-guides.mjs` 生成 `web/scenario-guides/<chapterId>.json` 八个指南文件，
  「关卡设置」面板按场景 id 加载，缺译显示「中文待补」。
- 引擎接线：8 章 behavior 适配到 `preScenarioSetup/setupLocations` 真实契约（`setupLocations` 返回
  location id 数组；自建全部地点的章节返回 `[]` 避免重复放置）；章节点/共享点不按卡号写分支。

### 15.2 验收入口

| 入口 | 结果 |
| --- | --- |
| `node --test tests/eote-scenario-*.test.mjs tests/eote-campaign-flow.test.mjs tests/eote-story.test.mjs` | 八章、共享遭遇、战役流程与剧情/指南测试全部通过 |
| `node tools/audit-eote-scenarios.mjs --check` | 8/8 章 verified；指南 469/469；战役卡 264/264；战役 playable/launchable；浏览器桌面+移动通过 |
| `node tools/run-eote-scenarios-browser.mjs` | 真实大厅启动《地球边缘》→ 序幕 → 8 章指南/章节流/记录投影，账本 `passed` |
| `node tools/import-eote-story.mjs --check` / `node tools/import-scenario-guides.mjs` | 逐字节复算一致、62 关指南生成校验通过 |
| `node tools/verify-eote.mjs --node` / `--regression` | P7 测试含在 Node 验收；`test:fast` 无新增失败、13 局 replay 零漂移 |
| `node tools/scan-eote-scope.mjs --check` / `scan-eote-mechanisms.mjs --check` / `build-encounter-index --check` | P7 包阶段与来源重签、索引 1573 条一致 |

### 15.3 裁决与偏差

1. **确定性布阵**：失落之峰山腰洗牌取 5、古老者之城三套布局/16 钥匙、疯狂之心设施槽的印刷随机
   在本实现用确定性顺序 + 可注入 shuffle（测试可复算），棋盘随机性留 P8 发布层打磨。
2. **地点特殊动作近似**：部分地点行动子结算（冻伤威胁计数、部分地点额外效果）用现有原语近似，
   逐项登记在章节 `behavior.scenarioApproximations` 与 `artifacts/migration/eote/primitive-requests/p7-*.json`；
   账本不计为完全等价。
3. **中文覆盖缺口**：zh locale 本身缺 199 段、8 段未译；运行时按 `chineseGaps` 显示「中文待补」，
   不机翻、不用英文冒充；补译走 P8 翻译批次。
4. **开放边界**：P7 打开战役入口与八章（playable），但发布级全卡/全流程审计、随机性打磨与
   正式发行验收仍属 P8；AI 调查员池与 13 局 replay 保持零漂移。
5. **冻结失败**：P0 冻结的 3 条既有失败继续冻结；`scan-eote-baseline --check` 的外部 `behaviorLines`
   漂移按 P0–P5 同口径不重签。

## 16. P8 整体验收与发布记录（2026-11-08）

P8 汇总发布：`audit/eote-migration.json` 为唯一总账本（verified），`audit/eote-release-acceptance.json`
为发布门禁复核（passed），`audit/eote-release-browser.json` 为真实大厅浏览器证据（passed）。发布细节
与已披露边界见 [P8 发布验收记录](p8-release.md)，本节只保留结论与最终数字。

### 16.1 生产注册与链路

- `content/registered.js` 静态注册战役/八章/三包；`assertLaunchable('edgeOfTheEarth')` 通过、大厅可见、
  `earlyAccess:false`；真实大厅链路（选战役 → 准备/构筑/席位 → 序幕 1–4 → 八章主线/检查点/幕间/升级/
  致命幻景/尾声）有 Node 与浏览器证据。
- P8 Node 验收：`node tools/verify-eote.mjs --node` → **475/475**（含 P0–P8 全部 EotE 测试，
  `sourceStableDuringRun:true`）。
- 全量回归：`node tools/verify-eote.mjs --regression` → **6956 项 / 6950 过 / 3 条 P0 冻结失败 /
  3 skipped、additions []、replay 零漂移、sourceStable**。

### 16.2 逐卡与规则

- `audit/eote-all-card-acceptance.json`：**403 条**（266 campaign / 22 investigators / 115 player）；
  verified 375、simplified 26（全部关联 8 个 pending 行为原语请求，逐条披露）、no-behavior 2
  （08596/08621 参考卡）、missing 0、blocked 0；每条记录带条目文件 sha256 与实跑证据。
- `audit/eote-rules.json`：23 条规则、38 条关键词、16 条规则书条目与卡文直达全 verified；
  `audit/eote-interactions.json` 交互验收 verified；条目合规/索引/集换门禁全绿。

### 16.3 真实大厅发布浏览器验收

- `node tools/run-eote-release-browser.mjs` → exit 0；3 specs（release/progression/online）× 桌面 1440×950 /
  移动 390×844，**6/6 用例 passed**、checks 12/12、**104 张截图**逐张 sha256/bytes 与磁盘一致
  （release 6/6、progression 42/42、online 4/4 每视口）、`blocked:[]`。
- 覆盖：大厅选择/启动、真实牌桌首章操作、逐章推进（检查点 I–III、幕间 I–III、真实升级、致命幻景、尾声）、
  双真人 relay 联机（手牌隐私、越权拒绝、断线恢复）。

### 16.4 发布边界

- 未采用提前开放（`earlyAccess:false`）；`releaseAcceptance.remaining=0`，deferred 28 条为
  已披露近似/队列项（25 条 pending 原语请求、26 张 simplified 卡、8 个 pending 行为请求、22 条 P6
  队列 rejected），逐条带证据路径，不阻塞发布门禁，但**不宣称与原版逐字等价**。
- 印刷随机布阵仍为确定性顺序 + 可注入 shuffle；中文缺译 260 present-needs-review / 10 untranslated /
  199 missing 按 `chineseGaps` 标记显示「中文待补」；补译与随机性打磨作为后续维护批次。
- 发布运行时不依赖 `参考资源/`：卡图走 `web/img/**` 本地缓存或数据远程回退字段（`audit/eote-scope.json#cardImages`），
  运行时目录扫描无参考工程读取点。

## 17. 中文翻译专项审计记录（2026-11-09）

> **修复状态**：本节是审计时点（修复前）的事实记录；同一天完成的**翻译修复批次**已把 82 条问题中的 75 条修复、7 条保留裁定，缺译全部补齐（章节 469/469、战役 258/258、指南 `chineseGaps=0`），并修复剧情/指南分段。修复记录、变更文件与验收命令见 [`translate/fix-batch.md`](translate/fix-batch.md) 及 §18。

发布后补充了一轮**只读翻译专项审计**（不改实现/生成器；台账与产物独立于迁移账本）。范围：`eoep` + `eoec` 的 08 号段中文侧 —— 403 张卡面、8 章 469 段剧情/指南、战役 258 个 locale 键、8 份「关卡设置」面板指南 JSON、跨内容术语/用字。完整报告、结构化 findings 与补译 backlog 见 [`translate/README.md`](translate/README.md)；共享口径见 [`translate/_SPEC.md`](translate/_SPEC.md)。

结论摘要：

- **卡面**：403 张卡 4030 个展示字段 100% 有中文，与上游 `cards_zh-cn.json` 去 HTML 后逐字节一致，**本仓导入/改写新增翻译问题 0**；发现 32 条**上游继承**问题（149 处 occurrence，high 2：08586 伤害/恐惧混淆、08022/08036/08050「每控制一张不同职阶」应按职阶计数），另含 `[fast]→[free]` 图标 53 张、Campaign Log/调查员名/物资名等。
- **剧情/指南覆盖**：复算与本文件 §15/§16 记录一致 —— 8 章 469 段 = 260 present / 10 untranslated / 199 missing；战役 258 键 = 189 / 1 / 68；补译 backlog **278 条**（[`translate/guides/coverage.json`](translate/guides/coverage.json)，章节 209 + 战役共享 69）。
- **新发现展示链缺陷（high，文档原口径仅覆盖指南面板正文层）**：故事日志/章节展示层把英文回退直接拼进 `intro/setup/resolutions` 且无「中文待补」标记（126 叶，Lead 复算 112 个纯英文段落）；战役 flow **14 个选项 label 显示英文并覆盖模块中文兜底**（根因 `records.js#storyBody` 不判三态 + `flow.js#localizeNodes` 无条件覆盖）；指南面板 **14 个缺译标题静默消失**、Part3「调查员设置」因 `@:` 引用未展开成假性缺译（en 面板整段丢失）。
- **错误符号/占位符**：`{'{'}frost{'}'}` 转义残渣（剧情 32 处/16 段、指南 7 段）、`[shelterValue]`/`Shelter Value:`/`Experience:` 原样显示、`。.`/半角标点（剧情 67 处、指南 65 处）、`Camp - X (N)` 记录标签 13 条、`keywords.js` Retaliate「报复」等，详见 translate §8。
- **用字与术语**：「著」作「着」661 处（剧情 451 / 指南 210）；规则书/模块自写偏差（议程/战役日志/Broken-Unbroken/泰坦坡道/木制雪撬等）见 [`translate/terms/glossary.md`](translate/terms/glossary.md)。
- **修复优先级**：P0 展示链三态门限与「中文待补」呈现 → P1 生成器（`{'{'}…{'}'}` 还原、`@:` 展开）→ P2 补译 278 条 → P3 上游继承卡面勘误/本仓自写术语 → P4 机械清理。本轮未修改任何内容文件；修复后需重跑 `import-eote-story --write`、`import-scenario-guides` 并同步 sources 哈希与账本。

## 18. 中文翻译修复批次记录（2026-11-09）

审计（§17）完成后立即执行了**翻译修复批次**：目标是把 82 条 findings 全部处理，并修复剧情/指南正文的分段问题。详细逐条状态、文件清单、保留项裁定与验收命令见 [`translate/fix-batch.md`](translate/fix-batch.md)。

- **结果**：75 条已修复、7 条保留并说明；缺译 backlog **278 → 0**；章节正文 **469/469**、战役 locale 键 **258/258**、八章指南 `chineseGaps=0`（343 段中文正文，128 段多段）。
- **机制**：参考资源只读，新增本地补译/修正层 `content/campaigns/edgeOfTheEarth/locale-supplement/`（4 文件 288 条 entry），由 `tools/import-eote-story.mjs` 生成时覆盖；卡面修正在 `card-text-fixes.js` 中由 `tools/import-cards.mjs` 调用；规则书/模块硬编码文案（records/checkpoints/interludes/web/eote-rules）直接修正。
- **分段修复**：生成器 `joinDisplay`/`buildResolutions`/`buildGroup`/`buildCampaign` 统一 `\n\n`；`story-access.js` flatten/resolution 空行分段；`src/campaign/story.js` 新增 `splitParagraphs` + `eoteIntroduction`（章节开场按叙事键分段、去重复标题）；指南面板保留段落空行并去掉结局正文重复标题。
- **验收**：`import-eote-story --check`、`import-scenario-guides`、`import-cards --check` 全 exit 0；`translate/tools/verify-fix-batch.mjs` `ok: true`；EOTE Node 测试 **364/364** 通过（含八章/剧情/流程/P8/replay/migration）；受内容影响的账本（scope/mechanisms/scenarios/rules/investigators/primitives）与 replay 基线已重签，`--check` 全 exit 0。
- **保留项**（7 条）：卡面换行排版（cards-0003）、08706/08707「险境」中文正确而 en 缺 Peril（cards-0020）、多段长引语引号惯例（story-0013 / guides-0008）、en 侧 `Scenario ???`（story-0014）、指南 `<li>`→纯文本列表合并（guides-0014）、卡面「庇护N」与规则「庇护值」层级差异（terms-0018）；裁定理由见 `translate/fix-batch.md` §5。
- **边界**：本批次只做中文内容/展示层修复，不改行为规则；P8 行为验收账本（release/all-cards/migration）不属本批范围，其工作区现状为既有 pending/降级状态（与翻译改动无关）。
