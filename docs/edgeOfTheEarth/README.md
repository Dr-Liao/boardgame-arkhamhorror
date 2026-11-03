# 七循环《地球边缘》迁移路线图

英文名：Edge of the Earth。战役标识：`edgeOfTheEarth`；本轮工具及审计简称：`eote`；来源战役编号：`08`。

建立日期：2026-11-03。本文件是实施路线与完成清单，完成状态以代码、测试和审计证据为准。当前处于规划准备阶段，P0 → P8 均未开始，战役、调查员与一般玩家卡保持 `catalog-only`。

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

`08001`–`08133`（`eoep`）和 `08501`–`08738`（`eoec`）是首轮扫描候选，不把连续编号或包名直接当作最终迁移范围。P0 必须展开双面关联面（如陈丽丽演武 `08011a/b`–`08014a/b`、伙伴坚毅面 `08723`–`08731`）、调查员依赖、书附／平行卡替代或重印映射（如诺曼 `98007/98008/98009`、蒙特雷 `90062/90063/90064`）、《纪念逝者》剧情奖励及跨循环重印；复用核心遭遇组只登记依赖，不重复归入本轮分片。

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

- [ ] 扫描候选内容包（`eoep`、`eoec`），输出唯一卡号全集、正反面与关联卡、重印 canonical 映射及范围外依赖。
- [ ] 将调查员及专属依赖、一般玩家卡、共享遭遇组（含忒咳哩-哩、探险队伙伴、纪念逝者）和逐章非玩家卡分成无交集集合，保留并集守恒检查。
- [ ] 逐章锁定来源、真实提示卡号（`08501`、`08549`、`08596`、`08621`、`08648` 及拆分章节 ID）、四档混乱符号规则、初始混乱袋和完整指南来源，记录相对路径与 SHA-256。
- [ ] 记录起始提交、工作区已有改动、回归既有失败，以及引擎卡号字面量、`EFFECTS`、逃生原语和 R1/R2/R3 合规基线。
- [ ] 在行为改动前生成 golden replay 临时基线；登记 `scope.json` 和报告位置。
- [ ] 接入目录身份和必要的审计骨架；未验收内容保持 `catalog-only`，战役、选人和构筑不因数据收录而开放。

退出门禁：来源可复算，集合无重叠无遗漏，现有 replay 可复现；此后来源漂移必须让 `--check` 失败。

### P1：扫描新增机制（规范第 1 步）

- [ ] 全量扫描卡面、背面、规则、检查点、幕间及每章指南，形成 `mechanism-scan.json`，覆盖 `primitive / keyword / rulebook / interaction / scenario / content`。
- [ ] 每张范围内卡至少关联一个机制条目；同一机制合并，记录代表卡号、来源、既有实现、缺口与候选原语。
- [ ] 将 §5 的重点机制逐项分类，核实复用能力与真实缺口；未知机制保持阻断。
- [ ] 建立八个章节单元的完整指南段落清单（含 `iceAndDeath` 三部分与 `theHeartOfMadness` 两部分的分篇映射），单列中文缺译和特别规则，不以“已有剧情正文”代替指南覆盖。

退出门禁：未分类卡为 0，所有原语缺口进入 P2；扫描阶段不批量写卡。

### P2：拆分并实现通用原语（规范第 2 步）

- [ ] 盘点 `EFFECT_PRIMITIVES`、`ctx.api`、能力 kind、窗口、matcher、目标枚举和 play channels，先复用再新增。
- [ ] 为寒霜标记（`[frost]`）、探险队伙伴（Partner）、忒咳哩-哩（Tekeli-li!）专属弱点牌库、地点庇护值（Shelter）、跨章物资（Supplies）、多职阶构筑及牌库顶揭示打出等机制建立 `reuse / new / escape` 计划。
- [ ] 新原语同时交付注册校验、引擎读点、正常及负面路径测试、JSON 存档往返和文档；新状态纳入版本迁移。
- [ ] 同句规则在第二张出现时提取候选，第三张前完成原语；本阶段先完成通用接口，不批量写卡，`escape` 默认保持为空。
- [ ] 完成 `primitive-plan.json` 与只读 `primitive-catalog.json`；所有 `new` 项为 `done`，复用项可定位，replay 对比无非预期漂移。

退出门禁：原语单测和 `test:fast` 无新增失败；不得留下卡号分支、直写状态或“声明无人读取”的字段。

### P3：关键词与规则书（规范第 3 步，M4）

- [ ] 对照全部卡面与指南确认关键词、时机词及已有关键词在本循环的适用性，逐项登记代表卡号。
- [ ] 实现并验收寒霜标记、伙伴、忒咳哩-哩、庇护值、多职阶等规则原语缺口；实际单卡字面行为仍在 P5–P7 验收，机制全链路见 §5。
- [ ] 完成循环概览、检查点与营地继承、伙伴存活／划去／强化、忒咳哩-哩牌库、寒霜标记等规则条目及卡文直达链接。
- [ ] 规则书只描述已实现的规则，补齐中英文、关联 ID 与检索索引，通过桌面 1440／移动 390 阅读和返回验收。
- [ ] 建立 `confirmations.keywords`、`confirmations.rulebook`；符合条件的条目由审计写入 `verified`。

退出门禁：本批卡牌所依赖的关键词已验收；未实现机制不能以可用规则条目开放。

### P4：新增交互与界面（规范第 4 步）

- [ ] 完成寒霜标记连续揭示与第 2 枚自动失败提示、开局伙伴选派、伙伴跨关伤害／恐惧／阵亡状态展示等扫描确认的新交互。
- [ ] 完成诺曼牌库顶常驻揭示与打出、陈丽丽演武构筑选择与场上翻面、鲍勃代打同地点队友手中道具并共同付费、忒咳哩-哩洗入与结算等必要交互，复用现有组件、CSS 变量和服务端合法动作。
- [ ] 确认忒咳哩-哩不查看洗入牌库、未揭示城市景观、营地随机失踪抽选与条件剧情的座位可见性，不向观察投影泄露隐藏信息。
- [ ] 幕／议程行动正确标记 `scriptCard`，在剧本书对应卡片旁显示，包含不可用原因。
- [ ] 复用固定“关卡设置”入口：剧本书右侧、混乱提示卡下方；特别规则优先，后续剧情与结局默认折叠。
- [ ] 桌面 1440／移动 390 覆盖合法、非法、空状态、取消／重试、键盘操作与焦点恢复，保存截图和报告。

退出门禁：新增交互已通过浏览器验收，再进入批量卡牌阶段；不得在卡批次中临时拼接界面。

### P5：调查员及专属依赖（规范第 5 步，M1）

中文显示名最终以锁定的本项目中文数据为准；此处用卡号及中英文名对照。

- [ ] `08001` Daniela Reyes（丹妮拉·雷耶丝）：构筑（守卫者 0 级、求生者 1–5 级、最多 5 张其他 0 级求生者）、敌人攻击后反应（非自身引发趁乱攻击，含攻击被取消时造成伤害或自动躲避）、旧印及专属依赖 `08002`、`08003`。
- [ ] `08004` Norman Withers（诺曼·威瑟斯）：构筑（探求者 0 级、潜修者 1–5 级、最多 5 张其他 0 级潜修者）、牌库顶常驻揭示、每轮一次减费打出牌库顶牌、牌库顶弱点强制抽取、旧印交换手牌与牌库顶牌，以及专属依赖 `08005`、`08006`；核对 `98007/98008/98009` 映射。
- [ ] `08007` Monterey Jack（蒙特雷·杰克）：构筑（流浪者 0 级、探求者 1–5 级、最多 5 张其他 0 级探求者）、回合结束按本轮起始地点与当前地点连接距离结算资源／抽牌、旧印及专属依赖 `08008`、`08009`；核对 `90062/90063/90064` 映射。
- [ ] `08010` Lily Chen（陈丽丽）：构筑（潜修者 0 级、守卫者 1–5 级、最多 5 张其他 0 级守卫者、禁 `[[Firearm]]` 枪械）、初始与每满 15 经验增选双面永久演武 `08011a/b`–`08014a/b`、每张演武配 1 张 `08015` 命运重担、[[运功]]／[[破功]]翻面与轮末恢复、旧印。
- [ ] `08016` Bob Jenkins（鲍勃·詹金斯）：构筑（求生者 0 级、流浪者 1–5 级、最多 5 张其他 0 级流浪者）、同地点队友揭示手中 `[[Item]]` 道具、额外行动代打队友手中道具归其控制并支持双方分摊资源费用、旧印及专属依赖 `08017`、`08018`。
- [ ] 五位调查员分别通过初始化、能力、构筑合法／非法、专属依赖、多人窗口和存档恢复；自动／手动构筑共用服务端规则。

退出门禁：逐位证据完整才开放该调查员；已有同名或平行版本不自动证明本编号与依赖已完成。

### P6：一般玩家卡批量迁移（规范第 5 步，M2）

- [ ] 主进程生成 `shards.json`，按卡号／职阶／机制拆成适当分片，检查无交集、并集覆盖全部一般玩家卡（含双职阶／三职阶卡、场外成套入场支援、0 级演进升级卡与基础弱点）。
- [ ] 按通用规范使用主进程与 worker 分工：worker 只写分配的单卡文件、进度和原语请求；共享层、账本、文档及索引由主进程维护。
- [ ] 逐卡核对费用、槽位、使用次数、多职阶属性、目标、窗口、区域、持续时间、每轮／每局限制、升级折扣及负面路径。
- [ ] 缺原语时写 `primitive-requests/*.json` 并将卡记为 `blocked`；主进程实现并验证后再恢复，不绕过 API 直写状态。
- [ ] 跨包／跨循环重印只保留 canonical 实现；每张卡登记 `descriptor / legacy / hybrid / missing` 和测试证据。
- [ ] 合并后统一重建索引，完成单卡检查、R1/R2/R3 审计、replay 对比与 `test:fast`，队列无悬挂。

退出门禁：开放卡全部有可执行行为与证据；`missing`、简化卡和阻塞卡不进入已完成数量或构筑池。

### P7：共享遭遇、八章及战役流程（规范第 5 步，M3）

- [ ] 先迁移战役内共享遭遇组（忒咳哩-哩、探险队伙伴与坚毅面、纪念逝者、极地气候与古老者等），再按 §4 顺序落地八个章节单元；按归属目录分片，避免共享卡重复实现。
- [ ] 八个章节单元逐项完成准备、伙伴选派、区域守恒、地点连接、全部幕／议程正反面、敌人／诡计／剧情资产、符号与结局。
- [ ] 严格按原版游玩顺序接入序幕、检查点 I–III、幕间 I–III、致命幻景的可选／重复切入和尾声。
- [ ] 根据检查点与幕间的实际规则处理营地继承、失踪／划去伙伴、经验与升级权限；检查点与紧邻部分之间按规则控制升级与状态延续。
- [ ] 从锁定来源生成完整叙事，覆盖所有伙伴存活／划掉与物资分支；运行时只显示已到达且有权查看的正文，历史正文不被当前记录改写。
- [ ] 每个章节单元同步生成完整中英文指南（`iceAndDeathPart1/2/3` 与 `theHeartOfMadnessPart1/2` 分别提取对应篇章），补译并标记缺项，通过来源覆盖、生成校验、Node 和浏览器验收。
- [ ] 八个章节单元全部完成 §6 的逐章确认，战役记录、伙伴状态、物资、纪念逝者、混乱袋和存档跨章一致。

退出门禁：每章的字面行为与指南均有证据；章内定向夹具不能代替真实大厅路线，战役仍需 P8 发布验收。

### P8：整体验收与发布（规范第 6 步，M5）

- [ ] 汇总 `audit/eote-migration.json`：来源哈希、逐卡账本、原语队列、章节、关键词、规则书、指南和截图证据可追溯。
- [ ] 覆盖完整合法战役、跳过／进行《亡命冰原》II–III、进入／跳过《致命幻景》、失败／撤退路线、伙伴全存／全灭、四档难度、存档恢复和 replay。
- [ ] 从真实大厅验证选战役、选人、构筑、开局、逐章推进、检查点、幕间、升级与尾声；覆盖多人、AI、断线恢复和权限边界。
- [ ] 通过单卡及合规门禁、指南生成检查、本循环测试与审计、既有 replay、全量回归、展示数据和浏览器检查。
- [ ] 核对本循环英文／中文卡图库存与远程回退，发布运行时不依赖 `参考资源/`。
- [ ] `confirmations.scenarios / keywords / rulebook` 全部 `verified`，且发布验收全部完成后，才确认完整迁移完成。
- [ ] 如决定提前开放，另行证明基础门禁，在 `releaseAcceptance.deferred`、`remaining` 和大厅明确延后项，保留 `earlyAccess: true`；延后项不打勾。

退出门禁：无新增失败，既有失败单独记账；无未披露的近似、阻塞卡或待实现原语。全部发布证据完成后才能撤销提前开放标识。

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
- [ ] **探险队伙伴（Partner）与纪念逝者**：9 位伙伴支援（`08714`–`08722`）的开局选派、不占盟友槽位、跨关持久化伤害与恐惧、被击败即在战役日志划去名字（`Eliminated`）、失踪（`Mia`）与转化（`TheEntity`）、坚毅面（`08723`–`08731`）升级替换，以及幕间从《纪念逝者》（`08732`–`08738`）领取对应遗物入牌组。
- [ ] **忒咳哩-哩！（Tekeli-li!）弱点牌库**：共享 16 张弱点牌库（`08700`–`08713`）构建与存档持久化、不查看内容洗入调查员牌库、抽到时揭示结算并默认移回忒咳哩-哩牌库底（或按持续修正改为洗回牌库、放牌库底、洗入任一调查员牌库或留在原位）。
- [ ] **营地、庇护值（Shelter）与检查点继承**：地点 `shelter` 数值读取、已揭示地点跨部分记录、检查点 I 按营地庇护值随机保护存活伙伴、跳过或进行后续部分的分支与奖励差异。
- [ ] **探险物资（Supplies）与封印（Seals）**：《失落之峰》7 项探险物资支援的控制、随攀登携带、失败掉落到地点及结局回收记录；《疯狂之心》五枚封印在激活／休眠状态下的持有、放置、转换与高塔互动。
- [ ] **地形网格、高度层级与行列移动**：《失落之峰》按高度层（Level）连接的山坡攀登与下坠；《古老者之城》三列城市景观随机摆放、同行／同列查看已揭示面与跨格移动；《亡命冰原》与《疯狂之心》的环形或网状连接。
- [ ] **多职阶卡、成套支援与调查员特殊规则**：双职阶／三职阶卡在构筑限制中的職阶匹配、陈丽丽演武双面永久卡与经验解锁、诺曼牌库顶常驻揭示与打出、鲍勃跨座位揭示手牌与共同付费打出道具、0 级可升级玩家卡的经验折扣与标记继承。
- [ ] **已有关键词及模板**：猎手、冷漠、反击、涌动、流放、封印等以实际扫描结果为准；已有实现也要验证本循环所需时机与交互。

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

### 阶段总览与证据登记

- [ ] P0 范围与基线完成。
- [ ] P1 机制扫描完成。
- [ ] P2 原语完成。
- [ ] P3 关键词与规则书完成。
- [ ] P4 交互完成。
- [ ] P5 调查员及专属依赖完成。
- [ ] P6 一般玩家卡完成。
- [ ] P7 八章、检查点、幕间、指南及战役流程完成。
- [ ] P8 发布验收完成，完整迁移交付。

| 日期 | 项目 | 状态／勾选依据 | 验证结果 | 证据路径 |
| --- | --- | --- | --- | --- |
| 2026-11-03 | 规划准备 | 完成规范阅读、来源定位、八章路线及清单建立；实现阶段均未勾选 | 文档链接检查通过 | `docs/edgeOfTheEarth/README.md` |

后续每次推进在此追加记录，并把稳定的逐卡／逐章证据写入 `audit/`。只有代码、来源与验收结果一致时才更新完成勾选。
