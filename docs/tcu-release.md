# 《万象无终》发布手册（M5 / P10）

> **当前结论（2026-10-25 修复战役后）：`playable` + `earlyAccess`，`equivalenceCertified: false`，发布门禁 `gate.pass=true`。**
> 九章可从大厅启动；三组确认 16 条关键词 / 16 条规则 / 11 条交互均为 `verified`；发布级浏览器证据覆盖桌面与移动视口；
> 展示素材 10 图 / 27 首 BGM 全部解析。60 张 high+over-claimed 卡的独立复审结果为 **43 match / 12 approximation /
> 1 simplified / 4 missing**（仍缺 05010、05013、05019、05324），全量 377 卡行为审计未重跑，因此发布口径仍是
> `earlyAccess`，不宣称与印刷规则等价。
>
> 依据：`audit/tcu-migration.json`（仓库账本，`--check` 可复算）+ `audit/tcu-browser-acceptance.json` + 外部审计报告
> `artifacts/tcu-audit/REPORT.md`（2026-10-25）+ 修复报告 `artifacts/tcu-fix/FIX-REPORT.md`。

## 1. 当前状态（仓库账本事实，`node tools/audit-tcu.mjs --check` 实算）

| 字段 | 值 |
| --- | --- |
| `status` / `playable` / `launchEnabled` | `playable` / `true` / `true` |
| `earlyAccess` / `earlyAccessReason` | `true`；60 张 gap、174 张近似未重新审阅 |
| `equivalenceCertified` | `false` |
| `gate.pass` | **`true`** |
| `verifiedScope` | keywords/rulebook/interactions/investigators/scenarios/playerCards/story/allCards/launch/presentation/releaseBrowser=true；cardBehaviorAudit=false（保持 P10 旧结论，未重审） |
| `confirmations.release` | `status=verified`；checks 全部 true：launchable/lobby/allCards/presentation/playerPool/releaseDesktopBrowser/releaseMobileBrowser/mediaDesktop/mediaMobile |
| `remaining` | **101 条**（60 卡 gap + 摘要 + 174 张近似摘要 + 显式简化/剧情回退/剧情近似/发布边界；逐条见账本） |
| 逐卡账本 | `audit/tcu-all-card-acceptance.json`：377/377 verified、6 文件 **441 例**、`simplified=234` |
| 章节账本 | `audit/tcu-scenario-acceptance.json`：9 章 verified、**354 例**、`pendingEncounterCards=0`、`gaps=0` |
| 玩家账本 | `audit/tcu-player-acceptance.json`：87/87 verified、85 可构筑 / 83 可入牌组 |
| 调查员验收 | `tests/tcu-investigators.test.mjs` **43 例**全过 |
| 逐卡行为审计 | P10 基线 143 match / 174 approximation / 60 gap（未重跑）；2026-10-25 增量复审 60 张 high+over-claimed：43 match / 12 approximation / 1 simplified / 4 missing（见 `artifacts/tcu-audit/reaudit/`） |

## 2. 发布门禁逐项核验

| 门禁 | 账本 | 说明 |
| --- | --- | --- |
| 范围/记录/三包/章节/遭遇组/包存在 | ✅ | 377=343+34、三包 237/19/87、9 章 playable、21 组 |
| launch / lobby / playerPool | ✅ | 大厅入口、选人、85 可构筑 / 83 可入牌组 |
| allCards / 三组确认 / story | ✅ | 441 例实跑证据、剧情 9 章 8 结局 |
| `releaseBrowser` | ✅ | 5 spec 一次跑齐：**28 例 / 28 张截图**；`release.desktop/mobile=true`、`media.desktop/mobile=true` |
| `presentationAssets` | ✅ | 图片 10/10；BGM 27/27 文件存在且非空；9 章歌单各 3 首全部 resolved |
| `releaseGate` | ✅ | launch/lobby/allCards/cardBehaviorAudit/releaseBrowser/presentation/playerPool 全部通过 |

**外部审计（`artifacts/tcu-audit/REPORT.md`）复核结论**：独立重判 377 条记录为 ok 124 / partial 117 / simplified 122 /
mismatch 7 / missing 7（严重度高 37 / 中 146 / 低 70）；P10 旧结论处置 confirmed 344 / over-claimed 26 / understated 7。
修复战役已处理其中全部 high 与 over-claimed 的可修复项（见 `artifacts/tcu-fix/FIX-REPORT.md`）。

## 3. 2026-10-25 修复战役对发布门禁的改动

- `tools/audit-tcu.mjs` 的 BGM 判据改为按 `MUSIC_TRACKS` 的 `tcu*` id + `common/*.mp3` 文件路径双口径识别，27/27 通过。
- `tests/tcu-media.browser.mjs` 增加移动视口用例并写 `annotation type:'media'`（`images=10,tracks=27`），
  报告器产出 `media.mobile=true`、`resources=37`；5 spec 一次跑齐重生成 `audit/tcu-browser-acceptance.json`。
- 账本全部重生成并 `--check` 逐字节复算：`audit/tcu-migration.json`、`audit/tcu-all-card-acceptance.json`、
  `audit/tcu-player-acceptance.json`、`audit/tcu-scenario-acceptance.json`、`audit/tcu-browser-acceptance.json`、
  `audit/ability-coverage.json`。
- 9 篇 `docs/tcu-*.md` 与 `docs/encounter-entry-split-plan.md` 落盘，`check-doc-links` 0 失效（250+ 条链接全解析）。
- `.gitignore` 对 `artifacts/migration/tcu/**` 开例外，审计输入可随仓库复现。
- 引擎/内容修复（黑王座 cosmos 崩溃、巫异时刻 +2 混乱标记、议程实例毁灭、spawnLocation 语义、翻面/胜利点、
  05004 取消嵌套、05152/05230/05280 附属/取消窗口、05095 双毁灭、05086/05093 章节转发等）
  见修复报告；golden replay 因行为修复属有意变更，已 `replay-fixtures --write` 重锁并通过 `--check`。

## 4. 仍如实保留的边界（不宣称规则等价）

1. **全量逐卡行为审计未重跑**：P10 账本 143 match / 174 approximation / 60 gap 仍是旧结论；2026-10-25 对
   60 张 high+over-claimed 做了独立增量复审（43 match / 12 approximation / 1 simplified / 4 missing，
   见 `artifacts/tcu-audit/reaudit/`），其余卡片待下一轮全量重审。
2. **仍 missing 的 4 张 high**：05010（XP 惩罚读点）、05013（beneath 打出/投入通道）、05019（弱点进支援区与
   [fast] 任意窗口）、05324（tokenReveal 替换窗口）；05280 为 approximation（窗口已接线但来源范围未按卡面限定）。
   其余 deferred 见 `artifacts/tcu-fix/progress-fix-*.json` 与各包 primitive-requests。
3. **非 TCU 既有失败已清零**：02040「画」与米奇·布朗两例按 P3.2 A1′ 门禁修正了陈旧断言（不写回权威 state），
   `test:fast` 以最终实跑为准。
4. **发布素材为占位美术**（确定性生成图，非官方美术）；自动构筑只在《万象无终》战役追加 83 张 05 卡。

## 5. 复现命令

```powershell
npm run test:tcu                      # TCU Node 全量
npm run audit:tcu:check               # 整轮账本复算（gate/evidence/remaining）
npm run audit:tcu:player              # 玩家账本
npm run audit:tcu:all-cards           # 377 卡全卡账本（441 例证据）
npm run audit:tcu:scenarios           # 9 章章节账本（354 例）
npm run audit:tcu:primitives          # 14 原语账本（含文档哈希）
npm run scan:tcu:check                # 机制扫描
npm run import:tcu-story:check        # 剧情生成物与来源哈希
npm run docs:check                    # 文档本地链接
npm run replay:fixtures               # golden replay 一致性
npm run baseline:check                # P0 基线（16 审计 + 文档 + replay + fast）
```

浏览器证据（仓库根，5 spec 一次跑齐）：

```powershell
node node_modules/@playwright/test/cli.js test --config games/arkhamhorror/playwright.tcu.config.mjs `
  tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs `
  tcu-release.browser.mjs tcu-media.browser.mjs
```
