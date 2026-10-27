# 《食梦者》剧情手册（M3-C / P8-T 骨架 · draft）

> **口径**：本文件是 **P8-T 之前的骨架**（`draft`），只登记「中文剧情缺什么、怎么补、怎么验收」；**没有开始翻译**，也没有任何 `storyText` 被标成 `verified`。
> 决策 D2（2026-10-27）：中文剧情采用**自译补齐**，口径是「自译，非官方中文」；审计账本必须标 `sourceKind: 'self-translated'`、`officialChinese: false`，**不得**写成官方中文来源。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §8.5；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §5.1。

## 1. 事实：缺口规模（初勘口径，待 P8-T 批 00 复核）

| 项 | 数值 | 说明 |
| --- | ---: | --- |
| 英文源 | 9 文件 / **194,299 字符** | `locales/en/theDreamEaters/{base,scenarios/*}`；P2 来源锁已锁 SHA-256（9 个 en + 9 个 zh） |
| 中文可复用 | 45,221 字符（23.3%） | 其中 **15 段正文疑似节译须重译**、11 条短记录键可原样复用 |
| 净需翻译 | **147,718 en 字符** | 叙事 120,098 / 规则 24,999 / 界面 2,621 |
| 中文产出估算 | 约 44k–56k 中文字符（中值 ~50k） | 按 en→zh 0.30–0.38 字符比；story-text 约 36k–46k |
| 批次 | **14 批 + 批 00** | 00 术语表/来源锁/55 记录键校对；01 序章+战役结构；02–04 幕间 I/II/III；05 16 段结局矩阵；06–11 按平行章对译 8 章；12 关键词与附加规则；13 场景规则文本；14 界面杂项与终审 |
| 工期 | 约 23–36 人日（单人 3–5 周） | 与 P3–P8 可并行 |
| 记录键 | **55 个** | `Campaigns/TheDreamEaters/Key.hs`；中文 `key.*` 覆盖在 zh `base.json`（仅 55 键） |
| 结局 | **16 段** | A4 × B4 的 4×4 矩阵；特殊尾声 `brokeTheLawOfUlthar` |

### 1.1 术语与高风险词形

- 术语表基线 44 行，以 `src/cards/cards-data.js` 的中文卡名为专名基线（7 个关键词官方词形：多重 / 蜂拥 / 掩藏 / 研究完成 / 警戒 / 隐私 / 绑定；8 章标题 / 5 调查员 / 战役名）。
- **5 个高风险词形冲突**：Hidden 隐私 vs 隐藏、Dreamlands 幻梦境 vs 梦境之地、Swarming 蜂拥 vs 群集、Veiled 掩藏 vs 隐蔽、campaign/scenario 战役/剧本 vs 冒险。
- **3 个空白词**：Great Ones、waking world、campaign 称呼——在批 01 拍板。

## 2. 工作流（P8-T）

| 步骤 | 内容 | 产物 |
| --- | --- | --- |
| 批 00 | 锁 en 源 SHA-256、建术语表（≥20 条）、校对 55 记录键与 8 章标题 | 来源锁 + 术语表 + `check:tde:terms` 草稿 |
| 批 01–14 | 按批次翻译与两轮审校 | `content/campaigns/theDreamEaters/story-source/*.json` / `.md`（**不写 `参考资源/`**，运行时不依赖参考资源） |
| 生成 | `tools/import-tde-story.mjs --write` 从自译源生成 `story-text.js` | 生成物 + 生成器 `--check` 逐字节一致 |
| 术语检查 | `check:tde:terms` | 专名/关键词/记录标签一致 |
| 审计 | `storyText` 标注自译来源 | `sourceKind: 'self-translated'`、`officialChinese: false`、`enSourceHashes`、`glossaryVersion`、`generatedSha256` |

`epilogueMatrix` 含 `data-epilogue` / `{count}` 控制标记，生成器需专门处理；15 段疑似节译必须重译或逐段补齐后才可复用。

## 3. 待办（P8-T）

| # | 事项 | 验收 |
| ---: | --- | --- |
| 1 | 批 00：来源锁 + 术语表 + 55 记录键校对 | 术语表 ≥20 条、来源哈希可复算 |
| 2 | 批 01：序章 + 战役结构（约 5,244 en 字符 → ~1.8k 中文字符） | 自译源 + 审校记录 |
| 3 | 批 02–05：三幕间 + 16 段结局矩阵 | 与双线模式共用文案 |
| 4 | 批 06–11：8 章（按平行章对） | 每章正文覆盖导入/幕间/结局 |
| 5 | 批 12–14：关键词/规则文本/界面杂项 | 术语一致、无 HTML 控制标记 |
| 6 | 生成器与门禁 | `import:tde-story:check`、`check:tde:terms`、`test:tde:story` |

## 4. 边界

- 自译**不是官方中文**：规则书/卡文/剧情都要能区分来源；审计不得把自译写成官方来源。
- 未完成的章节 `storyText` 保持 `pending`，**不得**用手写摘要顶替原文；未触发分支不得泄露（按 part 与事件 lane 投影）。
- 15 段疑似节译是「疑似」，批 00 需逐段判定：要么重译，要么给出「已完整」的逐句证据。

## 5. 相关手册与维护

- 剧本：[`tde-scenarios.md`](./tde-scenarios.md)；规则书：[`tde-rules.md`](./tde-rules.md)；发布：[`tde-release.md`](./tde-release.md)；路线图 §8.5。
- 维护：每批完成后更新本文件的「事实」表（字符数/批次状态）；来源哈希与生成物哈希由工具复算，不手写。
