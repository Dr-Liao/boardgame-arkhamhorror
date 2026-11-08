# 《地球边缘》术语一致的性审计报告（terms / notes）

- 审计员：terms-audit（task-4）
- 日期：2026-11-09
- 工作区：`games/arkhamhorror/docs/edgeOfTheEarth/translate/terms/`（只读审计，未修改任何既有游戏文件）
- 工具：`docs/edgeOfTheEarth/translate/tools/terms-scan.mjs`（可复现，node 直跑，不 spawn 子进程）
- 产物：`findings.json`（22 条）、`glossary.md` / `glossary.json`（术语总表）、本文件、`tools/terms-scan.mjs`

## 一、范围与输入

| 层 | 输入 | 纳入语料 |
| --- | --- | --- |
| cards | `src/cards/cards-data.js` 的 08 号段 403 卡中文字段（nameZh/subnameZh/textZh/backTextZh/flavorZh/backFlavorZh/traitsZh/customization*） | 1,521 条 / 49,353 汉字 |
| story | `content/campaigns/edgeOfTheEarth/story-text.js`（8 章 sections + campaign 各段；去掉 campaign.checkpoints/interludes 嵌套副本、chapter.intro/setup/resolutions、localeKeys 扁平副本） | 429 条 / 55,989 汉字 |
| guides | `web/scenario-guides/{iceAndDeathPart1/2/3,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadnessPart1/2}.json` 的 `locales.zh`（跳过 `missing/untranslated` 叶子） | 207 条 / 26,040 汉字 |
| rules | `web/eote-rules.js` 23 条规则书条目的标题+正文段落 | 94 条 / 5,747 汉字 |
| modules | `keywords.js`、`records.js`、`shared-encounters.js`、`parts.js` 的中文常量 | 84 条 / 307 汉字 |
| 对照（只读，不计入统计） | `参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json`（简中权威卡面）、`cards_zh.json`（繁中）、`cards_en.json`；`frontend/src/locales/zh/{label.json,cards.json}`；`frontend/src/locales/zh/edgeOfTheEarth/**` | — |

口径说明：
- 统计单位是「去重后的中文 doc」（卡面按字段、剧情按段落、指南按叶子、规则书按段落）。纯英文回退段落不计入术语语料（属 story/guides 漏翻审计范围）；这也是文件里 body/text 双份写入但只计一次的原因。
- 每条 sample 的 `path:line` 由脚本用中文片段回定位原始文件行；定位失败的条目不输出。本次 `unlocated=0`。
- 参考卡面对照：repo 08 段 `textZh` 与上游 `cards_zh-cn.json` 的 `text` **完全一致（0 差异）**；差异只有 164 条 `traitsZh` 分隔符（repo 用「、」，上游用「. 」）与 26 条 flavor 的 `<cite>` 标签。因此卡面上的术语问题基本都是 **上游继承（upstream-zh-cn）**，不是本仓改写。

## 二、方法与命令

```powershell
# 在 Mod 根 games/arkhamhorror/ 下执行
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs            # 摘要（术语矩阵/专名差异/简繁/标点/关键词/上游对照）
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --write    # 写 terms/scan-report.json（约 0.8MB）
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --json     # 完整报告到 stdout
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --term=tekelili   # 单术语变体+样本
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --names / --chars / --punct / --icons / --keywords / --english / --markers / --diff
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --contains=明瞭   # 任意中文串的跨层位置
```

本次运行摘要（复算基准）：

```
语料层：cards=1521条/49353汉字  story=429条/55989汉字  guides=207条/26040汉字  rules=94条/5747汉字  modules=84条/307汉字
docs=2335  unlocated=0  warnings=0
繁体字命中：661（著→着，story=451, guides=210）
关键词与卡面不一致：retaliate 11 张（卡面「反击」）、fast 42 张（[fast]→[free]）、tekelili 46 张（卡面名无「！」）、shelter 13 张（卡面「庇护N」）等
卡面 EN→ZH 图标 token 不一致：fast→free 53 卡 / 58 处
上游对照：比较字段 2015，一致 1825，差异 190（traitsZh 164 + flavor 26）
内部标记：escaped-brace-leak 23、[shelterValue] 4
```

> 沙箱备注：本会话的 pwsh/node 进程被 DSH 文件沙箱限制，`fs.writeFileSync` 写 workspace 会 EPERM（write 工具不受影响）。因此脚本 `--write` 会自动回退写到 `%TEMP%\eote-terms-scan-report.json` 并打印提示；扫描本身的统计完全由 `--json`/摘要复算，`scan-report.json` 不是本 area 的交付依赖。若需要归档该报告，在非沙箱环境重跑 `--write` 即可，或把临时文件拷到 `docs/edgeOfTheEarth/translate/terms/scan-report.json`。

## 三、结论统计

- **findings 22 条**：high 3 / medium 16 / low 3；
  分类：terminology 14、symbol-format 5、mixed-language 2、missing-translation 1。
- 另有 8 组**误报排除**（见 `findings.json#falsePositives`：敌军阶段、损伤、技巧、胜利区、Hidden Tunnel、Level、Massive=庞大、冒险???）。
- 核心术语整体健康度：
  - 统一且无冲突：毁灭标记、线索、伤害、支援、事件、技能、诡计、敌人、地点、幕、结局、战役、探险、钥匙、封印、标记、调查员、弱点、遭遇组、营地、目标、撤退、混乱标记/混乱袋、瘴气、未勘之地、创伤、敌军阶段等。
  - 关键词（38 条）卡面对齐良好，仅 **Retaliate=报复**（应为反击）、**Tekeli-li 多感叹号**、**Titanic「巨型」** 三处关键名失真；Massive=庞大（不是巨大）经证据核实为上游一致口径。
  - 专名：5 位调查员、9 位伙伴（正文/卡面/指南三层）、9 件纪念逝者、5 个章节、主要敌人/地点（伊夸之门、迷雾高塔、无名疯狂、星之恐怖、修格斯等）均同写，未发现异译；偏差集中在 **records.js 的 2 个营地名**、**物资 2 件**、**story 记录层伙伴名缺失**。
- 简繁/异体：繁体仅集中在「著」661 处（story 451 / guides 210，cards 193 处全为「着」）；「明瞭」3 处误写，「瞭望」4 处正确；其余繁体/异体对 0 命中。
- 标点/数字：卡面沿用上游「全角句读 + 半角括号」；story/guides 混入英文式半角编号（`: .`）与重复「。.」133 处；rules 用「「」」引号、story 用「“”」；`•` 与行首 `-` 分属剧情/卡面，属层内风格差异。均已在 glossary §五 给出统一口径。

## 四、High 问题逐条

1. **terms-0001 图标 token `[fast]`→`[free]`（53 卡 / 58 处）**
   EN 卡面 58 处 `[fast]` 在 zh 卡面全部变成 `[free]`（zh `[free]` 58 处、`[fast]` 0 处；EN 恰好相反）。仓库渲染层把两者区分：`web/locales/zh-CN.table.js:12-13` free=「免费触发」、fast=「快速」，`web/card-text.js:17` 分别映射不同标签/规则链接。玩家看到「快速」能力被标成「免费触发」，属规则可见错误。来源：上游 `cards_zh-cn.json` 继承（本仓 08 段 textZh 与之逐字节一致）。建议 cards 审计统一改回 `[fast]`。
   样本：`src/cards/cards-data.js:285465`（08002 机修工的扳手）、:285741（08005 伊波恩之书）、:288342（08041 通路档案）、:291188（08089 快拔枪套）。

2. **terms-0002 转义占位串 `{'{'}frost{'}'}` 泄漏 23 处**
   story 16 处 + guides 7 处，形如「向混乱袋中添加1个 {'{'}frost{'}'} 标记。」。这是参考工程 zh locale 把 `{frost}` 插值误转义成 `{'{'}frost{'}'}` 后进入中文正文；玩家会在剧情/指南里看到一段乱码而不是 `[frost]` 图标。来源：reference-locale（story/guides 生成链）。
   样本：`content/campaigns/edgeOfTheEarth/story-text.js:2288`、:2489、:3044；`web/scenario-guides/iceAndDeathPart2.json:44`、`iceAndDeathPart3.json:52`。

3. **terms-0003 战役记录标签「Camp - X (N)」13 条**
   13 个营地记录键的中文标签全部带英文前缀 `Camp - ` 和半角括号，如「Camp - 屏障营地 (7)」，而 records.js 自己的回退格式是「屏障营地（庇护 7）」。战役日志/记录面板直接显示这些标签，13/56 键受影响。来源：reference-locale（story-text 生成）。
   样本：`content/campaigns/edgeOfTheEarth/story-text.js:1139,1160,1188`。

## 五、与上游/参考工程口径的关系

| 问题 | 来源判定 | 依据 |
| --- | --- | --- |
| [fast]→[free] | **upstream-zh-cn（继承）** | repo 08 段 `textZh` 与 `cards_zh-cn.json` 的 text 完全一致；上游全库同样存在 537 处 [free] 对 140 处 [fast] |
| 木制雪撬/雪橇 | **upstream-zh-cn（继承）** | 上游 08615 卡名即「木制雪撬」，且同卡第二段又写「木制雪橇」 |
| 庇护N（卡面） | **upstream-zh-cn（继承）** | 上游 08502–08514 正文即「庇护N」 |
| 著/着混用、明瞭、[shelterValue]、Camp - 标签、escaped-brace | **reference-locale（参考工程 zh locale 继承）** | 与 `参考资源/…/locales/zh/edgeOfTheEarth/**` 一致；本仓 story/guides 由该 locale 生成 |
| keywords.js Retaliate=报复 / Tekeli-li！/ Titanic=巨型 | **repo-authored（本仓数据）** | 与本仓卡面及上游卡面均不一致；keywords.js 为 P3 手写数据 |
| rules 层 议程/战役日志/Broken/Unbroken/泰坦坡道/无名狂魔/备件 | **repo-authored（规则书自写）** | 与卡面/story 口径不一致，只出现在 `web/eote-rules.js` |
| records.js 莱克营地遗迹/水晶洞窟 | **repo-authored（本仓模块）** | 与卡面+story 标签不一致，records.js 是唯一偏差 |

## 六、未覆盖 / 需人工裁定

1. **纯英文回退段**：story/guides 中大量整段英文（story-text `chineseGaps`、guides `missing/untranslated`）未计入术语语料，属 story/guides 审计范围；本次只在 `crossArea` 备注。
2. **卡面 `[fast]` 修复归属**：terms 只登记跨层口径，实际改卡属 cards 审计（改 textZh 需重跑 cards 账本与上游 SHA 对照）。
3. **Massive/Titanic 的 trait 译名**：`[[Titanic]]` 在本循环 08 段没有作为卡面 traitsZh 出现（卡面用「巨大坡道」专名），keywords.js 的 trait「巨型」缺乏卡面证据，需 cards 审计裁定是数据问题还是分类问题。
4. **「同伴/队友 vs 伙伴」「场景/剧本/冒险」「物资/补给品/补给」「庇护N vs 庇护值」**：属语境分工而非硬错误，已在 glossary 给出分语境推荐，未升级为 findings（仅 terms-0018 卡面庇护值列为 medium）。
5. **两处角色名省略敬称**：story 记录标签用「戴尔」「肯斯勒博士」而卡面为「威廉·戴尔教授」「艾米·肯斯勒博士」，属正常叙事省略，未报。
6. **未逐个枚举 266 张战役卡的专名**：本次对 9 位伙伴、7 件物资、13 个营地、5 章、主要敌人/地点（10+）做了全层核对；卡名系统性抽查通过（5 位调查员、纪念逝者 9 件全一致），其余长尾专名由 cards 审计逐卡对照。

## 七、跨 area 线索（供 Lead 合并去重）

- cards-audit：`[fast]→[free]` 53 卡（terms-0001）；卡面「庇护N」是否补「值」（terms-0018）；08615 卡名/正文「雪撬/雪橇」（terms-0011）。
- story-audit：`{'{'}frost{'}'}` 23 处（terms-0002）；Camp 标签英文前缀（terms-0003）；伙伴名 9/9 英文回退（terms-0019）；`[shelterValue]`/Shelter Value/Experience（terms-0015）；「著」661 处（terms-0013）；`冒险???` 为印刷留白，勿误报。
- guides-audit：与 story 同源（terms-0002/0013/0015/0016/0017 的 guides 侧）。
- rules-audit（如有）：`web/eote-rules.js` 的 议程 5 处、战役日志 12 处、Broken/Unbroken、泰坦坡道、无名狂魔、备件（terms-0006～0010、0021）。
- Lead：`keywords.js` 属共享数据，若 rules 面板后续消费 `EOTE_KEYWORDS.zh`，Retaliate/Tekeli-li 会直接显示错误名，建议在收口时一并修正（terms-0004/0005）。

## 八、复现命令

```powershell
cd games/arkhamhorror
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs                        # 摘要
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --write                # scan-report.json（沙箱内回退 TEMP 并提示）
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --term=retaliate       # Retaliate 变体/卡面样本
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --names                # 专名四层计数 + 卡面 vs 模块差异
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --chars                # 著/着 与异体对统计
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --punct                # 标点/数字逐层计数
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --icons                # 图标 token + [fast]→[free] 对照
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --keywords             # keywords.js vs 卡面一致性
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --markers              # escaped-brace / [shelterValue] / 占位符
node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --diff                 # 与上游 cards_zh-cn 差异（归一化后）
```
