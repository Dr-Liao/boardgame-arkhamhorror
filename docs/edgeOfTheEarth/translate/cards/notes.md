# EOTE（《地球边缘》）卡面中文翻译审计 · cards

> area：`cards` ｜ auditor：`cards-audit` ｜ 日期：2026-11-09 ｜ 性质：**只读审计**（未修改 `src/`、`content/` 等既有文件）
> 产物：`cards/findings.json`（32 条聚合 findings）、`cards/_dump.md`（403 卡中英对照，供复核）、`tools/cards-scan.mjs`（可复现脚本）

## ① 范围与输入

- **对象**：`src/cards/cards-data.js` 中 `pack=eoep`（137 张，调查员包）与 `pack=eoec`（266 张，战役包）共 **403 张**，08 号段（`08001`–`08133`、`08501`–`08738`，含 `08011a/b`–`08014a/b`、`08556b`–`08583b` 等 a/b 面）。
- **字段**：`name/nameZh`、`subname/subnameZh`、`text/textZh`、`backName/backNameZh`、`backText/backTextZh`、`flavor/flavorZh`、`backFlavor/backFlavorZh`、`traits/traitsZh`、`customization*`（EOTE 全为空）。共 **4030 个展示字段**。
- **上游权威对照（只读）**：`参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json`（简体上游）、`cards_zh.json`（繁体）、`cards_en.json`。
- **既有口径**：README §2 已声明 EOTE 卡中文来自上游 ArkhamDB 简体数据（`tools/import-cards.mjs` 生成，逐字段优先 zh-cn、其次繁中、最后英文回退，再 `stripHtml` 去标签）；`officialChinese=false` 只针对剧情/指南，卡面中文按上游简体继承处理。

## ② 方法与命令

1. **来源复算（判定继承 vs 本仓改写）**：按 `tools/import-cards.mjs` 的 `localeFields/normalizeCard/stripHtml` 规则，对 10 个展示字段逐个复算期望值（zh-cn 简中 / zh 繁中 / en 回退），与本仓实际 `*Zh` 做逐字节比较；不一致即为「本仓导入/改写差异」。
2. **机械扫描**：`[icon]`/`[[特性]]`/`{占位符}` token 多重集、数字多重集、行数、括号/引号配对、重复标点、HTML 残留、U+FFFD、首尾/连续/多余半角空格、全/半角、繁简用字、术语变体、行级「伤害/恐惧」「否定」对照、卡名自引用与跨卡名引用、引文署名格式。
3. **人工复核**：脚本导出 `_dump.md`（403 卡 name/子名/特性 + 正反面 rule text 中英对照 + 字段行号）后，**eoep 137 张 + eoec 266 张全部规则文本逐卡精读**（含背面）；风味文本按可疑清单抽查、80 处 Lovecraft 引文署名全查。
4. **脚本**（从 Mod 根直接运行，不 spawn 子进程）：
   ```bash
   cd games/arkhamhorror
   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs
   ```
   注：本机 shell 文件沙箱对 `games/arkhamhorror/**` 子目录只读（`EPERM`），脚本写产物时自动回退到 workspace 根 `.eote-cards-staging/`，再由主进程拷入 `cards/`；脚本本身与 `findings.json`/`_dump.md` 的生成逻辑不受影响。

## ③ 结论摘要与统计

**核心结论**：403 张卡的全部 4030 个 zh 展示字段，与上游 `cards_zh-cn.json` 经 `stripHtml` 去标签后的结果**逐字节一致**；无英文回退、无繁中回退、`localeStatus` 全部复算一致。因此本轮 **所有 findings 均为上游简体继承问题（`source: upstream-zh-cn`），本仓导入/改写引入的问题为 0 处**。

- **findings**：32 条（聚合口径，覆盖 **149 处** occurrence，见 `count` 之和）。
- **byCategory**：`symbol-format` 11 ｜ `terminology` 12 ｜ `mistranslation` 8 ｜ `mixed-language` 1 ｜ `missing-translation` 0 ｜ `marker-leak` 0。
- **bySeverity**：`high` 2 ｜ `medium` 6 ｜ `low` 24。
- **medium 速览**：`[fast]→[free]` 图标系统性替换（53 字段/58 token）；08520 `[[Objective]]` 标记丢失；08622 Campaign Log 误作「剧本手册」；08037 正文自名「地区探测」≠卡名「地区勘测」；08008 调查员名「雷蒙特·杰克」≠「蒙特雷·杰克」；08615「木制雪撬」≠「木制雪橇」。
- **机械检查通过（0 问题）**：漏翻/未译/英文残留、`localeStatus` 不符、`{占位符}`、HTML 残留、U+FFFD、括号/引号不配对、全角字母数字、`traits` 与 en 数量不一致、同一 en 名称/特性多译、繁简残留（333 字繁→简对照表 0 命中）、`[[特性]]` 133 处仅 08520 一处丢失。
- **规模说明**：任务书预期 findings 80–250 条；实际聚合 32 条（149 处）。原因：卡面中文几乎全量继承官方简中、翻译总体质量高，且 `_SPEC` 要求同根因合并（如 58 个 `[fast]` token 合并为 1 条、79 处引文署名换行合并为 1 条）；**未为凑数拆条**。若按卡/按位置拆分会虚增到数百条，反而掩盖高频系统性问题。

## ④ high 问题逐条复述

1. **cards-0013 ｜ 08586（Anamnesis/回首往事）`textZh` 伤害/恐惧混淆（high）**
   - 位置：`src/cards/cards-data.js:300191`（`08586.textZh`）。
   - en：「Revelation - You must either (choose one): / - **Take 2 horror**.」→ 简中：「- 受到**2点伤害**。」
   - 影响：规则级误译——「受到恐惧」与「受到伤害」影响不同的伤害/恐惧分配与治愈路径（尤其该卡还有「险境」不可交流）。
   - 处置：改为「受到2点恐惧」；上游继承（上游 cn 原文同错，繁中亦为「恐懼」，可佐证）。
2. **cards-0014 ｜ 08022 / 08036 / 08050「for each different class」按卡计数（high）**
   - 位置：`src/cards/cards-data.js:287213`（`08022.textZh`；另见 08036/08050）。
   - en：「For each **different class** among cards you control, …」→ 简中：「你**每控制一张不同职阶的卡牌**，……」（按**卡牌张数**计数）。
   - 影响：直接改变效果量级（例：控制 2 个职阶共 5 张卡时，正确为 +2，按简中字面为 +5）。
   - 佐证：繁中「你控制的卡牌之中每有一個不同的職階」；同包 08077 简中亦为「你控制的卡牌中**每有一个不同的职阶**」——可见按职阶才是本批译者的既定口径。
   - 处置：三张卡改为「你控制的卡牌中每有一个不同的职阶，……」；上游继承，建议上游/本地补丁同时修。

## ⑤ 继承 vs 本仓新增（量化）

| 检查项 | 结果 |
| --- | --- |
| 展示字段来源复算 | `translated`（简中）1588 ｜ `not-applicable`（en 本身为空）2442 ｜ 英文回退 **0** ｜ 繁中回退 **0** |
| 本仓与上游导入期望不一致字段 | **0 / 4030** |
| `localeStatus` 与实际不符 | **0 / 403**（全部 `complete` 且复算一致） |
| findings 来源 | `upstream-zh-cn` **32 / 32**；`repo-authored/generated` **0** |

重点核实（与 Lead 关注点）：

- **08520 的 `[[Objective]]`**：上游 `cards_zh-cn.json` 原文写作 `<i>(然后，结算场景1a上的<b>目标</b>)</i>`——**上游简中本身没有使用 `[[ ]]` 标记特性**；本仓按既定导入规则 `stripHtml` 去 HTML 标签后得到纯文本「目标」。即「**上游未标记 + 本仓去 HTML 后无标记**」，**不是本仓在去标签过程中丢失**（`[[ ]]` 从未出现在上游原文里；繁中同为 `<b>目標</b>`）。本条属上游继承，定性为「上游简中未用特性括号」而非「本仓丢失」。
- **`[fast]→[free]`**：上游 zh-cn 原文即全部写作 `[free]`（简体卡表把快速时间窗图标记作 free token），非导入替换。
- **FAQ 注记 / 「险境」多出 / 引文署名换行合并**：均能在上游 zh-cn 原文找到相同文本，属上游继承。
- 与「导入机制」相关的两处变换（traits 用 `/`、`。` 切分；`*Zh` 去 HTML 标签）经 4030 字段比对**未造成任何差异**。

## ⑥ 未覆盖 / 存疑（需人工裁定或其它 area）

1. **无官方卡图比对**：08706/08707 简中多出「险境（Peril）」而 en 文本无 Peril（繁中亦有），无法仅凭数据判定是英文数据缺漏还是简中多译；08596/08635 的 `(FAQ，v2.1)` 勘误注记同理（en 无对应）。两者均标 `low` 并给出两种处置。
2. **低风险语义存疑**：08650–08653「可以共同花费…来激活」较 en 增「可以」（可选化）；08671「bearer's deck→承受者的牌库」；08047「H.P.洛夫克拉夫特，《无名之城》」署名格式。均标 `low`，建议产品口径裁定。
3. **简繁检测方法**：使用脚本内 333 字「繁体→简体」对照表（非完整 OpenCC），EOTE 简中语料 0 命中；若后续需完整简繁校验，可换 OpenCC。
4. **风味文本**：为抽查 + 80 处引文署名全查，未逐字精读全部约 153 段风味；可疑清单（含英文字符、空格、行数差异）已全部覆盖。
5. **跨循环术语**（如 Spirit/Charm 等特性译名与其它循环是否一致）归 `terms` area；本 area 只报 EOTE 内部不一致（并用繁中作单点对照）。
6. **渲染层**：未验证 `[free]` 在 Mod 界面实际渲染的图形，仅按数据 token 差异报出；如需可查 `web/` 图标渲染表。

## ⑦ 复现命令

```bash
cd games/arkhamhorror

# 复现统计（打印 32 条 findings 的 id/分类/严重度/count + byCategory/bySeverity，与 findings.json 完全一致）
node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs

# 输出完整 findings JSON（stdout）
node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --json

# 重新生成 cards/findings.json 与 cards/_dump.md（若本机沙箱拒写 cards/，自动回退到 ../../.eote-cards-staging/）
node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --write --dump

# 仅生成 403 卡中英对照 dump
node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --dump
```

- 输入：`src/cards/cards-data.js`（403 张，08 号段）+ `参考资源/ArkhamHorror-main/frontend/public/cards_{en,zh-cn,zh}.json`。
- 脚本内的源码块索引保证每条 finding 的 `location`（`src/cards/cards-data.js:行号`）可复算、非手写。
