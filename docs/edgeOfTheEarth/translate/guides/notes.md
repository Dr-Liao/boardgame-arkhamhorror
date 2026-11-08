# EOTE 八章「关卡设置」指南面板中文审计报告（guides）

- area：`guides`（《地球边缘》8 份 `web/scenario-guides/*.json`）
- auditor：guides-audit
- generatedAt：2026-11-09
- 性质：**只读审计**。未修改 `games/arkhamhorror` 下任何既有文件；仅新增本目录三份产物与 `docs/edgeOfTheEarth/translate/tools/guides-scan.mjs`。

## ① 范围与输入

| 输入 | 相对 Mod 根路径 | 用途 |
| --- | --- | --- |
| 审计对象 | `web/scenario-guides/{iceAndDeathPart1,iceAndDeathPart2,iceAndDeathPart3,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadnessPart1,theHeartOfMadnessPart2}.json` | `locales.zh` / `locales.en` / `chineseGaps` / `chineseStatus` / `chinese` / `sectionCount` / `guideKeyCount` / `sources` |
| en 事实源（只读） | `参考资源/ArkhamHorror-main/frontend/src/locales/en/edgeOfTheEarth/{base.json,scenarios/*.json}`（6 文件） | en 叶子事实源；与 `tools/eote-guide-scan.mjs#buildGuides` 同一切片 |
| zh 源（只读） | 同路径 `zh/`（6 文件） | 中文三态判定；`chineseGaps` 复算 |
| 同一事实源 | `content/campaigns/edgeOfTheEarth/story-text.js`（P7 生成物） | 章节 `chineseGaps`/`chinese`/`sectionCount`/`sources` 比对；`iceAndDeath`→part1–3、`theHeartOfMadness`→part1–2 映射 |
| 面板渲染 | `web/scenario-setup-view.js`、`web/locales/zh-CN.panels.js`、`web/card-text.js` | 「中文待补」口径、locale 选择、token 渲染路径 |
| 注册 | `content/scenario-guides.js`（8 章 `note/setup` 摘要，非本次正文对象） | 交叉确认面板入口 |

**范围统计**：8 章共 **469** 个 en 叶子 key（`55/38/31/68/51/94/79/53`，与 `story-text.js#EOTE_STORY_META.guideKeyCounts`、`audit/eote-scope.json`、`docs/edgeOfTheEarth/scenarios.md` §1 表一致）。拆章共享篇段重复计入：
`iceAndDeath` part1–3 各含 11 个共享行（`heading/tokens/icebreakerLanding/manifestationsOfEvil`，part 切片 44/27/20），`theHeartOfMadness` part1–2 各含 15 个共享行（`heading/tokens/specialRules`，part 切片 64/38）——这是 P0/P7 既有口径，不是统计错误。
另有战役共享段 `base.json` **258** 个 en 叶子（序幕/检查点/幕间/尾声/特别规则/记录标签），不进入「关卡设置」面板，仅作为补译 backlog 单列。

## ② 方法与命令

`docs/edgeOfTheEarth/translate/tools/guides-scan.mjs`（Node 直接运行，无子进程、无第三方依赖）：

1. **覆盖重算（A）**：以参考 locale **en 叶子**为事实源，按 `tools/eote-guide-scan.mjs#buildGuides` 同一切片（整文件或 `sharedTopLevel + partN.*`）逐 key 读取 zh 同路径，三态判定与生成链同口径：`missing`（无同路径）/ `untranslated`（有值但无 CJK，或含 3+ 连续英文小写词）/ `present-needs-review`（含 CJK）。
2. **渲染树重建**：用与 `tools/import-scenario-guides.mjs#buildEoteGuide` 相同的 `eoteBlocks` 规则从 `story-text.js` 重建 `locales.zh/en`，先验证**与磁盘 JSON 逐字节等价的树**（含 skipped key、title 省略、specialRules 去重），再按结构把每个源 key 对齐到磁盘 JSON 的真实指针与行号（自写 JSON 指针→行号解析器，证据行号不是手写）。
3. **chineseGaps 核对**：期望 gaps = 源 locale 重算三态 != present；与 JSON `chineseGaps`、`story-text.js#chineseGaps` 双向比对（漏记/多记/状态错）。
4. **渲染口径检查（B）**：逐块检查 `text` / `title` / `missing`，验证「中文待补」是否在所有层生效；在**面板实际渲染的 zh 文本**上做中英混杂、半译、英文片段扫描。
5. **符号/标点/简繁/结构（C/D）**：重复标点、半全角、引号/括号配对、图标 token 与 en 对照（`web/card-text.js#SYMBOLS` 已知 token 表）、`{var}`/花括号转义残留、U+FFFD、空格、`\n`、`•` 列表、markdown `_` 泄漏；繁体白名单扫描（「著」简繁两用按 著作/著名/显著 排除）。
6. **一致性（E）**：逐章比对 guide JSON `chineseStatus/chinese/sectionCount/guideKeyCount/sources` 与 `story-text.js` 生成物、P0 计数、源文件 sha256；并验证 `iceAndDeath ×3`、`theHeartOfMadness ×2` 拆分映射。

命令见 ⑦；`--report=stats|gaps|flags|consistency` 输出中间账本，`--check` 逐字节复算两份产物。

## ③ 结论统计

### 3.1 总账（8 章）

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| en 叶子 key | 469 | = `guideKeyCount` 合计（含共享篇段重复） |
| zh present-needs-review | 260 | 含 CJK 且有中文正文，待人工校对 |
| zh untranslated | 10 | 无中文、或中文里夹整句英文（与生成链同口径） |
| zh missing | 199 | zh locale 无同路径 |
| `chineseGaps` 记录 | 209 | = 10 + 199；与源 locale 重算、`story-text.js` **完全一致**（漏记 0 / 多记 0 / 状态错 0） |
| 面板可见正文块（text present） | 169 | 实际渲染中文正文 |
| 面板「中文待补」正文块 | 121 | 全部为 `chineseGaps` 已登记缺译，按既有口径显示「中文待补」 |
| 面板标题（title present） | 38 | 中文标题 |
| **标题静默缺失** | **14** | 已登记缺译标题 **不显示「中文待补」**（新发现缺陷，见 ④） |
| **标题整段消失（@: 引用）** | **1** | `iceAndDeathPart3 investigatorSetup.title`，见 ④ |
| 不渲染的缺译键（skipped） | 73 | `heading/tokens/label` 等 `SKIPPED` 键，面板根本不渲染 |
| 可读中文单元 | 169 正文 + 38 标题 = **207 / 469（44.1%）** | 其余 = 121 待补 + 15 标题缺失 + 126 skipped 键 |

### 3.2 按章（正文/标题渲染与缺译）

| 章 | keys | present | untranslated | missing | 待补正文块 | 标题缺失 | 隐藏缺译键 | backlog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iceAndDeathPart1 | 55 | 43 | 2 | 10 | 2 | 0 | 10 | 12 |
| iceAndDeathPart2 | 38 | 30 | 2 | 6 | 1 | 1 | 6 | 8 |
| iceAndDeathPart3 | 31 | 15 | 2 | 14 | 10 | 0（另有 1 个 @: 标题） | 5 | 16 |
| fatalMirage | 68 | 21 | 1 | 46 | 33 | 3 | 11 | 47 |
| toTheForbiddenPeaks | 51 | 30 | 1 | 20 | 12 | 0 | 9 | 21 |
| cityOfTheElderThings | 94 | 40 | 0 | 54 | 32 | 1 | 21 | 54 |
| theHeartOfMadnessPart1 | 79 | 59 | 0 | 20 | 14 | 3 | 3 | 20 |
| theHeartOfMadnessPart2 | 53 | 22 | 2 | 29 | 17 | 6 | 8 | 31 |
| **合计** | **469** | **260** | **10** | **199** | **121** | **14(+1)** | **73** | **209** |

### 3.3 按 layer（469 key 的 en 叶子归类）

| layer | keys | present | untranslated | missing | 待补正文 | 标题缺失 | 隐藏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| setup | 122 | 24 | 5 | 93 | 97 | 0（另 1 个 @: 标题） | 0 |
| intro | 73 | 66 | 1 | 6 | 0 | 1 | 6 |
| characters | 43 | 43 | 0 | 0 | 0 | 0 | 0 |
| resolutions | 65 | 43 | 4 | 18 | 15 | 5 | 2 |
| specialRules | 16 | 0 | 0 | 16 | 8 | 8 | 0 |
| interlude | 39 | 38 | 0 | 1 | 1 | 0 | 0 |
| labels | 42 | 0 | 0 | 42 | 0 | 0 | 42 |
| tokens | 58 | 46 | 0 | 12 | 0 | 0 | 12 |
| heading | 8 | 0 | 0 | 8 | 0 | 0 | 8 |
| deck | 3 | 0 | 0 | 3 | 0 | 0 | 3 |

> 注：拆章共享篇段在三份 part 中重复计数（见 ①）；「待补正文 / 标题缺失 / 隐藏」之和 = 209 = `chineseGaps`。

### 3.4 「中文待补」口径验证（B）

- 渲染路径：`web/scenario-setup-view.js#renderBlocks`（L52–58）对 `block.text` 为空且带 `missing` 的块统一渲染 `t('setup.chineseMissing')`（`web/locales/zh-CN.panels.js:9` = 「中文待补」）；intro/setup/specialRules/story/resolutions 五层全部走同一 `renderBlocks`（L84–88），**正文层口径一致**：实测 121 个缺译正文块全部会显示「中文待补」，无「缺译正文静默消失」。
- **不一致点**：`title` 缺译没有对应分支，`eoteBlocks` 直接省略 title → 14 个已登记缺译标题在面板中**完全不出现**、也不显示「中文待补」（见 finding `guides-0002`，high）；另有 1 个 `title` 因 `@:` 跨节引用被删空（`guides-0003`，high）。
- **未标 missing 的英文直接显示**：正文层未发现整段英文/整句英文（3+ 连续英文小写词 = 0 段）；但存在 7 段半译/夹英文片段（结算标签、`Setup.`、`Resolution 3:`、`Intro 3:`、`(v. I)` 等），见 `guides-0004`（medium）。en/zh 的图标 token 多重集合 **0 处不一致**（`[skull]/[free]/[per_investigator]` 等均一致）。

## ④ high 问题逐条

1. **`guides-0001`（symbol-format / high）：7 处 i18next 花括号转义 `{'{'}frost{'}'}` 原样进入正文**。位置：`web/scenario-guides/iceAndDeathPart2.json:44`（另有 Part3:52、toTheForbiddenPeaks:156/166/176、cityOfTheElderThings:323、theHeartOfMadnessPart1:203）。玩家看到的是 `向混乱袋中添加1个 {'{'}frost{'}'} 标记`，冰霜标记无法识别。根因：`tools/import-tde-story.mjs#cleanText` 只还原 `elderThing/tablet/fast` 三种转义、`tools/import-eote-story.mjs#localizePlaceholders` 不处理 `{'{'}x{'}'}`；同仓 `tools/import-scenario-guides.mjs#guideText` 有通用还原但 EOTE 生成链未复用。en locale 同源也有 7 处。
2. **`guides-0002`（missing-translation / high）：14 个已登记缺译标题静默消失，8 个特别规则分组标题整组丢失**。标题缺译时面板无「中文待补」，玩家只看到无标题的正文块（多数正文本身还显示「中文待补」，分组语义丢失）。样本：`iceAndDeathPart2.json:230`（No Resolution）、`fatalMirage.json:414`（Mirage）、`cityOfTheElderThings.json:562`（Keys）、`theHeartOfMadnessPart1.json:446/454/462`（Ancient Facility Locations / Seals / Location Adjacency…）、`theHeartOfMadnessPart2.json:333/341`（同上）等，全量 14 条见 `findings.json#samples` 与 `coverage.json` 的 `render.titleDropped`。
3. **`guides-0003`（missing-translation / high）：Part3「调查员设置」整段因 `@:` 跨节引用未展开而丢失（假性缺译）**。参考 locale 的 `part3.investigatorSetup.title/body` 在 **en/zh 两语都是** `@:edgeOfTheEarth.iceAndDeath.part2.investigatorSetup.{title,body}`；生成链 `stripRefs` 把整行删掉 → zh 面板该段显示「中文待补」（`iceAndDeathPart3.json:15-16` 记为 untranslated），en 面板该设置段整块不显示；而 **Part2 已有完整中文「调查员设置」及正文**，展开引用即可消除这个假性缺译。属可修缺陷而非真实缺译，建议优先修生成器。

## ⑤ 与既有 `chineseGaps` /「中文待补」口径的关系

- **已披露缺译（不算 bug）**：121 个正文块 + 73 个 skipped 键 + 14 个标题 + 1 个 `@:` 标题都已在参考 zh locale 缺失/未译、由 `story-text.js#chineseGaps` 显式登记；按 `_SPEC` §六，这些缺译在面板显示「中文待补」（正文层）是既有披露口径，不计为缺陷。它们全部进入 `coverage.json` 的补译 backlog（209 个章节 key + 69 个战役共享 key，共 278）。
- **新发现的缺陷（不在统计数字上，而在呈现/生成口径上）**：
  1. 标题缺译不显示「中文待补」（14 条，`guides-0002`）；
  2. `@:` 引用未展开造成 Part3 调查员设置**假性缺译**、en 面板整段丢失（`guides-0003`）；
  3. 7 处花括号转义乱码（`guides-0001`）；
  4. 7 段半译/夹英文未标缺译即显示（`guides-0004`）；
  5. 未知占位符 `[shelterValue]` 原样显示（`guides-0005`）；
  6. `chinese` 统计口径与面板可见口径不同：`chinese.total=469` 包含 126 个 skipped 键与 53 个 title 键；面板实际可读中文单元 207、显示「中文待补」121、标题缺失 15、hidden 126。**这是 P0/P7 既定统计口径，非生成物错误**；但对外引用「缺译 199 / 未译 10」时需注明其中 73 个不在面板显示、15 个标题不可见。
- **一致性结论（E，全部通过、无 finding）**：8 章的 `chineseGaps` 与源 locale 重算、与 `story-text.js` 逐键完全一致；`chinese/sectionCount/guideKeyCount/chineseStatus` 与生成物、`EOTE_STORY_META`（469 = 55+38+31+68+51+94+79+53）一致；`sources` 的 path/bytes/sha256 与参考文件实测一致；按 `buildEoteGuide` 逻辑重建的 `locales.zh/en` 与磁盘 JSON 逐字节等价（无生成物漂移）；拆分映射 `iceAndDeath→part1/2/3`、`theHeartOfMadness→part1/2` 与 `scenarios.md` §1 一致。

## ⑥ 未覆盖 / 存疑

- **en 英文面板未单独审计**：本次只审 zh 侧；生成链同源，推测 en 侧同样有 7 处花括号转义、且 Part3 调查员设置因 `@:` 整段缺失（已由 zh 审计顺带证明）。若要报 en 侧问题需另立 finding。
- **语义级误译仅做机械对照**：对 260 段 present-needs-review 未逐句人工重译；做了数字多重集合对照（阿拉伯数字，8 处候选均为中文数词/单位写法差异，如「五」vs「five」「40 磅」vs「forty pounds」，未列为缺陷）、列表符号/段落数对照。`guides-0012`（No Resolution 译法）与 `guides-0011`（Part2 标题数字）为标题级、有明确 en 对照，已报；其余可能的语义偏差需人工抽检。
- **`[shelterValue]` 的期望呈现方式需产品裁定**：静态指南拿不到运行时庇护值；是替换为「庇护值」文字还是由面板做动态插值，本次按缺陷登记（`guides-0005` medium），不擅自定方案。
- **繁体检测为白名单法**：仅命中「著」210 处及 计画/网路/想像 9 处；语料中未发现其他繁体字，但白名单外的异体字可能漏检（如全角/异体标点已由 C 类检查覆盖）。
- **战役共享段（base.json）只做三态 backlog（69 个缺译 key）**，未做符号/标点/渲染审计——那属 story area 范围，且不进指南面板。
- **未做浏览器实机截图验证**：只读审计，渲染结论来自 `web/scenario-setup-view.js`/`web/card-text.js` 代码路径与逐块数据；面板行为如需视觉证据，建议在补译批次后跑真实大厅 1440/390 验收。
- 本轮未修改源 locale；所有修法建议（`suggestion` 字段）供补译批次或生成器维护者执行，修后需重跑 `import-eote-story --write` / `import-scenario-guides --write` 并同步 `sources` 哈希与账本。

## ⑦ 复现命令

```bash
cd games/arkhamhorror

# 摘要（469 keys / 209 gaps / 278 backlog / 14 findings）
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs

# 逐字节校验磁盘产物（coverage.json / findings.json）
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --check

# 从脚本重新生成产物（Mod 目录可写时；本环境沙箱只读，先写 staging 再由 Lead 拷贝）
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --write
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --out-dir=<其他可写目录>

# 明细账本
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --print=coverage
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --print=findings
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --report=stats        # 标点/简繁/半译/结构统计
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --report=gaps         # 缺译逐 key + 标题缺失 + 渲染异常
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --report=flags        # 英文片段/token/下划线/引号/半全角样本
node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --report=consistency  # 与 story-text.js / 源锁一致性
```

产物：`docs/edgeOfTheEarth/translate/guides/coverage.json`（全量 backlog：8 章 209 + 战役共享段 69，含 path/layer/源文件行/面板指针/状态/en 摘要/渲染方式）、`findings.json`（14 条，_SPEC §5 schema）、本 `notes.md`。
