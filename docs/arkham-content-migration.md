# Arkham 内容迁移规范

本文定义《诡镇奇谈：卡牌版》扩展循环的通用迁移格式。核心原则是：目录收录、规则实现、验收确认和正式开放彼此独立；不得因为卡牌已有数据或图片就将内容标记为可玩。

## 1. 权威来源

每轮迁移必须锁定以下来源及 SHA-256，不直接修改参考资源：

- 卡牌字段：`参考资源/ArkhamHorror-main/frontend/public/cards*.json`，通过现有卡牌导入管线进入 `catalog/` 和 `src/cards/cards-data.js`。
- 规则行为：`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/`。
- 中文剧情：`参考资源/ArkhamHorror-main/frontend/src/locales/zh/<campaign>/`。
- 卡图：统一使用 `games/arkhamhorror/web/img/arkham/cards/` 和 `web/img/arkham/zh/cards/`，并保留现有远程回退；不得创建循环专属卡图目录或手工改名副本。

审计报告必须记录来源根目录、相对路径、哈希和资源策略。来源发生变化时，`--check` 必须失败，人工审阅后才能重写报告。

## 2. 实现规矩（迁移必须遵守）

迁移不只是把卡文变成代码，还必须把行为放进正确的层。以下规矩与重构路线一致；完整条文见
[`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md) §3、§7，稳态架构见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。

- **行为唯一入口**：新卡行为写在 `src/cards/card-abilities.js` 的描述子（`abilities` / `modifiers` / `elderSign`）。不得向 `card-effects.js` 的 `EFFECTS` 增加新条目，不得在 `engine.js` 按卡号、关卡名或战役名新增分支。
- **新机制先走通用层**：卡面写不下时，先扩 `ability.js` / `windows.js` / `matcher.js` / `modifiers.js` 的通用能力，再写卡。新窗口必须同时完成注册、调用点接线与测试——注册不等于接线。
- **非玩家卡走 `encounter-abilities.js`**：敌人、地点、幕／议程、剧情支援与威胁的常驻规则写成带 `scope` 的描述子（Phase 3 · D1），引擎按场上实体枚举，读点是 `entityModifierTotal` / `entityRuleActive`；**不要**再往关卡 `behavior.js` 加按卡号的分支，也不要在引擎里加卡号判断。
- **通道必须登记**：迁移范围内的每张卡在审计账本里记录通道状态 `descriptor | legacy | hybrid | missing` 与证据路径；`missing` 会让该章的 `literalCardBehavior` 保持 `false`。
- **规则层不读策略**：不得引入"谁在操作这个座位"的分支（例如按 `humanSeats` 自动跳过可选反应）；这类判断由大厅注入。
- **可重放**：迁移新增的状态字段必须进 `save-migration.js` 的版本迁移，并保证 JSON 存读档往返一致；行为改动要用 replay 基线证明"行为零变化"——迁移前 `node tools/replay-fixtures.mjs --baseline <文件>`，迁移后 `--compare <文件>`（见 [`phase4-replay.md`](phase4-replay.md) §4）。
- **简化必须显式**：未逐条还原的卡写 `simplified: true` + `note` 并留在待实现清单，不得用"看起来一样"的实现静默通过验收。

迁移完成的证据是三个指标**不增加且逐批下降**：`engine.js` 的卡号字面量、`EFFECTS` 条目数、战役逃生原语卡数。当前基线见重构路线 §1。

## 3. 目标目录

每个循环使用以下结构：

```text
games/arkhamhorror/
├─ content/
│  ├─ campaigns/<campaign>/
│  │  ├─ manifest.js
│  │  ├─ shared.js
│  │  ├─ chapters.js
│  │  ├─ story-text.js                 # 剧情开始迁移后建立
│  │  ├─ encounter-rules.js            # 存在跨章遭遇规则时建立
│  │  └─ scenarios/<scenarioId>/
│  │     ├─ index.js
│  │     ├─ definition.js              # 复杂章节按需拆分
│  │     ├─ layout.js
│  │     └─ behavior.js
│  └─ packs/
│     ├─ <cycle>Campaign/manifest.js
│     ├─ <cycle>Investigators/manifest.js
│     └─ <cycle>Player/manifest.js
├─ audit/<cycle>-migration.json
├─ tests/<cycle>-migration.test.mjs
└─ tools/audit-<cycle>.mjs
```

阶段说明、截图和执行日志放在仓库根目录 `artifacts/`；不得放入游戏运行目录。历史试点包只在确有独立行为边界时保留，不为保持目录数量而创建空包。

## 4. 迁移阶段

### M0：目录与来源基线

- 登记卡号范围、章节顺序、真实剧本提示卡号和初始混乱袋。
- 将战役牌、调查员依赖和玩家卡无重叠分区。
- 每章建立独立 `scenarios/<scenarioId>/index.js`。
- 所有内容保持 `catalog-only`，大厅、选人和构筑不得开放。

### M1：调查员

- 迁移构筑选项、牌组要求、主能力、旧印、专属卡与专属弱点。
- 自动构筑和手动构筑使用同一服务端规则。
- 每位调查员通过初始化、能力、依赖、存档恢复和负面路径测试后，才可加入选人列表。

### M2：玩家卡

- 逐卡登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐等行为。
- 每张开放卡必须有行为测试和审计账本证据。
- 目录卡不能仅凭卡文解析进入构筑或升级池。

### M3：剧本

- 按章节迁移布置、遭遇区域、放在一边区域、地点连接、幕／议程、敌人、诡计、剧本行动、混乱符号、结局和跨关记录。
- 章节可以单独处于 `development`，但战役在所有章节确认前保持不可启动。

### M4：关键词与规则书

- 从本循环所有卡面和规则来源提取关键词、时机词和循环专属机制。
- 已有关键词必须确认引擎行为仍适用于本循环卡牌；新增关键词必须实现规则、测试和规则书条目。
- 循环专属规则必须能从相关卡牌、地点、幕／议程和规则目录直达。

### M5：发布

- 完成完整合法路线、失败路线、存档恢复、多人／AI、桌面和移动端浏览器验收。
- 剧本、关键词和规则书三个确认组全部为 `verified` 后，才允许将战役及依赖包提升为 `playable`。
- `playable` 表示本 Mod 的已声明实现范围可玩；若未逐条等价，不得标记或描述为规则等价认证。

## 5. 剧本迁移确认

每章必须在迁移审计的 `confirmations.scenarios.items` 中独立记录以下布尔检查：

- `sourceLocked`：剧本、地点及必要卡牌来源已锁定。
- `identityRegistered`：真实卡号、名称和章节身份已登记。
- `setupAndZones`：准备、遭遇牌库、放在一边、移除、胜利区和可选遭遇组守恒。
- `actsAndAgendas`：全部幕／议程、推进条件、背面效果和剧本行动已实现。
- `locationsAndConnections`：地点正反面、随机变体、连接和离场行为已实现。
- `encounterBehaviors`：敌人、诡计、剧情资产和共享遭遇组行为已实现。
- `literalCardBehavior`：已逐张、逐能力严格核对卡面字面需求；每个时机、费用、目标、区位、限制、成功／失败分支、持续效果和离场条件都有可执行路径及测试证据。
- `chaosEffects`：四档提示卡与符号时机已实现。
- `resolutionsAndRecords`：结局、经验、创伤、奖励、混乱袋及战役记录已实现。
- `storyText`：完整导入并只展示实际到达的序章、导入、结局、幕间和尾声，不泄露未触发或私密分支。
- `saveReplay`：合法动作在 JSON 保存／恢复后确定性一致。
- `browserAcceptance`：真实大厅流程及桌面、移动端界面通过。

全部检查为真且附有测试或审计证据路径时，该章才能标为 `verified`。定向夹具不能替代真实大厅路线。

### 5.1 完整叙事迁移规则

- `story-text.js` 必须由锁定的中文剧情来源生成；运行时不得依赖 `参考资源/`，也不得用手写摘要替代原文。
- 迁移范围必须覆盖战役序章、每章导入、全部结局、幕间、条件信息段和尾声。准备步骤、奖励和记录写入仍由规则引擎执行，不得混入叙事正文。
- 运行时只能投影已经到达的分支。条件导入使用进入该章时的战役记录，结局使用实际结局键，幕间使用该次访问保存的选择；仅指定调查员可见的正文必须经过座位级过滤。
- 每个战役必须提供可重复执行的 `tools/import-<campaign>-story.mjs --write/--check` 生成器。来源或生成物漂移时，检查必须失败并要求人工审阅。
- `storyText` 审计不得只检查字符串非空。至少要验证每章存在导入正文、每个可达结局键存在正文、生成文本不含 HTML 控制标记，并由测试证明未触发分支不会出现在观察视图中。
- 旧存档若只保存了摘要，读取时应以该次访问保存的记录重建完整正文；已经保存的完整历史正文不得被当前战役记录改写。

### 5.2 卡牌字面功能严格审查

事故备忘（2026-10-16）：03185《约束衣》虽然已收录卡文并在遭遇结算代码中出现，仍因未登记主动能力而无法触发；同次复核还发现 03059、03091、03094、03301、03332 和 02316–02319 存在相同类别的缺口。由此确认：卡号出现在 definition、behavior、`implemented*` 清单或测试源码中，均不能单独证明卡牌功能已实现。

今后每轮迁移必须建立逐卡能力清单，并按以下要求审查：

- 同时检查正面、背面、关联面、升级版和在不同剧本中的复用状态；不得只确认卡牌已进入牌库、放在一边区或运行时定义。
- 将每段卡文拆为显现、强制、反应、免费触发、行动、持续修正、目标／限制、目标条件和离场规则；逐项关联到 legal move、执行分支和状态清理路径。
- 核对卡牌实际区位及牌类语义，包括威胁区、调查员支援区、地点／敌人附属区、槽位占用、控制权、不可离场和弃牌归属。
- 核对全部费用及限制，包括行动数、资源、线索、使用次数、横置、伤害／恐惧、每轮／每局限制、地点与控制者限制；非法状态不得显示操作入口。
- 成功、失败、取消、无合法目标、多份同名卡、跨地点触发、议程推进、调查员被击败及保存／恢复都必须有覆盖。
- 测试必须至少证明合法行动会出现、非法行动不会出现、执行后的状态与卡面一致。仅搜索卡号、检查 `rulesPending:false`、检查文本非空或确认函数源码包含卡号，一律不能作为 `literalCardBehavior` 的充分证据。
- 任何简化、近似或未覆盖分支都必须进入待实现清单，并将 `literalCardBehavior` 保持为 `false`；不得继续标记为逐条验收或规则等价。

`literalCardBehavior` 是通用迁移硬门槛。新增循环和重新生成的既有循环报告均必须包含该字段；缺失该字段时，`content/migration-confirmation.js` 必须拒绝报告。

## 6. 关键词迁移确认

每个关键词或时机词必须在 `confirmations.keywords.items` 中记录：

- 来源中出现该词的代表卡号。
- 它是已有通用机制，还是本循环新增机制。
- `sourceInventoried`：卡面与规则来源已盘点。
- `engineBehavior`：权威引擎行为已实现，不能只由前端解释。
- `nodeAcceptance`：成功、失败、时机冲突和存档恢复有 Node 测试。
- `rulebookEntry`：规则书存在准确条目或明确关联到已有条目。
- `cardLinks`：相关卡文和详情可以跳转到规则条目。

新增关键词即使只有少量卡使用，也不能并入“卡牌特殊效果”后跳过独立确认。

## 7. 规则书迁移确认

每个循环的 `confirmations.rulebook` 必须确认：

- `campaignOverview`：战役结构、记录和发布边界。
- `scenarioMechanics`：循环及章节专属机制。
- `keywordEntries`：新增关键词和必要的已有关键词关联。
- `cardLinks`：相关卡牌、地点、幕／议程均能直达正确条目。
- `desktopBrowser`：桌面规则目录、搜索、关联跳转和返回。
- `mobileBrowser`：移动端阅读、滚动、关闭和卡牌返回。

规则书描述必须以当前实现为准，不能把未实现的原版规则写成已经可用。规则条目、关联 ID、拼音索引和浏览器验收必须同时提交。

## 8. 审计状态与发布门槛

通用校验器位于 `content/migration-confirmation.js`。审计报告必须包含：

- `confirmations.scenarios`
- `confirmations.keywords`
- `confirmations.rulebook`

状态只有 `pending` 和 `verified`。校验器根据检查项计算应有状态，拒绝手工把不完整项目写成 `verified`；任何确认组未完成时，拒绝 `playable: true`。

## 9. 最低验证命令

每轮至少提供并执行：

```powershell
npm run test:<cycle>
npm run audit:<cycle>
npm run replay:fixtures   # golden replay 基线没被无意改动（行为零变化）
npm test
npm run presentation:check
```

批量迁移（改卡行为）时另加 `tools/replay-fixtures.mjs --baseline/--compare` 的临时基线对比，见
[`phase4-replay.md`](phase4-replay.md) §4。完整发布还必须运行相关大厅、浏览器、联机和图片库存验证。
若全量回归存在既有失败，迁移报告必须明确区分新增失败与可复现的既有漂移。
