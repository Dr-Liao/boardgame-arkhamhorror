# 《地球边缘》翻译修复批次记录（2026-11-09）

> 对应审计：[`README.md`](README.md)（82 条 findings，修复前基线）、[`findings.json`](findings.json)。
> 本批次目标：**把审计发现的问题全部修掉，并修复剧情/指南正文的分段问题**；参考资源 `参考资源/ArkhamHorror-main` 保持只读，所有中文修正落在本仓的**本地补充层**。
> 结论：**75 条已修复、7 条保留并给出裁定说明**；章节正文 469/469、战役 locale 键 258/258、八章指南 `chineseGaps` 全空，EOTE 364 项 Node 测试全绿。

## 1. 结果总览

| 指标 | 修复前（审计快照） | 修复后 |
| --- | --- | --- |
| 章节正文 | 469 段 = 260 present / 10 untranslated / 199 missing | **469/469 present，missing/untranslated = 0** |
| 战役 `base.json` | 258 键 = 189 present / 1 untranslated / 68 missing | **258/258 present** |
| 八章指南面板 | `chineseGaps` 207 段；14 个标题静默消失 | **`chineseGaps` = 0，无缺译 marker，343 段中文正文** |
| 补译 backlog | 278 条（章节 209 + 战役 69） | **0**（本地补译 288 条 entry 落地） |
| 展示链英文回退 | 126 叶英文回退 + 14 flow 选项英文 | **0**（含 `storyBody` 三态门限、`@:` 展开） |
| 问题条目 | 82 条（high 11 / medium 36 / low 35） | **75 修 + 7 保留说明** |

修复后的现状可用一条命令复算：

```bash
cd games/arkhamhorror
node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs
# { ok: true, summary: { chapters: '469/469', localeKeys: '258/258',
#   guides: '8 files, zh texts 343, multi-paragraph 128', recordLabels: '81/81' }, problems: [] }
```

## 2. 修复机制（为什么能修参考资源里的问题）

参考 locale 只读，因此新增**本地补译/修正层**：`content/campaigns/edgeOfTheEarth/locale-supplement/`。

- `chapters-a.json`（31 条）、`chapters-b.json`（68 条）、`chapters-c.json`（97 条）、`campaign.json`（92 条），共 **288 条 entry**，结构 `{ file, path, guide, en, zh, status, currentZh, fixNote }`；
- `tools/import-eote-story.mjs` 生成时先读本地补充层，再回退参考 zh locale（`supplementZhFor` / `resolveLocaleRef`）；`meta.zhSupplement` 诚实记录补充层路径与条目数，`sourceKind = reference-project-zh-locale+local-supplement`；
- 生成器同时内置确定性清理 `normalizeZhText()`（转义残渣、半角/重复标点、繁体「著」、「。..」、英文式编号、罗马数字、台港用词、半角括号、`牌组→牌库`、`没有结局→未达成结局` 等），因此**参考层历史遗留问题不靠人工重录**；
- 战棋卡面不能靠生成器覆盖：卡面修正在 `content/campaigns/edgeOfTheEarth/card-text-fixes.js`，由 `tools/import-cards.mjs` 在 `mergeCatalog` 中调用后重新生成 `src/cards/cards-data.js`；
- 规则书/剧情模块的少量硬编码文案（营地/伙伴名、MIA/XP、记录标签）直接改本仓模块（`records.js` / `checkpoints.js` / `interludes.js` / `web/eote-rules.js`），并在 `terms/fix-report.md` 记录。

### 2.1 分段修复（剧情文本）

| 位置 | 修复 |
| --- | --- |
| `tools/import-eote-story.mjs` | `joinDisplay` / `buildResolutions` / `buildGroup` / `buildCampaign` 统一用 `\n\n` 拼接段落；章节 intro 由 `paragraphsOf(...)` 输出多段 |
| `content/campaigns/edgeOfTheEarth/story-access.js` | `flattenStory` / `flattenResolution` / `resolutionText` 用 `\n\n` 分隔 title/body，段落读取 `storyParagraphs` 稳定拆分 |
| `src/campaign/story.js` | 新增 `splitParagraphs` + `eoteIntroduction`：章节开场按叙事键（`intro*` / `setup` / `flavorText` / `prologue*`）分段渲染，去掉重复标题；`resolutionStory` 与 flow 节点正文也按段拆分 |
| `tools/import-scenario-guides.mjs` + EOTE 指南 | 段落/列表保留空行；结局正文去掉重复的「结局 N：」标题前缀；指南面板 343 段中文正文中 128 段为多段 |
| 验收 | 章节 `intro` 可拆出 39 段；`flattenStory({title,body}) === '标题\n\n正文'`；指南多段正文 > 0 |

## 3. 按审计 area 的修复清单

### 3.1 cards（32 条 → 30 修 + 2 保留）

| finding | 处理 |
| --- | --- |
| cards-0001 `[fast]` 被系统性写成 `[free]`（53 个字段、58 token） | **已修**：`card-text-fixes.js` 在 en 含 `[fast]` 时把 zh `[free]` 改为 `[fast]`（53 张卡） |
| cards-0002 `[[Objective]]` → `[[目标]]` | **已修**：08520 恢复方括号标记 |
| cards-0004 多余半角空格 / cards-0005 句末标点冗余 / cards-0006 `-1[icon]` 空格 / cards-0008 关键词行漏空格 / cards-0009 行末缺标点 / cards-0010 `简单/ 普通` / cards-0012 FAQ 注记 | **已修**：`normalizeZhPunctuation` / `ensureLineTerminals` / 规则表逐卡处理 |
| cards-0007 `[frost]` 后漏「标记」 | **已修**：`[frost]` → `[frost]标记`（图标 token 不变） |
| cards-0011 数字体例 | **已修**：12 张卡的「一张/两次」统一为 `1张/2次` |
| cards-0013 `受到2点伤害`（应恐惧） | **已修**：08586 → `受到2点恐惧` |
| cards-0014 按职阶计数 | **已修**：08022/08036/08050 → 「每有一个不同的职阶」 |
| cards-0015 Campaign Log → 剧本手册 | **已修**：08622 → 剧本日志 |
| cards-0016 承受者→持有者 / cards-0017 强制加「可以」 / cards-0018「经」→「将」 / cards-0019 漏「你」 | **已修**：08671 / 08650–08653 / 08112 / 08596 |
| cards-0021 地区探测→地区勘测 | **已修**：08037 |
| cards-0022 雷蒙特·杰克→蒙特雷·杰克 | **已修**：08008 |
| cards-0023 shroud 隐藏值不统一 | **已修**：14 张卡统一「隐藏值」 |
| cards-0024 牌库/牌组 Limit 1 / cards-0025 毁灭标记/印记 / cards-0026 忽略/忽视 / cards-0027 标准/基础伤害 / cards-0028 战斗值→攻击值 / cards-0029 战役→剧本 / cards-0030 雪撬→雪橇 / cards-0031 复盖→覆盖 / cards-0032 引文署名 | **已修**：按规则表统一（08114/08115/08549/08621/08648/08076/08048/08127/08673/08509/08615/08605/08047 等；80 处引文统一 `H. P. 洛夫克拉夫特《…》`） |
| cards-0003 换行/分段与 en 不一致 | **保留**（内容一致，纯排版差异；逐卡手工重排风险大于收益，见 §5.1） |
| cards-0020 08706/08707 多出「险境」 | **保留**（简中「险境」正确，en 卡面缺 Peril 关键词，需上游修数据，见 §5.2） |

完整逐条状态见 [`cards/fix-report.md`](cards/fix-report.md)。

### 3.2 story（14 条 → 12 修 + 2 保留）

| finding | 处理 |
| --- | --- |
| story-0001 缺译英文回退拼进 intro/setup/resolutions | **已修**：补译后 `chineseGaps` 全空；`records.js#presentEntry` 只取 present 条目，`storyBody/flow` 不再回退英文 |
| story-0002 flow 选项/节点英文覆盖中文兜底 | **已修**：补译 + `presentEntry` 门限后 flow 0 英文节点/选项 |
| story-0003 记录标签 `Camp - …` / 25 键 camelCase | **已修**：补译 13 个 Camp 标签为「X（庇护 N）」；`records.js#recordLabelMap` 补 24 个 schema 键 + 9 名伙伴结果标签，`recordSchema` 81/81 有中文 |
| story-0004 Resolution/Intro/Shelter Value/Experience 英文前缀 | **已修**：补译 + 生成器标签本地化 |
| story-0005 半角/重复标点 67 处 | **已修**：`normalizeZhText` 统一（含 `。.`、半角标点、标点前空格） |
| story-0006/0007 `{'{'}frost{'}'}` 32 处、`[shelterValue]` | **已修**：生成器还原为 `[frost]` / 「营地庇护值」；en 侧同源转义也做还原 |
| story-0008 难度「困难等级」误译、skip 丢「跳过」 | **已修**：part1 expert → 「专家等级 / 2 个毁灭」；winifredNotPresent → 「跳到导言 3」 |
| story-0009 繁体「著」451 处 | **已修**：`著→着`（保留著名/著作/著称等），现状 0 |
| story-0010 intro 标题体例 | **已修**：统一「冒险 I/II/III」「亡命冰原 第II部分」 |
| story-0011 关键词/记录译名与卡面不一致 | **已修**：`keywords.js` 报复→反击、忒咳哩-哩、巨型→巨大、高度等级→高度；records 营地/伙伴/水晶洞穴 |
| story-0012 MIA/XP 英文缩写 | **已修**：检查点日志 `MIA→失踪`、幕间奖励 `XP→经验值` |
| story-0013 引号不配对 20 段 | **保留**（多段长引语惯例，见 §5.3） |
| story-0014 参考源 `Scenario ???` | **保留于 en 侧**（en 原文即 `Scenario ???`；zh 展示已清理为「冒险：致命幻景」） |

### 3.3 guides（14 条 → 12 修 + 2 保留）

| finding | 处理 |
| --- | --- |
| guides-0001 `{'{'}frost{'}'}` 7 处 | **已修**：同 story-0006 |
| guides-0002 14 个缺译标题静默消失 | **已修**：全部标题有中文；guide 层 `chineseGaps=0`，不再丢分组 |
| guides-0003 Part3 `@:` 引用假性缺译 | **已修**：生成器 `resolveLocaleRef` 展开 `@:edgeOfTheEarth.…`（zh 优先本地补充层） |
| guides-0004 半译英文标签 | **已修**：补译 + 标签本地化 |
| guides-0005 `[shelterValue]` | **已修**：→「营地庇护值」 |
| guides-0006 简繁/台港词（计画/网路/想像 9 处） | **已修**：`著→着` + 台港词归一，现状 0 |
| guides-0007 `。.` 65 处 | **已修** |
| guides-0009 markdown `_…_` | **已修**：生成器剥离，现状 0 |
| guides-0010 半/全角标点 27 处 | **已修**：标点归一 + 中文语境内半角括号转全角 |
| guides-0011 `第I部分I` | **已修**：`第I部分I→第II部分` |
| guides-0012 No Resolution 两种译法 | **已修**：统一「未达成结局」 |
| guides-0013 漏字「拥有额 1使用」 | **已修**：补译为「拥有额外 1 次使用」/重译覆盖 |
| guides-0008 引号不配对 9 段 | **保留**（同 story-0013） |
| guides-0014 列表项/段落数与 en 3 处差异 | **保留**（纯文本 `•` 展示合并，信息未丢失，见 §5.4） |

### 3.4 terms（22 条 → 21 修 + 1 保留）

`terms/fix-report.md` 记录逐条状态；要点：

- `[fast]`/`[free]`、`{'{'}frost{'}'}`、`Camp - X (N)`、记录 25 键 → 同 cards/story 修复；
- `keywords.js`：Retaliate 报复→**反击**、Tekeli-li **忒咳哩-哩！**（卡名带感叹号）、titanic 巨型→**巨大**、level 高度等级→**高度**；
- `web/eote-rules.js`：战役日志→**剧本日志**、议程→**密谋**、泰坦坡道→**巨大坡道**、巨型→**巨大**、无名狂魔→**无名疯狂**、备件→**备用零件**、Broken/Unbroken → **破功/运功**（英文别名保留）；
- 剧情/指南：牌组→**牌库**（154 处）、没有结局→**未达成结局**、明瞭→**明了**、台港词、半角括号统一；
- 营地名/伙伴名/物资名与卡面对齐（`莱克营地遗址`、`水晶洞穴`、`木制雪橇`、9 位伙伴名全部补齐）；
- terms-0018 卡面「庇护N」（无「值」）**保留**：上游印刷格式，剧情/规则统一用「庇护值」，属层级差异。

## 4. 变更文件清单（本批次）

| 类别 | 文件 |
| --- | --- |
| 本地补译层（新增） | `content/campaigns/edgeOfTheEarth/locale-supplement/{README,chapters-a,chapters-b,chapters-c,campaign}.json` |
| 生成器 | `tools/import-eote-story.mjs`、`tools/import-scenario-guides.mjs`、`tools/import-cards.mjs` |
| 生成物（重跑，不手改） | `content/campaigns/edgeOfTheEarth/story-text.js`、`web/scenario-guides/{8 章}.json`、`src/cards/cards-data.js`、`audit/catalog-report.json` |
| 运行时/内容模块 | `content/campaigns/edgeOfTheEarth/{story-access,records,keywords,card-text-fixes}.js`、`content/campaigns/edgeOfTheEarth/checkpoints.js`、`content/campaigns/edgeOfTheEarth/interludes.js`、`src/campaign/story.js`、`web/eote-rules.js` |
| 测试 | `tests/eote-story.test.mjs`、`tests/eote-scenario-theHeartOfMadnessPart1.test.mjs`、`tests/eote-scenario-theHeartOfMadnessPart2.test.mjs`、`tests/fixtures/replay/eote-p8-baseline.json` |
| 账本/基线（重签） | `audit/eote-scope.json`、`audit/eote-mechanisms.json`、`audit/eote-scenario-acceptance.json`、`audit/eote-rules.json`、`audit/eote-investigators.json`、`audit/eote-primitive-plan.json`、`tests/fixtures/replay/eote-p8-baseline.json` |
| 文档 | 本文件 + 各 area `fix-report.md`、[`README.md`](README.md)、`docs/edgeOfTheEarth/README.md`、`docs/edgeOfTheEarth/scenarios.md`、`docs/edgeOfTheEarth/p8-release.md`、`docs/edgeOfTheEarth/full-scan.md` |

> 说明：`audit/eote-release-acceptance.json`、`audit/eote-all-card-acceptance.json`、`audit/eote-migration.json` 是 P8 **行为验收**账本，不属于翻译批次；本工作区这三份账本在本次会话前已处于 pending/降级状态（工具已按 P0-11 收紧证据口径，旧账本口径不一致），重签需要独立的行为验收修复批次。翻译侧只重签了受内容变更影响的 scope/mechanisms/scenarios/rules/investigators/primitives 与 replay 基线，这些 `--check` 全部 exit 0。

## 5. 保留项与裁定说明（7 条）

### 5.1 cards-0003 规则文本换行/分段与 en 不一致

卡面中文文本按上游简中排版（`\n` 位置不同），**内容与规则逐句一致**；逐卡重排会与上游 diff 巨大且无规则收益，保留并在 `cards/fix-report.md` 记录。

### 5.2 cards-0020 08706/08707 多出「险境」（Peril）

简中卡面「险境」是**正确**的（繁中《禍害》、规则关键词 Peril），是 en 数据缺 `Peril` 关键词/图标；按「参考资源只读」约束不在本仓删正确中文，记录为上游数据问题。

### 5.3 story-0013 / guides-0008 引号不配对

多段长引语使用「上一段开引号、下一段收引号」的排版惯例（中文出版常见）；机械配对会造成跨段引语错乱，保留并说明。现状 51 段左引号多于右引号。

### 5.4 guides-0014 列表项/段落数与 en 3 处差异

生成器把 `<ul><li>` 转成纯文本 `• ` 行，个别 `en` 的空 `<li>`/嵌套列表在文本层合并；**信息未丢失**，属展示层格式差异，保留并在 `guides/fix-report.md` 记录。

### 5.5 story-0014 `Scenario ???`（en 侧）

`fatalMirage` 的 en 原文是 `Scenario ???: Fatal Mirage`（参考源即如此），en 面板保留原貌；zh 展示已清理为「冒险：致命幻景」。

### 5.6 terms-0018 卡面「庇护N」

卡面按上游印刷格式「庇护7」；剧情/规则书统一「庇护值」。两者是**卡面 vs 规则文本**的层级差异，不强行统一。

### 5.7 cards-0003/cards-0020 之外的卡面 low 项

cards-0003、0020 外的 30 条全部修复（见 §3.1）；无其他保留。

## 6. 验收命令与结果（2026-11-09）

```bash
cd games/arkhamhorror

# ① 生成物确定性
node tools/import-eote-story.mjs --check          # exit 0
node tools/import-scenario-guides.mjs             # exit 0，62 scenarios verified
node tools/import-cards.mjs --check               # exit 0

# ② 翻译批次专用探针
node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs
# ok=true；章节 469/469；localeKeys 258/258；指南 8 文件 / 343 段中文 / 128 段多段；记录标签 81/81

# ③ 账本复算
node tools/scan-eote-scope.mjs --check            # exit 0
node tools/scan-eote-mechanisms.mjs --check       # exit 0
node tools/audit-eote-scenarios.mjs --check       # exit 0（8/8 verified，469 段，264/266 战役卡）
node tools/audit-eote-rules.mjs --check           # exit 0
node tools/audit-eote-investigators.mjs --check   # exit 0
node tools/audit-eote-primitives.mjs --check      # exit 0
node tools/scan-eote-baseline.mjs --check         # exit 0

# ④ EOTE Node 测试（364 项）
node --test tests/eote-*.test.mjs tests/replay-eote-p8.test.mjs   # 364 pass / 0 fail
```

| 检查 | 结果 |
| --- | --- |
| `import-eote-story --check` / `import-scenario-guides` / `import-cards --check` | 全部 exit 0 |
| `verify-fix-batch.mjs` | `ok: true`，`problems: []` |
| EOTE Node 测试（28 个文件，含八章/剧情/流程/P8/replay/migration） | **364/364 pass** |
| `audit/eote-scenario-acceptance.json` | 8/8 章 verified，指南 469 段，战役卡 264/266，测试 146，浏览器 18（沿用既有浏览器账本） |
| replay | 内容正文变化导致状态指纹变化，已用 `docs/edgeOfTheEarth/translate/tools/regen-eote-replay-baseline.mjs` 重采基线；`replay-eote-p8` 2/2 pass |
| 测试更新 | `eote-story.test.mjs` 改为「全量已译」不变量；两处章节测试的英文断言改为中文断言；未放宽其他断言 |

## 7. 已知边界

- 参考资源 `参考资源/ArkhamHorror-main/**` **未改**；en 语言面板仍按参考 en 源显示，仅做同源转义还原（`{'{'}x{'}'}`）。
- 本批次是**中文内容/展示层修复**，不改行为规则；EOTE 行为验收账本（release/all-cards/migration）不在本批范围（见 §4 说明）。
- 引号配对、`???`（en 侧）、卡面「庇护N」等 7 条保留项属**风格/上游数据/层级差异**，已在 §5 记录，不做机械修改。
