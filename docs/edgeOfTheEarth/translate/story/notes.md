# story area 审计说明（《地球边缘》剧情正文与战役模块中文）

> 审计员：story-audit；日期：2026-11-09；只读审计，未修改 `games/arkhamhorror/**` 任何既有文件。
> 产物：本目录 `findings.json`（14 条 finding）、`coverage.json`（全量缺译 backlog + 逐章/战役计数 + 展示链证据）、
> 复现脚本 `docs/edgeOfTheEarth/translate/tools/story-scan.mjs`。
> 规范：`docs/edgeOfTheEarth/translate/_SPEC.md`（分类/严重度/证据/schema 全部按 §2–§5）。

## ① 范围与输入

| 输入 | 规模 | 说明 |
| --- | --- | --- |
| `content/campaigns/edgeOfTheEarth/story-text.js` | 831,107 B / 5,678 行，sha256 `e474f514…e6008a2` | 生成物：`meta`（chinese 三态）+ `campaign`（序幕/检查点/幕间/尾声/特别规则/记录标签）+ `chapters`（8 章 469 段：`sections`=展示值（present 取 zh，其余回退 en）、`sectionsEn`=en 原文、`chineseGaps`、`status`、`intro/setup/resolutions` 扁平展示值）+ `interludes`/`epilogue` 派生视图 + `localeKeys`（258 条 `edgeOfTheEarth.*`）。 |
| 战役模块（非生成中文） | 10 个文件 | `prologue.js`、`checkpoints.js`、`interludes.js`、`epilogue.js`、`flow.js`、`records.js`、`keywords.js`、`parts.js`、`shared.js`、`shared-encounters.js`：玩家可见 label/title/prompt/日志行/记录名/关键词名。 |
| 展示链（只读） | — | `story-access.js`（`chapterSection` 只读 `sections`）、各章 `texts.js`/`definition.js`（`SCENARIO_TEXT.intro/setup/resolutions`）、`records.js#storyBody`（flow 节点正文）、`src/campaign/story.js#introduction`（故事日志开场）、`web/story-reader.js`（逐段直排）、`web/hub.js#records`（战役记录面板）。 |
| 对照 | — | 生成器 `tools/import-eote-story.mjs`（三态判定/display 回退/deterministic 校验）；`web/card-text.js` 图标 token 表；`src/cards/cards-data.js` 08513/08514/08615/08501 等 nameZh；参考 zh locale（经生成物间接核对，未直接改读）。 |

## ② 方法与命令

方法：node 直接运行 `story-scan.mjs`（ESM，无第三方依赖、不 spawn 子进程）——

1. 读 `story-text.js` 并 import 其 `EOTE_STORY_TEXT`：递归展开 `sections`/`sectionsEn`/`localeKeys`，逐叶核对
   `chineseGaps` 与 `meta.chinese.byChapter`（计数、状态、display 是否等于 en 回退、en 是否存在）；
2. 逐叶扫描中英混杂（生成器同款「3+ 连续英文小写单词」+ `present` 无 CJK + 拉丁残留）、错误符号
   （重复标点/半角标点/引号配对/ICU 转义/未注册 `[token]`/`{var}`/U+FFFD/空白/`•` 异常）、繁体与「著」、
   以及数字/否定/难度词/同父键同译等误译候选；
3. import `flow.js`、`records.js`、`keywords.js` 复算展示链：`flow` 33 个 textKey 节点的 en 回退是否覆盖模块中文兜底、
   `recordSchema` 81 键中有多少无中文标签回退 camelCase、关键词中文名清单；
4. 正则提取 10 个战役模块源码里的字符串字面量（跳过注释），过滤模板字面量后人工复核；
5. 所有 `location` 行号由脚本在源码中搜索 JSON 转义片段算出（章节按 `chapters.<id>` 区域、campaign 按 `localeKeys` 区域限定），
   抽样再用 node 读行复核，非编造。

关键命令（从 Mod 根 `games/arkhamhorror/` 运行）：

```bash
# 摘要（scope/consistency/展示链/文本问题计数）
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs

# 全量明细 JSON 到 stdout
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --json

# 写 coverage.json（正常环境写 docs/edgeOfTheEarth/translate/story/coverage.json；
# 受限沙箱进程无权写 games/arkhamhorror/** 时自动回退 workspace 根 .eote-story-staging/coverage.json 并打印路径）
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --write

# 额外写全量明细到 TEMP/eote-story-detail.json（供人工复核符号/繁体/误译候选清单）
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --write --detail
```

## ③ 结论统计

### 3.1 覆盖（复算与既有披露一致）

- 章节：8 章 469 段 = present-needs-review **260** + untranslated **10** + missing **199**；
  `chineseGaps` 叶数与「untranslated+missing」逐章相等，display 回退 en 的 209 叶全部 `sections===sectionsEn`。
- 战役 base：`localeKeys` 258 条 = present **189** + missing **68** + untranslated **1**
  （`checkpoint1.theDisappearance3.body`），共 **69** 条缺译。任务预期的「68 段」= missing 68 已核对一致；
  多出的 1 条是 untranslated（英文正文已存在但无中文）。
- 缺译按 `chineseGaps` 是既有披露口径，全部列为补译 backlog 写入 `coverage.json`，**不逐条计为 finding**。

逐章（total / present / untranslated / missing；回退层 intro/setup/res/其它）：

| 章节 | total | present | untrans | missing | 回退层分布 |
| --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | 55 | 43 | 2 | 10 | intro 1 / setup 2 / other 9 |
| iceAndDeathPart2 | 38 | 30 | 2 | 6 | intro 1 / setup 1 / res 2 / other 4 |
| iceAndDeathPart3 | 31 | 15 | 2 | 14 | intro 1 / setup 9 / other 6 |
| fatalMirage | 68 | 21 | 1 | 46 | intro 1 / setup 19 / res 14 / specialRules 2 / other 11 |
| toTheForbiddenPeaks | 51 | 30 | 1 | 20 | intro 1 / setup 10 / res 1 / other 9 |
| cityOfTheElderThings | 94 | 40 | 0 | 54 | intro 1 / setup 31 / res 1 / specialRules 2 / other 19 |
| theHeartOfMadnessPart1 | 79 | 59 | 0 | 20 | intro 1 / setup 11 / specialRules 6 / other 2 |
| theHeartOfMadnessPart2 | 53 | 22 | 2 | 29 | intro 1 / setup 13 / res 4 / specialRules 6 / other 7 |
| **合计** | **469** | **260** | **10** | **199** | intro 8 / setup 96 / res 22 / specialRules 16 / other 67 |

战役 69 条缺口构成：`label.*` 选项标签 42（其中 14 条被 flow 模块使用→见 high 第 2 条）、`specialRules` 5 组
title+body 10、幕间开场标题 3（Restful Night/Endless Night/Final Night）、`partnerNames.*` 9、
`interlude*.label.doNotRemoveAnymore` 3、`interlude3.xp.cookiesAdvice` 1、untranslated 的 checkpoint1 正文 1。

### 3.2 findings（详见 `findings.json`，14 条）

| 分类 | 数量 | 严重度 |
| --- | --- | --- |
| mixed-language | 5 | high 2 / medium 2 / low 1 |
| symbol-format | 5 | medium 3 / low 2 |
| mistranslation | 1 | high 1 |
| terminology | 3 | medium 1 / low 2 |
| missing-translation / marker-leak | 0 | —（缺译清单走 backlog；「英文直接进中文段」计入 mixed-language） |
| **合计** | **14** | **high 3 / medium 6 / low 5** |

文本问题机器计数（`present-needs-review` 中文叶，出现次数；括号为字段数）：
`。.` 67(34)、CJK 后半角句号 31(24)、半角冒号 24(24)、半角问号 11(11)、半角逗号 6(6)、半角感叹号 2(2)、
标点前空格 3(3)、引号内侧空格 3(3)、引号不配对 20(20)、ICU 转义 `{'{'}…{'}'}` 32(16)、未注册 `[shelterValue]` 2(2)、
英文小标题前缀 2(2)、`Camp -` 记录标签 13(13)、「??? 占位」8(8)、「著」451 次/168 路径。
图标 token 与 en 多重集：**0 不一致**；`{var}` 模板残留：0（生成器已 localize，除 `[shelterValue]` 未注册 token）。

### 3.3 展示链复核（high 条目的依据）

- `story-access.js#chapterSection` 只读 `chapters[id].sections`（display 值，非 present = en 回退）；章节 `texts.js`/`definition.js`
  用它拼 `SCENARIO_TEXT.intro/setup/resolutions`，`src/campaign/story.js#introduction` 再把 `sc.intro` 写进故事日志；
  `web/story-reader.js` 逐段直排，**没有** `chineseGaps`/「中文待补」判断。
- `theHeartOfMadnessPart2/texts.js:2` 注释声称「展示层回退 sectionsEn 并标注中文待补」，但该文件导出的 `chineseGaps`
  在全仓无消费点（grep 仅此一处定义为导出），注释与实现不符。
- 战役 flow：`records.js#storyBody`（:85–86）读 `localeKeys[...].body`（非 present 时= en）→ `flow.js#localizeNodes`（:106）
  `if (body) node.text = body` 覆盖模块内中文兜底；选项 label 在模块构建期就已被同一个 `storyBody` 覆盖。
- 记录标签：`flow.js:128` 把 `recordLabels()`（无中文标签时= 原始键名，records.js:292）并入 manifest → clientData →
  `web/hub.js#records`（:1485 `recordLabels?.[key] || key`）与 `web/story-reader.js:32`（日志「调查结果」）直接展示。
- 「关卡设置」面板主路径由 `web/scenario-guides/*.json` 的 `locales.zh` + `chineseGaps` 渲染（有「中文待补」标记，属 guides 区）；
  story-text 的 setup/intro 只在 guide 加载失败的回退分支（`web/scenario-setup-view.js:93-99`）可见 —— 跨区问题已在 findings 注明。

## ④ high 问题逐条

1. **story-0001（mixed-language / high）章节缺译叶子以英文回退拼进故事日志开场/设置/结局，无「中文待补」标记。**
   8 章共 126 个 intro/setup/resolutions 叶子回退 en：intro 8（各章 heading `Scenario I/II/III/IV`、fatalMirage `Scenario ???`）、
   setup 96（cityOfTheElderThings setup v1–v3 三套全英文、各章 gatherSets 等）、resolution 22（toTheForbiddenPeaks
   resolution1 正文全英文、theHeartOfMadnessPart2 noResolution.title=`No Resolution` 等）。定位样例：
   `content/campaigns/edgeOfTheEarth/story-text.js:1990`（heading Scenario I）、`:3353`（city setup.v1.gatherSets）、
   `:3035`（peaks resolution1.body）、`:4131`（H2 noResolution.title）。根因：`tools/import-eote-story.mjs:124` display 回退 en +
   `story-access.js:44` 直读 `sections` + `definition.js:141` 拼 `SCENARIO_TEXT.intro`；故事日志 `web/story-reader.js` 无 marker。
   建议：`sections` 只存中文（非 present 空串），展示层按 `chineseGaps` 过滤并显示「中文待补」；缺译补 backlog。
2. **story-0002（mixed-language / high）战役 flow 选项/节点显示英文并覆盖模块中文兜底。**
   14 个选项 label（prologue 2、checkpoint2 2、幕间门 10）+ 1 个节点正文（checkpoint1SearchStory）在中文 UI 显示英文，
   而模块里始终写着中文兜底。证据：`interludes.js:131` 显示 `Open the door and venture into the mirage.`（兜底「打开门，进入幻景。」）；
   `prologue.js:58`、`checkpoints.js:87/119`、`interludes.js:191/261` 同理；`flow.js:106` 覆盖。修复：`storyBody` 加
   `status==='present-needs-review'` 门限，让兜底生效。
3. **story-0008（mistranslation / high）iceAndDeathPart1 难度条件误译。**
   `setup.expert`（story-text.js:2026）en `Expert difficulty / add 2 doom` 被译成「如果你在游玩困难等级，则在密谋1a上放置2个毁灭标记」，
   与 `setup.hard`（:2025，1 doom）完全同一「困难等级」，会误导难度设置；同章 `setup.winifredNotPresent`（:2015）en
   `Otherwise, skip to Intro 3.` 译成「否则进入 导言 3.」，丢掉「跳过」，与 winifredPresent 分支不可区分。

## ⑤ 与既有披露口径的关系

- scenarios.md §4/§7、README §15.3/§16.4、p8-release.md 均写「中文缺译按 `chineseGaps` 显式标记，运行时显示「中文待补」，
  不以英文冒充中文」。本轮复算 **260 / 10 / 199**、战役 68 missing + 1 untranslated 与之完全一致；
  **偏差在于展示链**：story-text 消费端（故事日志 intro、SCENARIO_TEXT.setup/resolutions、flow 节点、记录标签）没有消费
  `chineseGaps`，英文回退值被直接当正文渲染（story-0001/0002/0003），属「应标记而未标记」的新增问题，而非缺译数量问题。
- 参考 zh locale 的线索沿用 `officialChinese:false` 口径：本报告中的标点/ICU 转义/「著」/英文条目名，标注
  `source: reference-locale`（上游继承问题）；模块内兜底/常量/流程文字标 `repo-authored`；生成器转换（display 回退、
  `{var}`→`[var]`）标 `generated`。修复顺序建议：先补 backlog（coverage.json）→ 再统一修 reference-locale 的机械问题 → 最后改展示层。
- 与 Lead 的 `translate/crosscheck/summary.json` 对照：章节 gaps 209、localeKey gaps 69、flowEnglishNodes 1 一致；
  「著」章节 211 + 战役 240 = 451 与本报告一致（脚本逐叶出现次数口径）。crosscheck 的 campaignGaps 64 是按分组 entries
  口径，本报告 69 是 localeKeys 叶子口径，两者不冲突，notes 已说明。

## ⑥ 未覆盖 / 存疑

1. **未逐句审校翻译质量**：469 段只做机械候选 + 抽样人工确认；数字/否定候选（30/38 条）多为噪声
   （en `forty pounds`→zh「40磅」、`one additional use`→「额外1使用」属正常；否定候选多因中文「否/未/别」字面命中）。
   结论只保留 hard/expert 与 skip to 两处有 en/zh 双证据的误译。
2. **20 段引号不配对（story-0013）**：可能是英文多段长引语「每段开引号、末段收引号」的转写惯例，已给 low 并注明需人工裁定。
3. **`冒险???：致命幻景`（story-0014）**：en 源本身即 `Scenario ???`，不是翻译新增；是否保留占位需产品裁定。
4. **未验证浏览器实机渲染**：本会话无法启动浏览器，展示链结论来自代码读点 + `tests/eote-story.test.mjs` 契约
   （测试只断言 `storyText/intro` 非空，不检查 marker），无截图证据；如需发布级证据请跑 P8 浏览器验收。
5. **guides 同源风险（crossArea）**：`web/scenario-guides/*.json` 的 `locales.zh` 与 story-text 同源（同一参考 zh locale），
   标点/英文条目名/`[shelterValue]` 等同型问题也可能出现在指南面板；按 area 边界只在此提示，不写 guides 文件。
   `guides-audit` 若发现同根因可并到本报告 story-0004/0005/0006。
6. **跨区术语**：`keywords.js` 的 level「高度等级」、records 常量「水晶洞窟/莱克营地遗迹/木制雪橇」与卡面不一致（story-0011），
   交 terms-audit/cards-audit 合并；`[frost]`/寒霜标记译名口径亦建议 terms 统一。
7. **生成物不可手改**：所有修复须改参考 zh locale 后重跑 `node tools/import-eote-story.mjs --write` 并 `--check`；
   本轮只读，未触碰生成器/内容文件。
8. **写盘环境**：本会话 node/pwsh 进程对 `games/arkhamhorror/**` 为 EPERM（write 工具正常），故 `--write` 自动回退
   `G:\boardgame-hall-ai\.eote-story-staging\coverage.json`；交付时由 Lead 用宿主 shell 拷到
   `docs/edgeOfTheEarth/translate/story/coverage.json`（内容与 `--write` 目标逐字节一致，脚本行为已写注释）。

## ⑦ 复现命令与产物清单

```bash
cd games/arkhamhorror

# 1) 摘要：应输出 chapterGaps 209（199 missing/10 untranslated）、campaign localeKeys 258（68 missing/1 untranslated）、
#    displayChain intro 8 / setup 96 / res 22 / flowLeaks 1 / flowEnglish optionLabel 14 / recordLabelFallbacks 25
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs

# 2) 全量明细（stdout，可与 findings.json 的 count/samples 对照）
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --json

# 3) 写 coverage.json（受限沙箱回退 staging，stdout 会打印实际路径）
node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --write

# 4) 生成器确定性（只读校验，非本报告必需）
node tools/import-eote-story.mjs --check
```

产物：

- `docs/edgeOfTheEarth/translate/story/findings.json` — 14 条（high 3 / medium 6 / low 5），schema 按 _SPEC §5。
- `docs/edgeOfTheEarth/translate/story/notes.md` — 本文件。
- `docs/edgeOfTheEarth/translate/story/coverage.json` — 逐章 `gaps`（missing/untranslated 的 `[path,line]` 全量，
  章节 209 + 战役 69）、逐章计数、`displayChain`（intro/setup/resolutions 回退清单、
  flow 英文节点/选项、记录标签回退键）、`expectedMatches`（469/199/10/68/1 全 true）、`textIssues` 机器计数。
- `docs/edgeOfTheEarth/translate/tools/story-scan.mjs` — 无依赖、不 spawn 子进程、可从 Mod 根复跑；`--detail` 时把
  全量符号/繁体/误译候选写 `%TEMP%/eote-story-detail.json`。
