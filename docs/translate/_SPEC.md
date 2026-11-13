# 全战役剧情 / 冒险指南 / 关卡设置文本中文审计规范（docs/translate）

> 性质：**只读审计 + 可复现扫描**。本轮不修改游戏内容与实现；产物只写 `games/arkhamhorror/docs/translate/**`。
> 生成日期：2026-11-09。口径借鉴七循环现有的 `docs/edgeOfTheEarth/translate/_SPEC.md` 归档（未随本仓迁移保留），本条线把范围扩展到全部 8 个已注册战役。

## 一、审计对象

数据源（相对 Mod 根 `games/arkhamhorror/`）：

| 层 | 数据源 | 说明 |
| --- | --- | --- |
| 剧情文本 | `content/campaigns/<campaign>/story-text.js`；`content/campaigns/theCircleUndone/scenarios/*/story-text.js` | 各战役序章/章节导入/幕间/结局/尾声的运行时正文 |
| 剧情文本（投影） | `src/campaign/story.js`；`contentRegistry.getCampaign().flow` | 故事日志/幕间的标题、选择 prompt/label、记录标签、结局标签 |
| 剧情文本（模块内联） | `content/campaigns/*/interludes.js`、`prologue.js`、`epilogue.js`、`checkpoints.js`、`flashbacks.js`、`introduction.js`、`resolutions.js`、`dual-story.js`、`parts.js`、`story-access.js` | 不在 story-text 生成物里的玩家可见字面量 |
| 引导文本 | `web/scenario-guides/<scenarioId>.json` 的 `locales.zh` / `locales.en` | 「关卡设置」面板实际加载的完整冒险指南：开场、设置、特别规则、后续剧情、结局 |
| 关卡设置文本 | `contentRegistry.getScenarioData(id)` 的 `name/intro/setup/resolutions`；`content/scenario-guides.js` 的 `GUIDES`（`note` / `setup` 摘要） | 设置面板、故事回退正文、布置摘要 |

**不覆盖**（明确排除，避免误读覆盖率）：5,930 张卡面文本、规则书文本、卡牌交互按钮/技能检定提示、记录标签 UI、卡图内文字。卡面中文本轮仍由既有卡牌迁移/验收链路负责；七循环另有专项审计（`docs/edgeOfTheEarth/translate/`），本报告只补其未覆盖的残留。

## 二、问题分类（category）

1. `missing-translation` **漏翻/未译**：应有中文的位置是英文原文、空串或标记；en 有正文而 zh 缺失。
2. `mixed-language` **中英混杂**：中文段落里出现整句英文、英文小标题（Intro N: / Resolution N:）、英文连接词（and/the/of）或未替换 token。
3. `segmentation` **未分段/分段错误**：应分成多段的内容被塞进单个展示单元（HTML `<p>` 被折成单段、段内 `\n\n` 在故事日志中被折叠）、段首重复标签。
4. `symbol-format` **图标/格式错误**：`[token]` 未注册或写错大小写、`{token}` 花括号、ICU 转义、`[count]`/`[shelterValue]` 占位符、遭遇组图标清单缺失、中文指南丢失职阶/混乱标记图标。
5. `vague` **语焉不详**：分支条件停在半句、没有「前往〈引言 N〉/跳至结局 N/进入冒险设置」的下一步；只有布置摘要没有可执行步骤。
6. `marker-leak` **内部标记泄漏**：`@:`、`{占位符}`、`missing/untranslated`、U+FFFD、`{'…'}` 等会渲染给玩家的内部记号。
7. `terminology` **术语/用字**：同一英文词多译（Intro→引言/开场/介绍/导言）、简繁混用（「著」当「着」）。
8. `structure` **结构差异**：zh/en 指南块数/标题层不一致（中文把标题内联进正文），导致信息层级丢失。
9. `coverage` **覆盖/来源**：来源归属、缺项记账、范围与保留项。

## 三、严重度（severity）

- `high`：玩家直接看到英文/内部标记，或分支指引缺失导致无法判断该读哪段、该走向哪段；图标缺失导致关键行动信息丢失（如梦境职阶、混乱标记）。
- `medium`：可读但明显瑕疵：重复标签、图标 token 与英文不一致、中文标题缺失、简繁混用、分节结构丢失、占位符潜在泄漏。
- `low`：标点/半角/空格等机械问题、术语不统一、结构风格差异、来源说明。

## 四、证据格式

`docs/translate/findings.json` 每条 finding：

```jsonc
{
  "id": "story-0001",
  "area": "story | guides | setup | crosscut",
  "category": "missing-translation | segmentation | symbol-format | vague | ...",
  "severity": "high | medium | low",
  "title": "一句话结论",
  "count": { "occurrences": 12, "groups": 12 },  // 由扫描候选复算
  "campaigns": ["theForgottenAge"],
  "scenarios": ["heartOfTheEldersPart1"],
  "samples": [{ "file": "content/.../story-text.js", "line": 146, "pointer": "introductions...", "evidence": "原文片段" }],
  "expected": "期望文本/对照",
  "suggestion": "可执行修法（改哪个生成器/源文件）",
  "sourceKind": "upstream-zh-locale | generated | repo-authored | self-translated | ...",
  "rootCause": "可选：根因"
}
```

- 行号由扫描器在源码中按文本片段实际定位，**定位失败则为 null，不编造**。
- `samples` 最多 10 条；全量候选在 `scan/*.json`，可按 kind/campaign 过滤复算。
- 同一根因的多处出现合并为一条 finding（如「结局正文段首重复标签」107 处一条），不按段落拆条。

## 五、输出物

```
docs/translate/
  README.md              # 主报告：结论、统计、逐层问题、修复优先级、复现命令
  _SPEC.md               # 本文件：范围/分类/严重度/证据格式
  fix-plan.md            # 按 finding 的可执行修复顺序（P0/P1/P2）
  findings.json          # 人工裁定的结构化 findings（count/samples 由扫描数据复算）
  scan/
    story-candidates.json / story-coverage.json
    guides-candidates.json / guides-coverage.json
    setup-candidates.json / setup-coverage.json
  tools/
    _shared.mjs          # 提取/检测共用库
    scan-story.mjs       # 剧情层扫描
    scan-guides.mjs      # 引导层扫描（zh/en 结构对照）
    scan-setup.mjs       # 关卡设置层扫描
    build-findings.mjs   # 人工裁定表 → findings.json（count/samples 复算）
    README.md            # 工具用法与扩展方式
```

## 六、口径与噪声规则（人工复核约定）

- **上游继承 vs 本仓新增**：剧情/指南的 zh 文本来自参考工程 zh locale 的，问题标 `upstream-zh-locale`；TDE 自译标 `self-translated`；生成器/展示链造成的问题标 `generated`；本仓手写模块的问题标 `repo-authored`。修法优先级按来源分流。
- **保留项（不计 finding）**：
  - TDE `interludes.js` / `dual-story.js` 的锁定英文原文（`pendingTranslation` 已全部为 false，不发生展示；保留作对比源与回归断言）。
  - `nameEn` / 双语关卡名（catalog 有意并排展示中英名；仅 TDE/EOTE 内部格式不一致计 low）。
  - TIC 幕间 `base.interlude*`：`interludes.js#present()` 用 `textBlocks().join('\n\n')` + `visit.storyText`，故事日志按 `\n\n` 正常分段；只有 `introduction.js`/`resolutions.js#journal()` 直接把 textBlocks 单串塞进 `paragraphs` 的路径才计分段问题。
  - TIC `ph'nglui mglw'nafh…` 等洛夫克拉夫特式咒语（有意保留原文的音译）。
  - TCU `prologue.tarotResults.*.text` 里的 `{name}`（运行时 `replaceAll('{name}')` 替换）。
  - TDE「黑猫 2：」「蜘蛛女王 1：」等同一幕间内的分节标签（不是重复标题）。
  - 官方长段落：叙事长段是原文风格，不按字数判「未分段」；只有「多段被折成单段」才计。
- **未决/需人工裁定**：图标 token 数量差异中，中文用「各加 1 个」这类简写而省略重复 token 的，列 low 并注明需人工裁定（guides-0008）。

## 七、复现

```sh
# 在 games/arkhamhorror 下
node docs/translate/tools/scan-story.mjs --write
node docs/translate/tools/scan-guides.mjs --write
node docs/translate/tools/scan-setup.mjs --write
node docs/translate/tools/build-findings.mjs --write
```

扫描器只读源码、不 spawn 子进程、不修改游戏数据；重复运行应得到相同的 count/samples（`-candidate` 文件按稳定排序输出）。
