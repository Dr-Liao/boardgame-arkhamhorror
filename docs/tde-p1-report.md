# 《食梦者》P1 收尾报告：M0 范围与来源锁（2026-10-27）

> **状态口径**：P1 完成，TDE 仍是 `catalog-only`：目录、归属、来源锁与分片草案已可复算，**没有**任何章节、卡牌或调查员实现。
> 账本是 `artifacts/migration/tde/scope.json`：`artifacts/` 默认不签入，但这个文件按 `.gitignore` 的逐文件白名单放行，干净检出可直接复算（`npm run scan:tde:scope:check`）。
> 路线图见 [`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §3；前置清理与基线见 [`tde-p0-report.md`](./tde-p0-report.md)。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| 记录分区 | **388 = 352 主卡 + 36 关联面**；三包 **283 / 18 / 87**，无重叠、无遗漏 |
| 遭遇组 | **20 组 = 8 章节组 253 + 12 共享组 30**；组卡合计 **283**（249 主卡 + 34 面） |
| 8 章 | 每章 1 组、参考卡名与卡池 `name/nameZh` 逐字一致；4 个章对各含 A/B 两线各一章 |
| 印刷包 | `tde 112 / sfk 62 / tsh 41 / dsm 40 / pnr 54 / wgd 47 / woc 32`，全部复算一致 |
| 来源锁 | **43 项**（参考实现 15 + 剧情 19 + 卡表 4 + 仓内事实源 5），全部存在并锁 SHA-256；路线图原写「46 项」不可复算，以本表为准 |
| 基线 | `replay-before.json` 与 golden **13 局 / 786 步 / 799 指纹逐条一致**；规则 `n6.0`、schema 7 |
| 分片 | M1 18 / M2 22·22·22·21 / M3 章节 9 片（Search 拆主卡 36 + 面 17）+ 共享组 1 片 30 = **388，无交集** |
| M0 目录骨架 | 3 个内容包 manifest + 战役 `shared.js` + 8 章 `scenarios/<id>/index.js` 占位，全部 `catalog-only`；`content/registered.js` 未接入 |
| 命令 | `npm run scan:tde:scope` / `scan:tde:scope:check` / `scan:tde:images`，`--check` 复算一致且 `gate.pass=true` |

## 2. 账本 gate（`scope.json` 的 `gate`）

| gate | 值 | 说明 |
| --- | --- | --- |
| `records` | 388 / 388 | 与 `counts` 和三包合计一致 |
| `mainCodes` | 352，未归属 0，未知归属 0 | 主卡号 = `/^06\d{3}$/` |
| `faces` | 36，override 4 | 34 张按 `encounterCode` 归战役包；`06015a/b` 与 `06169a/b` 走显式 override |
| `packCounts` | 283 / 18 / 87 | 同时校验主卡 249/16/87 与面 34/2/0 |
| `chapterGroups` | 8 组 / 253 张 | 逐章卡数见 §5 |
| `sharedGroups` | 12 组 / 30 张 | 逐组 1–4 张 |
| `encounterGroups` | 20 组 / 283 张，唯一，无未映射、无空组 | 卡池 `encounterCode` ↔ 内容侧 id 一一对应 |
| `chapterPairs` | 4 对，全部 A+B 齐 | 章对 1–4 各含 A/B 一章 |
| `printPacks` | 7 包与印刷分布一致 | 独立于内容侧分区，防止按包误切 |
| `shards` | 索引 15 片、并集 388、交集 0 | M1/M2/M3 草案见 §6 |
| `sources` | 43 / 43 存在 | 逐文件 SHA-256；缺失即 `--check` 失败 |
| `baseline` | ids/hashes 与 golden 一致 | 13 局 / 786 步 / 799 指纹 |
| `crossCycleGroups` | 8 / 8 目录存在 | 见 §3.3 |
| `unownedFaces` | 4 / 4 已归属 | 见 §3.1 |
| `catalogOnly` | `registered=false` | `content/registered.js` 不含 TDE 导入 |

> `gitHead` 不进账本（提交会变，账本要能长期复算）：基线提交存
> `artifacts/migration/tde/reports/baseline-git-head.txt`（P0 起为 `421be477…`）。

## 3. 事实修正（相对路线图初勘口径）

### 3.1 无主双面卡：4 条显式登记，不是「两张卡没人管」

| 卡号 | 归属 | 依据 |
| --- | --- | --- |
| `06015a` / `06015b` | `tdeInvestigators`（Luke Robinson 06004） | 卡面无 `encounterCode`、调查员 `signatureCards` 未登记；按卡面 `Bonded (Gate Box)` 归调查员包（路线图 §1.1 / D6） |
| `06169a` / `06169b` | `tdeCampaign`（A Thousand Shapes of Horror） | 卡面本身有 `encounterCode=a_thousand_shapes_of_horror`；override 与 encounterCode 规则互相印证（账本 `agreesWithEncounterCode=true`） |

### 3.2 本地卡图：不是「1/388」也不是「缺 387」

`npm run scan:tde:images` 实测（清单 `artifacts/migration/tde/reports/image-inventory.json`）：

| 目录 | 覆盖 | 扩展名 |
| --- | --- | --- |
| `web/img/cards/`（英文） | **388 / 388** | avif |
| `web/img/zh/cards/`（中文） | **388 / 388** | avif |

- 远程回退字段 `imagesrc` / `backimagesrc` 覆盖 **388/388** 条记录。
- 本地卡图目录整体被 `.gitignore` 忽略（约 1.9 GB），所以**干净检出必然是 0 张**，这不是仓库缺陷；路线图 R3 的「缺图 387 条」是初勘时的本机缓存状态，已废弃。
- 结论：M5 的展示素材风险从「缺图」降级为「干净检出时依赖远程回退 / 需按需 `npm run images:fetch`」。

### 3.3 跨循环通用遭遇组：8/8 可用，`DarkCult ↔ pentagram` 由卡面证实

| 参考实现 `gather` | 仓库目录 | 被哪些章引用 |
| --- | --- | --- |
| `Set.LockedDoors` | `shared/locked_doors` | A Thousand Shapes of Horror、Waking Nightmare |
| `Set.StrikingFear` | `shared/striking_fear` | Point of No Return、Waking Nightmare |
| `Set.ChillingCold` | `shared/chilling_cold` | A Thousand Shapes of Horror、Weaver of the Cosmos |
| `Set.Ghouls` | `shared/ghouls` | A Thousand Shapes of Horror、Point of No Return |
| `Set.Rats` | `shared/rats` | A Thousand Shapes of Horror |
| `Set.AncientEvils` | `shared/ancient_evils` | Dark Side of the Moon、Point of No Return、Weaver of the Cosmos |
| `Set.Nightgaunts` | `shared/nightgaunts` | Point of No Return |
| `Set.DarkCult` | `shared/pentagram` | Where the Gods Dwell |

- `Set.DarkCult` 与 ArkhamDB 的 pentagram 组对应：该目录条目的卡池 `encounterName` 就是 **`Dark Cult`**（01169/01170/01171），不再是推断。
- `scope.json` 的 `gatherRefs` 逐章记录了参考实现的 `gather` / `gatherAndSetAside` 集合，M3 的 `requiredEncounterGroupIds` 直接以它为准。

### 3.4 `Beyond the Gates of Sleep` 确认没有 `gather`

`BeyondTheGatesOfSleep.hs` 只有 `li "gatherSets"` 声明，没有任何 `gather Set.*` 调用 → 该章遭遇牌库证据仍缺，已作为 `pending` 条目写进账本
（`beyondTheGatesOfSleepEncounterDeck`），M3 用规则书 setup 文本逐句对齐后再销账（路线图 R8）。

### 3.5 来源数：46 → 43

路线图 §1.5 写「46 个文件的 SHA-256 台账」，但初勘产物 `recon/**` 不在仓库（P0 已核实），无法复算出那 46 项。本工具的清单是**可复算的 43 项**：

| 类别 | 数量 | 代表 |
| --- | ---: | --- |
| 卡表 JSON | 4 | `cards.json`、`cards_zh-cn.json`、`cards_zh.json`、`cards_en.json` |
| 双战役后端 | 7 | `Campaigns/TheDreamEaters/{CampaignSteps,ChaosBag,Helpers,Import,Key,Meta}.hs` + `Campaign/Campaigns/TheDreamEaters.hs` |
| 8 章剧本 | 8 | `Scenario/Scenarios/TheDreamEaters/*.hs` |
| 英文剧情（自译底本） | 9 | `locales/en/theDreamEaters/{base,scenarios/*}.json` |
| 中文剧情（不完整） | 9 | `locales/zh/theDreamEaters/{base,scenarios/*}.json` |
| 中文记录标签 | 1 | `locales/zh/campaignLog.json` |
| 仓内事实源 | 5 | `src/cards/cards-data.js`、3 个包 manifest、`shared.js` |

## 4. M0 目录骨架（本轮新建）

| 路径 | 内容 | 状态 / 下游 |
| --- | --- | --- |
| `content/packs/tdeCampaign/manifest.js` | 249 主卡 + 34 面；20 组；`catalog-only` | P8 接章节与逐卡行为 |
| `content/packs/tdeInvestigators/manifest.js` | 5 调查员 + 11 专属主卡 + 2 面；`UNOWNED_FACE_OVERRIDES` 4 条 | P6（M1） |
| `content/packs/tdePlayer/manifest.js` | 87 张（含 4 张基础弱点）；`catalog-only` | P7（M2，4 片） |
| `content/campaigns/theDreamEaters/shared.js` | 8 章（id/code/name/part/pair/packCode/encounterCode）、12 共享组、20 组映射、4 模式、5 调查员 | P3/P5/P8 的唯一战役事实源 |
| `content/campaigns/theDreamEaters/scenarios/<8 id>/index.js` | 每章一个 `catalog-only` 占位（16 行） | P8 换真实模块（G11） |

- 三包**没有**接入 `content/registered.js`：账本 `gate.catalogOnly` 用源码扫描证明这一点，大厅/选人/构筑不受影响。
- 包 manifest 里的 `rulesImplemented` 全为 `false`、`deckbuilding` 全为 `false`；P6/P7 起改读逐卡账本，不手写清单。

## 5. 8 章与章对（`scope.json.chapters`）

| 章 | 参考卡 | 线 | 章对 | 印刷包 | 组（主卡+面） | 迁移难度锚点（路线图 §1.2） |
| --- | --- | --- | ---: | --- | --- | --- |
| `beyondTheGatesOfSleep` 梦境门外 | 06039 | A | 1 | tde | 24+2 | 14 种梦境 setup、幕 1–3 不抽遭遇 |
| `wakingNightmare` 清醒噩梦 | 06063 | B | 1 | tde | 21+0 | 蛛群滋生袋、蛛巢、护工替换 |
| `theSearchForKadath` 寻觅卡达斯 | 06119 | A | 2 | sfk | 36+17 | 最大章：4 区域、15 张掩藏地点 |
| `aThousandShapesOfHorror` 万千骇形 | 06168 | B | 2 | tsh | 26+2 | 183–188 纵向链、随机门分组 |
| `darkSideOfTheMoon` 月之暗面 | 06206 | A | 3 | dsm | 28+1 | 警报等级 0–5+、白船、土星猫 |
| `pointOfNoReturn` 无归之地 | 06247 | B | 3 | pnr | 25+12 | 漆黑之海掩藏地点翻面、桥梁进度 |
| `whereTheGodsDwell` 神居之所 | 06286 | A | 4 | wgd | 37+0 | 奈亚 5 形态 Hidden、6 塔 × 4 低语 |
| `weaverOfTheCosmos` 编织宇宙 | 06333 | B | 4 | woc | 22+0 | 大网纵向堆叠、阿特拉克旋转、四腿 Massive |

## 6. 分片草案（P6/P7/P8 以此为准）

| 分片 | 记录数 | 说明 |
| --- | ---: | --- |
| `M1` | 18 | 调查员包整包一片（16 主卡 + 2 面）；**豁免 20–50 张/片**：专属卡不可与调查员拆分（路线图 §9） |
| `M2-1`–`M2-4` | 22 / 22 / 22 / 21 | 玩家卡 87 张按卡号顺序四等分 |
| `M3-<chapter>` × 8 + `M3-theSearchForKadath-faces` | 26 / 21 / 36 / 17 / 28 / 29 / 37 / 37 / 22 | 章节按归属目录切；Search 53 张拆主卡 36 + 面 17 |
| `M3-shared-groups` | 30 | 12 个共享组一片（≤50） |
| 合计 | 388 | 索引两两无交集、并集 = 全部记录 |

## 7. 命令与复现

```powershell
cd games/arkhamhorror
npm run scan:tde:scope          # 写 artifacts/migration/tde/scope.json
npm run scan:tde:scope:check    # 复算 + gate + 逐字节比对
npm run scan:tde:images         # 本地卡图库存 → reports/image-inventory.json
```

`--check` 的失败语义：来源哈希变化、三包/章节/组卡数偏离、分片有交集或缺口、`replay-before` 与 golden 不一致 —— 任一发生即非零退出并打印 gate 明细。

## 8. 仍未完成（P1 之后）

| 项 | 说明 |
| --- | --- |
| P2 机制扫描 | `tools/scan-tde-mechanisms.mjs` + `mechanism-scan.json`（初勘 38 条机制待正式复算，依赖本账本） |
| 8 篇卫星文档 | `docs/tde-{primitives,rules,interactions,investigators,player-cards,scenarios,story,release}.md` —— **必须在 `plan:tde:primitives` 之前**（P0 报告的 TCU 教训） |
| `audit-baseline` 注册 | `AUDITS` 追加 `tdeScope` 需与全局 `audit/baseline.json` 重采一起做，否则 `baseline:check` 会因新增项失败（R4 未结） |
| 剧情自译 | 批次 00（术语表 + 来源锁）/ 01（序章）仍在 §13 清单里，未开工 |
| P3 骨架 | `campaign-parts` 与 D8-C adapter（协议级 spike 已在 P0 完成，见 `tde-p0-report.md` §7） |
