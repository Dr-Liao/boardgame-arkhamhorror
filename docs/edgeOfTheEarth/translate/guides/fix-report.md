# EOTE 指南面板修复记录（guides，2026-11-09）

> 审计基线：[`findings.json`](findings.json)（14 条）、[`notes.md`](notes.md)、[`coverage.json`](coverage.json)（修复前 backlog）。
> 修复入口：`content/campaigns/edgeOfTheEarth/locale-supplement/` + `tools/import-eote-story.mjs`（`@:` 展开、`normalizeZhText`）+ `tools/import-scenario-guides.mjs`（`buildEoteGuide` / `sourceKind`）。
> 结果：**12 条已修复、2 条保留说明**；八章指南 `chineseGaps` 全空、无缺译 marker、343 段中文正文。

## 1. 生成链

```
参考 zh locale（只读）+ locale-supplement/*.json
  → tools/import-eote-story.mjs --write   （章节/战役正文，含 @: 展开与规范化）
  → tools/import-scenario-guides.mjs --write（web/scenario-guides/*.json，8 章 + 其他 54 关）
```

- `buildEoteGuide` 从 `story-text` 同源生成，`sectionCount`/`chineseGaps`/`sources` 与 story 完全一致；
- `sourceKind = EOTE_STORY_META.sourceKind`（`reference-project-zh-locale+local-supplement`），诚实披露本地补译层；
- `@:edgeOfTheEarth.<guide>.<path>` 引用由生成器 `resolveLocaleRef` 展开（zh 优先本地补充层），Part3「调查员设置」不再假性缺译。

## 2. 逐条状态（14 条）

| id | 严重度 | 结论 | 修复内容 |
| --- | --- | --- | --- |
| guides-0001 | high | ✅ 已修 | 7 处 `{'{'}frost{'}'}` → `[frost]`（生成器，含 en 侧） |
| guides-0002 | high | ✅ 已修 | 全部标题有中文；`chineseGaps` 0、缺译 marker 0，14 个标题不再静默消失 |
| guides-0003 | high | ✅ 已修 | `@:` 跨节引用展开；Part3「调查员设置」显示补译正文 |
| guides-0004 | medium | ✅ 已修 | 7 段半译/英文标签（结算标签、Setup/Resolution/Intro 前缀）全部中文化 |
| guides-0005 | medium | ✅ 已修 | 2 处 `[shelterValue]` → 「营地庇护值」 |
| guides-0006 | medium | ✅ 已修 | 简繁/台港词归一（`著→着`、计画→计划、网路→网络、想像→想象），现状 0 |
| guides-0007 | medium | ✅ 已修 | 33 段 `。.` 重复标点归一 |
| guides-0008 | medium | ⏸ 保留 | 9 段引号不配对属多段长引语惯例（见 `../fix-batch.md` §5.3） |
| guides-0009 | medium | ✅ 已修 | markdown `_…_` 斜体剥离，面板不再显示下划线 |
| guides-0010 | medium | ✅ 已修 | 半/全角标点归一 + 中文语境半角括号转全角 |
| guides-0011 | medium | ✅ 已修 | `亡命冰原 第I部分I` → `第II部分` |
| guides-0012 | low | ✅ 已修 | No Resolution 统一「未达成结局」 |
| guides-0013 | low | ✅ 已修 | 漏字「拥有额 1使用」→「拥有额外 1 次使用」（重译覆盖） |
| guides-0014 | low | ⏸ 保留 | 3 处列表项/段落数与 en 不同：`<li>` 转纯文本 `•` 的展示层差异（见 `../fix-batch.md` §5.4） |

## 3. 面板分段与展示

- 指南 `eoteBlocks` 输出纯文本段落，段间保留 `\n\n`、列表 `• ` 独立行；八章 343 段正文中 128 段为多段（`verify-fix-batch.mjs` 复算）。
- 结局块正文去掉与标题重复的「结局 N：」前缀（生成器 `buildChapter` 去重）。
- 缺译呈现：`chineseGaps=0` 后面板不再出现「中文待补」marker；en 面板保留 en 原文。

## 4. 验收

```bash
cd games/arkhamhorror
node tools/import-scenario-guides.mjs --write
node tools/import-scenario-guides.mjs            # exit 0，62 scenarios verified
node --test tests/eote-story.test.mjs            # 12/12 pass（含指南结构/幂等/无缺译 marker）
node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs  # 8 files / gaps 0 / 343 段
```

- 生成物为 `web/scenario-guides/{iceAndDeathPart1..2..3,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadnessPart1..2}.json`，由工具重生成，未手改。
- 幂等：`import-scenario-guides` 两次生成一致、磁盘文件逐字节等于生成结果（`tests/eote-story.test.mjs` 覆盖）。
