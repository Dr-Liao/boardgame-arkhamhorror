# 七循环《地球边缘》中文翻译审计报告（translate）

> 审计日期：2026-11-09 ｜ 对象：`edgeOfTheEarth`（EOTE，七循环《地球边缘》，`eoep` 调查员包 + `eoec` 战役包，08 号段）
> 性质：**只读翻译审计**（本文件与各 area `findings.json`/`coverage.json` 是**修复前基线快照**，保留历史事实）。
> **修复状态（2026-11-09）**：审计出的 82 条问题已完成修复批次（75 条已修、7 条保留并裁定说明），剧情/指南分段问题一并修复。修复记录见 [`fix-batch.md`](fix-batch.md) 以及 [`cards/fix-report.md`](cards/fix-report.md)、[`story/fix-report.md`](story/fix-report.md)、[`guides/fix-report.md`](guides/fix-report.md)、[`terms/fix-report.md`](terms/fix-report.md)。
> 修复后现状：章节正文 **469/469**、战役 locale 键 **258/258**、八章指南 `chineseGaps` **0**；用 `node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs` 复算（`ok: true`）。
> 共享口径：[`_SPEC.md`](_SPEC.md)（问题分类、严重度、证据格式、findings schema）。
> 与行为审计的关系：既有 [`../eote-scan/`](../eote-scan/README.md) 审计「实现 vs 卡面/可玩性」，**不覆盖中文翻译质量**；本目录是独立的翻译专项审计。

## 1. 结论摘要

**一句话判定**：EOTE 的中文卡面几乎全量继承上游官方简中、本仓导入零改写；剧情/指南的中文覆盖率约 55%，既有「缺译显示中文待补、不用英文冒充」的披露口径**只在指南面板正文层成立**；故事日志、战役流程与记录标签存在**英文回退直接进中文界面**的展示链漏洞，并伴有**内部占位符/标记泄漏、缺译标题静默消失、规则级误译**等若干具体问题。

| # | 结论 | 严重度 | 证据入口 |
| --- | --- | --- | --- |
| 1 | **卡面无漏翻**：403 张卡 4030 个展示字段 100% 有中文；与上游 `cards_zh-cn.json` 去 HTML 后逐字节一致，本仓导入/改写差异 0、英文/繁中回退 0。 | — | [`cards/notes.md`](cards/notes.md) §③⑤ |
| 2 | **卡面仍有 32 条上游继承问题**（149 处 occurrence，high 2）：08586「受到2点伤害」应为「2点恐惧」；08022/08036/08050「每控制一张不同职阶」应按职阶计数。 | high 2 / medium 6 / low 24 | [`cards/findings.json`](cards/findings.json) |
| 3 | **剧情缺译量**：8 章 469 段 = 260 present / 10 untranslated / **199 missing**（缺译率 44.6%）；战役 `base.json` 258 键另缺 68 + 1 未译。合计补译 backlog **278 条**（章节 209 + 战役共享 69）。 | — | [`story/coverage.json`](story/coverage.json)、[`guides/coverage.json`](guides/coverage.json) |
| 4 | **故事日志/章节展示层英文回退泄漏**（新发现，high）：缺译叶子以英文拼进 `intro/setup/resolutions`，共 126 个回退叶（`Lead` 独立复算 112 个纯英文段落），无「中文待补」标记；`web/story-reader.js` 直排。 | high | `story-0001` |
| 5 | **战役 flow 选项按钮显示英文**（high）：14 个选项 label + 1 个节点正文显示英文，并**覆盖模块里已写好的中文兜底**（根因 `records.js#storyBody` 不判三态 + `flow.js#localizeNodes` 无条件覆盖）。 | high | `story-0002` |
| 6 | **指南面板缺译呈现缺陷**（high）：121 个缺译正文块正确显示「中文待补」，但 **14 个缺译标题静默消失**（含 8 个 specialRules 分组标题）；Part3「调查员设置」因 `@:` 跨节引用未展开成为**假性缺译**（en 面板整段丢失，而 Part2 有现成中文）。 | high ×2 | `guides-0002`、`guides-0003` |
| 7 | **内部占位符/符号残渣进入玩家正文**（high/medium）：i18next 转义 `{'{'}frost{'}'}` 剧情 32 处/16 段 + 指南 7 段；`[shelterValue]`、`Shelter Value:`、`Experience:` 原样显示；`。.` 重复标点剧情 67 处 / 指南 65 处。 | high 1 + medium | `guides-0001`、`terms-0002`、`guides-0004/0005/0007` |
| 8 | **规则级误译**（high）：`iceAndDeathPart1 setup.expert`（专家难度）写成「困难等级」（与 hard 同文）；`winifredNotPresent` 的 `skip to` 译成「进入」，丢失「跳过」语义。 | high | `story-0008` |
| 9 | **用字/术语一致性问题**（medium/low）：terms 22 条 findings：`[fast]→[free]` 图标 53 张（渲染层区分「快速/免费触发」）、`keywords.js` Retaliate 错写「报复」、Tekeli-li 多「！」、规则书「议程/战役日志/Broken-Unbroken/泰坦坡道」与卡面口径不一致、`Camp - X (N)` 营地标签 13 条、营地名/物资/调查员名不一致；「著」作「着」661 处（剧情 451 / 指南 210）。 | high 3 / medium 16 / low 3 | [`terms/notes.md`](terms/notes.md)、[`terms/glossary.md`](terms/glossary.md) |

> 结论的审计口径：所有数量均为**本轮脚本复算值**，可运行第 12 节命令逐项复现；`location` 逐条校验文件与行号存在（合并版 `findings.json` 中 `locationValid` 全 true）。

## 2. 范围、数据源与方法

### 2.1 四条审计线（area）

| area | 审计员 | 对象 | 规模 | 产物 |
| --- | --- | --- | --- | --- |
| cards | cards-audit | `src/cards/cards-data.js` 中 `pack ∈ {eoep, eoec}` 的 08 号段卡 | **403 张 / 4030 个展示字段** | [`cards/findings.json`](cards/findings.json)、[`cards/notes.md`](cards/notes.md)、[`cards/_dump.md`](cards/_dump.md)（403 卡中英对照） |
| story | story-audit | `content/campaigns/edgeOfTheEarth/story-text.js`（生成物）+ 10 个战役模块 + 展示链 | 8 章 **469 段** + 战役 **258 个 locale 键** + 战役 flow/记录标签 | [`story/findings.json`](story/findings.json)、[`story/notes.md`](story/notes.md)、[`story/coverage.json`](story/coverage.json) |
| guides | guides-audit | `web/scenario-guides/` EOTE 8 份「关卡设置」面板 JSON | **469 个 en 叶子 key**（55/38/31/68/51/94/79/53） | [`guides/findings.json`](guides/findings.json)、[`guides/notes.md`](guides/notes.md)、[`guides/coverage.json`](guides/coverage.json) |
| terms | terms-audit | 跨卡面/剧情/指南/规则书/模块的术语、简繁用字、专名音译、标点风格 | 2335 条去重中文 doc / 137,436 汉字（cards 1521、story 429、guides 207、rules 94、modules 84） | [`terms/findings.json`](terms/findings.json)、[`terms/notes.md`](terms/notes.md)、[`terms/glossary.md`](terms/glossary.md)、[`terms/glossary.json`](terms/glossary.json)、[`terms/scan-report.json`](terms/scan-report.json) |
| （Lead） | lead | 独立交叉复核 + 合并去重 + 证据校验 | 覆盖上表全部 | [`crosscheck/`](crosscheck/)、[`findings.json`](findings.json)（合并版）、`tools/lead-crosscheck.mjs`、`tools/merge-findings.mjs` |

### 2.2 权威对照（只读）

- 卡面：`参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json`（简体上游，本项目 `textZh` 的事实源）、`cards_zh.json`（繁体）、`cards_en.json`（英文）。
- 剧情/指南：`参考资源/ArkhamHorror-main/frontend/src/locales/{zh,en}/edgeOfTheEarth/**`（6 个 JSON：`base.json` + 5 个 scenarios）。
- 展示链：`content/campaigns/edgeOfTheEarth/story-access.js`、`records.js`、`flow.js`、各章 `texts.js`/`definition.js`、`web/story-reader.js`、`web/scenario-setup-view.js`、`web/card-text.js`。

### 2.3 中文三态口径（与 P7 生成链一致）

- `missing`：参考 zh locale 无同路径；`untranslated`：有值但无 CJK，或中文里夹整句英文（3+ 连续英文小写词）；`present-needs-review`：含 CJK 但未经人工校对。
- 「缺译」= missing + untranslated。缺译按既有披露口径进入 `chineseGaps`，指南面板正文层显示「中文待补」。
- **本审计把「已披露缺译」与「新发现缺陷」严格分开**：缺译本身不逐条计 finding，全部进入 backlog（第 7 节）；只有**呈现/生成/翻译错误**才计 finding。

### 2.4 方法

1. 四条 area 分别用 Node 脚本（不 spawn 子进程）复算上游来源、机械扫描 + 人工复核；所有 `location` 由脚本在源码中定位，非手写。
2. Lead 用 `tools/lead-crosscheck.mjs` **独立复算**关键指标（不复用 area 脚本结论），覆盖：卡面 en/zh 结构 token、剧情三态与展示链、指南三态与面板树、参考 locale 叶子覆盖、发布文本符号残渣。
3. `tools/merge-findings.mjs` 合并四个 area 的 findings：schema 归一、`location` 文件/行号校验、重复项合并、统计。

## 3. 问题分类与严重度

分类与严重度定义见 [`_SPEC.md`](_SPEC.md) §二/§三，摘要：

| 分类 | 含义 | 本轮典型 |
| --- | --- | --- |
| `missing-translation` 漏翻 | en 有正文而 zh 缺失/空/未译 | 199 段章节缺译、68 个战役键缺失、14 个面板标题静默消失 |
| `mixed-language` 中英混杂 | 中文句夹英文单词/整句、英文回退直出 | 故事日志 126 叶英文回退、flow 14 个英文选项、`Shelter Value:` |
| `symbol-format` 错误符号/格式 | token/占位符/标点/括号/乱码/标记泄漏 | `{'{'}frost{'}'}`、`[shelterValue]`、`。.`、markdown `_`、引号不配对 |
| `mistranslation` 误译 | 数字/否定/条件/目标与 en 不符 | 08586 伤害↔恐惧、08022 职阶计数、expert→「困难等级」 |
| `marker-leak` 标记泄漏 | 内部标记渲染给玩家 | 本轮 0（面板「中文待补」属既定口径，不计泄漏） |
| `terminology` 术语/用字 | 同词多译、简繁混用、专名不一致 | 毁灭标记/印记、牌库/牌组、著→着、雷蒙特/蒙特雷、规则书议程/战役日志 |

严重度：`high`（玩家直接可感知且影响规则/理解）、`medium`（可读但有明显瑕疵）、`low`（风格/一致性/需人工裁定）。

## 4. 总量统计

### 4.1 合并 findings（四个 area）

> 数字与 [`findings.json`](findings.json) 的 `summary` 逐项一致（由 `merge-findings.mjs` 从四个 area 合并重算）。

| area | findings | high | medium | low |
| --- | --- | --- | --- | --- |
| cards | 32 | 2 | 6 | 24 |
| story | 14 | 3 | 6 | 5 |
| guides | 14 | 3 | 8 | 3 |
| terms | 22 | 3 | 16 | 3 |
| **合并** | **82** | **11** | **36** | **35** |

分类分布（82 条）：`terminology` 31 ｜ `symbol-format` 28 ｜ `mistranslation` 11 ｜ `mixed-language` 9 ｜ `missing-translation` 3 ｜ `marker-leak` 0。
合并版 [`findings.json`](findings.json) 由 `merge-findings.mjs` 生成：`invalidLocations` 0、`missingFields` 0、`duplicates` 0（82/82 条 `location` 文件与行号校验通过）。

### 4.2 中文覆盖总表

| 层 | 单元数 | 已译（present） | 未译（untranslated） | 缺译（missing） | 覆盖率 |
| --- | --- | --- | --- | --- | --- |
| 卡面（403 卡 × 展示字段） | 4030 | 4030 | 0 | 0 | **100%** |
| 剧情/指南章节段（8 章） | 469 | 260 | 10 | 199 | **55.4%** |
| 战役剧情/规则键（base.json localeKeys） | 258 | 189 | 1 | 68 | **73.3%** |
| 指南面板可读单元（正文+标题） | 469 | 169 正文 + 38 标题 = 207 | — | 121 正文显示「中文待补」；14+1 标题不可见；126 skipped | **44.1%** |
| 战役记录标签（recordSchema） | 81 | 56 | — | 25 回退 camelCase（见 story-0003） | 69.1% |

### 4.3 Lead 独立复核的机器指标（可复现）

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| 卡面 en/zh 展示字段 | 2821 对（7 字段 × 403） | 空译 0；zh==en 0；与上游去标签差异 **0**；`[fast]→[free]` 归一后图标 token 差异 0；数字差异均为中文数词写法（低风险） |
| 剧情 present 段英文-only | 0 | 章节 `sections` 中 present 值 0 段纯英文 |
| 剧情**展平展示值**英文回退 | intro 8 / setup 96 / resolutions 22 = **126 叶** | story-0001；Lead 按段落口径复算 **112 个纯英文段落** |
| 战役 flow 英文 | 1 节点正文 + **14 选项 label** | story-0002 |
| 记录标签回退 | 25 个 camelCase + 13 个 `Camp - …` | story-0003 |
| 参考 locale 叶子覆盖（6 文件） | 695 叶：present 431 / missing 253 / untranslated 11 | 叶子级口径包含非面板键；面板键口径见 §7 |
| 发布文本符号残渣（剧情） | `{'{'}…{'}'}` **32 处/16 段**（story area 口径；去重后 16 处）；`。.` **67 处/34 段**；`???` 8 段；`[shelterValue]` 2 段；CJK 后半角标点 74 处 | [`story/notes.md`](story/notes.md) §3.2、`crosscheck/shipped.json` |
| 发布文本符号残渣（指南） | `。.` **65 处/33 段**；`{'{'}…{'}'}` **7 段**；中文后半角句点 15 处/13 段；`[shelterValue]`/`Shelter Value`/`Experience` 4 段；`???` 1 | [`guides/notes.md`](guides/notes.md) §③、`crosscheck/shipped.json` |
| 「著」用字 | **661** 处（story **451** / guides **210**；卡面 193 处全为「着」） | terms area 去重语料口径；Lead crosscheck 的 533 为含展示副本的重复计数 |
| 剧情缺译键 | 209（199 missing + 10 untranslated） | 与 `story-text.js#meta.chinese`、`chineseGaps` 逐章一致 |
| 指南缺译键 | 209；backlog 278（章节 209 + 战役共享 69） | `guides/coverage.json` |
| 术语语料 | 2335 条去重中文 doc / 137,436 汉字；关键词 38 条、规则术语 40 条、专名 5 调查员 + 9 伙伴 + 7 物资 + 13 营地 | [`terms/glossary.md`](terms/glossary.md)；误报排除 8 组（敌军阶段/损伤/技巧/胜利区/Massive=庞大/冒险??? 等） |

## 5. High 问题清单

> 合并版 [`findings.json`](findings.json) 共 **11 条 high**；本节按主题归并为 **10 个条目**（H6 同时覆盖 guides-0001 与 terms-0002 同一根因的 guides/story 两侧）。编号以本文 H1–H10 为准，`findings.json` 中保留各 area 原始 id；每条都可由对应 area 脚本复现。

> 严重度口径差异说明：同一问题在不同 area 可能给不同严重度（如 `[fast]→[free]`：cards area 判 medium〔数据层〕、terms area 判 high〔渲染层区分「快速/免费触发」〕）。本报告 §5 取**最高严重度**展示；`findings.json` 保留各 area 原值，合并统计以 area 值为准。

### H1 `cards-0013` 08586「受到2点伤害」应为「受到2点恐惧」（误译 / upstream 继承）

- 位置：`src/cards/cards-data.js:300191`（`08586.textZh`）。
- 证据：en `Take 2 horror` → 简中「受到**2点伤害**」；繁中作「受到2點**恐懼**」，同卡英文亦为 horror。
- 影响：伤害/恐惧是两套独立结算与治愈路径，规则级错误；`险境` 卡不可交流，玩家难以察觉。
- 建议：本地补丁改为「受到2点恐惧」，同时向上游 ArkhamDB 简中数据反馈（该错在上游 `cards_zh-cn.json` 即存在）。

### H2 `cards-0014`「每控制一张不同职阶的卡牌」应按职阶计数（误译 / upstream 继承）

- 位置：`src/cards/cards-data.js:287213`（`08022.textZh`；另 08036/08050）。
- 证据：en `For each different class among cards you control` → 简中「你每控制**一张**不同职阶的卡牌」；同包 08077 与繁中均按「每一个不同的职阶」计数。
- 影响：效果量级错误（控制 2 职阶 5 张牌：正确 +2，按简中字面 +5）。
- 建议：三张卡统一改为「你控制的卡牌中每有一个不同的职阶，……」并向上游反馈。

### H3 `story-0001` 故事日志/章节展示层英文回退，无「中文待补」标记（中英混杂 / high）

- 位置：`content/campaigns/edgeOfTheEarth/story-text.js:1990`（`heading: Scenario I`）、`:3353`（city setup v1 `gatherSets`）、`:3035`（forbidden peaks `resolution1.body` 全英文）、`:4131`（H2 `noResolution.title = No Resolution`）等。
- 证据：生成器 `tools/import-eote-story.mjs:124` 让 `display` 在缺译时回退 en；`story-access.js:44` 直读 `sections`；各章 `definition.js`/`texts.js` 用其拼 `SCENARIO_TEXT.intro/setup/resolutions`；`web/story-reader.js` 逐段直排，**不消费 `chineseGaps`**。Lead 独立复算：展平 `intro/setup/resolutions` 中 **112 个纯英文段落**（story-audit 叶子口径 126 叶）。
- 影响：中文玩家在故事日志/剧情推进中直接读到英文块（`Scenario I`、`No Resolution`、整段英文结局），且无「中文待补」提示。
- 建议：展示层按三态过滤（非 present 渲染「中文待补」或干脆不渲染），或 `sections` 只存中文、英文回退移入 `sectionsEn`；补 backlog 后再回归。

### H4 `story-0002` 战役 flow 选项按钮/节点显示英文并覆盖中文兜底（中英混杂 / high）

- 位置：`content/campaigns/edgeOfTheEarth/interludes.js:131`（显示 `Open the door and venture into the mirage.`，模块中文兜底为「打开门，进入幻景。」）、`prologue.js:58/63`、`checkpoints.js:87/119/124`、`interludes.js:191/202/250/261`。
- 证据：`records.js:85-86#storyBody` 读 `localeKeys[...].body`（缺译时值即 en）→ `flow.js:99-116#localizeNodes` 无条件 `if (body) node.text/label = body` 覆盖模块兜底。共 **14 个选项 label + 1 个节点正文** 为英文。
- 影响：中文 UI 里序幕/检查点/幕间选择按钮是英文（`Run for your lives!`、`Stand and fight!` 等），且这些键在 backlog 里本有中文兜底可用。
- 建议：`storyBody` 增加 `status === 'present-needs-review'` 门限（缺译时返回空、让中文兜底生效）；或 `localizeNodes` 只在三态为 present 时覆盖。

### H5 `story-0008` 难度条件与分支误译（误译 / high）

- 位置：`content/campaigns/edgeOfTheEarth/story-text.js:2026`（`setup.expert`）、`:2015`（`setup.winifredNotPresent`）。
- 证据：en `Expert`（专家难度，放 2 doom）被译成「如果你在游玩**困难**等级…放2个毁灭标记」，与 `setup.hard`（`:2025`，放 1 doom）同文；`Otherwise, skip to Intro 3.` 译成「否则**进入** 导言 3.」，丢失「跳过」。
- 影响：难度设置指示错误；分支不可区分。
- 建议：改为「专家等级」与「否则跳到 导言 3」；参考 zh locale 修正后重跑 `import-eote-story --write`。

### H6 `guides-0001` / `terms-0002` `{'{'}frost{'}'}` 花括号转义残渣进入中文正文（错误符号 / high）

- 位置：`web/scenario-guides/iceAndDeathPart2.json:44`（另 Part3 `:52`、toTheForbiddenPeaks `:156/166/176`、cityOfTheElderThings `:323`、theHeartOfMadnessPart1 `:203`）；剧情侧 `content/campaigns/edgeOfTheEarth/story-text.js:2288/2489/3044` 等。
- 证据：`向混乱袋中添加1个 {'{'}frost{'}'} 标记`；story 侧 32 处/16 段，guides 侧 7 段（terms 去重口径 23 处：story 16 + guides 7）。根因 EOTE 生成链未还原 i18next 转义（同仓 `import-scenario-guides.mjs#guideText` 有通用还原但 EOTE 未复用）；en locale 同源也有 7 处。
- 影响：玩家看到乱码式占位符，冰霜标记无法识别。
- 建议：生成器复用 `{'{'}x{'}'}` → `[x]` 还原；再跑 `import-scenario-guides`/`import-eote-story` 并更新 sources 哈希。

### H7 `guides-0002` 14 个缺译标题静默消失，不显示「中文待补」（漏翻/呈现缺陷 / high）

- 位置：`web/scenario-guides/iceAndDeathPart2.json:230`、`fatalMirage.json:414`、`cityOfTheElderThings.json:562`、`theHeartOfMadnessPart1.json:446/454/462` 等。
- 证据：`web/scenario-setup-view.js:52-58#renderBlocks` 只对 `block.text` 缺译渲染「中文待补」，**title 缺译无对应分支**；生成器 `eoteBlocks` 直接省略 title。14 条已登记缺译标题不可见，其中 8 条是 specialRules 分组标题（Mirage/Keys/Ancient Facility Locations/Seals/Location Adjacency…），分组语义丢失。
- 影响：玩家看到无标题正文块/分组；缺译没有提示，与「中文待补」口径不一致。
- 建议：渲染层 title 缺译时输出占位标题或「中文待补」；生成器保留 title 的 missing 标记。

### H8 `guides-0003` Part3「调查员设置」`@:` 跨节引用未展开 → 假性缺译（漏翻/生成缺陷 / high）

- 位置：`web/scenario-guides/iceAndDeathPart3.json:15-16`。
- 证据：en/zh 源 `part3.investigatorSetup.title/body` 均为 `@:edgeOfTheEarth.iceAndDeath.part2.investigatorSetup.{title,body}`；生成链 `stripRefs` 把行删空 → zh 面板显示「中文待补」，en 面板整段消失；而 Part2 同段有完整中文。
- 影响：中文玩家看到此处「中文待补」（其实已有译文），en 玩家整块设置信息丢失。
- 建议：生成器展开 i18next `@:` 引用；展开后可从 backlog 移除该「假性缺译」。

### H9 `terms-0001` 卡面 `[fast]` 图标被系统性替换成 `[free]`（错误符号 / 上游继承 / high）

- 位置：`src/cards/cards-data.js:285465`（08002 机修工的扳手）、`:285741`（08005 伊波恩之书）、`:288342`（08041 通路档案）、`:291188`（08089 快拔枪套）等 **53 张卡 / 58 处**。
- 证据：en 卡面 58 处 `[fast]` 在简中全部变成 `[free]`（简中 `[fast]` 0），反向亦然。仓库渲染层把二者区分成**两个不同标签**：`web/locales/zh-CN.table.js:12-13` 中 `symbol.free=「免费触发」`、`symbol.fast=「快速」`，`web/card-text.js:17` 分别映射不同图标/规则链接。cards area 判 medium（数据层继承）、terms area 判 high（渲染层规则可见错误），本报告取 high。
- 影响：中文玩家看到原本「快速」的能力被标成「免费触发」，与印刷卡图/英文卡面不一致；对少数依赖时间窗判定的卡存在规则歧义风险。
- 建议：本地 `textZh` 把对应 token 改回 `[fast]`（同步重跑卡账本/上游 SHA 对照），或按产品口径确认统一采用 `[free]` 后更新渲染映射；上游 ArkhamDB 简中数据建议反馈。

### H10 `terms-0003` 13 个营地记录标签带英文前缀 `Camp - `（中英混杂 / high）

- 位置：`content/campaigns/edgeOfTheEarth/story-text.js:1139/1160/1188` 等（13 条 `camp.*` 记录标签）。
- 证据：战役日志/记录面板显示「**Camp -** 屏障营地 (7)」「**Camp -** 辽阔雪地 (4)」等：英文前缀 + 半角括号；`records.js` 自身回退格式为「屏障营地（庇护 7）」。13/56 个记录键受影响，属战役日志直接可见的中英混排。
- 影响：中文界面战役日志出现英文前缀，且与中文全角括号风格不一致。
- 建议：参考 zh locale 修正为「X（庇护 N）」；生成链重跑并同步 `chineseGaps`/账本。

## 6. 按 area 详情

### 6.1 cards（403 张卡面）

- **来源复算**：4030 个 zh 字段与上游 `cards_zh-cn.json` 去 HTML 后逐字节一致；`localeStatus` 403/403 一致；英文回退 0、繁中回退 0 → **本仓导入/改写新增问题 0**；全部 32 条 findings `source: upstream-zh-cn`。
- **high 2 条**：见 H1/H2。
- **medium 6 条**：`[fast]→[free]` 图标系统性替换（53 字段/58 token，见 §8.5）；08520 `[[Objective]]` 上游简中未用 `[[ ]]` 标记（`<b>目标</b>` 去标签后纯文本）；08622 `Campaign Log`→「剧本手册」（应为「剧本日志」）；08037 正文自名「地区探测」≠卡名「地区勘测」；08008 调查员名「雷蒙特·杰克」≠「蒙特雷·杰克」；08615「木制雪撬」≠「木制雪橇」。
- **low 24 条**：标点/空格/换行、数字体例（1 vs 一张）、术语变体（隐藏值、毁灭标记/印记、忽略/忽视、标准/基础伤害、每套/每个牌库仅限1张、campaign 战役/剧本）、FAQ 勘误注记（08596/08635）、引文署名格式等。
- 详见 [`cards/notes.md`](cards/notes.md)；逐卡中英对照在 [`cards/_dump.md`](cards/_dump.md)。

### 6.2 story（剧情正文与战役模块）

- **三态复算**：8 章 469 段 = 260/10/199；`chineseGaps` 209 条与 `meta.chinese`、逐章统计一致，209 个缺译叶 `display === sectionsEn` 全部成立。战役 `localeKeys` 258 = 189 present / 68 missing / 1 untranslated（`checkpoint1.theDisappearance3.body`）。
- **展示链漏洞**（new）：见 H3/H4；另有记录标签回退：`recordSchema` 81 键中 25 个无中文标签回退 camelCase（`web/hub.js:1485`/`web/story-reader.js:32` 直出）；13 个 `Camp - …` 记录标签英文（story-0003，medium）。
- **文本问题**（present 段）：`。.` 67 处/34 段；CJK 后半角标点 74 处；`{'{'}…{'}'}` 32 处/16 段；`[shelterValue]` 2 段；引号不配对 20 段（需人工裁定）；markdown 前缀 2 段；`冒险???：致命幻景` 8 段（en 源同为 `Scenario ???`，产品裁定）；「著」451 次/168 路径（见 §8.4）。
- **误译**：H5；另交叉提示 `keywords.js` level「高度等级」vs 卡文「层级」、records 常量「水晶洞窟/莱克营地遗迹/木制雪橇」与卡面「水晶洞穴/莱克营地遗址/木制雪撬」不一致（见 §6.4）。
- 详见 [`story/notes.md`](story/notes.md)、[`story/coverage.json`](story/coverage.json)。

### 6.3 guides（八章指南面板）

- **覆盖复算**：469 key = 260 present / 10 untranslated / 199 missing；`chineseGaps` 209 与源 locale 重算、`story-text.js` 逐 key 完全一致（漏记/多记/状态错均 0）；`sources` 哈希、重建 locales 与磁盘 JSON 逐字节等价、拆章映射全部通过（一致性检查无 finding）。
- **面板呈现**：169 中文正文块、121 块「中文待补」（正文层五层口径一致）、38 中文标题；**14 个缺译标题静默消失** + 1 个 `@:` 引用标题整段消失；73 个缺译键属 skipped（heading/tokens/label，面板不渲染）；可读中文单元 207/469（44.1%）。
- **缺陷**：H6/H7/H8；medium/low：7 段半译/夹英文（`Shelter Value:`、`Experience:`、`Setup.`、`Resolution 3:`、`Intro 3:`、`(v. I)`）、`[shelterValue]` 原样显示、`。.` 65 处/33 块、9 段引号不配对、7 段 markdown `_` 泄漏、25 段半/全角混用、Part2 标题「亡命冰原 第I部分I」（应为第II部分）、`No Resolution` 两种译法、city「拥有额」漏字、3 处列表/段落结构差异。
- 详见 [`guides/notes.md`](guides/notes.md)、[`guides/coverage.json`](guides/coverage.json)（278 条补译 backlog）。

### 6.4 terms（术语一致性、简繁与专名）

> 完整报告见 [`terms/notes.md`](terms/notes.md)，术语总表见 [`terms/glossary.md`](terms/glossary.md)（规则术语 40 条 / 关键词 38 条 / 图标 token / 专名：5 调查员 + 9 伙伴 + 7 物资 + 13 营地 + 5 章 + 主要实体），机器可读 [`terms/glossary.json`](terms/glossary.json)、全量扫描 [`terms/scan-report.json`](terms/scan-report.json)。
> terms 语料：**2335 条去重中文 doc / 137,436 汉字**（cards 1521、story 429、guides 207、rules 94、modules 84）；22 条 findings：high 3 / medium 16 / low 3。
> 推荐原则：**卡面（上游 ArkhamDB 简中）> 剧情/指南 > rules**；与上游一致标 `upstream-zh-cn`，参考 locale 继承标 `reference-locale`，本仓自写标 `repo-authored`。

**（1）规则术语整体健康，硬冲突集中在少数词**

| 状态 | 术语 |
| --- | --- |
| 统一且无冲突（抽样 40 条） | 毁灭标记、线索、恐惧（规则值）、伤害、支援、事件、技能、诡计、敌人、地点、幕、结局、战役、探险、钥匙、封印、标记、调查员、弱点、遭遇组、混乱标记/混乱袋、未勘之地、创伤、**敌军阶段（固定流程名，非误译）** 等 |
| 需修（medium） | `keywords.js` **Retaliate=「报复」**（11 张卡面全用「反击」，上游 37/37 也是「反击」）；规则书 **agenda=「议程」5 处**（卡面/剧情统一「密谋」33 次）；规则书 **campaign log=「战役日志」12 处**（卡面统一「剧本日志」132 次）；规则书 **Broken/Unbroken 保留英文**并与「运功/破功」三套并存；**Titanic Ramp 三套译名**（卡面「巨大坡道」/rules「泰坦坡道」/keywords trait「巨型」）；**The Nameless Madness** 卡面「无名疯狂」vs rules「无名狂魔」；**deck** 卡面/规则「牌库」vs 剧情/指南「牌组/牌堆」（89 次） |
| 语境分工（不升级为错误） | supplies 补给/物资/补给品、scenario 场景/剧本/冒险、partner 伙伴/同伴、shelter 庇护值/庇护所、location 地点/位置 |

**（2）关键词（38 条）**：卡面对齐良好，仅 3 处关键名失真：`Retaliate=报复`（见上）、**Tekeli-li 卡名无「！」**但 keywords/规则书/部分剧情写「忒咳哩-哩！」（42 卡不一致）、`[[Titanic]]` trait「巨型」缺卡面证据。`Massive=庞大`、`Hunter=猎手`、`Aloof=冷漠`、`Surge=涌动`、`Peril=险境`、`Parley=谈判`、`Patrol=巡逻` 等经证据核实为上游一致口径（**误报排除**：敌军阶段、损伤〔Injury 特性〕、技巧〔Trick 特性〕、胜利区〔victory display〕、Hidden Tunnel、Level、Massive=庞大、`冒险???`〔en 源印刷留白〕共 8 组）。

**（3）专名一致性**：5 位调查员、9 位伙伴（卡面/剧情/指南三层）、9 件纪念逝者、13 处营地、主要敌人/地点（伊夸之门、迷雾高塔、星之恐怖、修格斯等）同写，未发现异译；偏差集中在：

| 对象 | 现状 | 推荐 |
| --- | --- | --- |
| Monterey Jack | 08007「蒙特雷·杰克」 vs 08008「雷蒙特·杰克」 | 蒙特雷·杰克 |
| Wooden Sledge | 卡名 08615「木制雪撬」、records/剧情「木制雪橇」、规则书「木雪橇」；同卡内两行自相矛盾 | 木制雪橇 |
| 莱克营地 | records「莱克营地遗迹」 vs 卡面/剧情「莱克营地遗址」 | 莱克营地遗址 |
| 水晶洞穴 | records「水晶洞窟」 vs 卡面/剧情「水晶洞穴」 | 水晶洞穴 |
| Camp 记录标签 | 13 条「Camp - X (N)」英文前缀（H10） | X（庇护 N） |
| story 记录层伙伴名 | 9 位伙伴名 `status=missing`，值为英文（terms-0019，medium；但 `partnerNameMap` 当前无消费点，`PARTNERS` 常量提供中文名，实际 UI 影响低） | 补齐中文或删死字段 |

**（4）简繁与用字**：繁体/异体仅集中在「**著**」作「着」**661 处**（story 451 / guides 210；卡面 193 处全为「着」）；「明瞭」3 处误写（「瞭望」4 处为正确用法）；其余繁体/异体对 0 命中（卡面 333 字对照表 0 命中）。台港用词「计画/网路/想像」等 9 处在 guides 语料（guides-0006）。

**（5）标点/数字风格**：卡面沿用上游「全角句读 + 半角括号」（212 字段，不视为错误）；story/guides 混入英文式半角编号「引言 1:」「导言 2.」「进入 设置.」（129 处）与重复「。.」「：:」（138 处）；rules 用「」引号、story 用“”引号；`•` 与行首 `-` 分属剧情/卡面，属层内风格差异（glossary §五 给出统一口径）。

**（6）来源判定**：`[fast]→[free]`、木制雪撬、庇护N、著/着、`[shelterValue]`、`Camp -` 标签、`{'…}` 转义 = 上游/参考 locale 继承；`keywords.js` Retaliate/Tekeli-li/Titanic、`records.js` 两个营地名 = 本仓自写；rules 层议程/战役日志/Broken-Unbroken/泰坦坡道/无名狂魔/备件 = 规则书自写偏差（`web/eote-rules.js`）。

## 7. 漏翻 backlog（补译输入）

### 7.1 章节指南（8 章 469 段）

| 章 | total | present | untranslated | missing | 「中文待补」正文块 | 标题缺失 | 不渲染缺译键 | backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | 55 | 43 | 2 | 10 | 2 | 0 | 10 | 12 |
| iceAndDeathPart2 | 38 | 30 | 2 | 6 | 1 | 1 | 6 | 8 |
| iceAndDeathPart3 | 31 | 15 | 2 | 14 | 10 | 0（+1 `@:` 标题） | 5 | 16 |
| fatalMirage | 68 | 21 | 1 | 46 | 33 | 3 | 11 | 47 |
| toTheForbiddenPeaks | 51 | 30 | 1 | 20 | 12 | 0 | 9 | 21 |
| cityOfTheElderThings | 94 | 40 | 0 | 54 | 32 | 1 | 21 | 54 |
| theHeartOfMadnessPart1 | 79 | 59 | 0 | 20 | 14 | 3 | 3 | 20 |
| theHeartOfMadnessPart2 | 53 | 22 | 2 | 29 | 17 | 6 | 8 | 31 |
| **合计** | **469** | **260** | **10** | **199** | **121** | **14(+1)** | **73** | **209** |

### 7.2 战役共享段（base.json 258 键）

`chineseGaps` 69 条 = missing 68 + untranslated 1；其中 `label.*` 选项标签 42（14 条已被 flow 实际使用 → H4）、`specialRules` 10、幕间开场标题 3、`partnerNames.*` 9、`doNotRemoveAnymore` 3、`cookiesAdvice` 1、`checkpoint1.theDisappearance3.body` 1（untranslated）。

### 7.3 全量 backlog 文件

- [`guides/coverage.json`](guides/coverage.json)：**278 条**（章节 209 + 战役共享 69），每条含 `path`/`layer`/源 locale 文件+行/面板 JSON 指针+行/`status`/`render`/`en` 摘要，可直接作为翻译批次输入。
- [`story/coverage.json`](story/coverage.json)：209 条章节 gaps + 69 条 `localeKeys` gaps + 展示链证据（`displayChain`：intro/setup/resolutions 回退清单、flow 英文节点/选项、25 个记录标签回退键）。
- 卡面 backlog：**0**（4030/4030 已译）。

## 8. 错误符号/格式专项

| 子类 | 剧情（story-text） | 指南面板 | 代表位置 | 根因/建议 |
| --- | --- | --- | --- | --- |
| i18next 花括号残渣 `{'{'}x{'}'}` | **32 处 / 16 段**（去重 16 处） | **7 段**（terms 两侧去重共 23 处） | `web/scenario-guides/iceAndDeathPart2.json:44`；`story-text.js:2288/2489/3044` | EOTE 生成链未还原 `{'{'}…{'}'}`；建议复用 `import-scenario-guides#guideText` |
| 未注册方括号占位符 `[shelterValue]` | 2 段 | 2 段 | `web/scenario-guides/iceAndDeathPart1.json:187`、`iceAndDeathPart2.json:54` | `{shelterValue}` 被本地化为 `[shelterValue]` 后无渲染分支；建议按产品裁定替换为「庇护值」或动态插值 |
| 英文词条混入正文 | `Shelter Value:`/`Experience:`/`Resolution 3:`/`Intro 3:` | 同源 | `story-text.js:2065`、`web/scenario-guides/iceAndDeathPart1.json:187` | 参考 zh locale 半译；补译 |
| 重复标点 `。.` / `，,` / `：:` | **67 处 / 34 段** | **65 处 / 33 段**（terms 合计 138 处，含 `：:` 等） | `web/scenario-guides/iceAndDeathPart1.json:122/137`、`story-text.js:2290/2291` | 参考 locale 全角句号后又跟半角句点；批量清理 |
| 中文后接半角标点 | 句点 31 / 冒号 24 / 问号 11 / 逗号 6（story area 口径） | 句点 15 / 逗号 5 | 同上 | 统一为全角；上游继承 |
| markdown 下划线泄漏 | — | 7 段 `_附身_`/`_此外…_`/`_序言 2_` | `web/scenario-guides/iceAndDeathPart2.json:78` | 面板未解析 markdown；生成器清除或渲染层支持 |
| 引号不配对 | 20 段（长引语转写惯例，需裁定） | 9 段 | `guides/findings.json#guides-0008` | 人工裁定 |
| `…???…` 占位 | 8 段（`冒险???：致命幻景`） | 1（`fatalMirage.json:80` 标题） | `story-text.js:668`、`web/scenario-guides/fatalMirage.json:80` | **en 源本身即 `Scenario ???`（印刷留白）**，terms 已列为误报排除；是否保留由产品裁定 |
| 简繁/用字「著」 | **451 处**（story 层） | **210 处** | 全语料 | 批量「著→着」（排除著名/著作）；terms 去重口径合计 661 |
| `[fast]→[free]` 图标 | —（卡面）53 张卡 / 58 处 | — | `src/cards/cards-data.js:285465` 等 | 上游简中把「快速」图标写作 free token；渲染层「快速/免费触发」是两个标签（H9） |

> 说明：卡面 `[willpower]` 等图标 token 与 en 多重集**归一后 0 差异**（`[fast]→[free]` 单独计）；剧情/指南图标 token 与 en 多重集 0 差异。`{var}` 模板花括号在生成物中已基本本地化，仅余上述 `[shelterValue]` 与 `{'{'}…{'}'}` 残渣。

## 9. 与既有披露口径的关系

1. **数字一致**：`scenarios.md` §4/§7、`README.md` §15/§16、`p8-release.md` 记载的「260 present / 10 untranslated / 199 missing」「战役 68 段缺译」「缺译按 `chineseGaps` 显示中文待补、不用英文冒充」经本轮复算**逐项一致**，缺译 backlog 也一致。
2. **偏差在展示链**：P7 文档描述的「中文待补」只对**指南面板正文层**成立；故事日志 `story-reader`、章节 `SCENARIO_TEXT`、战役 `flow` 节点与记录标签**不消费 `chineseGaps`**，英文回退被直接渲染（H3/H4 + story-0003）。这属于「应标记而未标记」的新发现缺陷，不是缺译数量问题。
3. **统计口径提醒**：`chinese.total = 469` 包含 126 个面板不渲染的 skipped 键与 53 个 title 键；对玩家而言「面板可读中文单元」为 207/469（44.1%），「缺译 199 + 未译 10」中 73 个不在面板显示、15 个标题不可见。对外引用覆盖率时需注明口径（本报告 §4.2/§7 已分列）。
4. **与 eote-scan 的关系**：`eote-scan` 全量扫描是**实现/可玩性**审计（D1–D5），其 D1 只把卡面文本当规则事实源，不评估中文翻译质量；本目录是其未覆盖的翻译专项，二者互补、不重复。
5. **只读边界**：本轮未修改游戏内容、生成器或参考资源；所有修法建议仅登记在 findings `suggestion` 与本文 §10。

## 10. 修复建议与优先级

**P0 展示链缺陷（改动小、玩家可感知最强）**

1. `content/campaigns/edgeOfTheEarth/records.js#storyBody` 增加三态门限：缺译返回空，让模块中文兜底生效；`flow.js#localizeNodes` 只在 `present-needs-review` 时覆盖（修 H4）。
2. 故事日志/章节展示层按 `chineseGaps` 过滤英文回退并显示「中文待补」（修 H3）；`web/story-reader.js` 消费 `chineseGaps`。
3. `web/scenario-setup-view.js#renderBlocks` 为 title 缺译增加「中文待补」或占位标题（修 H7）。

**P1 生成器修复（重跑生成物即可，不动翻译）**

4. EOTE 生成链还原 `{'{'}x{'}'}` i18next 转义（修 H6）；展开 `@:` 跨节引用（修 H8）。
5. `{shelterValue}` 的呈现口径由产品裁定后实现（替换为「庇护值」文字或动态插值）。
6. 记录标签缺失时回退中文显示名而非 camelCase（story-0003）。

**P2 补译批次（278 条 backlog）**

7. 按章优先级补译：fatalMirage 47、cityOfTheElderThings 54、theHeartOfMadnessPart2 31、toTheForbiddenPeaks 21、iceAndDeathPart3 16、iceAndDeathPart1 12、iceAndDeathPart2 8、theHeartOfMadnessPart1 20；战役共享 69 条同步。
8. 补译后重跑 `node tools/import-eote-story.mjs --write`、`node tools/import-scenario-guides.mjs`，同步 `sources` 哈希与账本。

**P3 上游继承问题（卡面，建议本地补丁 + 上游反馈）**

9. 规则级：08586 伤害/恐惧、08022/08036/08050 职阶计数（H1/H2）。
10. 其他：08622 剧本手册、08037 地区勘测、08008 雷蒙特·杰克、08615 木制雪撬、08520 特性标记、`[fast]→[free]` 口径（H9）、FAQ 勘误注记（08596/08635）。

**P3b 本仓自写数据/规则书偏差（terms-0004～0012、0018、0021）**

11. `content/campaigns/edgeOfTheEarth/keywords.js`：Retaliate「报复」→「反击」；Tekeli-li 卡名去「！」；核查 `[[Titanic]]` trait「巨型」。
12. `web/eote-rules.js`：agenda「议程」→「密谋」（5 处）；campaign log「战役日志」→「剧本日志」（12 处）；Broken/Unbroken 与「运功/破功」统一；Titanic Ramp「泰坦坡道」→「巨大坡道」；The Nameless Madness「无名狂魔」→「无名疯狂」；Spare Parts「备件」→「备用零件」。
13. `content/campaigns/edgeOfTheEarth/records.js`：莱克营地遗迹→遗址、水晶洞窟→洞穴；`story-text` 记录层 9 位伙伴名缺失（无消费点，可补中文或清理字段）。

**P4 机械清理（reference locale/生成物）**

14. `。.`/半角标点/引号/markdown `_`/「著→着」批量清理；`No Resolution` 统一译法；Part2 标题「第I部分I」修正；`Camp - X (N)` 记录标签改「X（庇护 N）」（H10）。
15. 建议把 `coverage.json` 作为翻译进度账本（每次补译后更新并跑 `merge-findings.mjs`/area `--check`）。

## 11. 未覆盖与边界

1. **未做浏览器实机截图验证**：展示链结论来自代码读点与生成物数据（`web/story-reader.js`、`web/scenario-setup-view.js`、`flow.js`），如需发布级视觉证据，应在补译批次后跑真实大厅 1440/390 验收。
2. **语义级审计为抽样**：卡面 403 张规则文本逐卡精读（cards area）；剧情 260 段 present 只做机械候选 + 抽样人工确认（仅保留 en/zh 双证据的误译）；指南 260 段同理；术语已做 2335 条去重 doc 的全量矩阵但语义裁定以 glossary 推荐为准。可能存在未发现的语义偏差。
3. **需人工裁定项**：「著」是否统一为「着」、`???` 占位是否保留（terms 已确认 en 源即印刷留白）、引号不配对是否属长引语惯例、`[shelterValue]` 期望呈现、`[fast]→[free]` 是否本地修正、08706/08707「险境」多出（繁中亦有，无法仅凭数据判定英文缺漏还是简中多译）、卡面「庇护N」是否补「值」。
4. **上游继承问题**：卡面 32 条 findings 全部源于上游 `cards_zh-cn.json`，修复需上游 ArkhamDB 数据或本仓导入后打补丁；本轮未改数据。
5. **terms 已交付完整结论**：22 条 findings + [`glossary.md`](terms/glossary.md)/[`glossary.json`](terms/glossary.json)（规则术语 40 / 关键词 38 / 图标 / 专名）+ [`scan-report.json`](terms/scan-report.json)（823KB 全量扫描报告）；本报告 §6.4 为其摘要口径。terms 已明确排除 8 组机械误报（敌军阶段、损伤、技巧、胜利区、Hidden Tunnel、Level、Massive=庞大、`冒险???`），本报告不将其计为问题。
6. **en 侧未审计**：本轮只审中文侧；en 面板同样存在 `{'{'}…{'}'}` 残渣与 `@:` 段缺失（guides-0001/0003 顺带证明），如需 en 侧问题单独立项。

## 12. 产物清单、复现与验收

### 12.1 目录结构

```
docs/edgeOfTheEarth/translate/
  README.md              # 本报告
  _SPEC.md               # 共享审计规范（分类/严重度/schema）
  findings.json          # 合并版 findings（merge-findings.mjs 生成，含 location 校验结果）
  cards/                 # 403 卡面审计：findings.json / notes.md / _dump.md
  story/                 # 剧情正文审计：findings.json / notes.md / coverage.json（209+69 backlog）
  guides/                # 指南面板审计：findings.json / notes.md / coverage.json（278 backlog）
  terms/                 # 术语/简繁/专名：findings.json / notes.md / glossary.md / glossary.json / scan-report.json
  crosscheck/            # Lead 独立复核数据：summary/cards/story/guides/coverage/shipped.json
  tools/                 # 可复现脚本（见下）
```

### 12.2 复现命令（均在 `games/arkhamhorror` 下运行）

```bash
# Lead 独立交叉复核（写 crosscheck/*.json，打印摘要）
node docs/edgeOfTheEarth/translate/tools/lead-crosscheck.mjs

# 合并四个 area findings 并校验 location（写 translate/findings.json）
node docs/edgeOfTheEarth/translate/tools/merge-findings.mjs

# 各 area 复算
node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs            # 32 findings / 403 卡
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs            # 209 gaps / 69 localeKey gaps
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --check   # 逐字节校验 coverage/findings
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs            # 术语/用字摘要（22 findings 口径）
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --term=retaliate   # 单术语变体+样本
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --chars / --punct / --icons / --names / --keywords / --markers / --diff
```

### 12.3 本轮验收记录（2026-11-09）

| 检查 | 结果 |
| --- | --- |
| 合并版 `findings.json` | **82 条**（cards 32 / story 14 / guides 14 / terms 22；high 11 / medium 36 / low 35）；`invalidLocations` 0、`missingFields` 0、`duplicates` 0 |
| `cards-scan.mjs --write --dump` 复算 | 与交付 `findings.json`/`_dump.md` sha256 一致（cards-audit 自验 + Lead 拷贝校验） |
| `guides-scan.mjs --check` | `OK coverage.json / OK findings.json`，exit 0 |
| `story/coverage.json` | sha256 `cc79662b…ed93654`，与 staging 逐字节一致（Lead 拷贝校验） |
| `terms/scan-report.json` | 823,116 B（terms `--write` 全量报告，Lead 从 TEMP 归档） |
| `lead-crosscheck.mjs` | 卡面 403；章节 469/260/10/199；战役 localeKeys 258/189/68/1；flow 英文 1 节点；指南 469/199 missing；与 area 报告逐项一致 |
| 只读性 | 仅新增 `docs/edgeOfTheEarth/translate/**` 与 `docs/edgeOfTheEarth/README.md` §17 入口；未改任何游戏内容/实现/生成器 |

> 本报告由 Lead 汇总四个 area + 独立交叉复核生成；各 area 的方法与完整明细见对应 `notes.md` 与 `findings.json`。

## 13. 修复批次（2026-11-09，已完成）

> 本节记录审计交付后的修复批次；逐条状态、变更文件、验收命令与保留裁定见 [`fix-batch.md`](fix-batch.md)。

| 审计区 | findings | 已修 | 保留说明 | 修复记录 |
| --- | --- | --- | --- | --- |
| cards | 32 | 30 | 2（换行排版、08706/08707 险境） | [`cards/fix-report.md`](cards/fix-report.md) |
| story | 14 | 12 | 2（引号惯例、en 侧 ???） | [`story/fix-report.md`](story/fix-report.md) |
| guides | 14 | 12 | 2（引号惯例、列表合并） | [`guides/fix-report.md`](guides/fix-report.md) |
| terms | 22 | 21 | 1（卡面「庇护N」层级） | [`terms/fix-report.md`](terms/fix-report.md) |
| **合计** | **82** | **75** | **7** | [`fix-batch.md`](fix-batch.md) |

**修复后关键指标**：章节 469/469、战役 258/258、八章指南 `chineseGaps=0`、缺译 backlog 0、本地补译层 288 条 entry、EOTE Node 测试 364/364、生成物 `--check` 全绿（详见 `fix-batch.md` §6）。

**新增工具**（本目录 `tools/`）：

- `verify-fix-batch.mjs`：翻译修复批次验收探针（覆盖/残留/分段/记录标签，`ok: true` 才算通过）；
- `regen-eote-replay-baseline.mjs`：内容正文变更后重采 EOTE replay 基线。

**说明**：本目录 1–12 节的数量与清单是**修复前基线**，用于复盘审计方法与证据；修复后以 `fix-batch.md` 与 `verify-fix-batch.mjs` 为准。

