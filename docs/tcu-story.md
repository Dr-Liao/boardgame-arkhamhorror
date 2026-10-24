# 《万象无终》剧情手册（M3-C）

> 范围：中文剧情生成器与锁定的 10 个来源 JSON；生成物 [`content/campaigns/theCircleUndone/story-text.js`](../content/campaigns/theCircleUndone/story-text.js)（945 行，内嵌 10 个来源 SHA-256）。运行时**不读 `参考资源/`**，只读生成物；来源或生成物漂移时 `--check` 失败并要求人工审阅。
>
> 账本：[`audit/tcu-migration.json`](../audit/tcu-migration.json) 的 `confirmations.story`（9 项检查全真、status `verified`）：生成器/Node/章节/序章/幕间/结局/尾声/流程图/隐私。命令：`npm run import:tcu-story:check`、`npm run test:tcu:story`（18 例）。

## 1. 来源与生成器

- 生成器：[`tools/import-tcu-story.mjs`](../tools/import-tcu-story.mjs)。来源根 `参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/`，共 10 个文件：`base.json` + `scenarios/<id>.json` × 9（章节 id 与 [shared.js](../content/campaigns/theCircleUndone/shared.js) 的 chapters 顺序一致）。
- 命令：`npm run import:tcu-story`（`--write` 生成）、`npm run import:tcu-story:check`（重新读来源逐字节复算 SHA-256，来源变更即失败）。
- 生成物只含「已到达分支可展示」的叙事正文；来源中的 HTML 标签/准备步骤/奖励/记录写入不混入正文（准备与记录仍由规则引擎执行）。
- 去重与中文名：22 张大阿卡纳按 `TheFool0 … TheWorldXXI` 顺序；4 位故事调查员按卡号与中文名对照；两条来源为英文的结局正文（union r9、bbt r6）原样导入，不冒充中文。

## 2. `TCU_STORY_TEXT` 形状

| 字段 | 内容 |
| --- | --- |
| `source` / `generatedBy` / `sourceHashes` | 来源根、生成器、10 个来源文件的 SHA-256 |
| `prologue` | 标题「死亡只是开始」、`sections.body/intro/quote`、4 位故事调查员引言、22 条塔罗结果 |
| `introductions` | 9 章导入正文 |
| `resolutions` | 9 章 × 结局分支（1/6/4/3/4/4/11/5/7，共 45 个键） |
| `interludes` | 4 段幕间：I 失踪人口记录、II 进步的代价、III 核心圈、IV 扭转命运（含分支段落与 `labels`） |
| `endings` | 8 个战役结局（吞食宇宙/加入吹笛人/黑书签名/逆转咒语/阿撒托斯沉睡/女巫集会/秘社/永不被见） |
| `epilogue` | 尾声标题与段落 |
| `fallbacks` | 4 条显式回退（见 §5） |

## 3. 分支与流程

- `manifest.flow` 是「序章 → 9 章 → 幕间二/三/四 → 尾声 → 结束」的纯 JSON 节点链（34 个节点、9 个章节节点、14 个剧情节点），由 `validateCampaignGraph` 校验。
- 节点条件只读进入时机的战役记录/结局键：`recordOf(...)`、`resolutionOf(...)`、`includes/union`；未触发分支不写进「调查纪事」（`src/campaign/story.js` 按到达分支投影）。
- 幕间二：按 Josef 记录（失踪/被救/生还）与选择（拒绝/同意/撒谎）分支；幕间三：按核心圈路径（得知真相/加入/未加入/欺骗）；幕间四：结算 `twistOfFate`（含 expert 混乱标记按参考代码 -6，卡面写 -7，已登记近似）。
- 选择/经验/混乱标记/记录写入统一走 [`src/campaign/campaign-effects.js`](../src/campaign/campaign-effects.js) 的 `crossOffMementos` / `storyQuestions` / `twistOfFate`，剧情文本本身不改状态。

## 4. 隐私与投影

- 序章引言与 22 条塔罗结果只进 `campaign.privateStories`，经 `campaignView` / `campaignStory(observerSeat)` 按座位过滤；不进入 `scenarioIntro`，不泄露给其他座位。
- 正文由 `src/campaign/story.js` 投影：章节导入取进入章节时记录，结局取实际结局键，幕间取该次访问保存的选择；旧存档若只存摘要，读取时按当次访问记录重建正文。
- 观察投影只下发公开段落；私密段落按座位过滤（`confirmations.story.privacy` 三项检查全真）。

## 5. 显式回退与显式近似

回退（4 条，账本 `story.fallbacks`）：`atDeathsDoorstep/noResolution`、`theWagesOfSin/noResolution`（来源清洗后为空，回退为可读摘要）、`unionAndDisillusion/r5`（来源只有 basic 分支指针，回退为规则摘要）、`beforeTheBlackThrone/noResolution`（来源无该键，回退为调查员被击败正文）。

近似（5 条，账本 `story.approximations`）：幕间二 `price1/price2` 由在役调查员 traits 含 SilverTwilight 决定；幕间四 expert 混乱标记 -6（卡面 -7）；尾声展示 `survivedTheWatchersEmbrace` 后不真正划掉该记录；ReturnTo 内容不导入（排除 returnToResolution4 与重返版占卜）；P8 已有的 88 条 `scenarioApproximations` 继续有效（P9 不减少）。

## 6. 验收

- 生成物一致性：`import:tcu-story:check` 逐字节复算 10 个来源哈希；来源/生成物任一变化即失败。
- 剧情测试 18 例：生成物一致性、逐章导入正文/结局、分支互斥、幕间效果、旧存档不重写、私密投影、流程图节点。
- 账本检查（`confirmations.story.checks`）：generator/nodeAcceptance/chapters/prologue/interludes/endings/epilogue/flow/privacy 全真；`flow.nodes=34`、`epilogue.title/sections` 校验通过。
- 改剧情时：先更新锁定来源（不得运行时读参考资源）→ `import:tcu-story --write` → 审阅 diff → `--check` + `test:tcu:story` → 重跑 `audit:tcu --check`。

## 7. 边界

- 剧情 `verified` 只表示「本 Mod 导入并投影的文本/分支」通过检查，不代表印刷剧情逐字等价（两条英文来源、4 条回退、5 条近似已登记）。
- `story-text.js` 是生成物，禁止手改；任何手改都会被 `--check` 判为漂移。
- 战役入口已 `playable`，但发布门禁整体未过（`gate.pass=false`）；剧情补写/修复后需重跑 `audit:tcu` 更新账本，见 [发布手册](./tcu-release.md)。
- 真实大厅→序章→牌桌路径由 `tests/tcu-release.browser.mjs` 覆盖；9 章实机路径由 `tests/tcu-scenarios.browser.mjs` 覆盖，二者不替代剧情分支的 Node 断言。

## 8. 相关手册与维护

- 剧情来源属于「锁定参考资源」，不在本仓库内修改；换版时更新 `tools/import-tcu-story.mjs` 的来源清单与 `sourceHashes` 的复核说明，再跑 `--write` / `--check`。
- `manifest.flow` 的节点增删会同时影响 `src/campaign/campaign-flow.js` 与 `validateCampaignGraph`；改流程后必须重跑 `test:tcu:story` 与 `npm run audit:tcu:scenarios`。
- 章节内 P8 摘要（`INTRO/SETUP/RESOLUTION_*`）与 P9 全局生成物是两份数据：前者供章节定义直接引用，后者供运行时按到达分支投影；改文案时两处都要过审阅，不能只改一份。
- 相关手册：[剧本手册](./tcu-scenarios.md)、[迁移路线图](./tcu-migration-roadmap.md)、[发布手册](./tcu-release.md)、[迁移规范](./arkham-content-migration.md) §5.1。

## 附录：复核要点

- 本文数字取自 `TCU_STORY_TEXT` 的实际导入结果与账本 `confirmations.story`；10 个来源的哈希见生成物的 `sourceHashes`（`base.json` + `scenarios/<id>.json` × 9）。
- 复核命令：`npm run import:tcu-story:check`、`npm run test:tcu:story`、`npm run audit:tcu:check`。
- 已知来源限制：`参考资源/` 只读；union `r9`、bbt `r6` 两条来源本身为英文，原样导入、不重写为中文。
- 本文不复制剧情正文，避免与生成物重复维护；需要引用原文时以 `story-text.js` 与锁定来源为准。
- 生成物含 `generatedBy: tools/import-tcu-story.mjs` 与来源根路径，便于定位漂移来源；运行时不读 `参考资源/`。
- 章节定义里的 INTRO/SETUP 摘要（P8）与 P9 全文的键名/顺序必须一致，改一处要跑两处测试。
- 幕间/结局的 `labels` 只供 UI 显示选择文本，不参与规则判定；记录写入仍走 `campaign-effects`。
- 剧情测试/审计结果写进 `remaining` 与 `confirmations.story`，不以截图或人工阅读替代 Node 断言。
