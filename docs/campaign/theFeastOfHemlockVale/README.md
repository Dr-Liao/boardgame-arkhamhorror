# 九循环《铁杉谷盛宴》迁移路线图

英文名：The Feast of Hemlock Vale。战役标识：`theFeastOfHemlockVale`；本轮工具及审计简称：`fhv`；来源战役编号：`10`。

建立日期：2026-11-03。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。P0–P8 已全部完成，完整迁移已确认（`audit/fhv-migration.json#status = verified`，`earlyAccess: false`，`equivalenceCertified: true`）。三个内容包均为 `playable`：P5 调查员包（5 位调查员 + 15 张专属/绑定依赖）、P6 一般玩家卡包（120 条记录：102 张可构筑 + 4 基础弱点 + 11 绑定/场外依赖 + 3 Research）、P7/P8 战役包（301 条战役记录 + 4 段序曲 + 八章 + 26 个遭遇组）。发布验收覆盖完整合法三天三夜路线（多勘察顺序、夜 1/夜 2 两种分支、居民关系/法典/传家宝）、失败/撤退、四档难度、存档恢复与 replay、真实大厅三阶段双视口浏览器（含多人/AI/隐私/权限/断线）、素材与图片库存、全量回归与文档。

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

`10001`–`10138`（`fhvp`）和 `10501`–`10743`（`fhvc`）以及关联面 `10005b`、`10016a`、`10016b` 是首轮扫描候选。P0 以卡表的实际记录和关联面为准。传家宝奖励为 `10713`–`10715`，`10716`–`10720` 归入岩中恐怖遭遇组的双面地点。居民组有 9 对独立的支援面／敌人面。核心与《午夜假面》复用卡登记为范围外依赖。源码中的同名卡按卡文和属性复核，`10678`／`12158` 与 `10743`／`12129` 各自保持原卡号。 [P0 范围账本](../../../audit/fhv-scope.json)

以下路径均相对 `games/arkhamhorror/`，是计划交付位置，尚未建立的文件不表示已实现：

| 产物 | 计划路径 |
| --- | --- |
| 战役与章节内容 | `content/campaigns/theFeastOfHemlockVale/{manifest,shared,chapters,story-text,encounter-rules}.js`、`story-source/`、`scenarios/<scenarioId>/`；按需拆分，不建空壳 |
| 内容包 | `content/packs/fhvCampaign/`、`fhvInvestigators/`、`fhvPlayer/` 的 `manifest.js` |
| 玩家卡行为 | `src/cards/entries/<code>.js`，重印号复用 canonical 实现 |
| 非玩家卡行为 | `src/cards/encounter-entries/theFeastOfHemlockVale/_shared/<group>/<code>.js` 或 `<scenarioId>/<code>.js`；跨战役卡沿用 `shared/<group>/` |
| 叙事生成 | `tools/import-fhv-story.mjs` 与生成后的 `story-text.js` |
| 完整冒险指南 | 接入 `tools/import-scenario-guides.mjs`，适配非 `scenarios/` 子目录的英文源并生成 `web/scenario-guides/<scenarioId>.json` 中英正文 |
| 关键词与规则书 | 关键词身份 `content/campaigns/theFeastOfHemlockVale/keywords.js`；规则条目与卡文直达 `web/fhv-rules.js`（注册进 `web/rulebook-data.js`）；说明 `docs/campaign/theFeastOfHemlockVale/rulebook.md` |
| 总审计与专项账本 | `tools/audit-fhv.mjs`、`audit/fhv-migration.json`；按需拆分原语、关键词与规则书（`tools/audit-fhv-rules.mjs`、`audit/fhv-rules.json`）、调查员、玩家卡、章节和逐卡账本 |
| 测试 | `tests/fhv-*.test.mjs`、`tests/fhv-*.browser.mjs`，注册本循环测试与审计脚本 |

运行资料放在**大厅仓库根目录** `artifacts/migration/fhv/`，不与 Mod 下的历史 `artifacts/` 混用。最少包含 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、`shards.json`、`primitive-requests/`、`workers/`、`reports/` 和 replay 基线。只有干净检出复算所需的最小输入可逐文件加入白名单；截图、日志和执行过程文件不签入。

卡图继续使用 `web/img/cards/` 与 `web/img/zh/cards/` 及既有远程回退，不另建循环专属卡图副本。

## 3. 阶段路线清单

执行顺序为 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**。其中 P5–P7 是规范第 5 步的不同内容批次；P8 是第 6 步。M0–M5 仅表示内容产物范围，不替代执行顺序。

### P0：锁定范围与基线（M0）

- [x] 扫描两包并登记唯一卡号全集、双面、绑定卡、重印判定与范围外依赖。 [范围账本](../../../audit/fhv-scope.json)
- [x] 调查员及依赖、一般玩家卡、共享遭遇组和逐章非玩家卡分区通过无交集及并集守恒校验。 [分区校验](../../../tools/scan-fhv-scope.mjs)
- [x] 锁定章节、提示卡、四档混乱符号规则、初始混乱袋和英文指南。首次山谷序曲结算后才加入自动失败标记。来源相对路径与 SHA-256 已锁定。 [范围账本](../../../audit/fhv-scope.json)
- [x] 记录大厅与 Mod 起始提交、已有改动、既有快速回归失败、架构指标和 R1/R2/R3 合规基线。 [基线账本](../../../audit/fhv-baseline.json)
- [x] 在目录接入前生成 golden replay 基线并复放一致。运行镜像在大厅根目录 `artifacts/migration/fhv/scope.json`，回放在 `replay-before.json`，日志在 `reports/`。 [基线账本](../../../audit/fhv-baseline.json)
- [x] 三个目录包通过生产卡包清单接入，战役和章节走独立目录校验。审计验证战役启动、调查员选择和构筑均未开放。 [卡包清单](../../../content/packs/manifests.js) · [迁移审计](../../../audit/fhv-migration.json)

退出门禁已通过。来源可复算，分区无重叠无遗漏，现有回放逐步指纹一致。故意替换账本中的卡表 SHA-256 时，`--check` 返回非零并报告漂移路径。快速回归与起始基线的失败和取消项一致。

### P1：扫描新增机制（规范第 1 步）

- [x] 全量扫描卡面、背面、规则、序曲、法典及每章指南，输出六类去重机制。 [机制扫描账本](../../../audit/fhv-mechanism-scan.json)
- [x] 每个卡号关联逐行机制、原卡文哈希和参考实现锚点；机制条目登记代表卡、现有读点、缺口及 P2 候选。 [扫描器](../../../tools/scan-fhv-mechanisms.mjs)
- [x] 完成 §5 八组重点机制的复用与缺口核对。 [机制分类](../../../tools/fhv-mechanisms.mjs)
- [x] 归档所有英文源文本键及哈希，列出十二个场景、两段叙事序曲和战役规则的指南与法典覆盖；中文计划按源键分批，并记录自译来源。 [指南和译文清单生成器](../../../tools/fhv-guide-scan.mjs)

- 警戒复用躲避失败反击读点；逃逸需要攻击结束结算。巡逻复用既有路径计算，但带线索洞穴、最近空地点和随居民位置变化的目标需扩展。祝福／诅咒复用标记池、逐枚支付和连抽，P2 覆盖平局、组合支付和替代抽取。
- 《汉洛克庄园》的双类型实体与猎杀袋各有候选原语。矿车轨道、深沼渗坑、黑暗等级、追击区、屏障／诱饵／陷阱和终章深渊牌区也分别进入计划输入。
- 中文指南以 `英文文件#源键` 为覆盖键。P3 先翻译规则书与相关标签；P7 在 `story-source/` 补齐所有剩余分支、布置、符号、法典与结局，并通过指南导入器生成双语正文。

退出门禁已通过。未分类卡和未识别机制均为 0。`primitiveQueue` 为 P2 的候选清单，其中 `primitiveGaps` 逐项记录 `new` 或 `extend` 及其反向引用。

### P2：拆分并实现通用原语（规范第 2 步）

- [x] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels。 [原语目录](../../../audit/fhv-primitive-catalog.json)
- [x] 按 P1 缺口登记复用、新增与未收口事项。 [原语计划](../../../audit/fhv-primitive-plan.json)
- [x] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档，新状态纳入读档校验。
- [x] 共用规则已登记通用原语，`escape` 为空。
- [x] 原语计划与只读目录可复算。28 项缺口均已验收，回放与改动前基线逐步一致。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

P2 门禁已通过。双类型敌人／地点沿用同一实体标识，支持两类行动和击败坍塌。跨章节整备按调查员身份保存手牌、支援、资源与线索，并在下一次勘察开局恢复。 [接口与复验命令](primitives.md)

### P3：关键词与规则书（规范第 3 步，M4）

- [x] 对照全部卡面与指南确认逃逸（Elusive）、白日／黑夜（`Day [day]`／`Night [night]`）、法典（`[codex] X`）、巡逻（Patrol）、警戒（Alert）及祝福／诅咒在本循环的适用性，逐项登记代表卡号。 [关键词身份](../../../content/campaigns/theFeastOfHemlockVale/keywords.js) · [规则审计账本](../../../audit/fhv-rules.json)
- [x] 实现并验收逃逸结算（攻击或被攻击后解除交战、移往连接地点并横置）、昼夜门控、网格正交相邻等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。 [P2 原语计划](../../../audit/fhv-primitive-plan.json) · [Node 验收](../../../audit/fhv-node-acceptance.json)
- [x] 完成循环概览、三天三夜与可游玩序曲、铁杉谷法典、居民关系等级与笔记、网格正交相邻、逃逸与昼夜关键词等规则条目及卡文直达链接。 [规则条目](../../../web/fhv-rules.js) · [规则书说明](rulebook.md)
- [x] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。 [浏览器账本](../../../audit/fhv-rules-browser.json)
- [x] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目由审计写入 `verified`。 [迁移总账](../../../audit/fhv-migration.json)

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

P3 门禁已通过。6 项关键词（逃逸／昼夜／法典／巡逻／警戒／祝福诅咒）与 11 条双语规则条目全部 `verified`，441 张 `10` 段卡的卡文直达无遗漏；关键词所用原语在 P2 全部 `done`，规则书桌面 1440／移动 390 中英阅读、相关跳转、返回与卡文直达通过浏览器验收。战役保持 `catalog-only`，不因规则书开放而启动。

### P4：新增交互与界面（规范第 4 步）

- [x] 完成法典（`[codex] X`）触发、条件段落筛选与演进面板、三天三夜时间标记与居民关系等级／笔记展示、序曲结束保留 1 张非起始支援并选择下一场勘察关卡等扫描确认的新交互。 [交互事务](../../../src/engine/fhv-interactions.js) · [观察投影](../../../src/integration/mechanic-view.js) · [界面](../../../web/mechanic-ui.js)
- [x] 完成网格空位放置地点、矿车／道岔滑动、敌人-地点（`enemy_location`）双重交互（在场同时接受调查／移动与交战／攻击／躲避）、汉克被击败时翻面切换绑定坚毅调查员卡及凯特线索搬移等交互，复用现有组件、CSS 变量和服务端合法动作。 [双类型动作面板](../../../web/game-ui.js) · [说明](interactions.md)
- [x] 确认未触发法典条目、未到达昼夜分支、猎杀袋内容与条件剧情的座位可见性，不向观察投影泄露未到达信息。 [隐私断言](../../../tests/fhv-interactions.test.mjs) · [投影收窄](../../../src/integration/scenario-interactions.js)
- [x] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。 [通用证据 spec](../../../tests/script-actions-tfa.browser.mjs)
- [x] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。 [指南回归 spec](../../../tests/scenario-guides.browser.mjs)
- [x] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。 [浏览器账本](../../../audit/fhv-interactions-browser.json) · [回归账本](../../../audit/fhv-regression.json)

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

P4 门禁已通过。7 组交互（法典／演进面板／序曲整备／网格／矿车／敌人-地点／调查员状态）在桌面 1440 与移动 390 各一条真实验收路径，覆盖合法、取消、空状态与焦点恢复；未触发法典分支、猎杀袋内标记、他人手牌卡号与未到达昼夜内容均不进入观察投影。`audit/fhv-interactions.json#status = verified`；两条通用证据 spec（`scriptCard` 归属与关卡设置指南）同轮通过。战役仍为 `catalog-only`。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及中英文名对照。

- [x] `10001` Wilson Richards（威尔森·理查德）：`[[Tool]]` 0–5 级与守卫者 0–4 级构筑、每轮首张 `[[Tool]]` 支援减 1 费、`[[Tool]]` 支援检定技能值 `+1`、旧印场上与手牌 `[[Tool]]` 交换及专属依赖 `10002`、`10003`。 [条目](../../../src/cards/entries/10001.js) · [测试](../../../tests/fhv-investigator-10001.test.mjs)
- [x] `10004` Kate Winthrop（凯特·温斯罗普）：`[[Science]]` 0–4 级与探求者 0–5 级构筑、开局 `10005` 磁通量稳定器（关闭）在场、把线索从调查员移到自己控制且无线索的 `[[Science]]`／`[[Tool]]` 支援、带线索支援离场放回地点、稳定器翻面（`10005b` 开启）与检索绑定卡 `10006`/`10007` 以太电流、旧印及专属弱点 `10008`。 [条目](../../../src/cards/entries/10004.js) · [测试](../../../tests/fhv-investigator-10004.test.mjs)
- [x] `10009` Alessandra Zorzi（亚历山德拉·佐兹）：带“谈判（Parley）”卡牌 0–5 级构筑、每回合额外一次谈判专用行动、旧印自动躲避所在或已揭示连接地点非精英敌人及专属依赖 `10010`（3 张）、`10011`。 [条目](../../../src/cards/entries/10009.js) · [测试](../../../tests/fhv-investigator-10009.test.mjs)
- [x] `10012` Kōhaku Narukami（鸣神琥珀）：`[[Blessed]]`／`[[Cursed]]` 0–5 级与 `[[Occult]]` 0 级构筑、回合开始向混乱袋加入数量较少的一方（平局自选）或移除各 2 枚获额外行动、旧印及专属依赖 `10013`、`10014`。 [条目](../../../src/cards/entries/10012.js) · [测试](../../../tests/fhv-investigator-10012.test.mjs)
- [x] `10015` Hank Samson（汉克·萨姆森）：35 张牌库与 `[[Innate]]`／`[[Spirit]]` 0–2 级构筑、承接同地点调查员或盟友的伤害／恐惧、将要被击败时治愈全部伤恐并交换为绑定 `[[Resolute]]` 版本（`10016a` 或 `10016b` 二选一朝上，上限与能力随之变更）、旧印及专属依赖 `10017`、`10018`。 [条目](../../../src/cards/entries/10015.js) · [测试](../../../tests/fhv-investigator-10015.test.mjs)
- [x] 五位调查员分别通过初始化、能力、构筑合法／非法、专属与绑定依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。 [五人口径测试](../../../tests/fhv-investigator-signatures.test.mjs) · [浏览器账本](../../../audit/fhv-investigators-browser.json)

退出门禁：逐位证据完整才开放该调查员；已有同名版本不自动证明本编号与依赖已完成。

P5 门禁已通过。五人逐人 Node 验收（初始化／旧印／关键能力／构筑合法与非法／专属与绑定依赖／多人窗口／存档恢复）与浏览器验收（真实大厅选人开局，桌面 1440／移动 390 各 5 人）全部通过；`audit/fhv-investigators.json#status = verified`，`fhvInvestigators` 包升 `playable`（P6 起一般玩家卡包亦升 `playable`，本段保留 P5 收口时的阶段状态），战役包仍 `catalog-only`。已知近似与引擎读点缺口逐条登记在 [investigators.md](investigators.md) §5。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [x] 主进程生成 `shards.json`，按卡号／职阶／机制拆成适当分片，检查无交集、并集覆盖全部一般玩家卡（含祝福／诅咒进阶卡、面具 `[[Mask]]` 补给卡、工具／科学线索卡、谈判卡、契约基础弱点等）。12 片 × 10 张，分片计划 `audit/fhv-player-shards.json`。
- [x] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、进度和原语请求；共享层、账本、文档及索引由主进程维护。
- [x] 逐卡核对费用、槽位、使用次数（含跨支援共享花费补给／子弹）、目标、窗口、区域、持续时间、每轮／每局限制、升级及负面路径。
- [x] 缺原语时写 `primitive-requests/*.json` 并将卡记为 `blocked`；主进程实现并验证后再恢复，不绕过 API 直写状态。P6 采用与 TSK P6 相同的处置口径：缺读点的子句以现有原语实现最接近行为、逐卡 `simplified: true` + `note` 披露，45 份原语请求统一在 `audit/fhv-player-request-disclosures.json` 裁决为 deferred（P7–P8 原语批次），条目本身全部有可执行行为与证据、无 `blocked` 卡。
- [x] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。FHV 一般玩家卡无跨循环重印别名（`audit/fhv-scope.json#reprints` 仅含战役卡），120 条全部 `descriptor`（无 legacy/hybrid/missing）。
- [x] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。

P6 门禁已通过。120 条记录全部 `verified`（12 份分片测试共 142 例 + 通用原语/包边界 3 例全绿；每卡至少一条 `P6 <code>` 实跑证据），102 张可构筑卡进入大厅构筑池与 `EXPANDED_PLAYER_CARD_CODES`，4 张基础弱点与 11 张绑定/场外依赖只作依赖，3 张 Research 卡保留 `researchGated` 不进池；54 张近似卡逐条披露，45 份原语请求裁决为 deferred；`audit/fhv-player-acceptance.json#status = verified`，`audit/fhv-player-browser.json` 桌面 1440 / 移动 390 各 5 例通过，`fhvPlayer` 包升 `playable`，`fhvCampaign` 仍 `catalog-only`。详见 [player-cards.md](player-cards.md)。

### P7：共享遭遇、序曲、八章及战役流程（规范第 5 步，M3）

- [x] 先迁移战役内共享遭遇组（山谷、第一／二／三日、居民、传家宝、色彩爪牙、枯疫、折射、森林、菌类、突变、着火等），再按 §4 落地山谷序曲与八章；按归属目录分片，避免共享卡重复实现。证据：18 个共享遭遇组 97 张卡与 8 章专属卡全部落为一卡一条目（`src/cards/encounter-entries/theFeastOfHemlockVale/<chapter|_shared>/<code>.js`，291 条），归属由 `tools/encounter-entry-placement.mjs` 复算一致。
- [x] 八章及可游玩序曲逐项完成准备、昼夜时间标记配置、网格连接、全部幕／议程正反面、法典条目、敌人／敌人-地点／诡计／居民剧情资产、符号与结局。证据：12 个场景模块 `content/campaigns/theFeastOfHemlockVale/scenarios/<id>/{definition,layout,behavior,chaos,index}.js`；网格/轨道/下沉/双面敌人-地点/追击区/深渊等机械走 P2 原语；逐章见 `audit/fhv-scenario-acceptance.json`。
- [x] 按三天三夜状态机接入 3 段白日山谷序曲、3 段夜晚序曲、按尚未勘察区域选择的五个勘察关卡，以及《扭曲空洞》《最长一夜》《山谷的命运》。第 1 夜和第 2 夜均有夜探分支。证据：`parts.js`（12 步/三天三夜时间槽/夜 1-2 分支表）+ `flow.js`（35 节点流程图/勘察选择/终章）+ `interludes.js`。
- [x] 准确实现白日序曲整备、保留控制的线索、跳过白日勘察的常规调度重抽，并将经验记入“未花费经验”（`Unspent Experience`）。仅在指南指定的升级窗口开放购牌升级，白日序曲到紧邻勘察关卡之间保持 `noUpgrade`。证据：`interludes.js#runPrepare`（`src/engine/survey-preparation.js` 原语）、`flow.js#upgradeWindows`/`noUpgrade`、`records.js` 未花费经验键。
- [x] 完成 `locales/en/theFeastOfHemlockVale/` 全量中文翻译并生成完整叙事与法典文本，覆盖所有可达居民关系与昼夜分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。证据：`tools/import-fhv-story.mjs` → `story-text.js`（9 文件 1462 叶，en 来自参考工程 + 本地自译层 `story-source/**`，`chineseGaps=0`；`--check` 一致）；`story-access.js` 逐键读取。
- [x] 每个章节与可游玩序曲同步生成完整中英文指南，通过来源覆盖、生成校验、Node 和浏览器验收。证据：`tools/build-fhv-guides.mjs` → 12 份 `web/scenario-guides/<id>.json`（0 缺译块、`--check` 一致）；`tests/scenario-guides.test.mjs` 的中英指南结构/连接词/占位符门禁；浏览器账本 `audit/fhv-scenarios-browser.json`。
- [x] 序曲与八章全部完成 §6 的逐章确认，战役记录、居民关系等级与笔记、已勘察区域、传家宝、混乱袋和存档跨章一致。证据：`audit/fhv-scenario-acceptance.json`（12/12 场景 verified：模块/清单/指南/测试/条目/注册/流程/记录/浏览器）；240 键 `recordSchema` 闭包；12 章 `recordReads/Writes` 全 ⊆ schema。

退出门禁：每章的字面行为、法典与指南均有证据；章内定向夹具不能代替真实大厅路线，战役仍需 P8 发布验收。

P7 门禁已通过。12 个场景（4 序曲 + 8 章）逐章 Node 验收（12 章 + 战役流程/正文/记录/终章引擎回归共 13 份测试 408 例全绿）与真实大厅浏览器验收（桌面 1440 × 12 + 移动 390 × 12 = 24/24 通过、52 张截图，账本 `audit/fhv-scenarios-browser.json#status=passed`）；291 条单卡条目按归属算法落盘；12 份中英指南 0 缺译块；1462 叶正文 `chineseGaps=0`；`fhvCampaign` 包升 `playable` 且真实大厅可启动（`contentRegistry.assertLaunchable`）；全量 `test:fast` 与既有 replay 行为零变化（仅既有 2 项 P8 EOTE 失败单独记账）；`audit/fhv-scenario-acceptance.json#status = verified`（16 项门禁全真，含浏览器双视口）。详见 [campaign.md](campaign.md)。

### P8：整体验收与发布（规范第 6 步，M5）

- [x] 汇总 `audit/fhv-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。证据：`node tools/audit-fhv.mjs --check` 逐字节复算一致（`status: verified`，14 项门禁全真）；来源清单含 26+ 份账本/内容文件 sha256；`audit/fhv-all-card-acceptance.json` 441 行逐卡账本（301 战役 + 20 调查员/依赖 + 120 玩家，missing=0/blocked=0）；`audit/fhv-primitive-plan.json` 28 项缺口全部 closed、pending 0、`escape` 0；`audit/fhv-scenario-acceptance.json` 12/12 场景 verified；`audit/fhv-rules.json` 6 关键词 / 11 规则 verified；12 份指南与 1462 叶正文可复算；六份发布/逐章浏览器账本（规则/交互/调查员/玩家/场景/P8 发布）截图逐张 sha256 复算。
- [x] 覆盖完整合法战役（不同勘察顺序、第 1 夜《扭曲空洞》或夜探、第 2 夜《最长一夜》或夜探、不同居民最高关系路线）、失败／撤退路线、四档难度、存档恢复和 replay。证据：`tests/fhv-p8-campaign.test.mjs` 8 例（真实 `createGameState` + 生产组合根）：路线 A（岩间密语→扭曲空洞→汉洛克庄园→夜 2 夜探→消失的姐妹）与路线 B（汉洛克庄园→夜 1 夜探→深沼之物→最长一夜→寂静荒野）合计覆盖 12 步全部场景，逐节点断言 `flow.history`/`hemlockDate`/`surveyedAreas`/`campaignResult`；居民关系 +1/笔记双写跨章一致、传家宝 `heirloomsAwarded` 入战役牌组；最终夜 R3 `loseTheCampaign` → 尾声 defeat；四档难度混沌袋 14/14/15/16 与序曲 R1 `[autofail]` 迁移；4 处关键选择 JSON 往返后继续投影不变；同 seed replay 65 步 `stateHash` 与终态零 diff；另 `tests/fhv-campaign-engine.test.mjs` 覆盖终章可达与传家宝，`tests/fhv-campaign-flow.test.mjs`/`fhv-campaign-records.test.mjs` 覆盖流程图/记录。发现的 5 处引擎/内容缺陷（最终夜 lost 软锁、四档 Eldersign 拼写、`chaosBagTransitions` 无引擎读点、升级窗被整备关闭、跳过勘察悬挂整备包裹）已在本轮修复。
- [x] 从真实大厅验证选战役、选人、构筑、开局、序曲整备与带支援入场、法典交互、逐日推进、升级与尾声；覆盖多人、AI、断线恢复和权限边界。证据：`audit/fhv-release-browser.json#status = passed`（3 phase × 桌面 1440/移动 390 = 6 行，真实大厅 → 选战役/选人/自动构筑 → 开局 → 序曲整备与带支援入场 → 法典交互 → 三天三夜逐日推进 → 升级窗 → 终章/尾声；online phase 覆盖 2 席位、AI 队友、隐私投影、权限边界与断线恢复；70 张截图逐张 sha256 入账、sourceStable=true）；P7 逐章账本 `audit/fhv-scenarios-browser.json` 24/24（12 章 × 双视口）继续作为逐章浏览器证据。
- [x] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。证据：`npm run cards:check` / `cards:encounter-check` / `audit:entries` 通过（一卡一文件、R1/R2/R3、索引一致）；`import:fhv:story:check`、`build:fhv:guides:check` 一致；FHV 审计链（scope/scan/primitives/node/rules/interactions/investigators/player/scenarios/all-cards/assets）全部 `--check` 通过；`replay-fixtures --compare` 与 P0 基线逐条一致；`node tools/verify-fhv.mjs --regression` 全量 fast 无新增失败（仅既有 P8 EOTE 2 项单独记账）；`build-presentation.mjs --check`、`check-doc-links.mjs` 通过。
- [x] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。证据：`audit/fhv-assets.json#status = verified`：441/441 记录图像解析可解析（本地 441、中文本地化 440、unresolved 0、remote 0），主面全部本地可展示；`audit/local-images.json` 含 FHV 1012 条（572 en + 440 zh），574 张英文面 SHA-256 与 `audit/image-digests.json` 逐字节一致；`src/content/web/presentation` 对参考资源真实读取依赖 = 0；远程回退抽样 8/8 HEAD 200；已知素材项（10694b 无中文面、440 张中文面无 sha 基线、404 个末位兜底候选）已在账本 `disclosed` 逐条登记。
- [x] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。证据：`audit/fhv-migration.json#confirmations`：scenarios 12/12（每章 §6 12 项全真）、keywords 6/6、rulebook 6/6；`content/migration-confirmation.js#assertMigrationConfirmations` 复算通过；`playable: true`、`earlyAccess: false`、`equivalenceCertified: true`、`launchEnabled: true`；`releaseAcceptance.status = complete`、`deferred = []`。
- [x] 不采用提前开放：全部发布门禁真实通过后以 `earlyAccess: false` 发布，未设置延后项；`remaining` 仅保留披露类（108 张近似行为卡，逐卡 `note`/章节 approximations 已登记；195 张数据型战役卡由章 behavior 承接并有章测试证据），无阻塞卡、无待实现原语、无未披露近似。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

P8 门禁已通过，完整迁移确认。详见 [campaign.md](campaign.md) 与 `audit/fhv-migration.json`。

### 阶段总览与证据登记

- [x] P0 范围与基线完成。 [范围账本](../../../audit/fhv-scope.json) · [起始基线](../../../audit/fhv-baseline.json) · [迁移审计](../../../audit/fhv-migration.json)
- [x] P1 机制扫描完成。 [机制扫描账本](../../../audit/fhv-mechanism-scan.json) · [迁移审计](../../../audit/fhv-migration.json)
- [x] P2 原语完成。 [逐项计划](../../../audit/fhv-primitive-plan.json) · [原语目录](../../../audit/fhv-primitive-catalog.json)
- [x] P3 关键词与规则书完成。 [规则审计账本](../../../audit/fhv-rules.json) · [Node 验收](../../../audit/fhv-node-acceptance.json) · [浏览器账本](../../../audit/fhv-rules-browser.json) · [规则书说明](rulebook.md)
- [x] P4 交互与界面完成。 [交互审计账本](../../../audit/fhv-interactions.json) · [浏览器账本](../../../audit/fhv-interactions-browser.json) · [回归账本](../../../audit/fhv-regression.json) · [交互说明](interactions.md)
- [x] P5 调查员及专属依赖完成。 [调查员审计账本](../../../audit/fhv-investigators.json) · [浏览器账本](../../../audit/fhv-investigators-browser.json) · [Node 验收](../../../audit/fhv-node-acceptance.json) · [调查员说明](investigators.md)
- [x] P6 一般玩家卡完成。 [玩家卡审计账本](../../../audit/fhv-player-acceptance.json) · [浏览器账本](../../../audit/fhv-player-browser.json) · [分片计划](../../../audit/fhv-player-shards.json) · [原语请求裁决](../../../audit/fhv-player-request-disclosures.json) · [逐卡说明](player-cards.md)
- [x] P7 序曲、八章、法典、指南及战役流程完成。 [场景审计账本](../../../audit/fhv-scenario-acceptance.json) · [浏览器账本](../../../audit/fhv-scenarios-browser.json) · [分片计划](../../../audit/fhv-campaign-plan.json) · [战役说明](campaign.md)
- [x] P8 发布验收完成，完整迁移交付。 [发布总账本](../../../audit/fhv-migration.json) · [逐卡账本](../../../audit/fhv-all-card-acceptance.json) · [发布浏览器账本](../../../audit/fhv-release-browser.json) · [素材账本](../../../audit/fhv-assets.json) · [P8 战役用例](../../../tests/fhv-p8-campaign.test.mjs) · [完成说明](campaign.md)

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-03 | 规划准备 | 完成规范阅读、来源定位、序曲与八章路线及清单建立 | 文档链接检查通过 | `docs/campaign/theFeastOfHemlockVale/README.md` |
| 2026-11-15 | P0 范围与基线 | 来源锁、分区守恒与目录身份通过验收 | `audit:fhv:check`、`cards:check`、`cards:encounter-check`、`audit:entries`、`docs:check` 通过；`test:fast` 无新增失败或取消 | `audit/fhv-{scope,baseline,migration}.json`，大厅根 `artifacts/migration/fhv/reports/{audit-check.log,fast-compare.json}` |
| 2026-11-15 | P1 全量机制扫描 | 逐卡、指南、法典及原语候选门禁通过，补齐第二夜夜探分支及白日勘察整备 | `scan:fhv:check`、`audit:fhv:check`、`docs:check` 通过；`test:fast` 无新增失败或取消 | `audit/fhv-mechanism-scan.json`，大厅根 `artifacts/migration/fhv/reports/{p1-audit.log,p1-fast-compare.json}` |
| 2026-11-15 | P2 原语盘点与首批实现 | 28 项缺口逐项登记，10 项完成，18 项保留待办 | 原语计划复算、专项测试和 P2 逐步回放通过；快速回归无新增失败或取消 | `audit/fhv-primitive-{plan,catalog}.json`，大厅根 `artifacts/migration/fhv/reports/{p2-replay-compare.log,p2-fast-compare.json}` |
| 2026-11-16 | P2 原语收口 | 剩余 18 项完成，双类型敌人／地点和跨章节整备通过存档往返 | 专项测试、逐步回放和 P2 验收门禁通过，快速回归与 P0 基线相比无新增失败或取消 | `audit/fhv-primitive-plan.json`，大厅根 `artifacts/migration/fhv/reports/p2-followup-*` |
| 2026-11-16 | P3 关键词与规则书 | 6 项关键词（逃逸／昼夜／法典／巡逻／警戒／祝福诅咒）与 11 条双语规则全部 `verified`；441 张 `10` 段卡卡文直达无遗漏；关键词原语在 P2 全部 `done` | `verify:fhv:node`、`plan:fhv:rules`、`audit:fhv:rules`、`test:fhv:rules`、`test:fhv:rules:browser`、`audit:fhv:check`、`docs:check`、`cards:check`、`cards:encounter-check` 通过；`test:fast` 新增失败 0（2 项 HEAD 既有的 EOTE 账本漂移按 `p3-preexisting-failures.json` 单独记账；P0 基线中的 15 项失败已由工作区其他批次修复，不属 P3 范围） | `audit/fhv-{rules,node-acceptance,rules-browser,migration}.json`、`docs/campaign/theFeastOfHemlockVale/rulebook.md`，大厅根 `artifacts/migration/fhv/reports/{p3-fast.log,p3-fast-compare.json,p3-preexisting-failures.json}` 与 `reports/screenshots/` |
| 2026-11-16 | P5 调查员及专属依赖 | 5 位调查员（10001/10004/10009/10012/10015）与 15 张专属/绑定依赖（签名卡/专属弱点/绑定面）全部注册并逐人 verified：旧印、关键能力、开局预置、翻面/绑定、濒败替换、构筑合法与非法、多人窗口、存档恢复均覆盖；`fhvInvestigators` 包升 `playable`，一般玩家卡与战役包保持 `catalog-only` | `verify:fhv:node`（Node 主验收 + investigators 段全过）、`verify:fhv:regression`（新增失败 0）、`test:fhv:investigators`、`test:fhv:investigators:browser`（10/10，5 人 × 桌面 1440／移动 390，10 张截图）、`plan:fhv:investigators`／`audit:fhv:investigators`（复算一致、内部门禁全真）、`audit:fhv:check`、`docs:check`、`cards:check`、`cards:encounter-check` 通过；`test:fast` 新增失败 0（EOTE 2 项 HEAD 既有失败沿用 P3/P4 记账，不属 P5 范围） | `audit/fhv-investigators.json`、`audit/fhv-investigators-browser.json`、`audit/fhv-node-acceptance.json`、`audit/fhv-regression.json`、`src/cards/entries/10001–10018 与 10005b/10016a/10016b.js`、`content/campaigns/theFeastOfHemlockVale/investigator-data.js`、`content/packs/fhvInvestigators/manifest.js`、`docs/campaign/theFeastOfHemlockVale/investigators.md`，大厅根 `artifacts/migration/fhv/p5/screenshots/` 与 `artifacts/migration/fhv/reports/p5-*.log` |
| 2026-11-16 | P4 新增交互与界面 | 7 组交互（法典／演进面板／序曲整备／网格／矿车／敌人-地点／调查员状态）通过桌面 1440／移动 390 浏览器验收；敌人-地点双类型动作面板（地点面调查/移动 + 敌人面攻击/躲避）、观察投影隐私、`scriptCard` 归属与关卡设置指南复用通过 | `verify:fhv:node`、`verify:fhv:regression`（新增失败 0）、`plan:fhv:interactions`、`audit:fhv:interactions`、`test:fhv:interactions`、`test:fhv:interactions:browser`、`test:fhv:rules`、`audit:fhv:check`、`docs:check`、`cards:check`、`cards:encounter-check` 通过；`test:fast` 新增失败 0（EOTE 2 项 HEAD 既有失败沿用 P3 记账，不属 P4 范围） | `audit/fhv-{interactions,interactions-browser,regression,node-acceptance}.json`、`docs/campaign/theFeastOfHemlockVale/interactions.md`，大厅根 `artifacts/migration/fhv/reports/{p4-fast.log,p4-*.log,p3-preexisting-failures.json}` 与 `artifacts/migration/fhv/p4/screenshots/` |
| 2026-11-16 | P6 一般玩家卡批量迁移 | 120 条记录（10019–10138）全部 verified：102 张可构筑卡进入大厅构筑池与开放玩家池，4 张基础弱点（10135–10138）与 11 张绑定/场外依赖只作依赖，3 张 Research 卡（10059–10061）保留 `researchGated` 不进池；12 片 × 10 张分片无交集并集覆盖，54 张近似卡逐条披露，45 份原语请求统一裁决为 deferred；`fhvPlayer` 包升 `playable`，战役包保持 `catalog-only` | `plan:fhv:player:check`、`audit:fhv:player`、`test:fhv:player`（142 例）与 `test:fhv:player:browser`（桌面 1440 / 移动 390 各 5 例）通过；`verify:fhv:node`、`verify:fhv:regression`（新增失败 0、replay 一致）通过；`cards:check`、`cards:encounter-check`、`audit:entries`、`audit:abilities`、`docs:check` 通过；全量 `test:fast` 7988 例 / 7983 通过 / 2 项既有 EOTE 失败 / 0 取消 | `audit/fhv-player-{acceptance,shards,queue,browser,request-disclosures}.json`，`artifacts/migration/fhv/reports/p6-fast-{log,exit,compare.json}`，逐卡说明 `docs/campaign/theFeastOfHemlockVale/player-cards.md` |
| 2026-11-17 | P7 共享遭遇、序曲、八章及战役流程 | 4 段序曲 + 8 章 + 18 共享遭遇组 + 战役层流程全部落盘：291 条单卡条目、12 个场景模块、240 键战役记录、1462 叶中英正文（自译层 0 缺译）、12 份指南；三天三夜状态机（勘察选择/夜探分支/整备保留/调度重抽/未花费经验/升级窗口）、居民关系/法典/传家宝/已勘察区域跨章一致；`fhvCampaign` 包升 `playable` 且大厅可启动 | `npm run test:fhv:scenarios`（407 例）、`npm run import:fhv:story:check`、`npm run build:fhv:guides:check`、`npm run audit:fhv:scenarios`、`npm run verify:fhv:node`、`npm run verify:fhv:regression`、`npm run cards:check`、`npm run cards:encounter-check`、`npm run docs:check`、全量 `npm run test:fast`（既有 2 项 EOTE 失败单独记账） | `audit/fhv-scenario-acceptance.json`、`audit/fhv-scenarios-browser.json`、`audit/fhv-campaign-plan.json`、`web/scenario-guides/<id>.json`、`docs/campaign/theFeastOfHemlockVale/campaign.md` |
| 2026-11-17 | P8 整体验收与发布 | 完整迁移确认：`audit/fhv-migration.json#status = verified`（14 项门禁全真、`earlyAccess: false`、`equivalenceCertified: true`）、`confirmations` scenarios 12/12 × §6 12 项 + keywords 6/6 + rulebook 6/6、发布浏览器 3 phase × 双视口、素材 441/441 本地可展示、无阻塞/待实现原语；8 例 P8 战役 E2E 覆盖双路线/夜探/居民/传家宝/失败/四难度/存档/replay | `npm run test:fhv:p8`（8 例）、`npm run test:fhv:release:browser`、`npm run audit:fhv`、`npm run audit:fhv:check`、`npm run audit:fhv:allcards`、`npm run audit:fhv:assets`、`verify:fhv:node`、`verify:fhv:regression`、`cards:check`、`cards:encounter-check`、`audit:entries`、`replay-fixtures --compare`、`build-presentation --check`、`test:fast`（既有 2 项 EOTE 单独记账）、`docs:check` | `audit/fhv-migration.json`、`audit/fhv-all-card-acceptance.json`、`audit/fhv-release-browser.json`、`audit/fhv-assets.json`、`tests/fhv-p8-{campaign,migration,assets}.test.mjs`、`docs/campaign/theFeastOfHemlockVale/campaign.md` |

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。
