# 六循环《印斯茅斯暗潮》迁移路线图

英文名：The Innsmouth Conspiracy。战役标识：`theInnsmouthConspiracy`；本轮工具及审计简称：`tic`；来源战役编号：`07`。

建立日期：2026-11-02。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。P0 → P8 已完成，[总审计](../../audit/tic-migration.json) 状态 `playable`，P0–P8 均为 `verified`，`node tools/audit-tic.mjs --check` 复算一致。五位调查员、专属依赖及 93 条一般玩家卡记录已验收（90 张可构筑，3 张基础弱点只作依赖）；八章逐章 12 项验收 **8/8** 全绿，逐卡账本 252 张 `strictComplete`（`missing=0 / simplified=0`）。P8 已把 TIC 从 `catalog-only` 升级为生产可玩：战役与八章静态注册进内容组合根、大厅可启动、真实 layout 与逐章推进验收完成；`earlyAccess: false`，发布验收全部完成，详见 [P8 发布验收记录](p8-release.md)。

实施接口与证据说明见[原语契约](primitives.md)。本轮复算输入签入 `audit/tic-{scope,mechanism-scan,primitive-plan,primitive-catalog}.json`；大厅根目录 artifacts 保存运行镜像与过程资料，继续忽略，不放开整个目录。

## 1. 依据与打勾规则

遵循[内容迁移规范](../arkham-content-migration.md)、[架构与修改约定](../../ARCHITECTURE.md)、[一卡一文件操作手册](../card-entry-files.md)、[卡牌模型](../card-model.md)和[完整冒险指南要求](../scenario-guides.md)。本文件补充本循环的执行范围，不重新定义通用协议。

- `[ ]`：未完成，或缺少验收证据；实现中、阻塞和待复核均保持未勾选。
- `[x]`：完成该项要求，并在旁边或对应审计账本登记证据路径与验证结果。
- 阶段总项只有在其子项和退出门禁全部通过后才能打勾；`blocked`、`rejected`、`simplified` 和提前开放的延后项均不算完成。
- 审计确认组仍只使用 `pending` / `verified`；本清单不代替 `confirmations` 和 `releaseAcceptance`。
- 更新时记录日期、执行命令、结果及报告位置；测试数量、耗时和 replay 指纹数量取实测值，不手工写死。

### 已完成的规划准备

- [x] 阅读现有迁移规范及冒险指南要求，确定六步顺序与逐章验收口径。证据：本文件引用的规范。
- [x] 对照本地来源确认八章标识、真实剧本提示卡号及战役推进顺序。证据：下文来源清单、§4 的章节表与流程。
- [x] 建立本循环独立文档目录、阶段路线清单和完成勾选约定。证据：本文件。

## 2. 来源、范围与交付位置

来源根目录为大厅仓库的 `参考资源/ArkhamHorror-main/`，只读，不直接修改：

| 内容 | 来源相对路径 | P0 要锁定的内容 |
| --- | --- | --- |
| 卡牌数据与中文卡名 | `frontend/public/cards*.json` | 本循环内容包、卡号、正反面、关联卡、重印映射及 SHA-256 |
| 战役流程 | `backend/arkham-api/library/Arkham/Campaign/Campaigns/TheInnsmouthConspiracy.hs` | 幕间、升级窗口、日志、奖励与尾声分支 |
| 战役共用规则 | `backend/arkham-api/library/Arkham/Campaigns/TheInnsmouthConspiracy/` | 章节常量、初始混乱袋、记忆和共用机制 |
| 剧本身份 | `frontend/src/arkham/data/theInnsmouthConspiracy.json` | 八章真实提示卡号与单关设置项 |
| 卡牌及剧本行为 | `backend/arkham-api/library/Arkham/` 下相应 `CardDefs`、`Cards`、`Scenario/Scenarios` | 卡文、特别规则和参考行为逐项对应，不把参考实现自动视为无缺陷 |
| 中文剧情与指南 | `frontend/src/locales/zh/theInnsmouthConspiracy/` | `base.json` 及八章 `scenarios/*.json` 的完整覆盖 |
| 英文剧情与指南 | `frontend/src/locales/en/theInnsmouthConspiracy/` | 对照中文缺项、混入英文的段落、设置和特别规则，补译保留自译标记 |

`07xxx` 和 `tic / itd / def / hhg / lif / lod / itm` 是首轮扫描候选，不把连续编号或包名直接当作最终迁移范围。P0 必须展开关联面、调查员依赖、剧情奖励及跨循环重印；复用核心遭遇组只登记依赖，不重复归入本轮分片。

以下路径均相对 `games/arkhamhorror/`，是计划交付位置，尚未建立的文件不表示已实现：

| 产物 | 计划路径 |
| --- | --- |
| 战役与八章内容 | `content/campaigns/theInnsmouthConspiracy/{manifest,shared,chapters,story-text,encounter-rules}.js`、`scenarios/<scenarioId>/`；按需拆分，不建空壳 |
| 内容包 | `content/packs/ticCampaign/`、`ticInvestigators/`、`ticPlayer/` 的 `manifest.js` |
| 玩家卡行为 | `src/cards/entries/<code>.js`，重印号复用 canonical 实现 |
| 非玩家卡行为 | `src/cards/encounter-entries/theInnsmouthConspiracy/_shared/<group>/<code>.js` 或 `<scenarioId>/<code>.js`；跨战役卡沿用 `shared/<group>/` |
| 叙事生成 | `tools/import-tic-story.mjs` 与生成后的 `story-text.js` |
| 完整冒险指南 | 接入 `tools/import-scenario-guides.mjs`，生成 `web/scenario-guides/<scenarioId>.json` 中英正文 |
| 总审计与专项账本 | `tools/audit-tic.mjs`、`audit/tic-migration.json`；按需拆分原语、调查员、玩家卡、章节和逐卡账本 |
| 测试 | `tests/tic-*.test.mjs`、`tests/tic-*.browser.mjs`，注册本循环测试与审计脚本 |

运行资料放在**大厅仓库根目录** `artifacts/migration/tic/`，不与 Mod 下的历史 `artifacts/` 混用。最少包含 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、`shards.json`、`primitive-requests/`、`workers/`、`reports/` 和 replay 基线。只有干净检出复算所需的最小输入可逐文件加入白名单；截图、日志和执行过程文件不签入。

卡图继续使用 `web/img/cards/` 与 `web/img/zh/cards/` 及既有远程回退，不另建循环专属卡图副本。

## 3. 阶段路线清单

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。其中 P5–P7 是规范第 5 步的不同内容批次；P8 是第 6 步。M0–M5 仅表示内容产物范围，不替代执行顺序。

### P0：锁定范围与基线（M0）

- [x] 扫描候选内容包，输出唯一卡号全集、正反面与关联卡、重印 canonical 映射及范围外依赖。
- [x] 将调查员及专属依赖、一般玩家卡、共享遭遇组和逐章非玩家卡分成无交集集合，保留并集守恒检查。
- [x] 逐章锁定来源、真实提示卡号、四档混乱符号规则、初始混乱袋和完整指南来源，记录相对路径与 SHA-256。
- [x] 记录起始提交、工作区已有改动、回归既有失败，以及引擎卡号字面量、`EFFECTS`、逃生原语和 R1/R2/R3 合规基线。
- [x] 在行为改动前生成 golden replay 临时基线；登记 `scope.json` 和报告位置。
- [x] 接入目录身份和必要的审计骨架；未验收内容保持 `catalog-only`，战役、选人和构筑不因数据收录而开放。

退出门禁：来源可复算，集合无重叠无遗漏，现有 replay 可复现；此后来源漂移必须让 `--check` 失败。

### P1：扫描新增机制（规范第 1 步）

- [x] 全量扫描卡面、背面、规则、幕间及每章指南，形成 `mechanism-scan.json`，覆盖 `primitive / keyword / rulebook / interaction / scenario / content`。
- [x] 每张范围内卡至少关联一个机制条目；同一机制合并，记录代表卡号、来源、既有实现、缺口与候选原语。
- [x] 将 §5 的重点机制逐项分类，核实复用能力与真实缺口；未知机制保持阻断。
- [x] 建立八章完整指南段落清单，单列中文缺译和特别规则，不以“已有剧情正文”代替指南覆盖。

退出门禁：未分类卡为 0，所有原语缺口进入 P2；扫描阶段不批量写卡。

### P2：拆分并实现通用原语（规范第 2 步）

- [x] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels，先复用再新增。
- [x] 为祝福／诅咒、淹没／空气、钥匙、载具及调查员特殊投入等机制建立 `reuse / new / escape` 计划；具体 API 与裁定见[原语契约](primitives.md)。
- [x] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档；新状态纳入版本迁移。
- [x] 同句规则在第二张出现时提取候选，第三张前完成原语；本阶段先完成通用接口，未批量写卡，`escape` 为空。
- [x] 完成 `primitive-plan.json` 与只读 `primitive-catalog.json`；所有 `new` 项为 `done`，复用项可定位；本轮与同时点控制副本逐步 replay 一致，最初基线漂移另记。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

### P3：关键词与规则书（规范第 3 步，M4）

- [x] 对照全部卡面与指南确认关键词、时机词及已有关键词在本循环的适用性，逐项登记代表卡号。
- [x] 实现并验收祝福／诅咒及其相关卡文、封印与追加揭示等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。
- [x] 完成循环概览、记忆与升级窗口、淹没／钥匙／载具等规则条目及卡文直达链接。
- [x] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。
- [x] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目已由审计写入 `verified`。

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

### P4：新增交互与界面（规范第 4 步）

2026-11-03：交互实现、隐私投影和当前稳定源码的专项验收已完成，见[交互契约](interactions.md)与[交互审计](../../audit/tic-interactions.json)。封印／释放、钥匙、载具、原区投入／收回均通过真实大厅 HTTP 通路的桌面和移动验证；既有剧本行动归属与固定指南入口同时回归。这里验收通用接口，TIC 八章实际行动和完整指南仍须在 P7 逐章确认。

- [x] 完成祝福／诅咒连续揭示与封印选择、淹没等级与空气信息、钥匙持有／转移及载具座位／驾驶等扫描确认的新交互。
- [x] 完成调查员卡下方牌、投入／收回等必要交互，复用现有组件、CSS 变量和服务端合法动作。
- [x] 确认隐藏牌、嫌疑人／藏身处、记忆闪回与条件剧情的座位可见性，不向观察投影泄露未到达信息。
- [x] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。
- [x] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。
- [x] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及英文名避免译名差异。

2026-11-03：五位调查员及十一张专属依赖完成逐人验收，见[调查员契约](investigators.md)和[调查员审计](../../audit/tic-investigators.json)。桌面／移动覆盖真实构筑开局、换牌后的阿曼达首次轮换，以及戴克斯特卡面主动能力；当前源码 Node、浏览器、全量快测和行为改动前基线回放均通过。`ticInvestigators` 独立开放，原有 AI 随机选人池及自动构筑卡池保持稳定。

- [x] `07001` Sister Mary：构筑、起始祝福与补充时机、旧印、专属卡和专属弱点。
- [x] `07002` Amanda Sharpe：每轮卡下方牌、投入时机与重复使用、旧牌清理、旧印及专属依赖。
- [x] `07003` Trish Scarborough：发现线索后的敌人条件、发现／躲避选择、限制、旧印及专属依赖。
- [x] `07004` Dexter Drake：支援替换的费用与时机、控制权和离场、旧印及专属依赖；核对其他版本及重印映射。
- [x] `07005` Silas Marsh：投入技能收回时机、每轮限制、旧印的弃牌堆技能交互及专属依赖；核对其他版本及重印映射。
- [x] 五位调查员分别通过初始化、能力、构筑合法／非法、专属依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。

退出门禁：逐位证据完整才开放该调查员；已有同名版本不自动证明本编号与依赖已完成。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [x] 主进程生成 `shards.json`，按卡号／机制拆成适当分片，检查无交集、并集覆盖全部一般玩家卡。
- [x] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、进度和原语请求；共享层、账本、文档及索引由主进程维护。
- [x] 逐卡核对费用、槽位、使用次数、目标、窗口、区域、持续时间、每轮／每局限制、升级及负面路径。
- [x] 缺原语时写 `primitive-requests/*.json` 并将卡记为 `blocked`；主进程实现并验证后再恢复，不绕过 API 直写状态。
- [x] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。
- [x] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。

证据：[玩家卡验收](players.md)、[逐卡账本](../../audit/tic-player-acceptance.json)、[分片](../../audit/tic-player-shards.json)与[原语队列](../../audit/tic-player-queue.json)。33 项请求均完成，93 条记录无缺失、简化或阻塞；桌面／移动实际操作及当前源码的全量快测、回放均通过。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。

### P7：共享遭遇、八章及战役流程（规范第 5 步，M3）

- [x] 先迁移战役内共享遭遇组，再按 §4 顺序落地八章；按归属目录分片，避免共享卡重复实现。证据：逐卡账本 `audit/tic-all-card-acceptance.json`（252 条，missing=0/blocked=0）。
- [x] 八章逐项完成准备、区域守恒、地点连接、全部幕／议程正反面、敌人／诡计／剧情资产、符号与结局。证据：`audit/tic-scenario-acceptance.json` 8/8×12 全绿；八章 `tests/tic-scenario-*.test.mjs`。
- [x] 严格按原版游玩顺序接入四个幕间、记忆闪回和尾声，不按剧情时间线重排关卡。证据：`tests/tic-interludes.test.mjs`、`tests/tic-flashbacks.test.mjs`（含 flashback XIV）、`content/.../flow.js` 与 `story-text.js` 校验。
- [x] 根据实际升级窗口处理经验与升级权限；不得在每关之间默认开放升级。证据：`content/.../flow.js` 的 `continueNoUpgrade` 接线与幕间测试。
- [x] 从锁定来源生成完整叙事，覆盖所有可达分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。证据：`tools/import-tic-story.mjs --check` 完整（8 章 + 基础 348 段译补）。
- [x] 每章同步生成完整中英文指南，补译并标记缺项，通过来源覆盖、生成校验、Node 和浏览器验收。证据：`tools/import-scenario-guides.mjs --check` 54 关通过；`audit/tic-browser-acceptance.json`（38 例、coverage 4/4）。
- [x] 八章全部完成 §6 的逐章确认，战役记录、奖励、混乱袋和存档跨章一致。证据：C1–C8 全部勾选；`audit/tic-scenario-acceptance.json` 的 `saveReplay/resolutionsAndRecords` 8/8。

退出门禁：每章的字面行为与指南均有证据；章内定向夹具不能代替真实大厅路线，战役仍需 P8 发布验收。

### P8：整体验收与发布（规范第 6 步，M5）

2026-11-05：P8 完整发布验收完成，证据与逐项说明见 [P8 发布验收记录](p8-release.md)。TIC 已从
`catalog-only` 升级为生产可玩：战役与 8 章 `playable`、静态注册进组合根、真实 layout 与大厅启动
链路落地；三位调查员包、逐卡账本、节点/浏览器/replay 验收全部通过，`earlyAccess: false`，
`releaseAcceptance.deferred: []`，`remaining: []`。

- [x] 汇总 `audit/tic-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。证据：`audit/tic-migration.json`（`--write`/`--check` 复算一致）、`audit/tic-scope.json`、`audit/tic-all-card-acceptance.json`、`audit/tic-scenario-acceptance.json`、`audit/tic-browser-acceptance.json`、`audit/tic-release-browser.json`、`audit/tic-release-acceptance.json`。
- [x] 覆盖完整合法战役、失败／撤退路线、关键分支、条件记忆、四档难度、存档恢复和 replay。证据：`tests/tic-p8-campaign.test.mjs`（19 例）、`tests/tic-p8-multiplayer.test.mjs`（11 例）、`tests/replay-tic-p8.test.mjs` 与 `tests/fixtures/replay/tic-p8-baseline.json`（13 局 / 853 步 / 8 章覆盖）、`audit/tic-p8-replay.json`。
- [x] 从真实大厅验证选战役、选人、构筑、开局、逐章推进、升级与尾声；覆盖多人、AI、断线恢复和权限边界。证据：`tests/tic-release.browser.mjs`、`tests/tic-progression.browser.mjs`、`tests/tic-online.browser.mjs`（6/6 通过、30 张截图）与 `audit/tic-release-browser.json`、`audit/tic-release-acceptance.json`（12/12）。
- [x] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。证据：`cards:check` / `cards:encounter-check` / `audit:entries`、`import-scenario-guides --check`（54 关）、`import-tic-story --check`、`test:fast` 6393/6390/0、既有 golden replay 13/13、`build-presentation --check`、`check-doc-links`（broken 0）。
- [x] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。证据：总审计 `images` 门禁（361 条记录均有 `imagesrc` 远程回退，本地缓存与远程回退策略登记；runtime 入口扫描 0 条 `参考资源/` 绑定引用）。
- [x] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。证据：`audit/tic-migration.json` 的 `confirmations`（8 章 12/12、18 条关键词、10 条规则书）、`releaseAcceptance.required` 全 true、`gate.releaseGate.pass: true`。
- [x] 未采用提前开放：已按完整发布验收收口，`earlyAccess: false`、`releaseAcceptance.deferred: []`、`remaining: []`；无需保留提前开放标识。1 条同句模板重构项登记为 `maintenance`（不改变行为、不阻塞发布）。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

## 4. 八章路线与逐章清单

以下名称来自本地中文剧情；真实提示卡号来自来源的剧本身份表。

| 顺序 | 章节 | scenarioId | 提示卡号 | 优先验收内容 |
| --- | --- | --- | --- | --- |
| 1 | 绝望深坑 / The Pit of Despair | `thePitOfDespair` | `07041` | 随机洞穴、淹没与空气、钥匙、记忆闪回、逃离与失败结局 |
| 2 | 艾莲娜·哈珀失踪案 / The Vanishing of Elina Harper | `theVanishingOfElinaHarper` | `07056` | 嫌疑人／藏身处、线索排除与指认、隐藏信息、营救及日志分支 |
| 3 | 深陷危局 / In Too Deep | `inTooDeep` | `07123` | 城镇地图、路障与逃离、洪水、人物记录及后续衔接 |
| 4 | 魔鬼礁石 / Devil Reef | `devilReef` | `07163` | 船只／海域移动、水下区域、钥匙／遗物组合、怪物记录与幕间参数 |
| 5 | 全速恐惧 / Horror in High Gear | `horrorInHighGear` | `07198` | 车辆、驾驶与乘客、道路生成／离场、追逐和抵达时机 |
| 6 | 雾中之光 / A Light in the Fog | `aLightInTheFog` | `07231` | 灯塔及水下地图、俘虏／钥匙、遗物与记忆、多个结局的奖励和日志 |
| 7 | 达贡巢穴 / The Lair of Dagon | `theLairOfDagon` | `07274` | 任务与记忆条件、仪式及敌人流程、诅咒交互、终章前记录 |
| 8 | 暗潮之下 / Into the Maelstrom | `intoTheMaelstrom` | `07311` | 海底地图与淹没、终局敌人、钥匙／地图／仪式记录、全部终局与尾声 |

战役推进骨架（按参考战役 `nextStep` 核对）：

```text
序章 → 绝望深坑 → 幕间 I → 艾莲娜·哈珀失踪案 → 幕间 II
     → 深陷危局 → 魔鬼礁石 → 幕间 III（按钥匙组合传参）
     → 全速恐惧 → 雾中之光 → 达贡巢穴 → 幕间 IV
     → 暗潮之下 → 尾声
```

幕间 I → 第二章、第三章 → 第四章、第六章 → 第七章在参考流程中使用 `continueNoUpgrade`；其余升级、经验到账和闪回限制仍须逐条核对指南与参考行为，不能仅凭该调用推断全部规则。

- [x] C1 绝望深坑：§6 全部通过，记录证据。`tests/tic-scenario-thePitOfDespair.test.mjs`（10 例）。
- [x] C2 艾莲娜·哈珀失踪案：§6 全部通过，记录证据。`tests/tic-scenario-theVanishingOfElinaHarper.test.mjs`（13 例，含指控三分支/营救六结局）。
- [x] C3 深陷危局：§6 全部通过，记录证据。`tests/tic-scenario-inTooDeep.test.mjs`（11 例）。
- [x] C4 魔鬼礁石：§6 全部通过，记录证据。`tests/tic-scenario-devilReef.test.mjs`（7 例）。
- [x] C5 全速恐惧：§6 全部通过，记录证据。`tests/tic-scenario-horrorInHighGear.test.mjs`（9 例）。
- [x] C6 雾中之光：§6 全部通过，记录证据。`tests/tic-scenario-aLightInTheFog.test.mjs`（12 例，含捕获/押送围捕）。
- [x] C7 达贡巢穴：§6 全部通过，记录证据。`tests/tic-scenario-theLairOfDagon.test.mjs`（26 例）。
- [x] C8 暗潮之下：§6 全部通过，记录证据。`tests/tic-scenario-intoTheMaelstrom.test.mjs`（9 例，含并行幕 07316–18）。
- [x] 四个幕间、记忆集合、条件闪回、奖励与升级窗口均完成独立测试。证据：`tests/tic-interludes.test.mjs`、`tests/tic-flashbacks.test.mjs`、`tests/tic-harper-acts.test.mjs`、`tests/tic-parallel-acts.test.mjs`。
- [x] 尾声覆盖记忆收集完整／不完整及其他可达分支，无未触发剧情泄露。证据：`STORY_TEXT` 8 章 + 战役尾声完整性由 `import-tic-story --check` 与 `storyText` 8/8 覆盖。

## 5. 本循环重点机制检查表

此表是扫描和验收重点，不表示已穷尽本循环机制，也不预设全部需要新增引擎能力。当前 `src/engine/chaos-bag.js` 已有祝福／诅咒消耗、封印与归还基础，P1–P2 必须验证其完整语义后再决定扩展。

- [x] **祝福／诅咒**：修正与追加揭示、连续抽取、数量及区域守恒、封印／释放、取消／替换、检定结束清理和卡牌相关触发；区分袋内、已揭示、封印及移出状态。证据：P3 关键词 verified、`tests/tic-rules.test.mjs`、`audit/tic-migration.json#confirmations.keywords`。
- [x] **淹没与空气**：等级变化、水下移动、空气获取／消耗、检查时机、伤害及免疫修正；覆盖离场、失败和存档恢复。证据：`src/engine/flood.js` 读点 + `tests/tic-flooded-agendas.test.mjs`、`tic-scenario-theLairOfDagon/inTooDeep` 逐章测试。
- [x] **彩色钥匙**：放置、获得、持有、转移、支付／检查与离场；隐藏钥匙不向未授权玩家泄露。证据：`src/engine/scenario-keys.js` + 八章逐章测试与 `tic-rules.browser.mjs`。
- [x] **船只与车辆**：驾驶／乘客、上下车、容量与移动、敌人交互、区域离场和驾驶者被击败。证据：`tests/tic-fishing-vessel.test.mjs`、`tic-vehicle-restrictions.test.mjs`、`tic-chase-vehicles.test.mjs`、`tic-car-faces.test.mjs`。
- [x] **道路与动态地图**：位置生成、连接、移动方向、距离、滚动移除和区域守恒，不在引擎按章节名硬编码。证据：`tests/tic-road-hazards.test.mjs`、`tic-chase-vehicles.test.mjs`、`_shared.js#chaseRoundEndCleanup`。
- [x] **调查与指认**：嫌疑人、藏身处、排除信息、指认合法性与失败分支；隐藏答案、随机结果和加载后确定性保持一致。证据：`tests/tic-scenario-theVanishingOfElinaHarper.test.mjs`、`tic-harper-acts.test.mjs`、`tic-scenario-light-in-the-fog` 等。
- [x] **记忆与倒叙战役**：记忆恢复、闪回条件、经验和升级窗口、剧情资产变更、遗物及终章条件；重复恢复不能重复结算奖励。证据：`tests/tic-flashbacks.test.mjs`、`tic-interludes.test.mjs`。
- [x] **调查员特殊能力**：卡下方牌、特殊投入与收回、发现线索后的选择、支援替换及祝福补充；费用、窗口和次数限制完整。证据：P5 调查员逐人验收（`audit/tic-investigators.json`、`audit/tic-investigator-replay.json`）。
- [x] **已有关键词及模板**：潜伏、猎手、交战、复仇、封印等以实际扫描结果为准；已有实现也验证了本循环所需时机与交互。证据：`audit/tic-migration.json#confirmations.keywords`（verified）与 `tests/tic-keywords.test.mjs` 等既有回归。

## 6. 每章完成模板

每章在 `confirmations.scenarios.items` 建立独立记录并复制本清单。各项必须附源码、行为测试或审计证据；只检索卡号、文本非空或条目存在均不足以通过。
2026-11-04：八章均已完成以下 12 项（`audit/tic-scenario-acceptance.json` 每章 12/12、`--check` exit 0），下列模板勾选表示「所有已迁移章节均满足」。

- [x] `sourceLocked`：卡面、规则、指南和剧情来源及哈希完整。
- [x] `identityRegistered`：真实提示卡号、名称、章节身份及布局对应正确。
- [x] `setupAndZones`：准备、遭遇／保留／移除／胜利区、可选遭遇组和随机变体守恒。
- [x] `actsAndAgendas`：全部幕／议程、推进、背面、行动及 `scriptCard` 归属通过。
- [x] `locationsAndConnections`：地点正反面、连接、淹没、动态变体与离场通过。
- [x] `encounterBehaviors`：专属与共享敌人、诡计、剧情资产行为全部接线。
- [x] `literalCardBehavior`：逐卡逐能力核对费用、目标、区域、限制、持续时间与清理；合法入口出现、非法入口不出现、结果符合卡面。
- [x] `chaosEffects`：四档提示卡与符号时机、追加揭示和相关触发通过。
- [x] `resolutionsAndRecords`：全部可达结局、经验、创伤、奖励、混乱袋和跨章记录通过。
- [x] `storyText`：完整叙事与完整中英指南覆盖开场、分支、设置、特别规则、后续剧情、结局和结算；实际演出只投影已到达分支。
- [x] `saveReplay`：关键选择前后 JSON 往返、恢复及 replay 确定性通过。
- [x] `browserAcceptance`：真实大厅、桌面 1440／移动 390、指南入口位置、特别规则、折叠剧透、中英切换、重试与键盘操作通过。

## 7. 验证命令与记录方式

以下命令在 `games/arkhamhorror/` 执行。P0 的 baseline 必须先于行为修改，compare 在修改后执行；其余按对应阶段运行。各次实跑结果见下方证据登记，P4 以后的命令仍须在对应阶段执行。

```powershell
# 从 Mod 目录指向大厅根目录的运行资料
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/tic/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/tic/replay-before.json

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

P0–P8 已注册并可执行的本循环命令如下。P7 的章节与逐卡校验用 `node tools/audit-tic-scenarios.mjs --check`、`node tools/audit-tic-all-cards.mjs --check`、`node tools/run-tic-browser.mjs`；P8 的注册检查、行为回放、真实大厅发布验收与总账本分别用 `node tools/check-tic-registry.mjs`、`node tools/verify-tic.mjs --p8-replay`、`node tools/run-tic-release-browser.mjs` + `node tools/audit-tic-release.mjs --check`、`node tools/audit-tic.mjs --check`。扫描、计划及审计生成与 `--check` 校验分开；检查不重写基线。

```powershell
npm run scan:tic:scope:check
npm run scan:tic:check
node tools/verify-tic.mjs --node
npm run test:tic:interactions:browser
node tools/verify-tic.mjs --p4-regression
node tools/verify-tic.mjs --p5-replay
node tools/verify-tic.mjs --p6-replay
node tools/verify-tic.mjs --p8-replay
node tools/check-tic-registry.mjs
node --test tests/tic-p8-campaign.test.mjs tests/tic-p8-multiplayer.test.mjs tests/replay-tic-p8.test.mjs
node tools/run-tic-release-browser.mjs
node tools/audit-tic-release.mjs --check
node tools/audit-tic-scenarios.mjs --check
node tools/audit-tic-all-cards.mjs --check
npm run test:tic:player
npm run audit:tic:player
npm run plan:tic:primitives
node tools/audit-tic-interactions.mjs --write
node tools/audit-tic-investigators.mjs --write
npm run audit:tic
npm run audit:tic:primitives
npm run audit:tic:interactions
npm run audit:tic:investigators
npm run audit:tic:check
```

`test:tic` 可直接运行本循环 Node 专项；交互浏览器命令同时覆盖 P3 阅读、卡文直达及返回、P4 交互、P5 调查员、P6 玩家卡，以及既有剧本行动和指南入口。P7 新增入口：`tools/audit-tic-scenarios.mjs`（逐章 12 项，`--write`/`--check`）、`tools/audit-tic-all-cards.mjs`（逐卡账本，`--write`/`--check`）、`tests/tic-chapters-acceptance.browser.mjs`（八章实机验收）。P8 新增入口：`tests/tic-p8-{registration,campaign,multiplayer}.test.mjs`、`tests/replay-tic-p8.test.mjs`、`tests/{tic-release,tic-progression,tic-online}.browser.mjs`、`tools/audit-tic-release.mjs`、`tools/check-tic-registry.mjs`，发布验收结论见 [P8 发布验收记录](p8-release.md)。

### 阶段总览与证据登记

- [x] P0 范围与基线完成。
- [x] P1 机制扫描完成。
- [x] P2 原语完成。
- [x] P3 关键词与规则书完成。
- [x] P4 交互完成。
- [x] P5 调查员及专属依赖完成。
- [x] P6 一般玩家卡完成。
- [x] P7 八章、幕间、指南及战役流程完成。
- [x] P8 发布验收完成，完整迁移交付。

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-02 | 规划准备 | 完成规范阅读、来源定位、八章路线及清单建立；实现阶段均未勾选 | 文档检查结果随本次交付说明 | `docs/theInnsmouthConspiracy/README.md` |
| 2026-11-02 | P0 范围与基线 | 来源逐文件锁定；三包、关联面、重印与八章身份独立校验；仅目录收录 | `scan:tic:scope:check` 复算一致，专项测试通过；原始工作区与 replay 基线保留 | `audit/tic-scope.json`、`audit/tic-baseline.json`、`tests/fixtures/replay/tic-baseline.json` |
| 2026-11-02 | P1 机制扫描 | 全部范围卡正背面分类，逐段盘点指南和中英缺译，原语缺口进入计划 | `scan:tic:check` 复算一致，专项测试通过；扫描结果不算卡牌行为验收 | `audit/tic-mechanism-scan.json`、`tests/tic-migration.test.mjs` |
| 2026-11-02 | P2 原语 | 新增项全部 `done`，复用项有来源与读点；可选状态扩展有版本与存档校验 | Node 专项通过、`test:fast` 零失败、单卡结构及合规检查通过、原语计划逐字节复算一致 | `audit/tic-primitive-plan.json`、`audit/tic-primitive-catalog.json`、`audit/tic-node-acceptance.json`、`audit/tic-regression.json` |
| 2026-11-02 | P3 关键词与规则书 | 关键词与规则书确认组均 `verified`；中英阅读、检索、关联规则、卡文直达及焦点返回已验收 | 桌面与移动浏览器专项通过；总审计生成及只读复算通过，截图已人工查看 | `audit/tic-migration.json`、`audit/tic-browser-acceptance.json`、`artifacts/migration/tic/reports/screenshots/`（大厅根目录） |
| 2026-11-03 | P4 当前源码最终验收 | 通用选择、只读投影、牌桌组件及固定入口已验收；暂停并发写入后重跑，源码哈希稳定 | Node、桌面／移动浏览器与全量快测通过；P4 行为改动前基线逐步回放完全一致，交互及总审计均 `verified` | `docs/theInnsmouthConspiracy/interactions.md`、`audit/tic-interactions.json`、`audit/tic-interactions-browser.json`、`audit/tic-interaction-regression.json` |
| 2026-11-03 | P5 调查员及专属依赖 | 五位正式调查员及十一张专属依赖逐人确认；重印复用、控制权、费用、阶段顺序、JSON 恢复与可见性已验收 | 当前源码 Node、桌面／移动浏览器、全量快测、单卡及合规门禁通过；P5 行为改动前基线逐步一致，调查员及总审计均 `verified` | `docs/theInnsmouthConspiracy/investigators.md`、`audit/tic-investigators.json`、`audit/tic-investigator-replay.json`、`audit/tic-p5-baseline.json`、`audit/tic-migration.json` |
| 2026-11-03 | P6 一般玩家卡 | 三个无交集分片覆盖 93 条记录；33 项原语请求全部完成；90 张构筑卡、3 张基础弱点依赖已接线，重印复用，无缺失或简化 | 当前源码的逐卡与循环 Node、桌面／移动浏览器、全量快测、单卡和合规门禁通过；P4／P5／P6 基线逐步一致；P0–P6 总审计均 `verified` | `docs/theInnsmouthConspiracy/players.md`、`audit/tic-player-acceptance.json`、`audit/tic-player-shards.json`、`audit/tic-player-queue.json`、`audit/tic-player-replay.json`、`audit/tic-migration.json` |
| 2026-11-04 | P7 八章、幕间、指南及战役流程 | 44 张剩余非玩家卡全部收口（合并 backup 回收 19 张 + 6 worker 并行 25 张）；捕获/押送、并行幕、Harper 事件等引擎读点与内容层接线完成；八章逐章测试 8/8、逐卡账本 252 条 missing=0、中英指南 54 关与完整叙事校验通过 | `node tools/audit-tic.mjs --check` exit 0（P0–P7 全 `verified`）；`audit-tic-scenarios --check` exit 0（8/8×12）；`run-tic-browser` 38/38、P4–P6 浏览器 42/42；`test:fast` 6351 项/6348 过/0 失败、replay 13 局逐条一致；TDE/TCU 账本同口径重建后 `--check` 均 exit 0 | `audit/tic-migration.json`、`audit/tic-scenario-acceptance.json`、`audit/tic-all-card-acceptance.json`、`audit/tic-browser-acceptance.json`、`audit/tic-interactions-browser.json`、`docs/theInnsmouthConspiracy/p7-development.md` |

P0–P3 历史验收相对最初基线存在 `tfa-untamed-wilds-hub` 漂移；当时同一源码的结果与关闭 TIC 接线的控制副本逐步哈希全部一致。原始基线未改写，差异与两层比较结论保存在 `audit/tic-regression.json` 和 `audit/tic-control-regression.json`。P4、P5、P6 分别在行为改动前锁定 `tests/fixtures/replay/tic-p4-baseline.json`、`tic-p5-baseline.json` 和 `tic-p6-baseline.json`，最终验收与三份基线均逐步完全一致，未使用控制副本豁免。P7 的章节验收以 `audit/tic-p7-baseline.json` 与 `tests/fixtures/replay/tic-p7-baseline.json` 复算，13 局逐条一致。P8 发布验收以 `tests/fixtures/replay/tic-p8-baseline.json`（TIC 13 局 / 853 步 / 8 章）与 `audit/tic-p8-replay.json` 复算，`--compare` 13/13 一致；P8 已按完整发布收口，不再是待办。

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。

P7 已完成（2026-11-04），开发验收记录与逐章证据见 [P7 开发验收记录](p7-development.md)；本页 P7、C1–C8 与阶段总览已按 `audit/tic-migration.json`、`audit/tic-scenario-acceptance.json` 与 `audit/tic-all-card-acceptance.json` 的实跑结果勾选。

P8 已完成（2026-11-05），实现内容、证据与已披露限制见 [P8 发布验收记录](p8-release.md)；本页 P8 与阶段总览已按 `audit/tic-migration.json`（`status: playable`、`earlyAccess: false`、`releaseAcceptance` 全 true、`remaining: []`）、`audit/tic-release-browser.json`、`audit/tic-release-acceptance.json`、`audit/tic-p8-replay.json` 与逐卡/逐章账本的实跑结果勾选。

P7 现场进度、已知失败与恢复顺序见 [2026-11-03 交接文档](p7-handoff-2026-11-03.md)（历史资料）。P7、P8 均已完成；TIC 已作为完整迁移内容在大厅开放。
