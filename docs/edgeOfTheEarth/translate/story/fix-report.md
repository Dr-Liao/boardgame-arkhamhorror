# EOTE 剧情正文修复记录（story，2026-11-09）

> 审计基线：[`findings.json`](findings.json)（14 条）、[`notes.md`](notes.md)、[`coverage.json`](coverage.json)（修复前 backlog）。
> 修复入口：`content/campaigns/edgeOfTheEarth/locale-supplement/`（本地补译层）+ `tools/import-eote-story.mjs`（生成器）+ `content/campaigns/edgeOfTheEarth/{story-access,records,checkpoints,interludes}.js` + `src/campaign/story.js`。
> 结果：**12 条已修复、2 条保留说明**；章节 469/469、战役 locale 键 258/258 present，`chineseGaps` 全空。

## 1. 补译与覆盖（修复前 backlog 278 条 → 0）

| 范围 | 审计时点 | 修复后 |
| --- | --- | --- |
| 8 章 469 段 | 260 present / 10 untranslated / 199 missing | **469/469 present，0 缺译** |
| 战役 `base.json` 258 键 | 189 / 1 / 68 | **258/258 present** |
| 本地补译层 | — | `locale-supplement/` 4 文件 **288 条 entry**（chapters-a 31 / b 68 / c 97 / campaign 92） |

补译原则：简体中文、保留图标 token（`[frost]`/`[action]`/`[per_investigator]`/`[seal_a]`…）、段落 `\n\n` + 列表 `• `、术语按 [`../terms/glossary.md`](../terms/glossary.md)。

## 2. 逐条状态（14 条）

| id | 严重度 | 结论 | 修复内容 |
| --- | --- | --- | --- |
| story-0001 | high | ✅ 已修 | 缺译清零后 `chineseGaps` 为空；`records.js#presentEntry` 只取 present 条目，故事日志/章节展示不再拼英文回退 |
| story-0002 | high | ✅ 已修 | 补译 + `presentEntry` 门限后，flow 节点/选项 0 英文；13 个 Camp 标签、25 个记录键全部中文 |
| story-0003 | medium | ✅ 已修 | `records.js#recordLabelMap` 补 24 个 schema 键 + 9 位伙伴结果标签；`recordSchema` 81/81 有中文，不再回退 camelCase |
| story-0004 | medium | ✅ 已修 | `Resolution 3:` / `Intro 3:` / `Shelter Value:` / `Experience:` 等英文前缀全部本地化（补译层） |
| story-0005 | medium | ✅ 已修 | `normalizeZhText` 统一重复/半角标点（`。.` 67 处等） |
| story-0006 | medium | ✅ 已修 | `{'{'}frost{'}'}` → `[frost]`（32 处/16 段；en 侧同源转义也还原） |
| story-0007 | medium | ✅ 已修 | `[shelterValue]` → 「营地庇护值」（en 占位符保留 en 语义） |
| story-0008 | high | ✅ 已修 | part1 expert → 「专家等级 / 2 个毁灭标记」；winifredNotPresent → 「跳到导言 3」 |
| story-0009 | medium | ✅ 已修 | `著` → `着`（451 处/168 路径），保留著名/著作/著称等，现状 0 |
| story-0010 | low | ✅ 已修 | intro 小标题统一「冒险 I/II/III」「亡命冰原 第II部分」 |
| story-0011 | low | ✅ 已修 | 关键词/记录译名与卡面对齐（高等级→高度、营地/伙伴/物资名、忒咳哩-哩） |
| story-0012 | low | ✅ 已修 | 检查点日志 `MIA→失踪`、幕间奖励 `XP→经验值` |
| story-0013 | low | ⏸ 保留 | 多段长引语惯例导致 51 段左引号多于右引号（见 `../fix-batch.md` §5.3） |
| story-0014 | low | ⏸ 保留（en 侧） | `Scenario ???` 为 en 原文；zh 展示已清理为「冒险：致命幻景」（见 `../fix-batch.md` §5.5） |

## 3. 分段修复（本次重点）

| 位置 | 修复前 | 修复后 |
| --- | --- | --- |
| 章节 `intro` | 多段被拼成单段 | 39 段段落化（标题独立，叙事按 `\n\n`） |
| `setup` / `resolutions` / 幕间正文 | 段落之间无空行 | `joinDisplay` / `buildResolutions` / `buildGroup` / `buildCampaign` 全部 `\n\n` |
| `story-access.js` | `flattenStory` 用 `\n` 拼 title/body | `\n\n`；`resolutionText` 去重「结局 N：」前缀 |
| `src/campaign/story.js` | 章节开场直接拼接 | 新增 `splitParagraphs` + `eoteIntroduction`，按叙事键分段、去重标题 |
| 结局展示 | 「结局 1」+「结局 1：……」重复 | 正文去除重复标题前缀 |

验证：`flattenStory({title,body}) === '标题\n\n正文'`；`iceAndDeathPart1.intro` 可拆 39 段；八章指南 343 段中文中 128 段含段落空行（`verify-fix-batch.mjs`）。

## 4. 生成链与验收

```bash
cd games/arkhamhorror
node tools/import-eote-story.mjs --write
node tools/import-scenario-guides.mjs --write
node tools/import-eote-story.mjs --check        # exit 0
node tools/import-scenario-guides.mjs           # exit 0
node --test tests/eote-story.test.mjs           # 12/12 pass
node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs  # ok=true
```

- `story-text.js` 为生成物，未手改；`meta.zhSupplement` 记录补充层文件与条目数（288），`sourceKind = reference-project-zh-locale+local-supplement`。
- 测试 `tests/eote-story.test.mjs` 已改为新不变量：8 章 469/469、`chineseGaps` 为空、指南 marker=0、`zhSupplement` 结构存在。
- 战役记录标签展示：`manifest.recordSchema` 81 键与 `manifest.recordLabels` 81 键一一对应（含 25 个流程层键、9 个伙伴结果键）。
- replay：正文变化改变状态指纹，已用 `../tools/regen-eote-replay-baseline.mjs` 重采 `tests/fixtures/replay/eote-p8-baseline.json`。
