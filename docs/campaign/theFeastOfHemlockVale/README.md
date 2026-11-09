# 九循环《铁杉谷盛宴》迁移路线图

英文名：The Feast of Hemlock Vale。战役标识：`theFeastOfHemlockVale`；本轮工具及审计简称：`fhv`；来源战役编号：`10`。

建立日期：2026-11-03。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。当前处于规划准备阶段，P0 → P8 均未开始，战役、调查员与一般玩家卡保持 `catalog-only`。

复算输入计划签入 `audit/fhv-{scope,mechanism-scan,primitive-plan,primitive-catalog}.json`；大厅根目录 `artifacts/migration/fhv/` 保存运行镜像与过程资料，继续忽略，不放开整个目录。

## 1. 依据与打勾规则

遵循[内容迁移规范](../../arkham-content-migration.md)、[架构与修改约定](../../../ARCHITECTURE.md)、[一卡一文件操作手册](../../card-entry-files.md)、[卡牌模型](../../card-model.md)和[完整冒险指南要求](../../scenario-guides.md)。本文件补充本循环的执行范围，不重新定义通用协议。

- `[ ]`：未完成，或缺少验收证据；实现中、阻塞和待复核均保持未勾选。
- `[x]`：完成该项要求，并在旁边或对应审计账本登记证据路径与验证结果。
- 阶段总项只有在其子项和退出门禁全部通过后才能打勾；`blocked`、`rejected`、`simplified` 和提前开放的延后项均不算完成。
- 审计确认组仍只使用 `pending` / `verified`；本清单不代替 `confirmations` 和 `releaseAcceptance`。
- 更新时记录日期、执行命令、结果及报告位置；测试数量、耗时和 replay 指纹数量取实测值，不手工写死。

### 已完成的规划准备

- [x] 阅读现有迁移规范及冒险指南要求，确定六步顺序与逐章验收口径。证据：本文件引用的规范。
- [x] 对照本地来源确认可游玩序曲与八章标识、真实剧本提示卡号及三天三夜推进顺序。证据：下文来源清单、§4 的章节表与流程。
- [x] 建立本循环独立文档目录、阶段路线清单和完成勾选约定。证据：本文件。

## 2. 来源、范围与交付位置

来源根目录为大厅仓库的 `参考资源/ArkhamHorror-main/`，只读，不直接修改：

| 内容 | 来源相对路径 | P0 要锁定的内容 |
| --- | --- | --- |
| 卡牌数据与中文卡名 | `frontend/public/cards*.json` | 本循环内容包（`fhvp`、`fhvc`）、卡号、正反面、绑定卡（磁通量稳定器／以太电流、汉克坚毅面）、敌人-地点（`enemy_location`）、重印映射及 SHA-256 |
| 战役流程 | `backend/arkham-api/library/Arkham/Campaign/Campaigns/TheFeastOfHemlockVale.hs` | 序幕、三天三夜状态机（`Day1/2/3 × Day/Night`）、白日与夜晚序曲、升级窗口、居民关系与尾声分支 |
| 战役共用规则 | `backend/arkham-api/library/Arkham/Campaigns/TheFeastOfHemlockVale/` | 章节常量（`CampaignSteps.hs`）、初始混乱袋、法典（`codex`）、勘察整备（`makePreparationsForNextSurvey`）、时间标记（`setupHemlockDay`）与居民关系（`Key.hs`、`Helpers.hs`） |
| 剧本身份 | `frontend/src/arkham/data/theFeastOfHemlockVale.json` | 序曲与八章真实提示卡号（`10704`、`10501`、`10523`、`10549`、`10569`、`10588`、`10605`、`10677a`、`10626`、`10679a/b`、`10651`） |
| 卡牌及剧本行为 | `backend/arkham-api/library/Arkham/` 下相应 `CardDefs`、`Cards`、`Scenario/Scenarios/TheFeastOfHemlockVale/` | 卡文、法典条目、昼夜分支、特别规则和参考行为逐项对应，不把参考实现自动视为无缺陷 |
| 英文剧情与指南 | `frontend/src/locales/en/theFeastOfHemlockVale/` | `base.json` 及 `{writtenInRock,hemlockHouse,theSilentHeath,theLostSister,theThingInTheDepths,theTwistedHollow,theLongestNight,fateOfTheVale}.json` 完整源文本 |
| 中文剧情与指南 | `content/campaigns/theFeastOfHemlockVale/story-source/` 与 `content/scenario-guide-translations.json` | 上游 `locales/zh/` 尚未收录 `theFeastOfHemlockVale` 目录；须按《食梦者》模式建立分批中文译文源并保留自译标记，禁止残留未译英文 |

`10001`–`10138`（`fhvp`）和 `10501`–`10743`（`fhvc`）以及关联面 `10005b`、`10016a`、`10016b` 是首轮扫描候选，不把连续编号或包名直接当作最终迁移范围。P0 必须展开双面／绑定卡、双提示卡（如 `10501` 与 `10502`）、居民双面卡（剧情支援面／敌人或密谋面）、传家宝奖励（`10713`–`10720`）及跨循环重印；复用核心遭遇组只登记依赖，不重复归入本轮分片。

以下路径均相对 `games/arkhamhorror/`，是计划交付位置，尚未建立的文件不表示已实现：

| 产物 | 计划路径 |
| --- | --- |
| 战役与章节内容 | `content/campaigns/theFeastOfHemlockVale/{manifest,shared,chapters,story-text,encounter-rules}.js`、`story-source/`、`scenarios/<scenarioId>/`；按需拆分，不建空壳 |
| 内容包 | `content/packs/fhvCampaign/`、`fhvInvestigators/`、`fhvPlayer/` 的 `manifest.js` |
| 玩家卡行为 | `src/cards/entries/<code>.js`，重印号复用 canonical 实现 |
| 非玩家卡行为 | `src/cards/encounter-entries/theFeastOfHemlockVale/_shared/<group>/<code>.js` 或 `<scenarioId>/<code>.js`；跨战役卡沿用 `shared/<group>/` |
| 叙事生成 | `tools/import-fhv-story.mjs` 与生成后的 `story-text.js` |
| 完整冒险指南 | 接入 `tools/import-scenario-guides.mjs`，适配非 `scenarios/` 子目录的英文源并生成 `web/scenario-guides/<scenarioId>.json` 中英正文 |
| 总审计与专项账本 | `tools/audit-fhv.mjs`、`audit/fhv-migration.json`；按需拆分原语、调查员、玩家卡、章节和逐卡账本 |
| 测试 | `tests/fhv-*.test.mjs`、`tests/fhv-*.browser.mjs`，注册本循环测试与审计脚本 |

运行资料放在**大厅仓库根目录** `artifacts/migration/fhv/`，不与 Mod 下的历史 `artifacts/` 混用。最少包含 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、`shards.json`、`primitive-requests/`、`workers/`、`reports/` 和 replay 基线。只有干净检出复算所需的最小输入可逐文件加入白名单；截图、日志和执行过程文件不签入。

卡图继续使用 `web/img/cards/` 与 `web/img/zh/cards/` 及既有远程回退，不另建循环专属卡图副本。

## 3. 阶段路线清单

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。其中 P5–P7 是规范第 5 步的不同内容批次；P8 是第 6 步。M0–M5 仅表示内容产物范围，不替代执行顺序。

### P0：锁定范围与基线（M0）

- [ ] 扫描候选内容包（`fhvp`、`fhvc`），输出唯一卡号全集、正反面与绑定卡（`10005b`、`10016a/b` 等）、重印 canonical 映射及范围外依赖。
- [ ] 将调查员及专属依赖、一般玩家卡、共享遭遇组（含山谷、第一／二／三日、居民、传家宝、色彩爪牙、枯疫、折射、森林、菌类、突变、着火等）和逐章非玩家卡分成无交集集合，保留并集守恒检查。
- [ ] 逐章锁定来源、真实提示卡号（含《岩间密语》双提示卡 `10501`/`10502` 及山谷序曲 `10704`）、四档混乱符号规则、初始混乱袋和完整指南来源，记录相对路径与 SHA-256。
- [ ] 记录起始提交、工作区已有改动、回归既有失败，以及引擎卡号字面量、`EFFECTS`、逃生原语和 R1/R2/R3 合规基线。
- [ ] 在行为改动前生成 golden replay 临时基线；登记 `scope.json` 和报告位置。
- [ ] 接入目录身份和必要的审计骨架；未验收内容保持 `catalog-only`，战役、选人和构筑不因数据收录而开放。

退出门禁：来源可复算，集合无重叠无遗漏，现有 replay 可复现；此后来源漂移必须让 `--check` 失败。

### P1：扫描新增机制（规范第 1 步）

- [ ] 全量扫描卡面、背面、规则、序曲、法典及每章指南，形成 `mechanism-scan.json`，覆盖 `primitive / keyword / rulebook / interaction / scenario / content`。
- [ ] 每张范围内卡至少关联一个机制条目；同一机制合并，记录代表卡号、来源、既有实现、缺口与候选原语。
- [ ] 将 §5 的重点机制逐项分类，核实复用能力与真实缺口（包含已有祝福／诅咒、巡逻、警戒的复用与扩展）；未知机制保持阻断。
- [ ] 建立序曲与八章完整指南及全部法典（Codex）段落清单，制定英文源的全量中文翻译计划，不以“已有卡牌中文”代替剧情与指南覆盖。

退出门禁：未分类卡为 0，所有原语缺口进入 P2；扫描阶段不批量写卡。

### P2：拆分并实现通用原语（规范第 2 步）

- [ ] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels，先复用再新增。
- [ ] 为法典触发与单次限制（`codex`）、昼夜条件词条（`Day [day]`／`Night [night]`）、逃逸（`Elusive`）、序曲整备资产持久化（`Persist`）、网格正交相邻（Location Adjacency）、敌人-地点双类型实体（`enemy_location`）与猎杀袋（Predation bag）等机制建立 `reuse / new / escape` 计划。
- [ ] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档；新状态纳入版本迁移。
- [ ] 同句规则在第二张出现时提取候选，第三张前完成原语；本阶段先完成通用接口，不批量写卡，`escape` 默认保持为空。
- [ ] 完成 `primitive-plan.json` 与只读 `primitive-catalog.json`；所有 `new` 项为 `done`，复用项可定位，replay 对比无非预期漂移。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

### P3：关键词与规则书（规范第 3 步，M4）

- [ ] 对照全部卡面与指南确认逃逸（Elusive）、白日／黑夜（`Day [day]`／`Night [night]`）、法典（`[codex] X`）、巡逻（Patrol）、警戒（Alert）及祝福／诅咒在本循环的适用性，逐项登记代表卡号。
- [ ] 实现并验收逃逸结算（攻击或被攻击后解除交战、移往连接地点并横置）、昼夜门控、网格正交相邻等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。
- [ ] 完成循环概览、三天三夜与可游玩序曲、铁杉谷法典、居民关系等级与笔记、网格正交相邻、逃逸与昼夜关键词等规则条目及卡文直达链接。
- [ ] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。
- [ ] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目由审计写入 `verified`。

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

### P4：新增交互与界面（规范第 4 步）

- [ ] 完成法典（`[codex] X`）触发、条件段落筛选与演进面板、三天三夜时间标记与居民关系等级／笔记展示、序曲结束保留 1 张非起始支援并选择下一场勘察关卡等扫描确认的新交互。
- [ ] 完成网格空位放置地点、矿车／道岔滑动、敌人-地点（`enemy_location`）双重交互（在场同时接受调查／移动与交战／攻击／躲避）、汉克被击败时翻面切换绑定坚毅调查员卡及凯特线索搬移等交互，复用现有组件、CSS 变量和服务端合法动作。
- [ ] 确认未触发法典条目、未到达昼夜分支、猎杀袋内容与条件剧情的座位可见性，不向观察投影泄露未到达信息。
- [ ] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。
- [ ] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。
- [ ] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及中英文名对照。

- [ ] `10001` Wilson Richards（威尔森·理查德）：`[[Tool]]` 0–5 级与守卫者 0–4 级构筑、每轮首张 `[[Tool]]` 支援减 1 费、`[[Tool]]` 支援检定技能值 `+1`、旧印场上与手牌 `[[Tool]]` 交换及专属依赖 `10002`、`10003`。
- [ ] `10004` Kate Winthrop（凯特·温斯罗普）：`[[Science]]` 0–4 级与探求者 0–5 级构筑、开局 `10005` 磁通量稳定器（关闭）在场、调查员与无毁灭／无线索 `[[Science]]`／`[[Tool]]` 支援间移动线索、带线索支援离场放回地点、稳定器翻面（`10005b` 开启）与检索绑定卡 `10006`/`10007` 以太电流、旧印及专属弱点 `10008`。
- [ ] `10009` Alessandra Zorzi（亚历山德拉·佐兹）：带“谈判（Parley）”卡牌 0–5 级构筑、每回合额外一次谈判专用行动、旧印自动躲避所在或已揭示连接地点非精英敌人及专属依赖 `10010`（3 张）、`10011`。
- [ ] `10012` Kōhaku Narukami（鸣神琥珀）：`[[Blessed]]`／`[[Cursed]]` 0–5 级与 `[[Occult]]` 0 级构筑、回合开始向混乱袋加入数量较少的一方（平局自选）或移除各 2 枚获额外行动、旧印及专属依赖 `10013`、`10014`。
- [ ] `10015` Hank Samson（汉克·萨姆森）：35 张牌库与 `[[Innate]]`／`[[Spirit]]` 0–2 级构筑、承接同地点调查员或盟友的伤害／恐惧、将要被击败时治愈全部伤恐并交换为绑定 `[[Resolute]]` 版本（`10016a` 或 `10016b` 二选一朝上，上限与能力随之变更）、旧印及专属依赖 `10017`、`10018`。
- [ ] 五位调查员分别通过初始化、能力、构筑合法／非法、专属与绑定依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。

退出门禁：逐位证据完整才开放该调查员；已有同名版本不自动证明本编号与依赖已完成。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [ ] 主进程生成 `shards.json`，按卡号／职阶／机制拆成适当分片，检查无交集、并集覆盖全部一般玩家卡（含祝福／诅咒进阶卡、面具 `[[Mask]]` 补给卡、工具／科学线索卡、谈判卡、契约基础弱点等）。
- [ ] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、进度和原语请求；共享层、账本、文档及索引由主进程维护。
- [ ] 逐卡核对费用、槽位、使用次数（含跨支援共享花费补给／子弹）、目标、窗口、区域、持续时间、每轮／每局限制、升级及负面路径。
- [ ] 缺原语时写 `primitive-requests/*.json` 并将卡记为 `blocked`；主进程实现并验证后再恢复，不绕过 API 直写状态。
- [ ] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。
- [ ] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。

### P7：共享遭遇、序曲、八章及战役流程（规范第 5 步，M3）

- [ ] 先迁移战役内共享遭遇组（山谷、第一／二／三日、居民、传家宝、色彩爪牙、枯疫、折射、森林、菌类、突变、着火等），再按 §4 落地山谷序曲与八章；按归属目录分片，避免共享卡重复实现。
- [ ] 八章及可游玩序曲逐项完成准备、昼夜时间标记配置、网格连接、全部幕／议程正反面、法典条目、敌人／敌人-地点／诡计／居民剧情资产、符号与结局。
- [ ] 严格按三天三夜状态机接入 3 段白日山谷序曲、3 段夜晚序曲、5 选 1 勘察关卡（按白日／黑夜与第几日动态调整设置）及固定夜晚关卡（《扭曲空洞》《最长一夜》《山谷的命运》）。
- [ ] 准确实现白日序曲结束时的勘察整备（保留 1 张非起始支援带入下一关、手牌与资源裁至起始上限）及经验记入“未花费经验”（`Unspent Experience`），仅在指南指定的升级窗口开放购牌升级，白日序曲到紧邻勘察关卡之间保持 `noUpgrade`。
- [ ] 完成 `locales/en/theFeastOfHemlockVale/` 全量中文翻译并生成完整叙事与法典文本，覆盖所有可达居民关系与昼夜分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。
- [ ] 每个章节与可游玩序曲同步生成完整中英文指南，通过来源覆盖、生成校验、Node 和浏览器验收。
- [ ] 序曲与八章全部完成 §6 的逐章确认，战役记录、居民关系等级与笔记、已勘察区域、传家宝、混乱袋和存档跨章一致。

退出门禁：每章的字面行为、法典与指南均有证据；章内定向夹具不能代替真实大厅路线，战役仍需 P8 发布验收。

### P8：整体验收与发布（规范第 6 步，M5）

- [ ] 汇总 `audit/fhv-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。
- [ ] 覆盖完整合法战役（不同勘察顺序、第 1 夜进入《扭曲空洞》或额外勘察、不同居民最高关系路线）、失败／撤退路线、四档难度、存档恢复和 replay。
- [ ] 从真实大厅验证选战役、选人、构筑、开局、序曲整备与带支援入场、法典交互、逐日推进、升级与尾声；覆盖多人、AI、断线恢复和权限边界。
- [ ] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。
- [ ] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。
- [ ] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。
- [ ] 如决定提前开放，另行证明基础门禁，在 `releaseAcceptance.deferred`、`remaining` 和大厅明确延后项，保留 `earlyAccess: true`；延后项不打勾。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

## 4. 序曲与八章路线及逐章清单

以下名称来自本地中文卡表与剧情；章节标识与提示卡号来自 `theFeastOfHemlockVale.json` 及 `CampaignSteps.hs`。

| 顺序 | 类别 | 章节／序曲 | scenarioId | 提示卡号 | 优先验收内容 |
| --- | --- | --- | --- | --- | --- |
| P1 | 白日序曲 | 欢迎来到铁杉谷 / Welcome to Hemlock Vale | `welcomeToHemlockVale` | `10704` | 山谷符号连接地图、居民初见与法典 1–9、结束时保留 1 张非起始支援并选择第 1 日勘察关卡 |
| P2 | 黎明序曲 | 第二日黎明 / Dawn of the Second Day | `dawnOfTheSecondDay` | `10704`（`10677a`） | 第二日山谷变化、失踪／幸存居民法典、传家宝与关系等级、整备并选择第 2 日勘察关卡 |
| P3 | 黎明序曲 | 最终日黎明 / Dawn of the Final Day | `dawnOfTheFinalDay` | `10704`（`10679a`） | 最终日山谷异变、疯狂弱点抽取／居民决断、整备并选择第 3 日勘察关卡 |
| 1 | 勘察关卡 | 岩间密语 / Written in Rock | `writtenInRock` | `10501`／`10502` | 北角矿井网格滑动、矿车（Mine Cart）移动、废料（Scrap）与道岔（Switch）、场景 1/2 提示卡切换、昼夜差异 |
| 2 | 勘察关卡 | 汉洛克庄园 / Hemlock House | `hemlockHouse` | `10523` | 铁杉港庄园楼层、敌人-地点（`enemy_location`）双重结算、猎杀袋（Predation bag）、威廉／里弗法典与昼夜差异 |
| 3 | 勘察关卡 | 寂静荒野 / The Silent Heath | `theSilentHeath` | `10549` | 珍珠岭网格正交连接、巢穴（`[[Lair]]`）与昆虫（`[[Insect]]`）生成／胜利区重洗、莉亚法典与昼夜差异 |
| 4 | 勘察关卡 | 消失的姐妹 / The Lost Sister | `theLostSister` | `10569` | 阿克万海岸洞穴（`[[Cave]]`）网格展开、异形（`[[Abomination]]`）、西奥／海伦搜救法典与昼夜差异 |
| 5 | 勘察关卡 | 深沼之物 / The Thing in the Depths | `theThingInTheDepths` | `10588` | 伊斯特威克沼泽渗坑（Sinkhole）积累、沼地沉没（`[[Sunken]]`）翻面、攫噬触须、吉迪恩／西缅法典与昼夜差异 |
| 6 | 第 1 夜关卡 | 扭曲空洞 / The Twisted Hollow | `theTwistedHollow` | `10605` | 森林动态空位放置地点、黑暗等级（Darkness level）、追击区（In pursuit）敌人生成、伯蒂搜救与夜晚脱出 |
| 7 | 第 2 夜关卡 | 最长一夜 / The Longest Night | `theLongestNight` | `10626` | 汉洛克庄园夜战防守、屏障（Barrier）／诱饵（Decoy）／陷阱（Trap）布防、四向围攻推進与居民牺牲／存活 |
| 8 | 第 3 夜终章 | 山谷的命运 / Fate of the Vale | `fateOfTheVale` | `10651` | 最终夜仪式、宇宙密使（Cosmic Emissary）、居民关系等级与笔记总清算、多路线终局与尾声 |

战役推进骨架（按参考战役 `TheFeastOfHemlockVale.hs` 的 `nextStep` 与三天三夜状态机核对）：

```text
序幕 → 序曲：欢迎来到铁杉谷（Day 1 · Day，10704，不升级）
     → 第 1 日白日勘察（从 10501 / 10523 / 10549 / 10569 / 10588 中选 1 关未勘察区域）
     → 序曲：第一夜（晚宴进食选择、法典 θ/δ/σ/ω/γ/π；选择搜寻伯蒂进 10605，或加石板+古神标记再选 1 关夜探）
     → 第 1 夜关卡（扭曲空洞 10605，或未勘察关卡的 Night 1 形态）
     → 序曲：第二日黎明（Day 2 · Day，10677a / 10704，整备保留 1 支援，不升级）
     → 第 2 日白日勘察（剩余未勘察区域选 1 关，Day 2 形态）
     → 序曲：第二夜 → 最长一夜（Day 2 · Night，10626）
     → 序曲：最终日黎明（Day 3 · Day，10679a / 10704，整备保留 1 支援，不升级）
     → 第 3 日白日勘察（剩余未勘察区域选 1 关，Day 3 形态）
     → 序曲：最终夜（10679b） → 山谷的命运（Day 3 · Night，10651） → 尾声
```

白日序曲与紧随其后的白日勘察关卡之间使用 `noUpgrade`，且保留序曲结束整备所选的 1 张非起始支援直接开局在场；序曲与幕间获得的经验先记入未花费经验，在每天结束后的指定升级窗口消费。

- [ ] P1–P3 三段可游玩山谷序曲及三段夜晚序曲：整备、法典、升级锁与区域选择全部通过，记录证据。
- [ ] C1 岩间密语：§6 全部通过，记录证据。
- [ ] C2 汉洛克庄园：§6 全部通过，记录证据。
- [ ] C3 寂静荒野：§6 全部通过，记录证据。
- [ ] C4 消失的姐妹：§6 全部通过，记录证据。
- [ ] C5 深沼之物：§6 全部通过，记录证据。
- [ ] C6 扭曲空洞：§6 全部通过，记录证据。
- [ ] C7 最长一夜：§6 全部通过，记录证据。
- [ ] C8 山谷的命运：§6 全部通过，记录证据。
- [ ] 尾声覆盖居民存活、关系等级满格、深渊／星之子等全部可达分支，无未触发剧情泄露。

## 5. 本循环重点机制检查表

此表是扫描和验收重点，不表示已穷尽本循环机制，也不预设全部需要新增引擎能力。当前已有祝福／诅咒、巡逻、警戒等基础，P1–P2 必须验证本循环的新增规则与组合边界。

- [ ] **铁杉谷法典（The Codex，`[codex] X`）**：地点、居民与敌人上的法典触发行动／强制能力，先支付全部费用再结算当前序曲／关卡的对应编号条目；每条法典在单场序曲或冒险中默认最多结算一次；由触发者（不明确时由队长）执行检定、扣血、付费等全部效果；按居民笔记（Notes）与关系等级顺序匹配唯一满足条件的小节，名字已划去的居民及其笔记不生效、不可入场。
- [ ] **三天三夜、昼夜标记（`Day [day]`／`Night [night]`）与动态设置**：开局按当前天数与昼夜放置时间标记卡（`10675`/`10677`/`10679`）；卡面 `(白日[day])` 与 `(黑夜[night])` 词条仅在对应时段激活；五个勘察关卡在 `Day 1 / Night 1 / Day 2 / Day 3` 下的遭遇组拼装、居民在场位置、密谋阈值与特殊规则分支。
- [ ] **可游玩序曲与勘察整备（`makePreparationsForNextSurvey`）**：山谷序曲结束后，每位调查员在所有受控非起始、非永久支援中选择 1 张标记 `Persist` 保留到下一场勘察关卡开局在场，其余弃置；手牌与资源若高于起始上限则弃／扣至起始值，弃牌堆洗回牌库；不开放牌组升级。
- [ ] **居民关系等级（Relationship Levels）、笔记与传家宝**：每位居民独立维护关系等级（勾选格数增减与归零）、专属笔记集合与存活／划去状态；达到特定关系等级或完成法典支线时获取传家宝（`10713`–`10720`）或角色支援加入牌组。
- [ ] **网格正交相邻（Location Adjacency）与动态放置地点**：除使用《山谷》遭遇组的序曲／关卡只按图标连接外，网格关卡中共享上／下／左／右边的地点默认互相连接（对角线不算相邻）；新地点入场时必须放入当前地点正交相邻的空位，无空位则不入场。
- [ ] **敌人-地点（`enemy_location`）与猎杀袋（Predation bag）**：《汉洛克庄园》中兼具 `enemy` 与 `location` 属性的实体，同时支持调查员在内停留／移动、被调查、作为敌人横置／受伤害／治愈，以及与独立猎杀袋的标记抽取与转移交互。
- [ ] **逃逸（Elusive）、巡逻（Patrol）与警戒（Alert）**：带 `Elusive` 的重整敌人在攻击或被攻击结算后立即与所有调查员解除交战、移动到连接地点（如有可能，优先选择无调查员的地点）并横置；`Patrol (目标)` 在敌军阶段按最短路径移动；`Alert` 躲避失败后不横置立即反击。
- [ ] **调查员与玩家卡特殊机制**：威尔森工具减费与旧印工具交换、凯特磁通量稳定器双面翻转与支援线索充能、亚历山德拉额外谈判行动、鸣神琥珀祝福／诅咒平衡与双消额外行动、汉克濒死切换绑定坚毅版本（`10016a/b`），以及跨支援花费补给／子弹、面具补给充能等。

## 6. 每章完成模板

每章在 `confirmations.scenarios.items` 建立独立记录并复制本清单。各项必须附源码、行为测试或审计证据；只检索卡号、文本非空或条目存在均不足以通过。

- [ ] `sourceLocked`：卡面、规则、指南和剧情来源及哈希完整。
- [ ] `identityRegistered`：真实提示卡号、名称、章节身份及布局对应正确。
- [ ] `setupAndZones`：准备、时间标记、整备继承支援、居民入场、遭遇／保留／移除／胜利区和按日变体守恒。
- [ ] `actsAndAgendas`：全部幕／议程、推进、背面、行动及 `scriptCard` 归属通过。
- [ ] `locationsAndConnections`：地点正反面、网格正交连接／图标连接、滑动／沉没／楼层、敌人-地点及离场通过。
- [ ] `encounterBehaviors`：专属与共享敌人、敌人-地点、诡计、居民与传家宝剧情资产行为全部接线。
- [ ] `literalCardBehavior`：逐卡逐能力核对昼夜条件、法典入口、费用、目标、区域、限制、持续时间与清理；合法入口出现、非法入口不出现、结果符合卡面。
- [ ] `chaosEffects`：四档提示卡与符号时机、猎杀袋／道岔／渗坑／屏障联动和相关触发通过。
- [ ] `resolutionsAndRecords`：全部可达结局、法典记录、居民关系与笔记、已勘察区域、日期推进、经验、创伤、混乱袋和跨章记录通过。
- [ ] `storyText`：完整叙事、法典与完整中英指南覆盖开场、分支、设置、特别规则、后续剧情、结局和结算；中文无漏译英文残留；实际演出只投影已到达分支。
- [ ] `saveReplay`：关键选择前后 JSON 往返、恢复及 replay 确定性通过。
- [ ] `browserAcceptance`：真实大厅、桌面 1440／移动 390、指南入口位置、特别规则、折叠剧透、中英切换、重试与键盘操作通过。

## 7. 验证命令与记录方式

以下命令在 `games/arkhamhorror/` 执行。P0 的 baseline 必须先于行为修改，compare 在修改后执行；其余按对应阶段运行。

```powershell
# 从 Mod 目录指向大厅根目录的运行资料
node tools/replay-fixtures.mjs --baseline ../../artifacts/migration/fhv/replay-before.json
node tools/replay-fixtures.mjs --compare ../../artifacts/migration/fhv/replay-before.json

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
npm run scan:fhv:scope:check
npm run scan:fhv:check
node tools/verify-fhv.mjs --node
npm run test:fhv:interactions:browser
npm run test:fhv:player
npm run audit:fhv:player
npm run plan:fhv:primitives
npm run audit:fhv
npm run audit:fhv:primitives
npm run audit:fhv:interactions
npm run audit:fhv:investigators
npm run audit:fhv:check
```

### 阶段总览与证据登记

- [ ] P0 范围与基线完成。
- [ ] P1 机制扫描完成。
- [ ] P2 原语完成。
- [ ] P3 关键词与规则书完成。
- [ ] P4 交互完成。
- [ ] P5 调查员及专属依赖完成。
- [ ] P6 一般玩家卡完成。
- [ ] P7 序曲、八章、法典、指南及战役流程完成。
- [ ] P8 发布验收完成，完整迁移交付。

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-03 | 规划准备 | 完成规范阅读、来源定位、序曲与八章路线及清单建立；实现阶段均未勾选 | 文档链接检查通过 | `docs/theFeastOfHemlockVale/README.md` |

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。
