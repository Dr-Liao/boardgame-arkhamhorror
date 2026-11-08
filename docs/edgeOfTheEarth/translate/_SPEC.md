# 《地球边缘》翻译审计共享规范（translate 工作区）

> 本文件是 2026-11-09 翻译审计的共享口径，所有 area 审计员必须遵守。
> 工作区根：`games/arkhamhorror/docs/edgeOfTheEarth/translate/`；Mod 根：`games/arkhamhorror/`。
> 本轮是**只读审计**：不修改 `games/arkhamhorror/{src,content,docs,web,tests,tools,audit}` 下任何既有文件；
> 只允许写 `docs/edgeOfTheEarth/translate/<area>/**` 与 `docs/edgeOfTheEarth/translate/tools/**` 下自己的 area 文件。

## 一、审计对象

七循环《地球边缘》（Edge of the Earth，EOTE，08 号段；`eoep` 调查员包 + `eoec` 战役包）的中文侧全部玩家可见文本：

| 层 | 数据源（相对 Mod 根） | 说明 |
| --- | --- | --- |
| 卡面 | `src/cards/cards-data.js` 的 `08xxxx` 记录 | `name/nameZh`、`subname/subnameZh`、`text/textZh`、`backName/backNameZh`、`backText/backTextZh`、`flavor/flavorZh`、`backFlavor/backFlavorZh`、`traits/traitsZh`、`customization*` |
| 卡面权威对照（只读） | `参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json`（简体）、`cards_zh.json`（繁体）、`cards_en.json` | 上游 ArkhamDB 简中来源，用于区分「上游继承问题」与「本仓导入/改写问题」 |
| 剧情正文 | `content/campaigns/edgeOfTheEarth/story-text.js`（生成物） | 战役序幕/检查点/幕间/尾声 + 8 章 469 段指南，含 `status/chineseGaps/sectionsEn` |
| 战役模块 | `content/campaigns/edgeOfTheEarth/{prologue,checkpoints,interludes,epilogue,records,keywords,parts,shared-encounters,shared,flow}.js` | 记录标签、关键词、伙伴/物资、章节标题等非生成文本 |
| 指南面板 | `web/scenario-guides/{iceAndDeathPart1,iceAndDeathPart2,iceAndDeathPart3,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadnessPart1,theHeartOfMadnessPart2}.json` | 「关卡设置」面板实际加载的 8 份指南（`locales.zh` / `locales.en` / `chineseGaps`） |
| 剧情/指南 zh 源（只读） | `参考资源/ArkhamHorror-main/frontend/src/locales/zh/edgeOfTheEarth/**` | 参考工程简中 locale（`base.json` + 5 个 scenarios JSON） |
| 剧情/指南 en 源（只读） | 同路径 `en/` | 对照缺项、混入英文与占位符 |

## 二、问题分类（category）

每个问题必须归入以下一类（可加 `subcategory` 细分）：

1. `missing-translation` **漏翻**：en 有正文而 zh 缺失/空串/仅有标记；zh locale 无对应键；zh 值等于 en 原文（未译）。
2. `mixed-language` **中英混杂**：中文句子里夹英文单词/整句；半译（标题中文正文英文）；专名音译不一致留下的英文；渲染层会把英文/`中文待补` 拼进中文段的路径。
3. `symbol-format` **错误符号/格式**：图标/占位符 token 与 en 不一致（如 `[skull]`、`[per_investigator]`、`{count}`、`[[特性]]`）、括号/引号不配对、重复标点（`。.`、`。。`、`,，`）、半角/全角混用、`<b>`/HTML 残留、乱码（U+FFFD）、不换行/多余空格、markdown 记法泄漏。
4. `mistranslation` **误译/语义偏差**：数字/否定/目标/条件与 en 不符（例：en `Take 2 horror` → zh `受到2点伤害`）；术语替换导致规则歧义。
5. `marker-leak` **内部标记泄漏**：`missing`/`untranslated`/`TODO`/`NEEDS REVIEW` 等内部标记出现在会渲染给玩家的文本中。
6. `terminology` **术语/用字**：同一英文术语多种译法；简繁混用（zh-cn 语料中出现「著/於/與」等繁体字）；角色/地点音译前后不一致；关键词与规则书译名不符。

## 三、严重度（severity）

- `high`：玩家直接可感知且影响理解/规则执行：漏翻整段、整句英文、误译改变规则、图标/占位符缺失导致读不懂、标记泄漏可见。
- `medium`：可读但有明显瑕疵：半译、术语不一致、重复标点、半/全角混用、多余空格、生硬机翻感明显的句子。
- `low`：风格/一致性/溯源问题：非关键异体字、书名号/引号风格、与上游简体来源一致但可优化的措辞、文档口径问题。

## 四、证据格式（强制）

- 每条 finding 必须带 `location`：`相对 Mod 根的路径:行号`（如 `src/cards/cards-data.js:4826`、`content/campaigns/edgeOfTheEarth/story-text.js:2011`、`web/scenario-guides/iceAndDeathPart1.json:234`）。
  - 行号用 `grep`/`Select-String`/`node` 实际定位，**禁止编造**。
  - JSON 数据同时给 `pointer`（如 `locales.zh.setup.gatherSets`）。
  - 脚本派生的机械发现可给 `source`（生成器/字段）与 `key` 路径代替行号，但必须能由随附脚本复算。
- `evidence` 放**原文片段**（截断到 ~200 字），`expected` 放建议译文或对照 en，`suggestion` 放可执行修法。
- 同一问题在多处重复时（如同一术语误译出现在多张卡）合并为一条模板 finding，`samples` 列 3–10 个代表位置，`count` 给全量计数。

## 五、输出物（每个 area 两份 + 脚本）

```
docs/edgeOfTheEarth/translate/<area>/
  findings.json   # 结构化发现（schema 见下）
  notes.md        # 中文说明：范围、方法、结论、统计、未覆盖项、抽样复核
docs/edgeOfTheEarth/translate/tools/<area>*.mjs  # 可复现扫描脚本（node 直接运行，不 spawn 子进程）
```

`findings.json` schema：

```jsonc
{
  "area": "cards",                 // cards | story | guides | terms
  "auditor": "<名字>",
  "generatedAt": "2026-11-09",
  "method": "一句话方法",
  "scope": { "source": "...", "count": 403, "notes": [] },
  "summary": { "findings": 0,
               "byCategory": { "missing-translation": 0, "mixed-language": 0, "symbol-format": 0, "mistranslation": 0, "marker-leak": 0, "terminology": 0 },
               "bySeverity": { "high": 0, "medium": 0, "low": 0 } },
  "findings": [{
    "id": "cards-0001",
    "category": "symbol-format",
    "severity": "medium",
    "title": "一句话结论",
    "scope": { "code": "08586", "field": "textZh", "key": "..." },
    "location": "src/cards/cards-data.js:4826",
    "pointer": "optional.json.path",
    "evidence": "受到的原文片段",
    "expected": "建议文本/对照",
    "suggestion": "改法",
    "source": "upstream-zh-cn | generated | repo-authored | reference-locale",
    "count": 1,
    "samples": []
  }]
}
```

`notes.md` 至少包含：①范围与输入；②方法与命令；③结论摘要（按分类/严重度）；④high 问题逐条复述；⑤与上游/既有文档口径的关系（继承 or 新增）；⑥未覆盖/不可判定项；⑦复现命令。

## 六、口径约束

- **区分来源**：卡面 `textZh` 是上游 `cards_zh-cn.json` 去 HTML 标签后的产物；与上游一致的翻译问题标 `source: upstream-zh-cn`（继承问题），与上游不一致的标 `source: repo-authored/generated` 并给差异证据。
- **官方中文**：EOTE 剧情/指南 zh 来自参考工程 locale，`officialChinese=false`；缺译按 `chineseGaps` 标记显示「中文待补」是**既有披露口径**，不算 bug；但「标记泄漏/英文直接进中文段/应标记而未标记」要报。
- **不臆断**：不确定的语义问题给 `severity: low` 并注明「需人工裁定」；有 en/zh 对照证据才可报 high。
- **不重复**：机械候选先按 token/模板聚合，再逐条人工确认；同一根因（如全库 traitsZh 用 `/` 连接而规则书用「.」）合并。
- **禁止**修改游戏实现与内容文件；本目录之外只读。

## 七、Area 划分与边界

| area | 审计员 | 覆盖 |
| --- | --- | --- |
| cards | cards-audit | 403 张 EOTE 卡的 zh 字段（卡名/卡文/背面/风味/特性/强化），对照 en 与上游 zh-cn；含调查员卡 22、玩家卡 115、战役卡 266 |
| story | story-audit | `story-text.js` 全部正文（战役 + 8 章 469 段 + interludes/epilogue/localeKeys），加战役模块内非生成中文文本（prologue/checkpoints/interludes/epilogue/records/keywords/parts/shared-encounters 的 label/提示） |
| guides | guide-audit | 8 份 `web/scenario-guides/*.json` 的 `locales.zh`、`chineseGaps`、`chineseStatus`，对照 zh/en locale 源；面板渲染口径（`web/scenario-setup-view.js`、`web/locales/zh-CN.panels.js`）；八章缺失/未译键全清单（补译 backlog） |
| terms | terms-audit | 术语一致性（关键词/图标/记录/伙伴/物资/地点/阵营）、简繁与异体字、音译一致性、规则书译名对照；跨 cards/story/guides 的术语总表与差异清单 |

跨 area 发现（如某术语在卡面和剧情都错）由发现者报到自己 area 并在 `crossArea` 字段注明；Lead 合并时去重。
