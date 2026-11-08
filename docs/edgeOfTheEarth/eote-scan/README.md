# EOTE（七循环《地球边缘》）全量扫描共享工作区

> 工作区根：`G:\boardgame-hall-ai\games\arkhamhorror\docs\edgeOfTheEarth\eote-scan\`。Mod 根：`G:\boardgame-hall-ai\games\arkhamhorror\`。
> 目录归档：本目录已从项目根的 `eote-scan/` 移入战役文档目录；下述沙箱说明记录的是原扫描时的环境。
> **本轮是只读审计**：目标是独立复核（不是复算既有账本），不修改 `games/arkhamhorror/{src,content,docs,audit,web,tests,tools}`。

## 一、五条审计维度

1. **D1 实现 vs 描述**：卡面印刷文本（`src/cards/cards-data.js` 的 `text/textZh/backText/backTextZh`）逐子句核对实现（单卡条目 + 章节 behavior + 引擎读点），给 `implemented / approximation / missing` 与 `file:line` 证据。
2. **D2 交互可感知**：真实界面上玩家能否感知：可选效果是否有选择/提示（`api.choice` + `prompt`/`label`）、自动效果是否有 `api.info` 日志或牌桌投影、隐藏信息是否仍隐藏、指南/面板是否展示。
3. **D3 关卡可跑通**：八章 setup→幕/议程→地点→遭遇→结局/记录→下一章；真实引擎路径是否推进、是否死锁；战役流程（序章 / 检查点 / 幕间 / 尾声 / 记录）是否闭环。
4. **D4 原语规则**：只读状态、写入只走 `ctx.api`；无引擎卡号分支（行为级）、无越界 import、声明即接线（`flags.*` / `*Rule.*` 有引擎或章节行为读点）、近似/逃逸有披露。
5. **D5 复用**：同句卡文模板/同机制是否复用原语；重印/平行版本走别名；章节间复制粘贴行为是否应上收为共享原语或共享常量。

**既有账本的 `verified` 只代表“有测试/文件证据”，不能作为语义正确性依据。** 已知偏差必须逐条复核。

## 二、只读输入（权威卡面与参考）

| 用途 | 位置 |
| --- | --- |
| 卡面权威数据（5930 卡） | `games/arkhamhorror/src/cards/cards-data.js`（`text` 英文 / `textZh` 中文 / `backText` / `backTextZh`） |
| 单卡审阅包（已生成） | `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/bundles/<code>.md`（403 份：卡面中英 + 元数据 + 条目源码 + 相关测试标题） |
| 章节审阅包 | `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/chapter-bundles/<chapterId>.md`（definition/behavior/chaos 源码 + 指南来源 + 章节卡号） |
| 范围/分片/统计 | `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/{cards,shards,chapters,stats,tests-index}.json` |
| 机械筛查线索 | `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/*.json`（integrity / keyword-coverage / flags-readpoints / duplication / tests-coverage / perceivability / scenario-integrity / known-deviations / primitive-compliance / summary.md） |
| 官方参考实现（只读） | `G:\boardgame-hall-ai\参考资源\ArkhamHorror-main\`：`backend/arkham-api/library/Arkham/`（Haskell CardDefs/Scenarios）、`frontend/src/locales/{en,zh}/edgeOfTheEarth/`（指南原文） |
| 既有账本（只读，仅作对照/已知偏差） | `games/arkhamhorror/audit/eote-*.json`、`docs/edgeOfTheEarth/*.md` |
| 行为测试 | `games/arkhamhorror/tests/eote-*.test.mjs`（36 个文件） |

## 三、沙箱与命令约束（重要）

本机 DSH 沙箱**禁止 Node 以管道 spawn 子进程**，`node --test`、`npm run test:*`、`tools/verify-eote.mjs` 等会 `spawn EPERM`。统一用 **in-process** 方式：

```bash
cd G:\boardgame-hall-ai\games\arkhamhorror
node tests/eote-investigator-daniela.test.mjs          # 单文件 in-process，可用
node --experimental-test-isolation=none --test tests/eote-player-m2-1.test.mjs tests/eote-player-m2-2.test.mjs   # 多文件，可用
```

- 审计产物写入本目录下各自的 `<area>/`；不修改游戏实现。原扫描时的只读沙箱限制为历史环境说明。
- `read` 工具可用于读取任何文件；脚本/测试里的文件写入请用 `node` 或 `write` 工具落到自己 area。
- 不要运行 `node tools/audit-eote-all-cards.mjs` / `audit-eote-player.mjs` / `verify-eote.mjs`（内部 spawn 必失败）。

## 四、输出（每个 area 一份 findings.json + notes.md）

写入 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/<area>/findings.json` 与 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/<area>/notes.md`（area 见任务卡）。

```jsonc
{
  "area": "player/m2-1",
  "auditor": "<你的名字>",
  "method": "逐卡逐子句核对 cards-data 卡面 vs 条目源码/引擎读点/测试；D2/D4/D5 附证据",
  "generatedAt": "2026-11-08",
  "scope": { "codes": ["08019"], "count": 30 },
  "summary": { "cards": 30, "match": 0, "approximation": 0, "gap": 0, "blocked": 0,
               "issuesBySeverity": { "high": 0, "medium": 0, "low": 0 } },
  "cards": [{
    "code": "08019", "name": "Geared Up", "nameZh": "全副武装",
    "verdict": "match",            // match | approximation | gap | blocked | not-applicable
    "accepted": true,               // 仅 verdict=match 且无 high issue 时 true
    "clauses": [
      { "text": "Permanent. Limit 1 per deck. Purchase at deck creation.",
        "status": "implemented",    // implemented | approximation | missing | unverifiable
        "evidence": "src/cards/entries/08019.js:2 / src/engine/setup.js:xxx", "note": "" }
    ],
    "perceivability": { "status": "perceivable", "evidence": "src/cards/entries/08019.js:33-45（api.choice+prompt）；web/...", "note": "" },
    "tests": { "status": "covered", "evidence": "tests/eote-player-m2-1.test.mjs:xx 标题…", "note": "" },
    "issues": [{
      "severity": "medium",        // high=规则/可玩性错误；medium=近似/感知缺失/复用缺失/声明未接线；low=文档/证据薄弱
      "dimension": "impl-vs-text", // impl-vs-text | perceivability | primitive | duplication | runtime | docs
      "summary": "……", "evidence": "file:line", "suggestion": "……"
    }]
  }]
}
```

- 结论必须给 `相对 mod 根路径:行号` 证据（如 `src/cards/entries/08019.js:44`、`content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js:133`、`tests/xxx.test.mjs:123`）。**无行号结论无效。**
- `verdict=match`：全部子句 `implemented` 且无 high issue；`approximation`：可用但有明示近似；`gap`：有 missing 子句或明显不等价（high）；`blocked`：无法验证且写明原因；`not-applicable`：纯参考卡/无行为卡（口径需说明）。
- 关卡/流程 area 追加 `"scenarios": [...]`（setup/rules/flow/runthrough/guides/issues），按任务卡要求。

## 五、机械筛查线索怎么用（不要照抄）

`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/*.json` 只是候选，常见噪声：
- `integrity.json` 的 `no-implemented-flag`（玩家卡普遍没有该字段）、`entry-no-code`（`code: CODE` 常量引用，已部分自动解析）需人工排除；`empty-behavior` 7 张需重点核。
- `keyword-coverage.json`：文本提到某动词但条目无对应 token，可能是引擎统一原语实现（例如“检定”走 `api.test` 的通用机制），必须读引擎读点后判定。
- `flags-readpoints.json`：`unread`（声明字段/调度值在 src+content 中无字面读点）是**高价值线索**；但注意通用 dispatcher（如 `entryFlags(code)` 后按数据分发）可能已实现，必须读消费点确认。`kind=rule-value`（如 `defenseElderThingsAtLocation` 之类处理函名字符串）完全无读点通常意味着**声明未接线**。
- `duplication.json`：`clonePairs` 是 token shingle 近似；必须打开两份源码确认是否“应复用却各写一遍”（也可能合理：不同卡的少量公共语法）。
- `known-deviations.json`：既有 26 simplified + 28 deferred + 25 primitive requests + 51 条目注释标记；逐条核对现状（是否仍披露、是否已实现但未销账）。

## 六、批量进度与协作

- 所有 area 并行，**不要修改别人的 area 文件**；需要其他 area 的信息时读他们的 findings.json 或发消息给 Lead。
- 卡很多时先批量扫描结构线索，再对重点卡深挖；每张卡至少：卡面 vs 条目 + 1 个关键读点 + 测试证据。**不要只写“已实现”**。
- 发现问题分三类输出：①已确认 bug（high，可复现）；②近似/降级（medium，写明与原版差异）；③文档/口径（low）。
- 发现 prior 账本虚假（例如 status=verified 但实际无行为/无读点）单独列出，Lead 汇总时会重点复核。
