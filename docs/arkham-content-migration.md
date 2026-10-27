# Arkham 内容迁移规范

本文定义《诡镇奇谈：卡牌版》扩展循环的通用迁移格式。核心原则是：目录收录、规则实现、验收确认和正式开放彼此独立；不得因为卡牌已有数据或图片就将内容标记为可玩。

执行顺序固定为 §4 的六步：**扫描新增机制 → 拆分原语 → 实现关键字与规则手册 → 实现新增交互与界面 → 多子进程批量迁移卡牌（原语请求排队）→ 测试与验收**。M0–M5 是内容阶段与产物范围，不是执行顺序。

## 1. 权威来源

每轮迁移必须锁定以下来源及 SHA-256，不直接修改参考资源：

- 卡牌字段：`参考资源/ArkhamHorror-main/frontend/public/cards*.json`，通过现有卡牌导入管线进入 `catalog/` 和 `src/cards/cards-data.js`。
- 规则行为：`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/`。
- 中文剧情：`参考资源/ArkhamHorror-main/frontend/src/locales/zh/<campaign>/`。
- 卡图：统一使用 `games/arkhamhorror/web/img/cards/`（英文）与 `games/arkhamhorror/web/img/zh/cards/`（中文），并保留现有远程回退（卡面 `imagesrc`／`backimagesrc`）；不得创建循环专属卡图目录或手工改名副本。

审计报告必须记录来源根目录、相对路径、哈希和资源策略。来源发生变化时，`--check` 必须失败，人工审阅后才能重写报告。

## 2. 实现规矩（迁移必须遵守）

迁移不只是把卡文变成代码，还必须把行为放进正确的层。以下规矩与稳态架构一致；完整条文见
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) §3–§9。

- **行为唯一入口**：新卡行为写在单卡文件里（一张卡一个文件，`export default` 恰好一个条目）。玩家卡写 `src/cards/entries/<code>.js`；非玩家卡按归属写 `src/cards/encounter-entries/`（通用 `shared/`、战役共用 `<campaign>/_shared/`、关卡专用 `<campaign>/<scenario>/`）。不得向 `card-effects.js` 的 `EFFECTS` 增加新条目，不得在 `engine.js` 按卡号、关卡名或战役名新增分支，不得恢复 `card-abilities.js` / `encounter-abilities.js` 条目或 `BATCH_*` / `MIGRATED_*` 批次大数组。
- **先原语、后卡牌**：每轮迁移先扫描新增机制并拆分原语，再批量写卡。卡牌只能使用已登记的原语；需要新原语时按 §4.6.3 的队列向主进程申请，不得由子进程直接改引擎。
- **新机制先走通用层**：卡面写不下时，先扩 `ability.js` / `windows.js` / `matcher.js` / `modifiers.js` / `targets.js` / `play-condition.js` / `effect-state.js` 的通用能力，再写卡。新窗口必须同时完成注册、调用点接线与测试——注册不等于接线。
- **新增交互先于批量卡牌**：新的选择、目标、提示、面板与动画必须在卡牌批量迁移前完成，并复用 `web/` 的现有组件、CSS 变量与交互模式；不允许在卡牌批次里边写卡边临时拼界面。验收必须覆盖桌面 1440 与移动端 390，见 §4.5。
- **剧本卡行动必须标明归属**：幕／议程卡面上印着的 `[action]` / `[free]` 行动（包括引擎自带的「探索」）必须通过关卡数据的 `scenario.scriptCards` 或显式 `scriptCard` 标成 `act` / `agenda`，牌桌才会把它放在剧本书对应卡片旁；只出现在通用动作栏视为迁移缺口。声明方式与验收见 §4.5.1。
- **多进程写入边界**：批量迁移由主进程 + 多个子进程完成；子进程只写分给自己的单卡文件（玩家卡 `entries/<code>.js`，非玩家卡 `encounter-entries/<归属目录>/<code>.js`），不得改 `entries/index.js`、`encounter-entries/index.js`、任一本 `_shared.js` / `_lookup.js`、两个聚合入口、`src/engine/`、`content/`、`docs/`、`audit/`。索引由主进程在合并时统一重建，见 §4.6。
- **非玩家卡一卡一文件**：敌人、地点、幕／议程、剧情支援与威胁的常驻规则写成带 `scope` 的描述子（Phase 3 · D1），引擎按场上实体枚举，读点是 `entityModifierTotal` / `entityRuleActive`。落点按使用范围分三档：跨战役 → `encounter-entries/shared/<encounterGroup>/`；同一战役跨关卡 → `encounter-entries/<campaign>/_shared/<encounterGroup>/`；只在单关卡 → `encounter-entries/<campaign>/<scenario>/`。**不要**再往关卡 `behavior.js` 加按卡号的分支，也不要在引擎里加卡号判断，更不要把条目写回 `encounter-abilities.js` 单文件。
- **通道必须登记**：迁移范围内的每张卡在审计账本里记录通道状态 `descriptor | legacy | hybrid | missing` 与证据路径；`missing` 会让该章的 `literalCardBehavior` 保持 `false`。
- **规则层不读策略**：不得引入"谁在操作这个座位"的分支（例如按 `humanSeats` 自动跳过可选反应）；这类判断由大厅注入。
- **可重放**：迁移新增的状态字段必须进 `save-migration.js` 的版本迁移，并保证 JSON 存读档往返一致；行为改动要用 replay 基线证明"行为零变化"——迁移前 `node tools/replay-fixtures.mjs --baseline <文件>`，迁移后 `--compare <文件>`（见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md#53-重放撤销与迁移对比)）。
- **简化必须显式**：未逐条还原的卡写 `simplified: true` + `note` 并留在待实现清单，不得用"看起来一样"的实现静默通过验收。

迁移完成的证据是三个指标**不增加**（已经为 0 的保持 0）：`engine.js` 的卡号字面量、`EFFECTS` 条目数、战役逃生原语卡数。当前基线见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9。

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
├─ src/cards/entries/<code>.js       # 玩家卡一卡一文件（子进程只写自己分到的文件）
├─ src/cards/entries/index.js        # 生成索引（只由主进程重建）
├─ src/cards/encounter-entries/
│  ├─ shared/<group>/<code>.js       # 跨战役通用（一卡一文件）
│  ├─ <campaign>/_shared/<group>/<code>.js  # 战役内跨关卡
│  ├─ <campaign>/<scenario>/<code>.js       # 关卡专用
│  ├─ _shared.js / _lookup.js        # 跨卡工具 / 跨条目查询（主进程独占）
│  └─ index.js                       # 生成索引（只由主进程重建）
├─ audit/<cycle>-migration.json
├─ tests/<cycle>-migration.test.mjs
└─ tools/audit-<cycle>.mjs
```

迁移运行目录放在仓库根目录 `artifacts/migration/<cycle>/`。默认不签入；若某个 `--check` 在干净检出中必须读取生成前的范围/机制/原语输入，可以在 `.gitignore` 中**逐文件白名单**最小复算集（通常仅 `scope.json`、`mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`）。不得放开整个循环目录，`workers/`、`primitive-requests/`、日志、截图、临时报告与 replay 过程文件始终不签入：

```text
artifacts/migration/<cycle>/
├─ scope.json                  # 卡号范围、来源哈希、基线与分片
├─ mechanism-scan.json         # 第 1 步：新增机制扫描
├─ primitive-plan.json         # 第 2 步：原语复用/新增计划
├─ primitive-catalog.json      # 主进程维护的原语快照（worker 只读）
├─ primitive-requests/         # 子进程写入的请求（每个请求一个 JSON）
├─ workers/<worker>.json       # 子进程进度/阻塞/产出清单
└─ reports/                    # 合并、队列、验收报告
```

阶段说明、截图和执行日志放在仓库根目录 `artifacts/`；不得放入游戏运行目录。历史试点包只在确有独立行为边界时保留，不为保持目录数量而创建空包。

逐文件白名单的实际写法（TDE 起采用；git 的负向规则要求先放开父目录，再只放行 4 个复算输入）：

```gitignore
artifacts/*
!artifacts/migration/
artifacts/migration/*
!artifacts/migration/tde/
artifacts/migration/tde/*
!artifacts/migration/tde/scope.json
!artifacts/migration/tde/mechanism-scan.json
!artifacts/migration/tde/primitive-plan.json
!artifacts/migration/tde/primitive-catalog.json
```

改完必须用 `git check-ignore -v <path>` 逐条验证：4 个复算输入不应命中忽略规则，`reports/`、`workers/`、`primitive-requests/`、日志与截图必须仍被忽略。

## 4. 迁移执行顺序（唯一）

迁移按以下六步执行，顺序不可交换：

```text
锁定范围 → 扫描新增机制 → 拆分原语 → 实现关键字与规则手册
        → 实现新增交互与界面 → 批量迁移卡牌（多子进程 + 原语队列） → 测试与验收
```

M0–M5 是内容阶段与产物范围（§4.8），不是执行顺序；扫描、原语、关键字、交互都可以在 M0 锁定范围后开始，不必等全部剧本迁完。

### 4.1 第 0 步：锁定范围与基线

- 锁定卡号范围、章节顺序、真实剧本提示卡号和初始混乱袋；记录来源路径与 SHA-256。
- 把战役牌、调查员依赖和玩家卡做无重叠分区；每张卡只属于一个批次分片。
- 记录迁移前基线：`node tools/replay-fixtures.mjs --baseline artifacts/migration/<cycle>/replay-before.json`，并保存当前 `git rev-parse HEAD`。
- 产物：`artifacts/migration/<cycle>/scope.json`（范围、来源哈希、基线、分片草案）。
- 门禁：来源哈希可复现；迁移前 golden replay 基线逐条一致。局数／步数／指纹数以 `--baseline` 实测写入 `replay-before.json` 的值为准，**不在文档里手写**（TDE P0 实测为 13 局 / 786 步 / 799 指纹，规则 `n6.0`）；范围外卡不得进入本轮。

### 4.2 第 1 步：扫描新增机制

先扫描，不写卡。扫描对象包括本循环全部卡面、规则来源、剧情、提示卡和参考实现行为，输出**机制条目**而不是代码：

```json
{
  "mechanisms": [
    {
      "id": "willpower-evade",
      "source": "04029 意志闪避 / 04271",
      "type": "primitive",
      "cards": ["04029", "04271"],
      "existing": false,
      "note": "现有 evade 只接受 agility，需要指定技能"
    },
    {
      "id": "exploration-deck",
      "source": "TFA 规则书",
      "type": "keyword+scenario",
      "cards": ["04050", "04285"],
      "existing": false
    }
  ]
}
```

- `type` 至少覆盖 `primitive`（引擎动作/读点）、`keyword`（关键词/时机词）、`rulebook`（规则条目）、`interaction`（选择/目标/提示/面板）、`scenario`（章节流程）、`content`（纯数据/文案）。
- 每个机制条目必须列出代表卡号、来源、是否已有通用实现、缺口和候选原语。
- 同一机制合并去重；同一张卡可以关联多个机制。
- 未知机制默认**阻断**，不得用近似卡文实现静默过关。
- 产物：`artifacts/migration/<cycle>/mechanism-scan.json`。
- 门禁：本轮迁移范围内每张卡至少出现在一个机制条目；未分类卡为 0；`type=primitive` 的条目全部进入下一步。

### 4.3 第 2 步：拆分原语

把上一步的机制拆成**窄原语**，先实现通用层，不写卡：

- 先盘点已有原语：`src/engine/effects.js` 的 `EFFECT_PRIMITIVES`、`ctx.api` 的 `api-*.js`、`ability.js` 的 `kind`、`matcher.js` 组合子、`targets.js` 的目标枚举、`play-condition.js` 的打出条件。能在现有原语里组合出来的，不新增。
- 需要新增时，一个原语只做一件事：动词 + 参数 + 目标 + 持续时间 + 成功/失败分支；不要把整张卡的规则塞进一个 `carcosaPlayer` 式大原语。
- 每个新原语必须同时具备：
  1. 通用实现（`effects.js` / `api-*.js` / `ability.js` / `modifiers.js` 等，按所属层）；
  2. 注册期校验（参数形状、未知目标、未知窗口在加载时失败）；
  3. Node 单测：正常、无合法目标、费用不足、存档往返；
  4. 文档条目（写入本轮 `primitive-plan.json` 的 `docs` 字段；稳定原语再补到引擎模块注释或 `docs/card-entry-files.md`）；
  5. 对既有卡的行为零变化（replay 对比）。
- 数据表达不了、且只服务一张卡的一次性逻辑，允许留在 `resolve(ctx)` 逃生口，但必须在 `primitive-plan.json` 的 `escape` 里登记卡号与理由；不得把可复用的原语写成 `resolve` 来绕过队列。
- 产物：`artifacts/migration/<cycle>/primitive-plan.json`：

```json
{
  "reuse": [{ "primitive": "draw", "cards": ["01001"] }],
  "new": [{
    "id": "evadeWithSkill",
    "params": { "skill": "willpower", "moveAfterEvade": true },
    "api": "api.evade(seat, { enemyId, skill, moveAfterEvade })",
    "tests": ["tests/phase2-primitives.test.mjs"],
    "docs": "docs/arkham-content-migration.md#43-第-2-步拆分原语",
    "status": "done"
  }],
  "escape": [{ "card": "03157", "reason": "替换/防止管线尚未交付" }]
}
```

- 门禁：所有 `new` 原语 `status=done` 且有测试；`reuse` 的引用在 `EFFECT_PRIMITIVES` / `ctx.api` 中可查；`escape` 只含单卡逻辑；`engine.js` 无卡号分支；`npm run test:fast` 无新增失败。

### 4.4 第 3 步：实现关键字与规则手册

- 对 `type=keyword` 的机制：实现引擎行为、窗口/时机、成功失败分支、存档恢复，并写 Node 测试；已有关键词要确认在本循环卡牌上仍然成立。
- 对 `type=rulebook` 的机制：写规则书条目、关键词索引、卡文直达和桌面/移动端阅读路径；规则描述只写规则本身，不写引擎入口、实现状态、界面操作或审计路径。未实现的机制不建条目，也不在规则书里描述为当前可用。
- 每个关键词/规则条目关联代表卡号；卡牌批量迁移时只能引用已经 `verified` 的关键词 id。
- 产物：`confirmations.keywords`、`confirmations.rulebook` 的检查项与测试/审计证据路径。
- 门禁：新增关键词与规则条目全部 `verified`；规则书桌面/移动端浏览器用例通过；未确认的关键词不得在卡牌文件里使用。

### 4.5 第 4 步：实现新增交互逻辑与界面一致性

批量写卡之前，先把新机制需要的新交互做完。交互包括：选择目标、选择卡牌/地点/敌人、多选、顺序排列、确认/取消、危险操作提示、空状态、不可用原因、动画与音效。

- **复用现有界面**：只使用 `web/` 已有的组件、CSS 变量、间距/字号/圆角/颜色/动画；不得为新卡在 `public/` 或大厅写卡号分支，也不得用写死颜色/字号的内联样式临时拼一个“能点就行”的面板；动态位置/尺寸必须复用既有布局变量。
- **数据通路**：交互状态由服务端 `requestChoice` / `presentation-state` / 观察投影产生；浏览器只提交合法动作，不复制规则判定。私有候选、手牌、牌库顺序不得进入其他座位投影。
- **状态齐全**：可用、不可用（带原因）、空候选、提交中、失败重试、取消后回到原状态；键盘/触屏都可操作。
- **视觉一致**：新面板与相邻面板使用同一套 token 和布局节奏；桌面 1440×900、移动端 390×844 各至少一张截图；截图放在 `test-results/` 或 `artifacts/`，不放进运行目录。
- **美化标准**：间距、字号、颜色、圆角、阴影、动画时长与相邻界面一致；新增按钮/选项不得比现有控件更小或更拥挤；桌面与移动端各检查一次，不允许“功能能用但看起来像另一个游戏”。
- **浏览器验收**：新增交互在卡牌批次前先跑对应 Playwright 用例；至少覆盖桌面和移动端各一条真实操作路径。
- 产物：交互组件/样式、`presentation-state` 字段、浏览器测试、截图。
- 门禁：桌面/移动端浏览器用例通过；新交互与既有界面的间距/字号/颜色一致；无卡号 UI 分支；新增颜色/字号/间距来自既有 token；隐私投影断言通过。

#### 4.5.1 剧本卡行动归属（scriptCard）

幕／议程卡面上印着的 `[action]` / `[free]` 能力（包括引擎自带的「探索」）必须能在剧本书
对应卡片旁直接执行；只在通用动作栏里出现，视为该章 `actsAndAgendas` 未完成。

- **归属标记**：行动带 `scriptCard: 'act' | 'agenda'` 时，`table-regions.js` 把按钮放在剧本书
  对应卡片旁，`card-interactions.js` 给该卡发光与点击入口，`observation.js` 也只保留这两类
  剧本行动提示。`scriptCard: 'location' | 'enemy'` 只喂 AI 计划，不占剧本区；**地点、敌人、
  剧情支援赋予的行动不要标成幕／密谋**（用 `locationId` / `enemyId` 表达归属）。
- **声明位置**：关卡定义（`definition.js`，没有独立定义文件的章节用其 `index.js`）里写
  `scenario.scriptCards`，由 `src/engine/script-cards.js` 作为唯一读点：
  - `explore: { card: 'act' | 'agenda' }`：声明引擎自带的探索行动归哪张当前剧本卡；
    只有部分幕／密谋印着探索时加 `codes: ['04057', '04058']`，当前卡不在清单里就返回 `null`。
  - `rules: { <rule>: 'act' | 'agenda' }`：按 `scenarioAction` / `encounterAction` 的 `rule`
    声明归属（撤退、取遗物、翻面等）。只在部分剧本卡上印着时写
    `{ card: 'act', codes: ['03324'] }`，当前卡不在清单里就返回 `null`。
  - `scenarioAction` / `encounterAction` 已带显式 `scriptCard` 时优先保留（例如献祭丽塔的
    `scriptCard: 'enemy'`）。不要在 `behavior.js` 里加新的 `scriptCardFor` 命令式钩子：行为层
    行数只减不增，归属属于关卡数据而不是流程逻辑。
- **只看当前卡**：当前幕／议程不印该行动时返回 `null`（例如《埃兹特里的覆灭》幕 3 不再探索，
  不能因为前一幕印过就继续留在幕卡旁）。
- **不可执行也要可见**：条件不满足时仍通过 `behavior.actions()` 返回带 `reason` 的提示；
  引擎自带行动（探索）由 `scriptActionHints` 在 `scriptCards.explore` 命中时补一条提示。牌桌显示
  带原因的禁用按钮，不允许整条消失，也不允许回落到通用动作栏。
- **验收**：Node 测试至少断言 `legalMoves`、`scriptActionHints` 与
  `viewState(...).scriptActions` 三处的 `scriptCard`，并断言地点／敌人行动未被误标；
  Playwright 走真实大厅流程，桌面 1440 与移动 390 各验证：按钮位于剧本书对应卡片旁、
  卡片发光、点击提交服务端公开动作。参考 `tests/script-card-ownership.test.mjs` 与
  `tests/script-actions-tfa.browser.mjs`。

### 4.6 第 5 步：批量迁移卡牌（多子进程 + 原语队列）

卡牌迁移拆成「主进程 + N 个子进程」。主进程是唯一的共享文件写者，子进程只写自己分到的单卡文件。
本文定义的是**协议**，不绑定某个固定工具名；本轮还没有专用编排器时，主进程脚本按 §4.6.2–§4.6.6
直接 spawn worker 也算合规，但必须留下 `shards.json`、worker 报告、原语队列报告与合并报告。

#### 4.6.1 角色与写入边界

| 角色 | 可以写 | 绝对不写 |
| --- | --- | --- |
| 主进程 / 编排器 | `src/engine/**`、`entries/_shared.js`、`entries/index.js`、`encounter-entries/_shared.js`、`encounter-entries/_lookup.js`、`encounter-entries/index.js`、两个聚合入口、`phase5-codes.js`、`docs/**`、`audit/**`、`content/**`、`artifacts/migration/**` | 子进程分到的单卡文件（除非接管/返工） |
| 子进程 worker | 自己分到的单卡文件（`src/cards/entries/<code>.js` 或 `src/cards/encounter-entries/<归属目录>/<code>.js`）、自己的 `artifacts/migration/<cycle>/workers/<id>.json`、`primitive-requests/*.json` | 两个 `index.js`、任一本 `_shared.js` / `_lookup.js`、两个聚合入口、`src/engine/**`、`content/**`、`docs/**`、`audit/**`、其他 worker 的卡文件 |

补充规则：

- 子进程创建卡文件时使用 `node tools/scaffold-card.mjs <code> --entry --no-index`（玩家卡）或
  `node tools/scaffold-card.mjs <code> --encounter --no-index`（非玩家卡），或直接按模板写文件；
  **不得运行** `build-card-index.mjs` / `build-encounter-index.mjs`。
- 索引由主进程在所有分片合并后**只重建一次**（两个索引都重建）；子进程各自重建索引会造成顺序/覆盖冲突。
- 子进程不做跨卡重构：需要改 `_shared.js`、`_lookup.js`、`matcher.js`、`ctx.api` 时，一律走原语请求队列（§4.6.3），由主进程实现。
- 任何两个 worker 不得写同一个 `code`；编排器在启动前检查分片交集为空。
- 非玩家卡的分片按**归属目录**（战役/关卡/遭遇组）切，而不是按 scope 切；同一目录内保持 20–50 张一片。

#### 4.6.2 分片

- 按卡号区间、内容包或调查员分组切分，每片 20–50 张；同一张卡只进一片。
- 分片清单写入 `artifacts/migration/<cycle>/shards.json`，含 `worker`、`codes[]`、起始/结束时间、输入快照哈希。
- worker 启动时读取只读快照：`primitive-catalog.json`、`mechanism-scan.json`、`primitive-plan.json`、本轮卡牌清单。
- 已存在且内容未变的单卡文件跳过（幂等）；内容冲突或文件不在自己的分片里则报错退出。
- 编排方式：主进程读 `shards.json`，用 `node:child_process` 的 `spawn` 为每个 worker 启动独立 Node 进程
  （cwd 固定 `games/arkhamhorror/`，stdout/stderr 落到 `artifacts/migration/<cycle>/workers/<id>.log`）。
  一个 worker 崩溃只重跑该分片，不影响其他 worker；没有编排器时，主进程脚本按同一份 `shards.json` 顺序 spawn 也符合本协议。

#### 4.6.3 原语请求协议

子进程遇到现有原语表达不了的卡面时，**不要停在那里等，也不要改引擎**：

1. 写一个请求文件到 `artifacts/migration/<cycle>/primitive-requests/<request-id>.json`（先写 `.tmp`，再原子 rename）；
2. 把该卡标记为 `blocked`，继续迁移同片其他卡；
3. 在批次末尾或每 N 张卡后轮询 `primitive-requests/` 的 `status` / `primitive-catalog.json`；
4. 主进程标记 `done` 后，重新实现该卡；标记 `rejected` 时按 `resolution.suggestion` 改用现有原语或 `resolve`，仍无法表达则留给主进程人工处理。

请求文件：

```json
{
  "schemaVersion": 1,
  "id": "w03-04029-willpower-evade",
  "cycle": "tfa",
  "worker": "w-03",
  "card": "04029",
  "primitive": "evadeWithSkill",
  "params": { "skill": "willpower", "moveAfterEvade": true },
  "cardText": "[action] 花费 1 充能：躲避。本次躲避使用 willpower……",
  "reason": "现有 evade 原语只接受 agility，无法指定技能",
  "proposedApi": "api.evade(seat, { enemyId, skill, moveAfterEvade })",
  "status": "pending",
  "createdAt": "2026-10-21T12:00:00+08:00"
}
```

主进程写回同一文件（状态机 `pending → claimed → done | rejected`）：

```json
{
  "status": "done",
  "claimedBy": "main",
  "resolution": {
    "api": "api.evade(seat, { enemyId, skill, moveAfterEvade })",
    "implementedIn": ["src/engine/api-clue.js"],
    "tests": ["tests/phase2-primitives.test.mjs"],
    "catalog": "primitive-catalog.json#evadeWithSkill",
    "notes": "skill 缺省为 agility；moveAfterEvade 只在成功时移动"
  }
}
```

队列规则：

- **只由主进程实现**：主进程读 pending，按 `(primitive, stableStringify(params))` 去重；相同请求合并为一个实现，多个 worker 共享结果。
- **先查已有原语**：能组合已有原语就回 `done` 并给出用法，不新增代码。
- **实现顺序**：通用层 → 注册期校验 → Node 测试 → 原语目录 → 回写 `done`；任何一步失败都回 `rejected` 并给出替代方案，不允许“先标 done 再补测试”。
- **不得改卡**：主进程不编辑 worker 分到的卡文件；只改共享层。
- **队列可恢复**：请求文件是纯 JSON、状态可重放；主进程崩溃后重新扫描 `pending/claimed` 即可继续；`claimed` 超时回到 `pending`。
- **审计**：队列统计（请求数、去重数、done/rejected、平均等待）写入 `artifacts/migration/<cycle>/reports/primitive-queue.json`，最终验收引用。

#### 4.6.4 子进程循环

```text
读取分片与只读快照
  → 对每张卡：匹配已有原语
      ├─ 能表达：写单卡文件（玩家卡 entries/<code>.js / 非玩家卡 encounter-entries/<归属>/<code>.js）→ node --check / 结构检查 → 记录 done
      └─ 不能表达：写 primitive request → 记录 blocked → 继续下一张
  → 本轮结束：轮询队列
      ├─ done：重新实现 blocked 卡
      └─ rejected：按建议改用现有原语/resolve，或保留 blocked 交主进程
  → 写 workers/<id>.json（done/blocked/requests/files/耗时）
  → 退出（不重建索引、不跑全量测试）
```

- 子进程的 `node --check`/结构检查只验证语法、单一 `export default`、`code` 与文件名一致、没有禁止 import；**不**加载完整引擎，也**不**注册/跑行为测试（这些由主进程合并后统一做）。
- 子进程可被中断后 `--resume`：已完成且哈希一致的文件跳过；`blocked` 卡保留请求 id，不重复发请求。
- 子进程超时/崩溃：主进程只回收该 worker 的分片，不碰其他分片；未写请求的卡回到待分配。

#### 4.6.5 主进程处理

1. 启动前：保存 `git rev-parse HEAD` 与共享文件哈希；检查分片无交集；生成 `primitive-catalog.json` 快照。
2. 运行期间：只处理原语队列与共享层；按 §4.6.3 回写；每处理完一批请求，更新 `primitive-catalog.json` 并通知/让 worker 轮询。
3. 合并前：检查每个 worker 的 `git status`/文件清单只包含自己的分片；发现越界写入直接拒绝该 worker 产物。
4. 合并：收集所有单卡文件（`entries/<code>.js` 与 `encounter-entries/<归属目录>/<code>.js`）；逐文件校验文件名/`code`/单一 default/禁止 import；重建 `entries/index.js` 与 `encounter-entries/index.js`；运行 `npm run cards:check` 与 `npm run cards:encounter-check`。
5. 行为门禁：`replay-fixtures --compare` 与迁移前基线逐条一致；若本轮有意新增行为，必须单独记录差异并在验收报告中说明。
6. 收尾：更新 `audit/<cycle>-migration.json`、`cards:audit:write`、队列报告、分片报告。

#### 4.6.6 合并、索引与冲突

- 索引只由主进程重建；worker 的 `--no-index` 是硬要求。
- 同一 `code` 出现两份文件 → 合并失败，回到分片阶段；不允许“后写覆盖”。
- 目标单卡文件已存在且不在本轮变更清单 → 视为冲突，主进程人工确认后才能替换。
- 子进程不得修改 `_shared.js`；需要新 helper 时放进自己的卡文件，确属跨卡复用再走原语请求由主进程提升到 `_shared.js`。

#### 4.6.7 失败、重试与回滚

- 单卡失败不阻塞分片：记录 `failed` 与原因，继续其他卡；主进程最后统一重试或转人工。
- 原语请求 `rejected` 不是失败：按建议改写；仍无法表达则把卡留在 `blocked` 清单，不计入本轮 `done`。
- 回滚以卡文件为单位：删除/还原单个单卡文件并重建对应索引即可；不得回滚整个共享层来“撤销一张卡”。
- 共享层改动必须单独提交/记录，便于把“原语实现”与“卡牌批量”分开审查。

#### 4.6.8 批次验收

| 检查 | 通过标准 |
| --- | --- |
| 分片完整性 | 每个 `code` 恰好一个 worker；无交集、无遗漏 |
| 写入边界 | worker 只改自己的单卡文件与自己的 `artifacts/migration/` 记录；无 `index.js`/engine/docs/audit 变更 |
| 单卡文件 | 文件名=`code`、单一 default、无禁止 import；非玩家卡归属目录符合扫描规则 |
| 索引 | 主进程重建两个索引各一次，`cards:check` 与 `cards:encounter-check` 全绿 |
| 原语队列 | 无 `pending`/`claimed` 悬挂；`done` 的原语都有测试；`rejected` 都有替代方案 |
| 行为 | `replay-fixtures --compare` 一致；`test:fast` 无新增失败（既有失败以 `artifacts/migration/<cycle>/reports/baseline.md` 的记录为准，未记录按 0 条计；TDE P0 实测 0 条） |
| 审计 | `audit/<cycle>-migration.json` 的通道/证据更新；`cards:audit` 指标不倒退 |
| 报告 | `reports/workers.json`、`reports/primitive-queue.json`、`reports/merge.json` |

#### 4.6.9 示例：一张卡走完队列

1. worker `w-03` 读到 04029，发现 `evade` 只接受 agility → 写 `w03-04029-willpower-evade.json`，卡标 `blocked`，继续 04271/04199。
2. 主进程去重后发现没有 `evadeWithSkill` → 在 `api-clue.js` 增加 `skill` 参数、补 `phase2-primitives.test.mjs`、更新 `primitive-catalog.json`，回写 `done`。
3. worker 轮询到 `done`，按 `resolution.api` 写 `entries/04029.js`，`node --check` 通过，标 `done`。
4. 主进程合并全部分片，重建索引，跑 `cards:check`、replay、fast，写批次报告。

### 4.7 第 6 步：测试与验收

按阶段跑，不要等最后一次性补：

| 阶段 | 必跑 | 通过标准 |
| --- | --- | --- |
| 原语 | 新原语单测 + `npm run test:fast` | 新原语覆盖正常/无目标/费用不足/存档往返；无新增失败 |
| 关键字/规则书 | `npm run audit:<cycle>` + 规则书浏览器 | 关键词/规则条目 `verified`；桌面/移动端可读、可跳转 |
| 交互 | Playwright 桌面 1440 / 移动 390 | 新交互可用、不可用原因、空状态、取消/重试；视觉与既有界面一致 |
| 批量卡牌 | `cards:check` + replay + `test:fast` | 索引一致；行为零变化；无新增失败 |
| 发布 | `npm run test:<cycle>`、`npm run replay:fixtures`、`npm test`、`npm run presentation:check`、浏览器回归 | 三组确认 `verified`；无新增失败；既有失败单独记账 |

最终报告必须区分：本轮新增失败、可复现的既有失败、`blocked` 卡与未完成原语。任何 `blocked`/`rejected` 都不能写成“已迁移”。

### 4.8 内容阶段 M0–M5（产物范围，不是执行顺序）

#### M0：目录与来源基线

- 登记卡号范围、章节顺序、真实剧本提示卡号和初始混乱袋。
- 将战役牌、调查员依赖和玩家卡无重叠分区。
- 每章建立独立 `scenarios/<scenarioId>/index.js`。
- 所有内容保持 `catalog-only`，大厅、选人和构筑不得开放。

#### M1：调查员

- 迁移构筑选项、牌组要求、主能力、旧印、专属卡与专属弱点。
- 自动构筑和手动构筑使用同一服务端规则。
- 每位调查员通过初始化、能力、依赖、存档恢复和负面路径测试后，才可加入选人列表。

#### M2：玩家卡

- 逐卡登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐等行为。
- 每张开放卡必须有行为测试和审计账本证据。
- 目录卡不能仅凭卡文解析进入构筑或升级池。

#### M3：剧本

- 按章节迁移布置、遭遇区域、放在一边区域、地点连接、幕／议程、敌人、诡计、剧本行动、混乱符号、结局和跨关记录。
- 章节可以单独处于 `development`，但战役在所有章节确认前保持不可启动。

#### M4：关键词与规则书

- 从本循环所有卡面和规则来源提取关键词、时机词和循环专属机制。
- 已有关键词必须确认引擎行为仍适用于本循环卡牌；新增关键词必须实现规则、测试和规则书条目。
- 循环专属规则必须能从相关卡牌、地点、幕／议程和规则目录直达。

#### M5：发布

- 完成完整合法路线、失败路线、存档恢复、多人／AI、桌面和移动端浏览器验收。
- 剧本、关键词和规则书三个确认组全部为 `verified` 后，才允许将战役及依赖包提升为 `playable`。
- `playable` 表示本 Mod 的已声明实现范围可玩；若未逐条等价，不得标记或描述为规则等价认证。

## 5. 剧本迁移确认

每章必须在迁移审计的 `confirmations.scenarios.items` 中独立记录以下布尔检查：

- `sourceLocked`：剧本、地点及必要卡牌来源已锁定。
- `identityRegistered`：真实卡号、名称和章节身份已登记。
- `setupAndZones`：准备、遭遇牌库、放在一边、移除、胜利区和可选遭遇组守恒。
- `actsAndAgendas`：全部幕／议程、推进条件、背面效果和剧本行动（含 `scriptCard` 归属，见 §4.5.1）已实现。
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

规则书只写规则本身：基础规则置顶并默认打开，条目不得出现引擎、实现、界面操作、审计状态或代码路径。未实现的机制不建条目，不以“当前可用”描述规则；可用性由大厅与桌面呈现，不由规则书承担。规则来源、关联 ID、拼音索引和浏览器验收必须同时提交。

## 8. 审计状态与发布门槛

通用校验器位于 `content/migration-confirmation.js`。审计报告必须包含：

- `confirmations.scenarios`
- `confirmations.keywords`
- `confirmations.rulebook`

状态只有 `pending` 和 `verified`。校验器根据检查项计算应有状态，拒绝手工把不完整项目写成 `verified`；任何确认组未完成时，拒绝 `playable: true`。

新增交互（目标/卡牌/地点选择、多选、排列、确认、空状态、不可用原因）还必须有桌面 1440 与移动 390 的浏览器用例和截图；只有 Node 测试不能算交互完成。原语队列、分片报告和交互截图路径应在迁移报告里可查。

## 9. 最低验证命令

每轮至少提供并执行（按 §4.7 的阶段顺序）：

```powershell
npm run cards:check                         # 单卡文件 / 索引 / 禁止批次大文件
npm run test:fast                           # 原语、关键字、卡牌逻辑；新增失败必须为 0
node tools/replay-fixtures.mjs --baseline artifacts/migration/<cycle>/replay-before.json
node tools/replay-fixtures.mjs --compare  artifacts/migration/<cycle>/replay-before.json
npm run test:<cycle>
npm run audit:<cycle>
npm run replay:fixtures                     # golden replay 基线没被无意改动
npm test
npm run presentation:check
npm run test:browser                        # 新交互与规则书桌面/移动端（Playwright）
```

批量迁移（改卡行为）时另加 `tools/replay-fixtures.mjs --baseline/--compare` 的临时基线对比，见
[`../ARCHITECTURE.md`](../ARCHITECTURE.md#53-重放撤销与迁移对比)。完整发布还必须运行相关大厅、浏览器、联机和图片库存验证。
若全量回归存在既有失败，迁移报告必须明确区分新增失败与可复现的既有漂移；`blocked`/`rejected`
的卡和原语必须单列，不能计入已完成。
