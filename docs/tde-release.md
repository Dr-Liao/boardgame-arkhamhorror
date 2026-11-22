# 食梦者（The Dream-Eaters）发布验收（P10）

> 本文件在部分检出中缺失；批次 4 Lead 依据 `audit/tde-migration.json`、
> `artifacts/migration/tde/primitive-plan.json` 与现有 TDE 验收测试重新补写，
> 作为 P10 发布账本的文档证据。发布门禁以工具实跑复算为准。

## 1. 交付范围

- 三包：`tdeCampaign`（283 张战役卡）、`tdeInvestigators`（18 张调查员/依赖）、`tdePlayer`（87 张玩家卡）。
- 双线战役：A 线（The Dream-Eaters）与 B 线（The Web of Dreams）共 8 章，含 part 状态、垂直链条、尾声矩阵。
- 大厅：三包与 8 章 `playable`，无提前体验（earlyAccess=false）、无简化（simplified=0）、无缺口（gaps=0）。

## 2. 验收证据

- 逐卡账本：`audit/tde-all-card-acceptance.json`（388/388 verified；main 352 + face 36）。
- 场景账本：`audit/tde-scenario-acceptance.json`（8/8 章 verified；记录覆盖 253/253）。
- 规则书/关键词：`audit/tde-rules.json`（关键词 7/7、规则书 verified）。
- 调查员：`audit/tde-investigators.json`；玩家卡：`audit/tde-player-acceptance.json`（87/87）。
- 并行/双线：`audit/tde-parallel-acceptance.json`（47 例 + 浏览器 6 例）。
- 原语计划：`artifacts/migration/tde/primitive-plan.json`（33/33 new done、9/9 mechanism covered、
  engineBoundary 0 卡号/0 战役名、replay 零漂移）。
- 总账：`audit/tde-migration.json` 由 `node tools/audit-tde.mjs --check` 逐字节复算。

## 3. 复算命令

```bash
node tools/audit-tde.mjs --check
node tools/audit-tde-primitives.mjs --check
node tools/replay-fixtures.mjs --compare tests/fixtures/replay/golden-replays.json
node tools/run-tests.mjs fast
```

## 4. 已知边界

- TDE 原语边界检查只针对代码字面量；注释中的跨循环说明不视为越界。
- 发布浏览器证据来自桌面 1440 / 移动 390 双视口，账本哈希逐张登记。
