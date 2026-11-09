# 翻译审计扫描工具（docs/translate/tools）

只读扫描器 + 人工裁定合并器。**不改游戏内容**，只写 `docs/translate/{findings.json,scan/*.json}`。
架构与分类口径见 [`../_SPEC.md`](../_SPEC.md)；报告见 [`../README.md`](../README.md)。

## 运行

在 `games/arkhamhorror/` 下：

```sh
node docs/translate/tools/scan-story.mjs --write   # 剧情文本 → scan/story-{coverage,candidates}.json
node docs/translate/tools/scan-guides.mjs --write  # 冒险指南 → scan/guides-{coverage,candidates}.json
node docs/translate/tools/scan-setup.mjs --write   # 关卡设置 → scan/setup-{coverage,candidates}.json
node docs/translate/tools/build-findings.mjs --write  # 人工裁定表 → findings.json
```

不带 `--write` 时打印摘要；`--json` 打印全量（调试用）。
四个脚本都只依赖 Node 内置模块，不 spawn 子进程，可重复运行。

## 各文件职责

| 文件 | 职责 |
| --- | --- |
| `_shared.mjs` | 提取与检测共用：JS 字符串字面量扫描（带真实行号）、结构化数据展平、指南 blocks 树、中文语言/图标/占位/标点/简繁检测、英文残留判定。 |
| `scan-story.mjs` | 收集 8 战役的 story-text 生成物、TCU 逐关 story-text、campaign flow 投影文本、叙事模块内联字面量、`src/campaign/story.js` 内联文本；检测未译/混排/图标/ICU/Markdown/分段/结局标签重复/简繁。 |
| `scan-guides.mjs` | 逐份读取 `web/scenario-guides/*.json`，做 zh/en blocks 结构对照（缺块、标题缺失、token 数量、bullet 数、分支指令差）、图标句悬空、未替换占位符、zh 语言/标点/简繁检测；产出逐关覆盖。 |
| `scan-setup.mjs` | 从 `contentRegistry` 读 62 关的 `name/intro/setup/resolutions`，连同 `content/scenario-guides.js` 的 `note/setup` 摘要逐项检测；对照指南 setup 段做齐全性对账。 |
| `build-findings.mjs` | 唯一写 `findings.json` 的地方：内含**人工复核后的 CURATED 裁定表**（每条 finding 的标题/期望/建议/匹配条件）；count 与 samples 从三份候选 JSON 复算，不手填。 |

## 扩展方式

- **新增检测**：在 `_shared.mjs` 增加纯函数 → 在对应 `scan-*.mjs` 的 `detect()`/逐块循环里调用 → 加 finding 前先看候选量级，噪声规则写回 `_SPEC.md` 第六节。
- **新增 finding**：在 `build-findings.mjs` 的 `CURATED` 里加一条，`match: [池, 谓词]`，谓词可用 `campaign/kind/pointer/severity` 组合；跑 `--write` 后检查 count/samples 是否合理。匹配不到任何候选会打印 `WARN`。
- **新增战役/关卡**：scanner 都从 `contentRegistry.listScenarios()` / `web/scenario-guides/` 自动发现，无需改列表；story 层新战役若结构特殊，需在 `scan-story.mjs` 的 `STORY_MODULE_SOURCES` 与 `STORY_PATH_FILTERS` 登记。

## 判定阈值（与生成器/测试同口径）

- 中文块含 **3+ 连续英文小写词** 或含英文停用词 run → mixed-language（与 `tools/import-scenario-guides.mjs`、`tests/scenario-guides.test.mjs` 同口径）。
- 中文块 **零 CJK 且有 2+ 英文词** → untranslated。
- zh 节字数 / en 节字符数 **< 0.22** 才判「整节缺块」；0.22–0.5 属正常中文压缩，不判缺译（避免 821 条误报，见 `_SPEC.md`）。
- 图标 token 只认 `web/card-text.js#SYMBOLS` 注册的 `[token]`；`{token}` / `[count]` / `[shelterValue]` 均为格式问题。
- 「未分段」只对**展示链会折叠换行**的路径判定（story-reader 的单段元素、TIC textBlocks 折叠），不对官方长段落按字数报警。
- **分支指引判定（2026-11-09 P0 修复后校准）**：中文去向词接受 `前往/跳至/跳到/跳转至/转至/转到/推进/参见/阅读/继续/进入/设置/进行`（与 `tools/import-scenario-guides.mjs` 的生成规则同集），避免把「转至结局 1」「跳到冒险设置」误判缺失；`en` 指南的 `Proceed/Skip/Read` 指令与 zh 去向数按同口径比较。
- **元数据过滤**：`nameEn/titleEn/labelEn/keyEn`、`sectionsEn`、`supplements`（补译来源哈希）等双语元数据不计入正文残留；仅扫描玩家可见文本。
- **TIC 展示链口径**：TIC 剧情源仍保留参考 locale 的 HTML/ICU/Markdown 原串，`textBlocks()`/`flashbacks.js#story()` 已在展示层规范化（段落拆分、ICU→`[token]`、英文分节标签→中文、Markdown 强调剥离、结局段首「结局 N：」剥离）。扫描器对 TIC 的这些问题按玩家可见结果判定，回归由 `tests/tic-story-format.test.mjs` 锁定；不要用源串原样重复报警。
- **运行时占位符**：`prologue.tarotResults.*` 的 `{name}`（塔罗结果）与 TFA `supplies.choose` 的 `{pointsRemaining}`（补给点数）由 `campaign-effects`/塔罗模块在展示前插值，不计 symbol/marker-brace 候选。
- **遭遇组图标句（guides-0004）**：只把「遭遇组/遭遇牌 … 图标 …：」的清单引导句计为 `icon-sentence-dangling`；「这张卡具有以下图标：」「图标如下：（貌似没有）」等解释性文字不报警。生成器侧 `stripEncounterIconHints` 会删掉清单引导句（zh/en、EOTE/TIC 同口径）。
- **P1 生成器修复已锁在测试里**：TFA 花括号 token→方括号、TCU `({class})`→`[class]`、四战役结局标签剥离、EOTE `[count]`→`X` 与尾声分节标题、指南连接词/职阶 token/`[shelterValue]`，分别见 `tests/story-format-p1.test.mjs`、`tests/tic-story-format.test.mjs`、`tests/scenario-guides.test.mjs`。
