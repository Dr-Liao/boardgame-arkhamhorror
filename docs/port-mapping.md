# 诡镇奇谈：卡牌版 · 历史移植对照表（N0 口径校正）

> 修订日期：2026-09-18。**旧 Phase 0–8 的完成结论全部废止**，当前执行与验收以 `games/arkhamhorror/ACTION_PLAN.md` 为准。
> 本文保留旧卡号对照与接口调查作为历史证据，不代表当前实现状态；尤其 §4 的 61 张旧定义不是当前 815 条统一目录。
> 当前机器基线：`games/arkhamhorror/audit/resource-report.json`；范围与差异维护表：同目录 `migration-scope.json`。
> 复核入口（在 `games/arkhamhorror/` 下运行）：`npm run audit`、`npm run audit:check`、`npm run test:audit`。这些入口只读，不导入卡牌、不下载资源。
> 新版英文 `frontend/public/cards_en.json` 为 N1 主源，简中／繁中按编号补展示，旧后端只作兼容补充；当前导入器尚未切换。
> JSON 并集 5,930、目标 815、目录差集 5,115；效果 96 条、显式简化 63 条、核心调查员能力 5 条、NOTZ 三关四难度均只是现状，**严格规则验收数为 0**。

---

## 1. 旧后端 cards.json 快照盘点（历史 0.1）

以下分类只描述 `参考资源/ArkhamHorror-main/backend/arkham-api/data/cards.json` 的旧快照，不代表全卡池。新版 `frontend/public/cards_en.json`、`cards_zh-cn.json`、`cards_zh.json` 各含 5,929 条结构化卡牌；13 份有效前端表与旧后端合计 5,930 个编号，旧后端独有 `60336`。`cards_ja.json` 为零字节，明确排除。

**本节旧快照为 815 条记录、815 个唯一编号、47 个卡包；不是实体张数或完整资源数量。** 中文字段来源匹配不等于翻译质量／双面内容均已验收。

### 1.1 按类型（type_code）

| type_code | 数量 | 说明 |
| --- | --- | --- |
| asset | 353 | 资产 |
| event | 214 | 事件 |
| skill | 70 | 技能 |
| story | 62 | 剧情/故事卡（多为剧本卡背面、多结局卡，属于遭遇/剧情资源） |
| treachery | 50 | 诡计（含全部弱点：51 weakness + 27 basicweakness 作为 subtype 散布在各类型上） |
| investigator | 44 | 调查员 |
| enemy | 20 | 敌人（弱化敌人 + 剧本剧情敌人） |
| location | 2 | 地点（Dream-Gate 等玩家卡地点） |

### 1.2 按阵营（faction_code）

| faction_code | 数量 |
| --- | --- |
| neutral | 166 |
| mystic | 120 |
| guardian | 117 |
| seeker | 117 |
| survivor | 117 |
| rogue | 115 |
| mythos | 63 |

### 1.3 按扩展包（pack_code，前 10 与核心包）

| pack_code | 数量 | 说明 |
| --- | --- | --- |
| core | **104** | 核心包（推荐 D1=A 起步范围） |
| ptc | 52 | The Path to Carcosa |
| tfa | 42 | The Forgotten Age |
| tcu | 42 | The Circle Undone |
| dwl | 39 | The Dunwich Legacy |
| tde | 39 | The Dream-Eaters |
| … | … | 其余 41 个卡包；完整 47 包统计见 N0 报告 `sources[].byPack` |

### 1.4 槽位分布（仅资产，slot 字段）

| slot | 数量 |
| --- | --- |
| Hand | 82 |
| Ally | 57 |
| Arcane | 42 |
| Accessory | 34 |
| Hand x2 | 17 |
| Body | 9 |
| Tarot | 7 |
| Hand. Arcane / Body. Hand x2 / Ally. Arcane / Arcane x2 | 各 1~3（组合槽） |
| （无 slot） | 99 |

### 1.5 XP 分布（玩家卡）

| xp | 数量 |
| --- | --- |
| 0 | 277 |
| 1 | 67 |
| 2 | 89 |
| 3 | 79 |
| 4 | 31 |
| 5 | 24 |

### 1.6 关键词标志

| 标志 | 数量 |
| --- | --- |
| is_unique（唯一） | 128 |
| permanent（常驻） | 19 |
| exceptional（特例） | 8 |
| exile（流放） | 7 |
| double_sided（双面） | 45 |
| hidden（隐藏） | 64 |

### 1.7 5 名核心调查员（Core Set）

| code | name | 阵营 | 意志 | 智识 | 战斗 | 敏捷 | 生命 | 理智 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01001 | Roland Banks | guardian | 3 | 3 | 4 | 2 | 9 | 5 |
| 01002 | Daisy Walker | seeker | 3 | 5 | 2 | 2 | 5 | 9 |
| 01003 | "Skids" O'Toole | rogue | 2 | 3 | 3 | 4 | 8 | 6 |
| 01004 | Agnes Baker | mystic | 5 | 2 | 2 | 3 | 6 | 8 |
| 01005 | Wendy Adams | survivor | 4 | 3 | 1 | 4 | 7 | 7 |

> 注意：参考实现中调查员顺序为 Roland→Daisy→**Skids**→Agnes→Wendy（01003=Skids，01004=Agnes）；
> 现有 `data.js` 里 agnes 排在 skids 之前，属展示顺序差异，不影响 code 映射。

---

## 2. NOTZ 三关剧本数据来源（0.2）

### 2.1 已有 JSON 与损坏骨架（N0 校正）

| 文件 | 内容及限制 |
| --- | --- |
| `frontend/public/cards_en.json`、`cards_zh-cn.json` | 含三关及其他剧本的场景、地点、幕、议程、敌人、诡计等结构化记录；不是只有玩家卡 |
| `backend/.../data/cycles.json` | 旧的 3 个战役目录（zealot/dunwich/carcosa），不是完整注册表 |
| `backend/.../data/arkham/cycles/nightOfTheZealot.json` | NOTZ 三关步骤与四难度混乱袋 |
| `backend/.../data/arkham/scenarios/nightOfTheZealot/theGathering.json` | 旧剧本骨架，布置与数量仍需对照 Haskell |
| `backend/.../data/arkham/sets/theGathering.json` | **严格 JSON 解析失败**：第 120 行前缺少 `reveal` 数组闭合符；另有占位内容，只作历史文本证据，不直接消费 |

> 损坏骨架已登记 `damaged-gathering-skeleton` 例外；不修补只读参考源。卡牌元数据优先新版卡表，行为／布置／未表达细节由 Haskell 补充。

### 2.2 Haskell CardDefs 与可执行行为参考

下列是 NOTZ 的 Haskell 参考入口；JSON 与源码交叉核对，源码存在不等于目标已迁移或已通过规则验收：

| 目录 | 关键文件 | 内容 |
| --- | --- | --- |
| `Campaigns/NightOfTheZealot/` | `CampaignSteps.hs` | 三关 scenario code：TheGathering=**01104**、TheMidnightMasks=**01120**、TheDevourerBelow=**01142**（+ Return To 50011/50025/50032） |
| | `ChaosBag.hs` | 4 难度混乱袋（与 JSON 一致，符号名 Skull/Cultist/Tablet/AutoFail/ElderSign） |
| `Scenarios/NightOfTheZealot/{TheGathering,TheMidnightMasks,TheDevourerBelow}/Helpers.hs` | i18n scope（仅作用域，无卡数据） |
| `Act/CardDefs/NightOfTheZealot/*.hs` | 三关各一文件 | 幕卡名 + code（如 TheGathering：Trapped=01108 / The Barrier=01109 / What Have You Done?=01110） |
| `Agenda/CardDefs/NightOfTheZealot/*.hs` | 三关各一文件 | 议程卡名 + code（如 What's Going On?!=01105 / Rise of the Ghouls=01106 / They're Getting Out!=01107） |
| `Location/CardDefs/NightOfTheZealot/*.hs` | 三关各一文件 | 地点 code + 图标连接（Study=01111 / Hallway=01112 / Attic=01113 / Cellar=01114 / Parlor=01115） |
| `Enemy/CardDefs/NightOfTheZealot/` | TheGathering.hs + 通用遭遇组 | 敌人属性（战斗/躲避/生命/伤害/恐惧/关键词/胜利点） |
| `Treachery/CardDefs/NightOfTheZealot/` | 通用遭遇组 | 诡计牌（AncientEvils/ChillingCold/Ghouls/Rats/StrikingFear/…） |

**The Gathering 的遭遇牌组**（`theGathering.json` 的 encounterSets）：theGathering、rats、ghouls、strikingFear、ancientEvils、chillingCold 六组。

**The Gathering 敌人的真实属性示例**（`Enemy/CardDefs/NightOfTheZealot/TheGathering.hs`）：

| code | name | 战斗 | 躲避 | 生命 | 伤害 | 恐惧 | 关键词/胜利点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01118 | Flesh-Eater | 4 | 1 | 4 | 1 | 2 | 胜利点 1 |
| 01116 | Ghoul Priest | 4 | 4 | 每人 5 | 2 | 2 | Hunter + Retaliate + Elite，胜利点 2 |
| 01119 | Icy Ghoul | 3 | 4 | 4 | 2 | 1 | 胜利点 1 |

> 旧“4 地点、3 敌人、议程固定阈值 4”的描述已失效。当前 `scenarios-data.js` 的 Gathering 有 5 地点、6 敌人定义和 3 议程，仍存在身份映射、流程与规则差异；具体对象见 N0 报告 `capabilities.scenarios`。

### 2.3 当前剧本来源策略

- 三关及后续剧本的**目录元数据**均应先查新版英文／中文卡表，不再声称后两关没有 JSON 卡牌数据。
- **行为与流程**从 Haskell 逐项核对；旧骨架仅作补充，损坏文件不得直接导入。
- N1 建立原卡号与运行时别名映射，N4 按遭遇组数量、布置、结局、个人奖励和战役记录验收。

---

## 3. Mod↔Agent 接口契约（历史 0.3 调查）

### 3.1 当前约束

保留既有大厅 Mod／Agent 架构和服务端动作校验边界。以下接口表与 §3.3 预判仅作历史参考，不再保证“永远只改 Mod”；待决选择、静态目录传输、异步状态版本在 N2/N3/N6 可能需要最小化大厅适配。N0 未改动运行时接口。

### 3.2 冻结的契约（已核实 `lib/mods.js` + `lib/agent/*` + `lib/server.js` 实际调用点）

**Mod 必须导出的字段/方法**（`lib/mods.js` 的 `validateMod` 强制校验）：

| 接口 | 消费方 | 说明 |
| --- | --- | --- |
| `id / name / players` | 大厅 / catalog | 元数据 |
| `createState(settings, players) -> state` | server.js | state 顶层须含 `status/winnerSeat/currentSeat/moveCount` |
| `validateMove(state, seat, move) -> string|null` | orchestrator + server | 硬边界，模型非法落子打回 |
| `applyMove(state, seat, move) -> events` | orchestrator + server | 原地改 state，返回事件数组 |
| `describeState(state) -> string` | prompt.js | 给模型的局面文本 |
| `legalMoves(state) -> move[]` | orchestrator + server | AI 兜底 / 前端按钮 |
| `moveToText(move) -> string` | prompt.js | 落子记法 |
| `moveFormat: string` | prompt.js | 落子 JSON 格式说明 |

**Agent 实际读取的 Mod 字段**（`lib/agent/prompt.js` + `orchestrator.js`）：

| 字段 | 用途 |
| --- | --- |
| `cooperative` | 合作/竞技分支（本 Mod = true） |
| `name / description` | 写进 system prompt |
| `agentHint` | 合作目标说明 |
| `moveFormat` | 行动格式 |
| `describeState / legalMoves / moveToText / validateMove / applyMove / createState` | 闭环 |

**事件 schema**（`lib/server.js` 写入 `session.events`，`prompt.js` 读取）：

- 落子事件建议 `{ type:'move', seat, move }`（prompt.js 用 `moveToText` 渲染）
- 台词事件 `{ type:'speech', seat, text }`
- 其余文本事件 `{ type:'info', text }`（现有 engine 主要用这个）

> **已知小缺口（记录，不阻塞 Phase 0）**：现有 `engine.js` 的 `applyMove` 只产出 `{type:'info'}`，
> 未产出 `{type:'move', seat, move}`，因此 `prompt.js` 的 `recentHistory` 里「落子记法」实际由 info 文本兜底呈现。
> 该问题在 Phase 6（AI 扮演增强）统一处理，不影响 `lib/*` 契约。

### 3.3 移植对契约的影响（预判）

- Phase 6 扩展 `moveFormat`（多重行动/free trigger/choose 分支/目标选择）、`legalMoves`、`describeState` 时，**只需改 Mod 内部**，`lib/agent/*` 的消费逻辑不变（它只是原样把 `moveFormat`/`describeState`/`legalMoves` 喂给模型）。
- 唯一需要保持的硬约束：`validateMove` 仍是硬边界，模型产出必须能过校验。

---

## 4. 现有卡牌 ↔ cards.json code 对照表（0.4）

> 现有实现共 **61 个卡牌定义**：5 调查员 + 5 签名卡 + 5 专属弱点 + 4 基础弱点 + 42 玩家卡。
> （ACTION_PLAN 里「~44 张玩家卡」为约数，实际玩家卡 42 张。）
> 对照依据：英文卡名（`cards.json` 的 `name`）；现有卡多为核心包（pack=core）。

### 4.1 调查员（5，全部命中）

| 现有 code | 现有 nameEn | 参考 code | 参考 name | 备注 |
| --- | --- | --- | --- | --- |
| roland | Roland Banks | 01001 | Roland Banks | 属性一致 |
| daisy | Daisy Walker | 01002 | Daisy Walker | 一致 |
| agnes | Agnes Baker | 01004 | Agnes Baker | 一致（参考序号在 skids 后） |
| skids | "Skids" O'Toole | 01003 | "Skids" O'Toole | 一致 |
| wendy | Wendy Adams | 01005 | Wendy Adams | 一致 |

### 4.2 签名卡 + 专属弱点（10，全部命中）

| 现有 code | 现有名 | 参考 code | 参考名 | 备注 |
| --- | --- | --- | --- | --- |
| sig-roland | .38 特制手枪 | 01006 | Roland's .38 Special | |
| weak-roland | 掩盖真相 | 01007 | Cover Up | |
| sig-daisy | 黛西的提包 | 01008 | Daisy's Tote Bag | 参考无 slot |
| weak-daisy | 《死灵之书》 | 01009 | The Necronomicon | 双面卡（正=签名卡/反=弱点） |
| sig-skids | 潜逃 | 01010 | On the Lam | |
| weak-skids | 被追捕 | 01011 | Hospital Debts | ⚠ 中文名与原文不一致（应为「医院债务」） |
| sig-agnes | 海珀波利亚传家宝 | 01012 | Heirloom of Hyperborea | slot=Accessory |
| weak-agnes | 黑暗记忆 | 01013 | Dark Memory | |
| sig-wendy | 温蒂的护身符 | 01014 | Wendy's Amulet | slot=Accessory |
| weak-wendy | 被遗弃者 | 01015 | Abandoned and Alone | |

### 4.3 基础弱点（4，命中 3，1 张自制）

| 现有 code | 现有名 | 参考 code | 参考名 | 备注 |
| --- | --- | --- | --- | --- |
| bw-paranoia | 偏执 | 01097 | Paranoia | |
| bw-amnesia | 健忘 | 01096 | Amnesia | |
| bw-hypochondria | 疑病症 | 01100 | Hypochondria | |
| bw-injury | 旧伤复发 | — | （无对应） | ⚠ 自制卡，核心包无此基础弱点 |

> 核心包完整基础弱点共 8 张：Amnesia/Paranoia/Haunted/Psychosis/Hypochondria/Mob Enforcer/Silver Twilight Acolyte/Stubborn Detective（01096~01103），Phase 3.3 全量补齐。

### 4.4 玩家卡（42，逐张对照）

图例：✅ 命中 · ⚠ 类型/槽位/阵营与参考不一致 · ❌ 自制/简化卡（cards.json 无对应）。

#### 中立（12）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| flashlight | 手电筒 | 01087 | Flashlight | ✅ |
| knife | 匕首 | 01086 | Knife | ✅ |
| firstaid | 急救包 | 01019 | First Aid | ⚠ 参考阵营=**guardian**（现有误置中立）；slot 参考为（无） |
| emergency | 应急储备 | 01088 | Emergency Cache | ✅ |
| backpack | 背包 | 04037 | Backpack | ⚠ 非核心包（pack=tfa），slot=Body |
| painkillers | 止痛药 | 02117 | Painkillers | ⚠ 非核心包（tmm），且参考类型=**asset**（现有=event） |
| recall | 安心回忆 | — | （无对应） | ❌ 自制卡 |
| guts | 胆识 | 01089 | Guts | ✅ |
| overpower | 压制 | 01091 | Overpower | ✅ |
| perception | 洞察 | 01090 | Perception | ✅ |
| manual | 灵巧 | 01092 | Manual Dexterity | ✅ |
| courage | 意外之勇 | 01093 | Unexpected Courage | ✅ |

#### 守卫者 Guardian（6）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| auto45 | .45 自动手枪 | 01016 | .45 Automatic | ✅ |
| machete | 开山刀 | 01020 | Machete | ✅ |
| beatcop | 巡警 | 01018 | Beat Cop | ✅（另有 xp=2 版 01028） |
| guarddog | 警犬 | 01021 | Guard Dog | ✅ |
| vicious | 猛烈一击 | 01025 | Vicious Blow | ⚠ 参考类型=**skill**（现有=event） |
| rally | 重整旗鼓 | — | （无对应） | ❌ 自制卡（疑似想表达 Second Wind=04149，非核心包） |

#### 探求者 Seeker（6）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| magnifier | 放大镜 | 01030 | Magnifying Glass | ✅ |
| milan | 米兰·克里斯托弗博士 | 01033 | Dr. Milan Christopher | ✅ |
| oldbook | 秘典古籍 | 01031 | Old Book of Lore | ✅ |
| hunch | 灵光一现 | 01037 | Working a Hunch | ✅ |
| deduction | 推理 | 01039 | Deduction | ⚠ 参考类型=**skill**（现有=event） |
| research | 古籍抄录 | — | （无对应） | ❌ 自制卡 |

#### 秘术师 Mystic（6）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| shrivelling | 枯萎术 | 01060 | Shrivelling | ✅ |
| rosary | 圣念珠 | 01059 | Holy Rosary | ✅ |
| scrying | 窥视 | 01061 | Scrying | ✅ |
| ward | 守护结界 | 01065 | Ward of Protection | ✅ |
| flame | 飞蛾扑火 | 01064 | Drawn to the Flame | ✅ |
| meditation | 冥想 | — | （无对应） | ❌ 自制卡 |

#### 游荡者 Rogue（6）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| derringer | .41 德林杰手枪 | 01047 | .41 Derringer | ✅ |
| leo | 里奥·德·卢卡 | 01048 | Leo De Luca | ✅ |
| burglary | 顺手牵羊 | 01045 | Burglary | ✅ |
| backstab | 背刺 | 01051 | Backstab | ✅ |
| elusive | 无影无踪 | 01050 | Elusive | ✅ |
| quickthinking | 急智 | 02229 | Quick Thinking | ⚠ 非核心包（uau），且参考类型=**skill**（现有=event） |

#### 幸存者 Survivor（6）

| 现有 code | 现有名 | 参考 code | 参考名 | 类型/备注 |
| --- | --- | --- | --- | --- |
| baseball | 棒球棍 | 01074 | Baseball Bat | ⚠ 参考 slot=**Hand x2**（现有=hand） |
| rabbit | 兔脚 | 01075 | Rabbit's Foot | ✅ |
| coat | 皮夹克 | 01072 | Leather Coat | ✅ |
| lucky | 幸运！ | 01080 | Lucky! | ✅ |
| lookwhat | 看我发现了什么！ | 01079 | "Look what I found!" | ✅ |
| survive | 绝境求生 | 01081 | Survival Instinct | ⚠ 参考类型=**skill**（现有=event） |

### 4.5 对照结论（供 Phase 2/3 使用）

- **命中率**：61 张中，✅ 直接命中 **47 张**（5 调查员 + 10 签名/弱点 + 3 基础弱点 + 29 玩家卡）。
- **需修正**（⚠）**10 张**：类型（vicious/deduction/survive/painkillers/quickthinking 应为 skill 或 asset）、阵营（firstaid）、槽位（baseball）、非核心包（backpack/painkillers/quickthinking）、译名（weak-skids）。
- **自制/简化卡**（❌）**6 张**：recall、rally、research、meditation、bw-injury、以及需进一步确认的对应。这些卡在 Phase 2.7/3.x 里要么映射到真实卡，要么明确标记「简化」并替换。

---

## 5. 当前数据、图像与完成边界（N0 校正）

1. **815 只是旧后端快照。** 新版英文及简繁中卡表各有 5,929 条、13 类型，含大量遭遇／场景元数据；目录合并不能按同名去重，`60336` 单列兼容处理。
2. **JSON 元数据与 Haskell 行为分工。** 损坏 Gathering 骨架隔离；Haskell 的 CardDef、builder、战役键、剧本别名和生成注册入口独立列账。静态候选不等于编译后的完整注册，不增加 5,930 的 JSON 并集口径。
3. **效果条目不是验收。** 当前效果解释器与 96 条效果已存在，63 条显式简化，未标记项仍可能有差异。当前能力清单没有任何严格规则验收通过项；未实现、部分、简化不能混称“已完成”。
4. **现有也是四难度。** 三关简化流程与四难度配置已存在，但地点、选择、结局、个人 XP、牌组继承及创伤仍待 N3/N4 验收。
5. **中文必须保留来源。** 简体／繁体是结构化卡表，不只是词典；逐字段匹配、背面缺失及同名回退见报告 `capabilities.cards[].locale`，字段存在不代表中文内容完整或质量通过。
6. **图片必须本地／远程分账。** 参考本地图片 299、字体 20、音频 3；目标图片 0。`frontend/image-manifest.json` 有 30,895 条路径，其中 204 条在参考公共目录存在、30,691 条仅有清单记录，不能视为下载或可展示数量。完整卡面目录不存在。
7. **图片解析尚待 N2。** 原主机 `https://assets.arkhamhorror.app` 可配置，普通 `/img/arkham/cards/{art}.avif`、中文 `/img/arkham/zh/cards/{art}.avif`；须迁移语言回退、正反面、卡背、重印与美术 ID 规则，不以 `code + b` 猜背面。当前 UI 为文字卡片，`imagesrc` 未接入卡图。
8. **许可与功能边界。** 两个音频有源内 CC0 声明，提示音有生成来源说明；其他媒体授权待核实。Return To、独立剧本、自制扩展与特殊编号均登记，首批严格规则只含 Core＋NOTZ；账号、真人多人、数据库、云部署不默认迁移。

---

## 6. 资源规划 + 临时资源约定

### 6.1 目录约定（本次新增，写回 ACTION_PLAN.md）

| 目录 | 用途 | 是否入库/交付 |
| --- | --- | --- |
| `参考资源/ArkhamHorror-main/` | **只读**参考实现（Haskell + JSON），不修改 | 参考，不修改 |
| `develop/` | **临时/一次性脚本与中间产物**（分析脚本、抽取脚本、试运行输出） | 临时，可随时重建 |
| `games/arkhamhorror/` | 最终 Mod 代码（index/data/engine/cards-data/scenarios-data/effects/deckbuilding + tools/） | 正式交付 |
| `docs/` | 阶段交付文档（本文件 port-mapping.md 等） | 正式交付 |

### 6.2 本阶段产出的临时资源（位于 `develop/`）

| 文件 | 用途 |
| --- | --- |
| `develop/analyze-cards.mjs` | 盘点 cards.json 全量构成（0.1），可重跑 |
| `develop/analyze-boundary.mjs` | 厘清 story/enemy/location 卡边界（0.1） |
| `develop/lookup-cards.mjs` | 按英文名查 code，用于建立对照表（0.4），可重跑 |

### 6.3 Phase 1~4 预计划的临时资源（约定放入 `develop/`）

| 计划文件 | 用途 | 归属阶段 |
| --- | --- | --- |
| `games/arkhamhorror/tools/import-cards.mjs` | cards.json → cards-data.js 的一次性生成脚本（已交付） | P1 ✅ |
| `develop/extract-scenario-*.mjs` | 从 Haskell 抽取/辅助转写剧本数据的脚本 | P4 |
| ~~`develop/verify-mapping.mjs`~~ | ~~校验 cards-data.js 完整性/无重复 code~~ 已并入 `tools/import-cards.mjs`（内置校验，失败 exit 1），无需单独脚本 | P1 |
| `develop/*.json` | 抽取过程的中间 JSON（不入最终交付） | P1~P4 |

> 原则：`tools/import-cards.mjs` 是「可重跑的正式脚本」，按 ACTION_PLAN 放 `games/arkhamhorror/tools/`；
> 其余一次性调研/抽取脚本与中间产物统一放 `develop/`，不进最终交付，避免污染 Mod 目录。
