# 印斯茅斯暗潮 P8 发布验收记录

日期：2026-11-05。范围：六循环《印斯茅斯暗潮》（`theInnsmouthConspiracy`，工具简称 `tic`）。
阶段：P8（规范第 6 步，M5 发布）。结论：**完整发布**。战役在大厅可启动、8 章可逐章游玩，
[总审计](../../audit/tic-migration.json) 的状态计为 `playable`、`earlyAccess: false`，
`confirmations.scenarios / keywords / rulebook` 全部 `verified`，发布验收全部完成后
`equivalenceCertified: true`。

本文记录 P8 的实现内容、证据位置与复现命令。P0–P7 的过程记录见 [P7 开发验收记录](p7-development.md)；
路线图勾选见 [README](README.md)。

## 1. 生产注册与启动链路

P7 结束时 TIC 只是目录级注册（`catalog-only` 战役 + `development` 章节，大厅不可见）。P8 把
整条真实启动链路接进生产组合根：

- `content/registered.js`：静态导入 TIC 战役 manifest + 8 个 `scenarios/<id>/index.js`；三个内容包
  `ticCampaign / ticInvestigators / ticPlayer` 与战役、章节一起进入 `bundle`。旧的
  `ensureInnsmouthCatalogRegistered()` 变成返回生产战役的兼容空操作。
- `content/campaigns/theInnsmouthConspiracy/manifest.js`：`status: 'playable'`，新增 `endings`
  表（`campaignEnding` 读取）；flow / unlock / recordSchema / 混乱袋保持不变。
- `chapter-entry.js#productionChapter(id)`：用 `chapter-data.json` + `buildChapterDefinition`
  生成 `status: 'playable'` 的真实章节；manifest 带 `referenceCode`（07041/07056/07123/07163/
  07198/07231/07274/07311）、真实 layout、`requiredPackIds: ['core','notz','ticCampaign']`、
  按 `gatherSets` ∩ `ticCampaign` 遭遇组解析的 `requiredEncounterGroupIds`、已登记机制、
  记录读写表；behavior 的 setup 钩子与 P7 development 版本完全一致（58 个既有 TIC 测试依赖它）。
- 8 × `scenarios/<id>/layout.js`：以 `chapter-data.json` 的真实设置坐标（inTooDeep `grid`、
  绝望深坑 `adjacentInitialPositions`、魔鬼礁石岛屿锚点、雾中之光行列、达贡巢穴楼层、暗潮之下
  随机槽、全速恐惧公路列）为槽位表，缺省地点用确定性蛇形补齐；TIC 地点 `connections` 目前均为
  空，因此 `layout.edges` 为空，不凭空创建规则连接。客户端地图坐标为展示层，运行时连接仍由
  grid-map / 地点符号读点写入。
- 三个包 manifest 升为 `playable`：`ticCampaign` 252 条记录 `rulesImplemented: true`（引用 P7 逐卡
  账本 `recordsImplemented 252 / missing 0`）、18 个遭遇组；`ticInvestigators` 16 条（11 张签名卡
  `dependencyOnly`，不开放构筑）；`ticPlayer` 93 条（90 张可构筑 + 3 张基础弱点仅作依赖）。
- 注册期难点（已在代码注释记录）：Harper 的遭遇牌库引用夜之狂热包 01135/01136，因此场景卡包必须含
  `notz`；TIC 记录的 PascalCase 键（`TheMissionFailed` 等）不满足 `content/schema.js#refs` 的 id
  形状，场景 `recordReads/recordWrites` 只声明小写开头的记录键；跨循环复用的 `rats` /
  `agents_of_cthulhu` / `chilling_cold` 等由 core/notz 卡号覆盖，不写进 ticCampaign 的遭遇组声明。
- 启动期校验：`node tools/check-tic-registry.mjs` 校验战役/章节/包 id、参考卡、遭遇组、记录键、
  flow 图、layout、大厅可见性，退出码 0。

同轮修复的两处真实缺陷：

- **TDZ 导入环**：`chapter-entry → companions-setup → src/engine/hand-entry.js →
  content/registered.js`。`src/engine/scenario-runtime.js` 新增 `api.putInHand(seat, code)`，
  `companions-setup.js` 改走运行时 API，环断开；`chapter-entry.js` 可被独立导入。
- **01168 朦胧之雾真实遭遇崩溃**（跨战役共享卡）：`src/cards/encounter-entries/shared/chilling_cold/
  01168.js` 等条目声明 `encounterResolve(state, inv, card, api, { location })`，但
  `src/engine/treachery-tokens.js` 只传 4 参，真实抽到即抛
  `Cannot destructure property 'location' of 'undefined'`。已改为传入
  `{ location: 调查员所在地点 }`，并新增 `tests/encounter-resolve-context.test.mjs` 走真实
  `drawEncounter` 链路回归。

## 2. 逐卡与规则证据

- 逐卡账本 `audit/tic-all-card-acceptance.json`：252 张战役卡 = **251 verified + 1 no-behavior**，
  `missing=0 / blocked=0 / simplified=0`，`strictComplete: true`；记录 361 条 = 252 + 16 + 93。
- P8 收口时把 9 张 P7 遗留的 pending 原语请求按「实现 + Node 证据」逐条核验关闭（07105、07178、
  capture、harper events、holding cells、parallel acts、act/agenda deck ops、act clue objective
  的 Lead 裁决桥、07280/07281 act1BackMap 坐标）。其中 `07280/07281` 的潮水通道与达贡巢穴落位
  新增回归测试，直接由 `chapter-data.json#act1BackMap.rawMatrix` 推导并断言坐标。
- 仅剩 1 条 **重构类**维护项（`w5-07280-oath-shared-rules`：三张达贡幕共用正面模板工厂）登记在
  总审计 `maintenance`，不改变任何卡牌行为，也不阻止发布。
- 既有合规门禁：`cards:check` / `cards:encounter-check` / `audit:entries`（R1/R2/R3）通过；
  `node tools/audit-abilities.mjs --check`（engineCodes=0 / effectsEntries=0 / escapeCards=0）通过。

## 3. Node 验收

- 总审计 Node 证据：`audit/tic-node-acceptance.json`，13 个测试文件 **234/234 通过**、
  `sourceStableDuringRun: true`。
- P8 新增专项：
  - `tests/tic-p8-registration.test.mjs`（6 例）：生产注册与大厅可见性、layout 完整、遭遇组/记录键/
    机制/混乱袋/flow。
  - `tests/tic-p8-campaign.test.mjs`（19 例）：真实大厅八章走查（区域守恒、幕间序列、升级购买、
    记录与混乱袋跨章）、失败/撤退路线、雾中之光多结局、达贡巢穴奥西罗斯分支、暗潮之下并行幕 +
    闪回 XIV、哈珀指控 0/1/2、条件记忆与闪回、四档难度混乱袋逐 token 核对、存档恢复（章节中/
    待决选择/幕间升级窗）逐字节一致、同种子回放确定性。
  - `tests/tic-p8-multiplayer.test.mjs`（11 例）：四真人 / 1 真人 + 3 AI、AI 真实动作回合、
    逐席位观察隐私（手牌/牌组/私有卡/隐藏答案/私有事件）、权限边界、回合交棒、共享幕间确认、
    断线恢复（四席位视图 + 合法动作 + 待决选择一致）。
  - `tests/replay-tic-p8.test.mjs`（4 例）：TIC P8 回放基线的 id/配方一致性、8/8 章节覆盖、
    四难度 + 失败路线、逐局哈希一致。
- 分层守卫：`tests/suite-manifest.test.mjs` 通过；上述新文件均登记在 `tests/suites.mjs`
  与 `tests/node-suite.mjs`。

## 4. Replay

- 新增 TIC 专属回放基线 `tests/fixtures/replay/tic-p8-baseline.json`：**13 局 / 853 步 / 866 指纹**，
  覆盖 8 章阶梯（含全部幕间与哈珀准备/雾前升级窗）、四档难度、失败路线。
  golden `tests/fixtures/replay/golden-replays.json` 与 `REPLAY_RECIPES` **未改动**；
  `node tools/replay-fixtures.mjs --check` 仍是 13/13。
- 证据：`node tools/verify-tic.mjs --p8-replay` → `audit/tic-p8-replay.json`
  （`status: passed`、`sourceStableDuringRun: true`、replay exit 0、8/8 章节、fixture sha256 记录）。
- 既有 13 局基线零行为变化：`--compare tests/fixtures/replay/tic-p7-baseline.json` 13 局 / 797 步逐条一致。

## 5. 真实大厅浏览器验收

一次完整运行覆盖 3 个 P8 spec（桌面 1440×950 / 移动 390×844）：

```powershell
node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tic-release.config.mjs
```

结果：**6/6 通过**，`audit/tic-release-browser.json` = `status: passed`、`sourceStableDuringRun: true`、
`complete: true`、30 张截图全部存在（sha256/bytes 校验）、`sourceFiles` 与当前源码一致；
`audit/tic-release-acceptance.json` = `passed`、`gate.pass: true`、12/12 检查、截图 30/30、
章节 8/8。零注入，全部走真实大厅 HTTP 通路：

- **发布门禁**（`tests/tic-release.browser.mjs`）：大厅战役下拉出现「印斯茅斯暗潮」→ 选 4 席位 →
  `/api/start` 得到 campaign id → 局外页面 → 关卡选择 8 章（1 可用 / 7 锁定）→ 战役总览三包
  「可玩」与 `/api/catalog` 版本/状态 → 真实选人 07001 玛丽修女 + 自动牌组 + 确认（其余 AI 座位
  自动准备）→ 出发页「绝望深坑」→ 开始关卡 → 牌桌 scenario=`thePitOfDespair`、手牌/地点存在、
  执行一次真实 `/api/move` → F1 规则书 10 条 TIC 规则与章节正文。全程无 pageerror / console error /
  横向溢出。
- **战役推进**（`tests/tic-progression.browser.mjs`）：真实调试控制台「经验 3 / 结束这关」→
  scenarioResult → 幕间 I（不可升级）→ 哈珀准备升级窗（真实 `/api/move` hubPurchase +
  hubConfirmUpgrades，经验扣减）→ 关卡选择显示第一章已完成、第二章可选 → 开始第二章牌桌；
  再跳至终章并以失败结局收束到 campaignResult。中段章节使用调试跳关，章节内规则由 Node
  逐章/回放测试覆盖，浏览器侧证明的是「真实大厅的推进、升级、收束」链路。
- **双人联机**（`tests/tic-online.browser.mjs`）：进程内中转服务 + 两个大厅，两名真人 07001/07002
  建局、准备、队长、开始；双方投影 campaign/scenario 一致、两张牌桌可见、逐座位手牌隐私、
  非应答座位命令被拒且 revision 不变、刷新后会话恢复（revision 一致）。

浏览器证据的旧链（P3 规则书 + P7 八章指南 38 例 / 68 截图）保持独立、未被本次改动覆盖。

## 6. 全量门禁与跨循环

复核命令（在 `games/arkhamhorror/` 执行）与结果：

```powershell
node tools/run-tests.mjs fast          # 6393 tests / 6390 pass / 0 fail / 3 skip
node --test tests/suite-manifest.test.mjs
node tools/build-card-index.mjs --check && node --test tests/card-entries.test.mjs
node tools/build-encounter-index.mjs --check && node --test tests/encounter-entries.test.mjs
node tools/audit-card-entry-compliance.mjs --check   # R1/R2/R3 条目合规
node tools/audit-abilities.mjs --check               # engineCodes=0 effectsEntries=0 escapeCards=0
node tools/import-scenario-guides.mjs --check   # 54 scenarios verified
node tools/import-tic-story.mjs --check         # 8 chapters + base; 348 translated supplements; complete
node tools/check-doc-links.mjs --json           # files 39 / links 125 / broken 0
node tools/build-presentation.mjs --check       # drift []
node tools/scan-tic-scope.mjs --check           # 复算一致
node tools/scan-tic-mechanisms.mjs --check      # 复算一致
node tools/audit-tic.mjs --check                # 复算一致（发布账本）
node tools/audit-tic-scenarios.mjs --check      # 8/8 章 12/12
node tools/audit-tic-all-cards.mjs --check      # 252 条 gate 完整
node tools/audit-tic-release.mjs --check        # 复算一致
node tools/audit-tde.mjs --check                # 复算一致（gate pass）
node tools/audit-tcu.mjs --check                # 复算一致（gate pass）
node tools/scan-tcu-scope.mjs --check           # 复算一致
node tools/replay-fixtures.mjs --check          # 13/13
```

跨循环说明：P8 改了 `content/registered.js`、`content/scenario-guides.js`、`web/deck-rules.js`、
`web/scenario-music.js`、`src/engine/scenario-runtime.js`、`src/engine/treachery-tokens.js` 等共享文件，
按仓库约定重建了 TDE / TCU 账本（`audit-tde --write`、`audit-tcu-player --write` + `audit-tcu --write`），
两本 `--check` 均复算一致、无行为变化。TIC 自身的历史 frozen baseline
（`tic-p4/p5/p6/p7-baseline.json`）未改写。

卡图与远程回退（P8 第 5 项）：本循环 361 条记录在 `web/img/cards/` 与 `web/img/zh/cards/` 的本地
缓存为 76 个卡号（运行期按需下载），全部 361 条都有 `imagesrc` 远程回退字段；运行时只读取
`web/img/**` 与 `cards-data` 的远程地址，不依赖 `参考资源/`（审计静态扫描 runtime 入口，
0 条运行时绑定引用；文中注释提及不算依赖）。`npm run images:verify` 的本地库存不足是仓库既有状态
（全仓库缺 12k+ 本地图），发布口径不要求全量本地图，按远程回退运行。

## 7. 已披露限制与维护项

1. `w5-07280-oath-shared-rules`：三张达贡幕的正面模板仍是三份手写声明（同句规则只写一次口径的
   重构候选），行为测试覆盖，登记为 `maintenance`，不阻塞发布。
2. `content/scenario-guides.js` 的 TIC 设置说明为 P8 补写；完整指南正文仍以
   `web/scenario-guides/<id>.json`（54 关生成校验）为准。
3. `web/campaign-presentation.js` 暂无 TIC 专属主题/战役插画，走 COMMON 回退（不产生 404）；
   `web/scenario-music.js` 已补 8 章播放列表（复用既有曲库，不新增音频）。
4. 浏览器推进证据中段章节使用调试跳关（上文已披露）；联机证据覆盖页面重载后的会话恢复，
   未覆盖中转服务整体重启（该场景在仓库内无法低成本复现）。

## 8. 最终账本

以 `audit/tic-migration.json` 为准：`status: playable`、`playable: true`、`launchEnabled: true`、
`earlyAccess: false`、`equivalenceCertified: true`、`releaseAcceptance.required` 全 true、
`releaseAcceptance.deferred: []`、`remaining: []`、`gate.releaseGate.pass: true`；
`node tools/audit-tic.mjs --check` 与 `node tools/audit-baseline.mjs --check` 复算一致。
`audit/baseline.json` 在发布收口时按两遍协议重采（先记录审计快照，再在总审计 `baseline.retaken`
翻为 true 后收口），保持 `milestone: "P10"` 以不改写 TDE 账本口径。
