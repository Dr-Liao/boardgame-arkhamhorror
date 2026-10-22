# 非玩家条目拆分：现状扫描与修改方案

> 日期：2026-10-22。状态：**方案待执行**。范围：`src/cards/encounter-abilities.js` 的 529 条
> 非玩家条目（敌人/诡计/地点/幕/议程/剧情资产/威胁）。
> 规矩条文已同步到 [`AGENTS.md`](../AGENTS.md)、[`ARCHITECTURE.md`](../ARCHITECTURE.md)、
> [`card-entry-files.md`](card-entry-files.md)、[`card-model.md`](card-model.md)、
> [`arkham-content-migration.md`](arkham-content-migration.md)。本文只讲**怎么改**与**为什么这样改**。

---

## 0. 摘要

| 项 | 现状 | 目标 |
| --- | --- | --- |
| 存放 | 1 个文件 `encounter-abilities.js`（约 7,100 行 / 307 KB） | 529 个单卡文件 + 1 个生成索引 |
| 目录 | 无（全部平铺在一个数组里） | `encounter-entries/` 下三档：`shared/`、`<campaign>/_shared/`、`<campaign>/<scenario>/` |
| 聚合 | 文件即数据（`NON_PLAYER_ABILITY_ENTRIES` 数组） | 文件降级为 facade；索引是生成物 |
| 归属 | 无归属元数据；只有 `scope` | 每张卡有唯一落点；守卫按算法校验 |
| 迁移期写入 | 单文件（单写者） | 文件级并行（多子进程互不冲突） |
| 硬编码基线 | `cardLayerCodes` 642 个键；本文件含 543 个唯一卡号（与其他文件重叠 1 个） | 迁移后约 **100**（其余在 `card-effects.js` 等） |

**不动的东西**：`content/campaigns/**/definition.js` 的关卡数据、`cards-data.js` 的 5,930 张卡面、
`behavior.js` 的剧本流程、两个聚合入口的**旧导出签名**。

---

## 1. 现状扫描

扫描器：`artifacts/encounter-entry-split/scan.mjs`（只读；输出 `inventory.json`）。
复现命令：

```bash
cd games/arkhamhorror
node artifacts/encounter-entry-split/scan.mjs
```

> 下面是 **2026-10-22 20:30 左右的快照**（529 条）。仓库还有并行改动，迁移前必须重跑扫描，
> 以当时的 `inventory.json` 与条目顺序为准；本文的分布表用于评审结构，不作为迁移输入。

扫描以 `content/registered.js` 的 29 个已注册关卡为真值来源，读取每个关卡的
`definition.js`（locations/acts/agendas/enemies/treacheries/storyAssets）与 manifest zones，
把条目 code、`cards-data.originalCode`、`scenarioReferences.ruleId` 都当作匹配 token。

### 1.1 条目构成

| scope | 条目数 | 其中含函数 | 纯数据 |
| --- | ---: | ---: | ---: |
| location | 162 | 124 | 38 |
| treachery | 125 | 109 | 16 |
| enemy | 89 | 42 | 47 |
| act | 71 | 71 | 0 |
| agenda | 68 | 68 | 0 |
| storyAsset | 14 | 3 | 11 |
| **合计** | **529** | **417** | **112** |

- 文件约 **7,100 行**（2026-10-22 20:37 快照 7,076 行）：条目区从第 659 行开始，顶部 **658 行 / 52 个顶层 helper**。
- 条目不是静态数据表：`encounterResolve` 109、`locationRule` 136、`actRule` 72、`agendaRule` 68，
  大量条目带闭包。拆分必须做**源码切片**，不能运行时序列化（会丢闭包）。
- 当前有 **4 处跨条目查询**（全部在条目区）：`nonPlayerEntryFor(...)`（02043 / 03137，约 1004 / 2780 行）
  与 `NON_PLAYER_ABILITY_ENTRIES.some(...)`（03124 / 03125，约 2907 / 2919 行）。
- `encounter-abilities.js` 被 **12 个文件** import：
  `card-rules.js`、`engine.js`、3 个关卡 `behavior.js`、4 个测试、3 个工具。facade 必须保留这些导出：
  `NON_PLAYER_ABILITY_ENTRIES` / `NON_PLAYER_ABILITY_CODES` / `nonPlayerEntryFor` / `originalOf` / `victoryVengeance`。

### 1.2 归属分布（按“卡被几个关卡使用”）

| scope | 关卡专用 | 战役共用 | 跨战役通用 | 合计 |
| --- | ---: | ---: | ---: | ---: |
| enemy | 50 | 33 | 6 | 89 |
| location | 151 | 10 | 1 | 162 |
| treachery | 58 | 51 | 16 | 125 |
| act | 71 | 0 | 0 | 71 |
| agenda | 66 | 2 | 0 | 68 |
| storyAsset | 13 | 1 | 0 | 14 |
| **合计** | **409** | **97** | **23** | **529** |

无未归属条目。4 个别名条目（`huntingNightgaunt` / `yithianObserver` / `onWingsOfDarkness` /
`falseLead`）按“跟随同名印刷卡”规则归位；其中 `falseLead` 原本只命中午夜假面，跟随 `01136` 后进
`shared/arkham/`，与印刷卡同档。

### 1.3 关卡专用条目分布（29 关，28 关有条目）

| 战役 | 关卡（条目数） |
| --- | --- |
| 夜之狂热 | 午夜假面 3、吞噬者之下 6（集结 0） |
| 敦威治遗产 | 课外活动 18、四叶草俱乐部 13、米斯卡塔尼克博物馆 22、埃塞克斯郡快车 21、血祭 19、无形无影 13、末日将至 20、时空尽头 20 |
| 卡尔克萨之路 | 谢幕 16、最后的国王 14、往昔回响 20、不可言说的誓约 26、真相幻影 22、苍白面具 20、黑星升起 16、卡尔克萨 20 |
| 失落的时代 | 蛮荒之地 9、埃兹特利之厄 3、命运之线 13、边界之外 22、古人之心（上）10、古人之心（下）7、档案之城 2、幽嘶深渊 18、破碎永世 13、时间倒流 3 |

`集结` 的专属卡没有条目（规则在 definition/behavior），迁移不凭空创建文件。

### 1.4 跨战役通用 23 条（`shared/`，10 个组）

| 遭遇组 | 条目 |
| --- | --- |
| nightgaunts | 01172、huntingNightgaunt、01173、onWingsOfDarkness |
| arkham | 01132、01135、01136、falseLead |
| agents_of_yog | 01177、yithianObserver、01178 |
| pentagram | 01169、01170、01171 |
| striking_fear | 01163、01164、01165 |
| chilling_cold | 01167、01168 |
| agents_of_hastur | 01176 |
| ghouls | 01162 |
| ancient_evils | 01166 |
| locked_doors | 01174 |

### 1.5 战役共用 97 条（`<campaign>/_shared/`）

| 战役 | 条目数 | 组（条目数） |
| --- | ---: | --- |
| 失落的时代 | 44 | rainforest 9、eztli 6、pnakotic_brotherhood 3、serpents 3、agents_of_yig 3、ruins 3、venom 3、guardians_of_time 2、poison 2、traps 2、expedition 2、flux 2、heart_of_the_elders 3、the_depths_of_yoth 1 |
| 卡尔克萨之路 | 31 | delusions 5、the_last_king 5、decay 3、hasturs_gift 3、cult_of_the_yellow_sign 3、evil_portents 3、byakhee 2、inhabitants_of_carcosa 2、hauntings 2、stranger 2、curtain_call 1 |
| 敦威治遗产 | 22 | beast_thralls 3、bishops_thralls 3、naomis_crew 3、the_beyond 3、hideous_abominations 2、dunwich 2、bad_luck 2、sorcery 2、whippoorwills 2 |

这些卡不属于单关卡，但也不是跨战役通用；放进某一个关卡会误导，放回 `shared/` 又会把“战役内复用”
说成“全局通用”，所以单列一档。

### 1.6 别名与重复（本次不合并）

- 4 组别名/印刷卡成对条目：`01172`/`huntingNightgaunt`、`01177`/`yithianObserver`、
  `01173`/`onWingsOfDarkness`、`01136`/`falseLead`。两边的规则内容基本重复，但 key 不同、注册后
  各占一条。**本次只保证落点一致，不合并条目**；去重是独立行为改动，需要 replay 证明。
- 34 组同名条目里，其余 30 组是不同版本的卡（例如 6 个「展厅」、5 个「客车」），不是重复。

### 1.7 现状问题

1. **单写者**：所有非玩家卡修复都改同一个 7k+ 行文件；多子进程迁移无法并行，review diff 噪音大。
2. **增长快**：审计报告写作时该通道只有 9 条，现在 529 条；P3 保真修复仍在往里加。
3. **无归属**：只有 `scope`，没有“这张卡属于哪个关卡/战役/遭遇组”的机器可读信息，无法做目录守卫。
4. **硬编码债务**：`cardLayerCodes` 642 个键；本文件含 543 个唯一卡号（与其他文件重叠 1 个），白名单只能冻结，不能下降。
5. **一致性**：玩家卡已经一卡一文件，非玩家卡仍是例外，文档/工具要维护两套规则。

---

## 2. 目标结构

```text
src/cards/encounter-entries/
├── _shared.js                                  # 52 个跨卡 helper（窄工具，无卡牌规则）
├── _lookup.js                                  # 跨条目查询（惰性表；唯一跨卡读点）
├── index.js                                    # 生成物：静态 import 529 个文件，保持旧数组顺序
├── shared/
│   ├── nightgaunts/01172.js
│   ├── nightgaunts/huntingNightgaunt.js
│   └── ...
├── nightOfTheZealot/
│   ├── _shared/                                # 本战役跨关卡（当前为空）
│   ├── theMidnightMasks/wolfManDrew.js
│   └── theDevourerBelow/youngDeepOne.js
├── theDunwichLegacy/
│   ├── _shared/rainforest/04072.js
│   ├── extracurricularActivity/02052.js
│   └── ...
├── thePathToCarcosa/...
└── theForgottenAge/...
```

- 顶层只有 `shared/` + 4 个战役目录；战役目录内是 `_shared/` + 关卡目录。
- 组目录用 `cards-data.encounterCode`（统一 snake_case）。没有组的（地点/幕/议程/剧情资产）直接放
  所属目录根部；战役共用且无组的放 `<campaign>/_shared/story/`。
- 预计目录数：29 个关卡中 28 个有条目 → 28 个关卡目录；战役 `_shared` 34 个组目录；
  `shared/` 10 个组目录；合计 **72 个目录 / 529 个文件**。
- 单目录最大 **26** 个文件（不可言说的誓约），最小 1；不会出现“所有关卡塞进一个目录”的情况。

### 2.1 文件形状

```js
// 02052 宿舍（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity（关卡专用）
// 卡面：未揭示时不能移动进入。
export default {
  code: '02052',
  scope: 'location',
  implemented: true,
  locationRule: { entryError: (state, location) => location.revealed ? null : '通往宿舍的门锁住了。' },
}
```

硬约束：

1. `export default` 恰好一个条目；`code` 等于文件名（允许 `wolfManDrew` / `03047b` 这类非五位 code）。
2. `scope` 必填，取值 `enemy | location | act | agenda | treachery | storyAsset | threat`。
3. 不 import `engine.js` / `card-abilities.js` / `encounter-abilities.js` / `content/`；
   helper 只从 `_shared.js` 取，跨条目查询只从 `_lookup.js` 取。
4. 不直接改 `state`；仍走描述子与 `ctx.api`。

### 2.2 索引与 facade

`encounter-entries/index.js`：

```js
import e01162 from './shared/ghouls/01162.js'
// ... 529 行 import
export const NON_PLAYER_ENTRY_LIST = [e01162, /* ... 保持旧顺序 ... */]
```

`encounter-abilities.js` 迁移后只保留：

```js
import { NON_PLAYER_ENTRY_LIST } from './encounter-entries/index.js'
import { entryByCode } from './encounter-entries/_lookup.js'
import { originalOf, victoryVengeance } from './encounter-entries/_shared.js'

export const NON_PLAYER_ABILITY_ENTRIES = NON_PLAYER_ENTRY_LIST
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))
export const nonPlayerEntryFor = entryByCode
export { originalOf, victoryVengeance }
```

这样 12 个现有 import 点一行不改；测试里的 `JSON.stringify(NON_PLAYER_ABILITY_ENTRIES)` 快照也仍然成立
（前提是顺序与对象 key 顺序不变）。

### 2.3 跨条目查询

`_lookup.js` 惰性建表：

```js
import { NON_PLAYER_ENTRY_LIST } from './index.js'

let map = null
function table() {
  map ||= new Map(NON_PLAYER_ENTRY_LIST.map(entry => [entry.code, entry]))
  return map
}
export const entryByCode = code => table().get(code) || null
```

为什么必须惰性：`index.js → 02043.js → _lookup.js → index.js` 是循环引用；模块初始化阶段 `index.js`
尚未完成，立即建表会 TDZ。函数调用发生在对局中，那时所有模块已求值完毕，安全。守卫要加一条：
“在新进程里单独 import 任一含跨条目查询的条目文件（02043 / 03137 / 03124 / 03125），不抛错”。

### 2.4 为什么不按 scope 拆

- **按 scope 拆**（`enemies/`、`treacheries/`、`locations/`）只是把一个大文件换成三个大文件：
  同一个关卡的地点/敌人/诡计仍然分散，review 与迁移边界都不清晰，而且会鼓励继续写“通用规则 + 卡号判断”。
- **按关卡拆**让“这一关的全部规则”集中在一个目录；迁移、验收、回滚都能以关卡为单位。
- **通用卡单独一档**避免把同一张 `ancient_evils` 复制到 10 个关卡目录；战役内复用再单独一档，
  避免把“战役通用”误标成“全局通用”。

---

## 3. 归属判定（唯一算法）

扫描器、`scaffold-card --encounter`、`tests/encounter-entries.test.mjs` 必须共用同一份实现
（计划落在 `tools/encounter-entry-placement.mjs`，纯函数，便于测试）。

```text
输入：entry.code、ALL_CARDS[code]（可能为空）
1. tokens = { entry.code, card.originalCode, card.scenarioReferences[].ruleId }
2. 对每个已注册关卡，收集 token 集：
   definition.locations[].{id,code,originalCode}
   definition.acts/agendas[].{id,code,originalCode}
   definition.enemies/treacheries/storyAssets 的 key + 值里的 {code,originalCode}
   manifest.zones[].cardCode、manifest.locations[].{frontCode,backCode}、startLocationId
3. scenarios = 命中 token 的关卡集合
4. 若为空：按 card.encounterCode 的 canonical 形式（小写去非字母数字）匹配
   manifest.requiredEncounterGroupIds；仍为空 → unresolved（迁移必须为 0）
5. 别名跟随：entry.code 不在 ALL_CARDS 且同名印刷卡条目唯一 → 继承其 scenarios/bucket/group
6. bucket：
   1 个关卡 → scenario
   同一战役多个关卡 → campaign
   多个战役 → shared
7. group = card.encounterCode（snake_case）；别名继承印刷卡；没有 → null
8. targetPath：
   shared    → shared/<group|story>/<code>.js
   campaign  → <campaign>/_shared/<group|story>/<code>.js
   scenario  → <campaign>/<scenario>/<code>.js
```

边界情况：

- `acts/agendas/locations` 通常是 scenario；被同战役多关复用（如 04055/04056/04066/04072…）时进
  `<campaign>/_shared/`，不允许复制成两个文件。
- 遭遇组 id 在 Carcosa manifest 是 camelCase、在卡面是 snake_case；必须先 canonical 再比较
  （本次扫描最初漏了 7 条就是这个原因）。
- 印刷卡 + 运行时别名同时有条目时，两文件必须同目录；不合并内容。
- 关卡没有条目（如「集结」）不创建空文件。
- **归属不是永久标签**：新关卡/新遭遇组开始使用某张卡后，它可能从 scenario 变成 campaign/shared；
  改内容时必须重跑算法并移动文件，守卫按当前 `content/` 校验路径。移动只改路径，不改条目内容。

---

## 4. 工具与守卫改动

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `src/cards/encounter-entries/**` | 新增 | 529 个条目文件 + `_shared.js` + `_lookup.js` + `index.js` |
| `src/cards/encounter-abilities.js` | 改写 | 降级为 facade，只保留旧导出 |
| `tools/encounter-entry-placement.mjs` | 新增 | 归属算法纯函数；扫描器/脚手架/守卫共用 |
| `tools/build-encounter-index.mjs` | 新增 | `--write` / `--check`；顺序沿用旧数组，新增文件追加 |
| `tools/scaffold-card.mjs` | 扩展 | `--encounter`：算落点、写单卡骨架、默认重建索引；`--no-index` 供批量 |
| `tools/split-encounter-entries.mjs` | 新增（一次性） | 源码切片生成 529 文件 + `_shared.js` + `index.js`；`--check` 做快照对账 |
| `tools/hardcode-audit.mjs` | 修改 | `GENERATED` 增加 `encounter-entries/`；迁移后 `--write` 重算白名单 |
| `tests/encounter-entries.test.mjs` | 新增 | 一卡一文件、`code`=文件名、单一 default、落点=算法、索引一致、禁止 import、禁止 facade 条目 |
| `tests/architecture-guard.test.mjs` | 修改 | 更新提示文案；可加“facade 不得含 `code:`/`abilities:`”断言 |
| `package.json` | 修改 | `cards:encounter-index`、`cards:encounter-check`，并纳入 `test:fast` |
| `tools/audit-abilities.mjs` 等 | 不改 | 继续从 facade 读 `NON_PLAYER_ABILITY_ENTRIES` |
| `content/**/behavior.js`、`card-rules.js`、`engine.js` | 不改 | facade 保留导出即可 |

`cards:encounter-check` 建议组成：

```bash
node tools/build-encounter-index.mjs --check && node --test tests/encounter-entries.test.mjs
```

---

## 5. 迁移步骤（建议一次写盘，分阶段验证）

### 阶段 0：冻结与基线

1. 公告冻结：迁移窗口内不再往 `encounter-abilities.js` 加条目；新卡先按目标目录写单卡文件
   （或推迟到迁移后）。
2. 记录基线：
   - `NON_PLAYER_ABILITY_ENTRIES` 的 529 条顺序 + 对象 key 顺序；
   - 逐条函数源码（`Function.prototype.toString()`）归一化后的快照；
   - `node tools/replay-fixtures.mjs --baseline artifacts/encounter-split-baseline.json`；
   - `npm run test:fast` 2304 例全绿。
3. 当前 `JSON.stringify` 快照（只含数据字段，不含函数）：
   `529 entries / 44,948 bytes / sha256 cdbbceea…a9e5fce`，可作为顺序与字段的第一道对账。

### 阶段 1：抽共享层（行为零变化）

1. 把 658 行 helper 迁到 `encounter-entries/_shared.js`，保持函数体逐字不变；
2. 把 `nonPlayerEntryFor` / `NON_PLAYER_ABILITY_CODES` / `originalOf` / `victoryVengeance` 的读点
   整理到 `_lookup.js` / `_shared.js`；
3. `encounter-abilities.js` 仍保留数组（此阶段不拆条目），只改为从共享层 import helper；
4. 跑 `test:fast` + replay，证明零变化。

### 阶段 2：工具与 dry-run

1. 实现 `encounter-entry-placement.mjs`、`build-encounter-index.mjs`、`split-encounter-entries.mjs`；
2. `split-encounter-entries.mjs --check` 输出：529 个文件的路径、内容、索引；
3. 工具必须按标识符分析为每个文件生成 `_shared.js` 的相对 import（目录深度不同，不能统一写
   `../_shared.js`），并对每个生成文件跑 `node --check`；未定义标识符必须为 0；
4. 对账必须为 0 差异：
   - 条目 code 集合 = 529；
   - 索引顺序 = 旧数组顺序；
   - 每条 entry 的字段集合/函数源码归一化后完全一致；
   - 目标路径与 `inventory.json` 一致；
   - 无重复 code、无空文件、无未归属路径。

### 阶段 3：写盘与门禁

1. `split-encounter-entries.mjs --write` 生成 529 文件 + `index.js` + `_shared.js` + `_lookup.js`；
2. 重写 `encounter-abilities.js` 为 facade；
3. 跑：
   ```bash
   npm run cards:encounter-check
   npm run cards:check
   node tools/replay-fixtures.mjs --compare artifacts/encounter-split-baseline.json
   npm run test:fast
   ```
4. 快照对账：`JSON.stringify(NON_PLAYER_ABILITY_ENTRIES)` 与阶段 0 完全一致；函数源码归一化对比 0 差异。

### 阶段 4：硬编码与审计

1. `hardcode-audit.mjs` 的 `GENERATED` 加 `encounter-entries/`；
2. 运行 `node tools/hardcode-audit.mjs --write`（白名单只减不增）；预期
   `cardLayerCodes` 642 → **约 100**（本文件 543 个唯一卡号移走，其中 1 个仍出现在其他文件；剩 `card-effects.js` 96 等）；
3. `node tools/audit-abilities.mjs --write` 更新覆盖率；
4. 更新 `audit/ability-coverage.json` 相关计数（如 `nonPlayerCards` 仍是 20，别把规则条目算成 abilities）。

### 阶段 5：文档与收尾

1. `AGENTS.md` / `ARCHITECTURE.md` / `docs/card-entry-files.md` / `docs/card-model.md` /
   `docs/arkham-content-migration.md` 已改为新规矩；迁移完成后删掉“迁移中”措辞；
2. 把本文状态改为“已执行”，记录对账证据；
3. 后续独立任务：4 组别名条目去重（需要 replay 与快照）。

---

## 6. 验收门槛

| # | 检查 | 通过标准 |
| --- | --- | --- |
| 1 | 文件数 | 529 个条目文件，`code` 唯一且=文件名 |
| 2 | 归属 | 每个文件路径 = `encounter-entry-placement` 计算结果；0 unresolved |
| 3 | 索引 | `index.js` 与目录一致；顺序 = 拆分前 `NON_PLAYER_ABILITY_ENTRIES` |
| 4 | 内容 | 逐条字段/函数源码归一化对比 0 差异；`JSON.stringify` 快照一致 |
| 5 | facade | 12 个 import 点不改仍工作；`encounter-abilities.js` 无 `code:`/`abilities:` 条目 |
| 6 | 守卫 | `cards:check` + `cards:encounter-check` 全绿 |
| 7 | 行为 | replay baseline/compare 逐条一致；`test:fast` 无新增失败 |
| 8 | 硬编码 | `engineCodes`/`engineEntityHits` 保持 0；`cardLayerCodes` ≤ 100 |
| 9 | ESM | 单文件 import、整包 import、引擎注册三条路径都不抛错 |
| 10 | 文档 | 新路径/命令/守卫在 5 份文档中一致，无死链 |

---

## 7. 风险与对策

| 风险 | 触发点 | 对策 |
| --- | --- | --- |
| ESM 循环 | 4 处跨条目查询 | `_lookup.js` 惰性建表；单文件 import 测试 |
| 顺序/快照漂移 | `JSON.stringify` 快照、注册顺序 | 索引以旧数组为唯一顺序源；写盘前 dry-run 对账 |
| 闭包丢失 | 417 条带函数，运行时序列化会丢闭包 | 用源码切片（复用 `split-card-entries.mjs` 的 parser） |
| helper 混杂 | 52 个 helper 里约一半是战役专用 | 先统一 `_shared.js`，只放窄工具；增长后再按战役拆 |
| 别名重复 | 4 组别名/印刷卡成对 | 本次同目录、不合并；去重单列后续任务 |
| 迁移窗口并发修改 | 单文件仍在被编辑 | 阶段 0 冻结；迁移在独立分支完成 |
| 白名单过期 | 卡号从旧文件移到新目录 | 迁移后统一 `hardcode-audit --write`，只允许下降 |
| 测试直接 import facade | 4 个保真测试、3 个工具 | facade 导出签名保持不变 |
| 启动成本 | 模块数约 1,000 | 已测 460 模块 +165 ms/进程；1,000 模块仍可接受，迁移后复测 |

---

## 8. 任务清单

- [ ] 阶段 0：冻结 + 基线快照 + replay baseline
- [ ] 阶段 1：`_shared.js` / `_lookup.js` 抽取，行为零变化
- [ ] 阶段 2：归属算法 + 索引工具 + 拆分工具 dry-run（0 差异）
- [ ] 阶段 3：写 529 文件 + facade + 双索引门禁
- [ ] 阶段 4：hardcode 白名单下降 + 审计重算
- [ ] 阶段 5：文档收尾 + 迁移记录
- [ ] 后续：4 组别名条目去重（独立任务）

---

## 9. 附录

### A. 目录/文件数

| 档位 | 目录数 | 文件数 |
| --- | ---: | ---: |
| `shared/<group>/` | 10 | 23 |
| `<campaign>/_shared/<group>/` | 34 | 97 |
| `<campaign>/<scenario>/` | 28 | 409 |
| **合计** | **72** | **529** |

### B. 关卡条目数（28 关）

夜之狂热：午夜假面 3、吞噬者之下 6。
敦威治：课外活动 18、四叶草俱乐部 13、博物馆 22、快车 21、血祭 19、无形无影 13、末日将至 20、时空尽头 20。
卡尔克萨：谢幕 16、最后的国王 14、往昔回响 20、不可言说的誓约 26、真相幻影 22、苍白面具 20、黑星升起 16、卡尔克萨 20。
失落时代：蛮荒之地 9、埃兹特利之厄 3、命运之线 13、边界之外 22、古人之心（上）10、古人之心（下）7、档案之城 2、幽嘶深渊 18、破碎永世 13、时间倒流 3。

### C. 扫描产物

- `artifacts/encounter-entry-split/scan.mjs`：本文用的只读扫描器（`artifacts/` 不签入）。
- `artifacts/encounter-entry-split/inventory.json`：529 行逐条归属（code/scope/group/scenarios/bucket/targetPath）。
- 迁移工具落地后，扫描逻辑应迁到 `tools/encounter-entry-placement.mjs`，由守卫与脚手架复用；
  不要把 `artifacts/` 当运行时输入。

### D. 逐目录 code 清单（529 条）

> 由扫描器生成；格式 `目录: code, code…`。迁移写作时逐目录核对。

- `shared/agents_of_hastur/`: 01176
- `shared/agents_of_yog/`: 01177, 01178, yithianObserver
- `shared/ancient_evils/`: 01166
- `shared/arkham/`: 01132, 01135, 01136, falseLead
- `shared/chilling_cold/`: 01167, 01168
- `shared/ghouls/`: 01162
- `shared/locked_doors/`: 01174
- `shared/nightgaunts/`: 01172, 01173, huntingNightgaunt, onWingsOfDarkness
- `shared/pentagram/`: 01169, 01170, 01171
- `shared/striking_fear/`: 01163, 01164, 01165
- `theDunwichLegacy/_shared/bad_luck/`: 02092, 02093
- `theDunwichLegacy/_shared/beast_thralls/`: 02094, 02095, 02096
- `theDunwichLegacy/_shared/bishops_thralls/`: 02085, 02086, 02087
- `theDunwichLegacy/_shared/dunwich/`: 02088, 02089
- `theDunwichLegacy/_shared/hideous_abominations/`: 02103, 02104
- `theDunwichLegacy/_shared/naomis_crew/`: 02097, 02098, 02099
- `theDunwichLegacy/_shared/sorcery/`: 02083, 02084
- `theDunwichLegacy/_shared/the_beyond/`: 02100, 02101, 02102
- `theDunwichLegacy/_shared/whippoorwills/`: 02090, 02091
- `theForgottenAge/_shared/agents_of_yig/`: 04083, 04084, 04085
- `theForgottenAge/_shared/expedition/`: 04081, 04082
- `theForgottenAge/_shared/eztli/`: 04055, 04056, 04060, 04061, 04062, 04066
- `theForgottenAge/_shared/flux/`: 04090, 04091
- `theForgottenAge/_shared/guardians_of_time/`: 04086, 04087
- `theForgottenAge/_shared/heart_of_the_elders/`: 04206, 04215, 04216
- `theForgottenAge/_shared/pnakotic_brotherhood/`: 04095, 04096, 04097
- `theForgottenAge/_shared/poison/`: 04101, 04102
- `theForgottenAge/_shared/rainforest/`: 04069, 04070, 04071, 04072, 04073, 04074, 04075, 04076, 04077
- `theForgottenAge/_shared/ruins/`: 04092, 04093, 04094
- `theForgottenAge/_shared/serpents/`: 04078, 04079, 04080
- `theForgottenAge/_shared/the_depths_of_yoth/`: 04296
- `theForgottenAge/_shared/traps/`: 04088, 04089
- `theForgottenAge/_shared/venom/`: 04098, 04099, 04100
- `thePathToCarcosa/_shared/byakhee/`: 03086, 03087
- `thePathToCarcosa/_shared/cult_of_the_yellow_sign/`: 03098, 03099, 03100
- `thePathToCarcosa/_shared/curtain_call/`: 03059
- `thePathToCarcosa/_shared/decay/`: 03101, 03102, 03103
- `thePathToCarcosa/_shared/delusions/`: 03084a, 03084b, 03084c, 03084d, 03085
- `thePathToCarcosa/_shared/evil_portents/`: 03090, 03091, 03092
- `thePathToCarcosa/_shared/hasturs_gift/`: 03095, 03096, 03097
- `thePathToCarcosa/_shared/hauntings/`: 03093, 03094
- `thePathToCarcosa/_shared/inhabitants_of_carcosa/`: 03088, 03089
- `thePathToCarcosa/_shared/stranger/`: 03104, 03105
- `thePathToCarcosa/_shared/the_last_king/`: 03065b, 03066b, 03067b, 03068b, 03069b
- `nightOfTheZealot/theDevourerBelow/`: 01151, 01156, goatSpawn, relentlessDarkYoung, screechingByakhee, youngDeepOne
- `nightOfTheZealot/theMidnightMasks/`: 01121b, 01133, wolfManDrew
- `theDunwichLegacy/bloodOnTheAltar/`: 02196, 02197, 02198, 02199, 02200, 02204, 02205, 02206, 02208, 02211, 02214, 02215, 02216, 02219, 02220, 02221, 02222, 02223, 02224
- `theDunwichLegacy/extracurricularActivity/`: 02042, 02043, 02044, 02045, 02046, 02047, 02049, 02050, 02051, 02052, 02053, 02054, 02055, 02056, 02057, 02058, 02059, 02060
- `theDunwichLegacy/lostInTimeAndSpace/`: 02312, 02313, 02314, 02315, 02316, 02317, 02318, 02319, 02320, 02323, 02324, 02325, 02326, 02327, 02328, 02329, 02330, 02331, 02332, 02333
- `theDunwichLegacy/theEssexCountyExpress/`: 02160, 02161, 02162, 02163, 02164, 02165, 02166, 02167, 02168, 02169, 02170, 02171, 02172, 02173, 02174, 02176, 02177, 02180, 02181, 02182, 02183
- `theDunwichLegacy/theHouseAlwaysWins/`: 02063, 02064, 02065, 02066, 02067, 02068, 02069, 02075, 02076, 02078, 02079, 02081, 02082
- `theDunwichLegacy/theMiskatonicMuseum/`: 02119, 02120, 02121, 02122, 02123, 02124, 02125, 02126, 02130, 02131, 02132, 02133, 02134, 02135, 02136, 02137, 02141, 02142, 02143, 02144, 02145, 02146
- `theDunwichLegacy/undimensionedAndUnseen/`: 02237, 02238, 02239, 02240, 02241, 02244, 02245, 02249, 02254, 02256, 02257, 02258, 02259
- `theDunwichLegacy/whereDoomAwaits/`: 02275, 02276, 02277, 02278, 02279, 02280, 02281, 02285, 02286, 02287, 02288, 02289, 02290, 02291, 02292, 02294, 02295, 02296, 02297, 02298
- `theForgottenAge/heartOfTheEldersPart1/`: 04207, 04208, 04209, 04209b, 04210, 04217, 04218, 04219, 04220, 04221
- `theForgottenAge/heartOfTheEldersPart2/`: 04211, 04212, 04213, 04214, 04222, 04225, 04228
- `theForgottenAge/shatteredAeons/`: 04315, 04316, 04317, 04318, 04319, 04320, 04324, 04327, 04328, 04330, 04334, 04335, 04337
- `theForgottenAge/theBoundaryBeyond/`: 04162, 04163, 04164, 04165, 04166, 04167, 04169, 04170, 04175, 04176, 04177, 04178, 04180, 04181, 04182, 04183, 04184, 04185, 04186, 04187, 04189, 04190
- `theForgottenAge/theCityOfArchives/`: 04259, 04261
- `theForgottenAge/theDepthsOfYoth/`: 04278, 04279, 04280, 04281, 04282, 04283, 04284, 04287, 04288, 04289, 04292, 04293, 04294, 04297, 04298, 04300, 04301, 04302
- `theForgottenAge/theDoomOfEztli/`: 04057, 04058, 04059
- `theForgottenAge/theUntamedWilds/`: 04044, 04045, 04046, 04047, 04048, 04049, 04050, 04052, 04053
- `theForgottenAge/threadsOfFate/`: 04114, 04115, 04116, 04122b, 04126b, 04128b, 04130b, 04137b, 04141, 04142, 04144, 04145, 04146
- `theForgottenAge/turnBackTime/`: 04345, 04346, 04347
- `thePathToCarcosa/aPhantomOfTruth/`: 03201, 03202, 03203, 03204, 03205, 03206, 03207, 03208, 03209, 03210, 03211, 03214, 03215, 03218, 03219, 03221, 03221b, 03222, 03223, 03224, 03225, 03226
- `thePathToCarcosa/blackStarsRise/`: 03283, 03285, 03287, 03288, 03289, 03290, 03291, 03292, 03293, 03294, 03295, 03296, 03298, 03300, 03302, 03303
- `thePathToCarcosa/curtainCall/`: 03044, 03045, 03046, 03047a, 03047b, 03047c, 03048, 03050, 03051, 03052, 03054, 03055, 03056, 03057, 03058, 03060
- `thePathToCarcosa/dimCarcosa/`: 03317, 03318, 03319, 03320, 03321a, 03322a, 03323a, 03324, 03331, 03332, 03333, 03334, 03335, 03336, 03337, 03338, 03339, 03340, 03341, 03342
- `thePathToCarcosa/echoesOfThePast/`: 03121, 03122, 03123, 03124, 03125, 03126, 03128, 03129, 03130, 03132, 03133, 03134, 03136, 03137, 03138, 03140, 03141, 03144, 03145, 03146
- `thePathToCarcosa/theLastKing/`: 03062, 03063, 03070, 03071, 03072, 03075, 03076a, 03077, 03078, 03079, 03080, 03081, 03082, 03083
- `thePathToCarcosa/thePallidMask/`: 03241, 03241b, 03242, 03243, 03244, 03245, 03246, 03248, 03249, 03250, 03251, 03254, 03255, 03256, 03257, 03258, 03259, 03260, 03261, 03262
- `thePathToCarcosa/theUnspeakableOath/`: 03160, 03161, 03162, 03163, 03164, 03165, 03166, 03167, 03170, 03172, 03174, 03175, 03176, 03177, 03178, 03179, 03180, 03181, 03182a, 03182b, 03183, 03184, 03185, 03186, 03187, 03188

