# 全战役剧情 / 冒险指南 / 关卡设置文本中文审计（2026-11-09）

> 性质：**只读审计**（不改游戏内容/实现），覆盖当前已注册的 **8 战役 × 62 关**的剧情文本、冒险指南（关卡设置面板）、关卡设置文本。
> 口径见 [`_SPEC.md`](_SPEC.md)；结构化结论见 [`findings.json`](findings.json)（36 条 finding，high 10 / medium 15 / low 11）；修复顺序见 [`fix-plan.md`](fix-plan.md)；扫描器见 [`tools/`](tools/README.md)，原始候选见 [`scan/`](scan/)。
> **状态（2026-11-09）**：P0 的 10 条 high 与 P1 的 10 项 medium 已修复，见 [`fix-report-P0.md`](fix-report-P0.md)、[`fix-report-P1.md`](fix-report-P1.md)；本报告的 finding 计数与证据为**修复前审计基线**，`scan/` 下候选已在修复后重跑（前后快照见 [`scan/after-fix-p0/`](scan/after-fix-p0/)、[`scan/after-fix-p1/`](scan/after-fix-p1/)），P2 仍按 [`fix-plan.md`](fix-plan.md) 执行。
> 与 EOTE 既有审计的关系：七循环《地球边缘》另有专项翻译审计（`docs/edgeOfTheEarth/translate/` 归档，2026-11-09 已修复批次）；本报告复核了其当前状态（`chineseGaps=0`、8 章 469/469 段有中文），只记录其残留问题（story-0011/0012、guides-0006）。

## 0. 一句话结论

中文卡面与规则书已基本简体、完整，但**剧情与指南这两条展示链仍存在三类直接影响玩家的问题**：
1. **整段英文进中文界面**：《失落的时代》久远腹地上/下篇导入与结局（12 段）、《万象无终》6 段、EOTE 2 处英文标签；这正是用户截图（「研究图案」卡 + 英文 `Intro 1:`）所示现象（`story-0001`）。
2. **分段/结构在展示链丢失**：《印斯茅斯暗潮》8 关导入与部分结局在「调查纪事」中被折成单段（`story-0004`）；指南分支收尾成段缺失，17 关的中文指南分支指令明显少于英文（`guides-0001`）。
3. **图标/占位符格式错**：遭遇组图标清单被生成器整段剥掉（61 份指南 87 处，`guides-0004`）；TIC 闪现记忆泄漏 `{'{'}cultist{'}'}` ICU 转义（`story-0005`）；TFA 用 `{cultist}` 等花括号代替 `[cultist]`（`story-0007`）；EOTE 残留 `[count]`/`[shelterValue]` 占位符（`story-0012`、`guides-0006`）。

此外还有全库性的**简繁混用**（剧情/指南中约 649 处「著」应为「着」，`story-0014`/`guides-0009`）与**结局段首标签重复**（107 处，`story-0009`）等一致性问题。

## 1. 范围与规模

| 层 | 输入 | 规模 |
| --- | --- | --- |
| 剧情文本 | 8 战役 `story-text.js`（含 EOTE 469 段/章 × 8）、TCU 逐关 story-text、campaign flow 投影、19 个叙事模块内联字面量、`src/campaign/story.js` | **3,499** 条去重文本（含 244 个 flow 节点文本） |
| 引导文本（冒险指南） | `web/scenario-guides/*.json` 的 zh/en 双面板 | **62** 份指南、zh **1,933** 块 / en **1,939** 块 |
| 关卡设置文本 | `contentRegistry` 62 关的 `name/intro/setup/resolutions` + `content/scenario-guides.js` 的 62 条 `note/setup` 摘要 | **62** 关 |

不覆盖：5,930 张卡面文本、规则书、交互按钮/技能检定提示、记录标签 UI、卡图内文字（见 `_SPEC.md` §一）；**未注册的战役**（`docs/campaign/theFeastOfHemlockVale`、`docs/campaign/theScarletKeys` 等仅有迁移文档/规划）不在本轮范围。

各战役剧情/指南规模与繁体用字（`著`）统计：

| 战役 | 剧情文本（去重） | 中文字符 | 「著」 | 指南份数 | zh 指南块 | 有候选的指南 | 「著」 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 夜之狂热 nightOfTheZealot | 37 | 2,767 | 10 | 3 | 52 | 3 | 11 |
| 敦威治遗产 theDunwichLegacy | 241 | 13,102 | 27 | 8 | 163 | 8 | 8 |
| 卡尔克萨之路 thePathToCarcosa | 186 | 16,208 | 0 | 8 | 221 | 8 | 0 |
| 失落的时代 theForgottenAge | 375 | 26,133 | 0 | 10 | 270 | 10 | 0 |
| 万象无终 theCircleUndone | 424 | 32,058 | 118 | 9 | 312 | 9 | 111 |
| 食梦者 theDreamEaters | 944 | 85,151 | 0 | 8 | 293 | 8 | 35 |
| 印斯茅斯暗潮 theInnsmouthConspiracy | 307 | 27,902 | 165 | 8 | 279 | 8 | 164 |
| 地球边缘 edgeOfTheEarth | 985 | 108,189 | 0 | 8 | 343 | 8 | 0 |
| **合计** | **3,499** | **311,510** | **320** | **62** | **1,933** | **62** | **329** |

> 「著」统计为疑似「着」的繁体用法（已排除 著名/著作/土著/显著 等合法词）。EOTE 当前为 0（修复批次已清）。繁简混用合计约 **649 处**。

EOTE 复核（与既有审计一致）：8 章 `sections` 中文/英文叶子 **469/469 对齐**、`chineseGaps=0`；62 份指南声明缺译 **0**；设置层 62 关均不缺口。EOTE 现有残留仅 story-0011（3 段英文标签）、story-0012（5 处 `[count]`）、guides-0006（en 面板 3 处 `[shelterValue]`）。

## 2. Findings 总表

> 「命中数」为扫描候选出现次数（同一根因可能被多个检测器重复命中；不代表独立缺陷条数）。完整证据、期望文本、修法见 [`findings.json`](findings.json)。

| ID | 层 | 严重度 | 结论（简要） | 命中数 |
| --- | --- | --- | --- | --- |
| story-0001 | 剧情 | high | 《失落的时代》久远腹地（上/下）导入与结局整段仍是英文原文（故事导入直接显示 Intro 1: / Resolution 1: 英文） | 12 |
| story-0002 | 剧情 | high | 《万象无终》6 段导入/结局正文仍是英文（含 unionAndDisillusion 的 Additional Intro 与 4 个结局分支） | 11 |
| story-0003 | 剧情 | high | 《食梦者》3 个幕间选择节点的 prompt 仍是英文（选择面板直接显示英文问句） | 2 |
| story-0004 | 剧情 | high | 《印斯茅斯暗潮》8 关故事导入与部分结局在「调查纪事」中丢失分段（多段 HTML 被 textBlocks() 折成单个 `<p>`） | 21 |
| story-0005 | 剧情 | high | 《印斯茅斯暗潮》闪现记忆正文泄漏 i18next ICU 转义：玩家看到 `{'{'}cultist{'}'}` 而不是混乱标记图标 | 13 |
| story-0006 | 剧情 | medium | 《印斯茅斯暗潮》闪现记忆正文保留 Markdown 星号强调（`*与托马斯·道森会面*`） | 18 |
| story-0007 | 剧情 | medium | 《失落的时代》幕间三/四用 `{cultist}`/`{skull}`/`{tablet}` 写混乱标记，故事日志原样显示花括号 | 16 |
| story-0008 | 剧情 | medium | 《万象无终》隐秘之名 intro3Mystic 首段泄漏 `({mystic})` 花括号职阶记号 | 1 |
| story-0009 | 剧情 | medium | 结局正文段首重复「结局 N：」标签（TCU 36 / TDE 39 / 敦威治 17 / TIC 15，共 107 处） | 107 |
| story-0010 | 剧情 | high | 结局正文段首是英文「Resolution N:」标签（敦威治 5 / 失落的时代 4 / 地球边缘 1） | 10 |
| story-0011 | 剧情 | medium | 《地球边缘》残留英文标签与短句（"Resolution 3:" / "Intro 3:" 等 9 处） | 9 |
| story-0012 | 剧情 | medium | 《地球边缘》5 处 `[count]` 占位符残留，当前实现没有替换点 | 5 |
| story-0013 | 剧情 | medium | 《食梦者》英文回退源保留 60 条英文原文（`pendingTranslation` 已全 false，不进界面；保留回归断言） | 0 |
| story-0014 | 剧情 | medium | 简繁混用：155 段命中繁体用字，「著」（应为「着」）约 320 处 | 155 |
| story-0015 | 剧情 | low | 标点/排版机械问题：半角标点 28、引号不配对 42、空格 11 等 | 87 |
| story-0016 | 剧情 | low | 英文虚词/作品名引用风格不统一（保留裁定） | 0 |
| guides-0001 | 指南 | high | 中文指南成段丢失分支收尾/去向指引：17 关分支指令数显著少于英文（TDE《神居之所》22→5、TCU《聚合幻灭》16→6） | 85 |
| guides-0002 | 指南 | high | 中文指南残留整行英文「Proceed to Setup / Intro / Scenario」（3 处） | 3 |
| guides-0003 | 指南 | medium | 中文指南保留英文小标题/连接词：`Intro N:`、`Resolution N:`、`Scenario I:`、`and` | 24 |
| guides-0004 | 指南 | medium | 遭遇组图标清单全体缺失：61 份指南 87 处「以下图标标示：」后无图标 | 87 |
| guides-0005 | 指南 | medium | 《食梦者·梦境门外》14 个梦境条目的职阶图标全部丢失 | 10 |
| guides-0006 | 指南 | medium | 英文指南面板 3 处 `[shelterValue]` 占位符原样显示 | 3 |
| guides-0007 | 指南 | high | 《食梦者》中文指南成块缺失：whereTheGodsDwell 缺 11 块、weaverOfTheCosmos 缺 4 块 | 15 |
| guides-0008 | 指南 | low | 中文指南图标 token 与英文数量不一致（含「各加1个」中文简写，需人工裁定） | 7 |
| guides-0009 | 指南 | medium | 中文指南简繁混用：127 段命中，「著」约 329 处 | 127 |
| guides-0010 | 指南 | low | 中文指南标点机械问题（半角标点 201、引号 25、半角括号 19 等） | 252 |
| guides-0011 | 指南 | low | 中文指南把「No Resolution / Resolution N」标题内联进正文（zh/en 块结构不一致） | 5 |
| setup-0001 | 设置 | high | 《印斯茅斯暗潮·达贡巢穴》场景设置残留 ICU 转义 `{'{'}bless{'}'}`/`{'{'}curse{'}'}` | 3 |
| setup-0002 | 设置 | medium | 《印斯茅斯暗潮》8 关场景设置正文未清理：`*遭遇组名*` 星号、HTML 折叠、悬空「图标」句 | 14 |
| setup-0003 | 设置 | low | 6 关无 `setup` 回退文本（敦威治），设置步骤完全依赖指南加载 | 7 |
| setup-0004 | 设置 | low | 关卡名中英混排不统一（TDE 2 关、EOTE 5 关带英文原名） | 6 |
| setup-0005 | 设置 | low | 设置层缺口（fatalMirage 无 intro、3 个结局键为空，属实现接线） | 4 |
| cross-0001 | 跨层 | medium | 图标记号体系不统一：`{token}` / `[count]` / `[shelterValue]` vs 渲染器只认 `[token]` | 0 |
| cross-0002 | 跨层 | low | 「Intro」类译名混用：引言 / 开场 / 介绍 / 导言 / Intro | 19 |
| cross-0003 | 跨层 | low | 来源口径：6 战役来自参考 zh locale（部分台湾繁中/上游缺译），TDE 自译，EOTE 补译 | 0 |
| cross-0004 | 跨层 | low | 范围说明：不覆盖卡面/规则书/交互提示；EOTE 另有专项审计 | 0 |

## 3. High 问题详情（玩家直接影响）

### 3.1 story-0001 · TFA 久远腹地上下篇整段英文（对应本次截图现象）

- **证据**：`content/campaigns/theForgottenAge/story-text.js:146/147/150/153/156`（Intro 1–4）、`:369/:372/:375`（Part1 结局）、`:380/:383`（Part2 结局）共 12 段英文；玩家在「故事导入」拍脸看到 `Intro 1: It has been several days…`（截图中的「研究图案 / 研究圖案」卡即该关 Act 1a 配图）。
- **根因**：`tools/import-tfa-story.mjs` 按 scenarioId 读取 `参考资源/.../zh/theForgottenAge/scenarios/heartOfTheEldersPart1.json`，而 upstream 这两个 id 文件只译了 tokens/label，**intro/resolutions 仍是英文**；完整中文在 `scenarios/heartOfTheElders.json` 的 `part1/part2`（生成器注释也写的是「分别放在 part1/part2 下」）。此外 `tests/tfa-heart-of-the-elders-part1.test.mjs:816` 断言 `bare.includes('Intro 1:')`，等于把英文标签固化成了期望行为。
- **修法**：生成器改读 `heartOfTheElders.json` 的 part1/part2；重生成 story-text；把测试断言改为中文正文（如 `includes('自从你的队伍再次进入丛林')`）。sourceKind：`reference-zh-locale / untranslated-upstream-variant`。

### 3.2 story-0002 · TCU 6 段导入/结局英文

- **证据**：`content/campaigns/theCircleUndone/story-text.js:449-451`（巫异时刻 resolution5）、`:496`（恶罪报应 r3）、`:574-575`（聚合幻灭 r9）、`:578`（聚合幻灭 r10）、`:633-634`（黑色王座 r6）、`:375`（聚合幻灭 additionalIntro）。
- **影响**：这些分支在对应结局/结盟条件命中时被投影进故事日志；中文玩家读到整段英文。
- **修法**：在 story-text 对应 zh 叶子补译（上游 zh locale 缺这几段），重跑 `npm run import:tcu-story -- --check` 与 `npm run test:tcu:story`。

### 3.3 story-0003 · TDE 幕间选择 prompt 英文

- **证据**：`content/campaigns/theDreamEaters/interludes.js:462`（`What shall I tell your friends in the waking world?`）、`:628`（`What message should the black cat carry to your companions?`，幕间三复用）。
- **影响**：`src/engine/campaign-flow.js:66` 把 `node.prompt` 直接作为 `campaignBranch` 的 prompt 展示，中文选择面板会显示英文问句。
- **修法**：给 TDE 三个 choice 节点补中文 prompt（硬编码改走 story-text locale 键，或直接写中文）。

### 3.4 story-0004 · TIC 导入/结局分段丢失

- **证据**：21 处；如 `content/campaigns/theInnsmouthConspiracy/story-text.js:1036`（绝望深坑 intro，含 4 个 `<p>`）、`:1102`（艾莲娜·哈珀失踪案 intro1，8 个 `<p>`）、`:1179`（深陷危局 intro，9 个 `<p>`）。
- **根因**：`chapter-definition.js#textBlocks()` 对字符串返回 `[整串]`；`introduction.js` 与 `resolutions.js#journal()` 把它直接当 `paragraphs`，story-reader 每个数组元素渲染成一个 `<p>`，段内 `\n\n` 被 HTML 折叠。闪现记忆走 `flashbacks.js#story()` 自行转换后 `api.present`，不受影响。
- **修法**：textBlocks 按 `</p>`/`<li>` 切段返回数组，或 story-reader 对含 `\n\n` 的段落二次拆分。

### 3.5 story-0005 · TIC ICU 转义泄漏

- **证据**：13 处，如 `story-text.js:1044`（`{'{'}cultist{'}'}`）、`:1048`（tablet）、`:1052`（elderThing）、`:1195`（inTooDeep flashback8，3 处）、`:1449/:1453`（aLightInTheFog flashback12/13）。
- **影响**：闪现记忆通过 `api.present` 展示，画面出现 `{'{'}cultist{'}'}` 字面量，标记完全不可读。
- **修法**：`flashbacks.js#story()` 的 HTML→纯文本链补 `{'{'}x{'}'}` → `[x]` 还原（与 `guideText` 已有替换同口径）。

### 3.6 story-0010 · 结局段首英文 Resolution 标签

- **证据**：`theDunwichLegacy/story-text.js:284/:291/:333…`（5 处）、TFA 4 处（heart 结局，同时属于 story-0001）、`edgeOfTheEarth/story-text.js:3673`（Resolution 3）。
- **修法**：结局正文段首标签统一剥离（标题层已生成「结局 N」），或保留分节语义时译成中文。

### 3.7 guides-0001 · 指南分支收尾缺失（17 关）

- **证据**：逐关分支指令词频对照（`scan/guides-coverage.json` + `findings.json` samples）：
  TDE whereTheGodsDwell **22→5**、TCU unionAndDisillusion **16→6**、TFA threadsOfFate **13→4**、TFA shatteredAeons **12→7**、TCU inTheClutchesOfChaos **13→6**、TCU atDeathsDoorstep 10→6、TCU disappearanceAtTheTwilightEstate 8→5、Dunwich theHouseAlwaysWins 7→2、TCU beforeTheBlackThrone 7→4、Dunwich extracurricularActivity 5→1、NOTZ theMidnightMasks 6→2、TCU theWitchingHour 6→2、TCU theWagesOfSin 2→0、FTA theCityOfArchives 4→2、FTA turnBackTime 4→2、Carcosa blackStarsRise 4→2、EOTE iceAndDeathPart1 6→4。
- **具体表现**：中文块停在条件半句，例如 `web/scenario-guides/shatteredAeons.json`：「检查剧本日志。如果你点燃了火盆」——没有「前往〈引言 1〉」；《食梦者·神居之所》故事段整段没有「宏大计划」分支的"读哪一段"指引。
- **根因**：参考工程 zh locale 的指南本身缺这些分支收尾（en 由 en locale 生成），生成器按 locale 逐块取文本、缺项无标记。
- **修法**：在 `content/scenario-guide-translations.json` / 战役自译源逐关补译缺失分支行，再 `node tools/import-scenario-guides.mjs --write`；生成器可加「en 有 Proceed/Skip 而 zh 块无对应动词」的拒绝门槛。

### 3.8 guides-0002 · 中文指南整行英文「Proceed to …」

- **证据**：`atDeathsDoorstep.json:22`（`Proceed to Setup`）、`disappearanceAtTheTwilightEstate.json:85`（`Proceed to Intro`）、`:156`（`Proceed to Scenario`）。
- **修法**：补译「进入冒险设置 / 继续阅读引言 / 前往下一场冒险」。

### 3.9 guides-0007 · TDE 指南成块缺失

- **证据**：`weaverOfTheCosmos.json:215/223/231/239`（The Spider Queen 1–4 的 en 块无对应 zh），`whereTheGodsDwell.json` 缺 11 块（Grand Design 1–5 + 结局分支等）。
- **影响**：中文玩家在指南里看不到「蛛后 1」的检查日志分支、宏大计划各段的去向，读完不知道下一步读哪段。
- **修法**：补 `content/campaigns/theDreamEaters/story-source/` 对应自译条目 → 重跑 `import-tde-story --write` 与 `import-scenario-guides --write`。

### 3.10 setup-0001 · TIC 达贡巢穴设置 ICU 转义

- **证据**：`content/campaigns/theInnsmouthConspiracy/story-text.js:1510`（`{'{'}bless{'}'}` / `{'{'}curse{'}'}`，来自 `story.setup.gatherSets…`）。
- **影响**：设置面板回退路径（指南 JSON 加载失败时展示 `scenario.setup`）会原样显示转义；指南正常时该串也会经 guideText 还原，属同源的清洗缺口。
- **修法**：TIC setup 渲染前统一还原 ICU 转义（与 story-0005 同一工具函数）。

## 4. 其他系统性问题（medium/low）

- **结局段首重复标签**（story-0009，107 处）：TCU/TDE/TIC/敦威治的结局正文以「结局 N：」开头，而故事日志已经是「结局 N」小标题；EOTE 已用 `resolutionText()` 显式剥离，可直接复用该口径。
- **图标格式**：遭遇组图标清单缺失（guides-0004，61/62 份指南 87 处——生成器把 `<section class="encounter-sets"><img…>` 整段剥掉，中英面板都只剩「以下图标表示：」的悬空句）；TDE 梦境职阶图标丢失（guides-0005，14 条梦境全部没有 `[guardian]` 等）；TFA 花括号 token（story-0007）；TCU `{mystic}`（story-0008）；EOTE `[count]`/`[shelterValue]`（story-0012、guides-0006）。
- **HUD/日志里的英文连接词**：`web/scenario-guides/theLastKing.json` 结局「移除所有[cultist], [tablet], and [elder_thing]」、`theGathering`/`theMidnightMasks`/`extracurricularActivity` setup 的「…, and 寒冷刺骨」——属上游 zh locale 的英文连接词残留（guides-0003）。
- **简繁混用**（story-0014 / guides-0009）：剧情+指南合计约 649 处「著」当「着」（TIC 329、TCU 229、敦威治 35、NOTZ 21、TDE 35），另有零星繁体字；卡面/规则书用简体，形成同一屏混排。EOTE 修复批次已示范批量替换脚本。
- **术语不统一**（cross-0002）：「Intro」在 TIC 译「导言」、TFA/TCU 有「引言」、TCU 有「转至介绍 1」、Dunwich/EOTE 残留「Intro N:」；建议建立与卡面/规则书一致的词表并在生成器统一。
- **标点机械问题**（story-0015 / guides-0010）：CJK 后半角标点（剧情 28、指南 201）、引号不配对（42/25）、半角括号（19）、多余空格等，多为上游 zh locale 原样带入，可确定性批量替换。
- **设置层覆盖**（setup-0003/0005）：敦威治 6 关、fatalMirage 场景数据无 `setup` 回退；设置面板的「步骤」完全依赖指南 JSON。当前指南都齐全（62/62 有 setup 段），但指南加载失败时设置面板只剩 note。

## 5. 修复优先级（详见 [`fix-plan.md`](fix-plan.md)）

| 优先级 | 动作 | 涉及 finding |
| --- | --- | --- |
| P0 本轮就该修 | 英文进中文界面、玩家读不懂的展示缺陷 | story-0001/0002/0003/0004/0005/0010、guides-0001/0002/0007、setup-0001 |
| P1 内容/生成器修复 | 补译上游缺项、生成器清洗与图标链路 | story-0006/0007/0009、guides-0003/0004/0005/0006、setup-0002 |
| P2 一致性清理 | 简繁、术语、标点、来源与结构 | story-0008/0011/0012/0014/0015、guides-0008/0009/0010/0011、setup-0003/0004/0005、cross-* |

## 6. 方法、复现与可验证性

- **方法**：静态提取三层数据源 → 机械候选（未译/混排/token/占位/分段/分支/简繁/标点）→ 人工复核归类 → 写 `findings.json`（count/samples 由扫描数据复算，行号按文本片段真实定位，定位失败为 null）。
- **复现**（在 `games/arkhamhorror/`）：
  ```sh
  node docs/translate/tools/scan-story.mjs --write
  node docs/translate/tools/scan-guides.mjs --write
  node docs/translate/tools/scan-setup.mjs --write
  node docs/translate/tools/build-findings.mjs --write
  ```
- **本报告产出物**：
  - [`findings.json`](findings.json)（36 条裁定 finding，含 36 组样本、行号、来源与修法；为**修复前审计基线**）
  - [`scan/story-coverage.json`](scan/story-coverage.json) / [`scan/guides-coverage.json`](scan/guides-coverage.json) / [`scan/setup-coverage.json`](scan/setup-coverage.json)（逐战役/逐关覆盖与候选计数）
  - [`scan/*-candidates.json`](scan/)（全量机械候选，供复算/追加 finding；**P0 修复后已重跑**，修复前后对比见 [`fix-report-P0.md`](fix-report-P0.md)）
  - [`scan/after-fix-p0/`](scan/after-fix-p0/)（2026-11-09 P0 修复后的扫描快照，供后续对比）
  - [`scan/after-fix-p1/`](scan/after-fix-p1/)（2026-11-09 P1 修复后的扫描快照）
  - [`fix-report-P0.md`](fix-report-P0.md) / [`fix-report-P1.md`](fix-report-P1.md)（两批修复的根因、落点、验证与残留）
  - [`tools/`](tools/README.md)（4 个可重复运行的扫描/合并脚本）
- **验证**：四个工具 `node --check` 通过；连续两次完整扫描/生成的文件哈希一致（确定性）；findings 中 170 条带行号样本用脚本复核，0 个文件缺失、行号均能在源码 ±2 行内命中证据（2 条证据含换行，属校验脚本显示差异）；本目录新增 Markdown 本地链接 25 条全部有效。**未修改任何游戏内容/实现文件**，只新增 `docs/translate/**`。
- 仓库既有 `npm run docs:check` 当前有 6 条与本轮无关的失效链接（`docs/edgeOfTheEarth/eote-scan/` 已在工作区删除、`docs/tcu-completion.md` 缺失），不在本报告修复范围。

## 7. 局限与未决项

1. **语义质量只做候选+抽样**：机翻感、语气、错别字（如 TIC「一汨咕呱之声」、TCU「很遗感」等）未逐句审校；本轮以结构性/可机械验证的问题为主。
2. **不判「未实现的剧情」**：如 TDE 16 段尾声矩阵当前投影链路、fatalMirage 回场正文是否可达，属行为验收范围（见 `docs/campaign/*/README.md` 与 audit 账本）。
3. **图标数量差异需人工裁定**：中文「各加 1 个」这类简写是否必须重复 token，取决于产品对规则可操作性要求（guides-0008）。
4. **来源归属**：上游 zh locale 的问题应写到本仓补译层而不是直接改参考资源；本报告给出 sourceKind，具体修法需按各战役生成器的 `--check` 流程落地。

## 8. 相关文档

- 七循环既有专项审计：`docs/edgeOfTheEarth/translate/` 归档（README 与 fix-batch 未随本仓迁移保留）
- 关卡指南生成器与门槛：[`docs/scenario-guides.md`](../scenario-guides.md)、[`docs/arkham-content-migration.md`](../arkham-content-migration.md) §4.5.2
- 卡面中文与上游来源：[`docs/card-image-translation.md`](../card-image-translation.md)
- 本轮扫描器说明：[`tools/README.md`](tools/README.md)

## 9. P0 修复状态（2026-11-09）

10 条 high 已全部修复，详细根因、落点、复扫结果与已知残留见 [`fix-report-P0.md`](fix-report-P0.md)。摘要：

| finding | 修复方式 | 验证 |
| --- | --- | --- |
| story-0001 | TFA 生成器改读 `heartOfTheElders.json` 的 `part1/part2`；上篇 r2 补译 | `import-tfa-story --check`、`test:tfa:story`、`test:tfa:scenarios` |
| story-0002 | TCU 补译层（6 条 finding 路径 + 2 段同根因英文结局），来源哈希登记进生成物 | `import-tcu-story --check`、`test:tcu:story` |
| story-0003 | TDE 3 个幕间 choice prompt 中文化 | `test:tde:story`、`test:tde:dual` |
| story-0004 | TIC `textBlocks()` 按段落/列表拆分，故事日志不再折成单段 | `tests/tic-story-format.test.mjs` |
| story-0005 | TIC 展示层还原 ICU 转义为 `[cultist]` 等图标记号 | 同上 + `test:tic:interactions` |
| story-0010 | Dunwich/TFA/EOTE 生成链剥离/替换段首英文 `Resolution N:`；指南同步译标签 | 各 `import:*-story --check`、`test:*:story` |
| guides-0001 | 指南生成器按 en 指令补中文去向；TDE zh 指南改用自译 story-text sections | `import-scenario-guides --check`、`tests/scenario-guides.test.mjs` |
| guides-0002 | 指南生成器统一本地化残留英文 `Proceed to …` | 同上；复扫 0 |
| guides-0007 | TDE 整块缺失由 story-text overlay 补全（保留参考 zh 缺失键回退） | 同上；复扫 block-missing 0 |
| setup-0001 | TIC setup 生成前还原 `[bless]`/`[curse]` 图标 token | `tests/tic-story-format.test.mjs` |

修复后复扫：剧情层 P0 对应类别（英文标签/ICU 转义/展示分段/英文结局标签）均为 0；指南层分支三件套与整块缺失均为 0；设置层 high 为 0。P2 finding 仍按 [`fix-plan.md`](fix-plan.md) 处理。

验证摘要：逐 finding 的 23 条 Node 断言全部通过；`npm run test:fast` 7032/7039（4 条失败为改动前即存在的 EOTE 证据产物/UI 词典/TCU scope 漂移，与本轮 P0 无关，详见 [`fix-report-P0.md`](fix-report-P0.md) §3）；`scenario-guides.browser.mjs` 桌面 1440 / 移动 390 2/2 通过。

## 10. P1 修复状态（2026-11-09）

P1 的 10 项已全部修复，详细根因、落点、复扫结果与残留见 [`fix-report-P1.md`](fix-report-P1.md)。摘要：

| finding | 修复方式 | 验证 |
| --- | --- | --- |
| story-0006 | TIC 展示层统一剥 Markdown 强调；审计按玩家可见文本判定 | `tests/tic-story-format.test.mjs`；复扫 `markdown-emphasis` 0 |
| story-0007 | TFA 生成器 `{cultist}` 等花括号 → `[cultist]`/`[elder_sign]` 方括号 token | `tests/story-format-p1.test.mjs`；`import:tfa-story --check` |
| story-0008 | TCU `({mystic})` → `[mystic]` 职阶图标 | `tests/story-format-p1.test.mjs` |
| story-0009 | TCU/TDE/Dunwich 生成器 + TIC 展示层剥离结局/尾声段首「结局 N：」标签 | `tests/story-format-p1.test.mjs`、`tic-story-format`；复扫 0 |
| story-0011/0012 | EOTE 尾声分节标题可读化、`[count]`→`X` | `tests/story-format-p1.test.mjs`；复扫 0 |
| guides-0003 | zh 指南清理 `, and` 与半角逗号连接词 | `tests/scenario-guides.test.mjs`；复扫 `mixed-language-word` 0 |
| guides-0004 | 删除「遭遇组…图标…：」悬空句（zh/en/EOTE/TIC setup 同口径） | 同上；复扫 `icon-sentence-dangling` 0 |
| guides-0005 | TDE 梦境条目补回五职阶 token（含「神秘学家」译名） | 同上；`beyondTheGatesOfSleep` 五 token 均存在 |
| guides-0006 | EOTE en 面板 `[shelterValue]` → `the camp's shelter value` | 同上；复扫 `unresolved-placeholder` 0 |
| setup-0002 | TIC setup 去 Markdown/HTML、删悬空图标句、按段落拆分 | `tests/tic-story-format.test.mjs` |

修复后复扫：剧情 P1 类别（Markdown 强调/花括号职阶/结局标签重复/`[count]` 等）均为 0；指南 P1 类别均为 0；设置 high 0。剩余 3 条 high 为作品内英文引用/R'lyehian 咒语误报（story-0016 low 口径），简繁/标点/术语等 P2 项仍待处理。
