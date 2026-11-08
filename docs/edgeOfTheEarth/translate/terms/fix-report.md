# EOTE 术语/用字修复记录（terms，2026-11-09）

> 审计基线：[`findings.json`](findings.json)（22 条）、[`notes.md`](notes.md)、[`glossary.md`](glossary.md)。
> 结果：**21 条已修复、1 条保留说明**。
> 修复落点：`content/campaigns/edgeOfTheEarth/keywords.js`、`web/eote-rules.js`、`content/campaigns/edgeOfTheEarth/{records,interludes}.js`、`card-text-fixes.js`、`tools/import-eote-story.mjs#normalizeZhText`、本地补译层。

## 逐条状态（22 条）

| id | 严重度 | 结论 | 修复内容 |
| --- | --- | --- | --- |
| terms-0001 | high | ✅ 已修 | 53 张卡面 `[free]` → `[fast]`（与 cards-0001 同一修复） |
| terms-0002 | high | ✅ 已修 | 剧情/指南 `{'{'}frost{'}'}` → `[frost]`（生成器还原，含 en 侧同源转义） |
| terms-0003 | high | ✅ 已修 | 13 个营地标签 `Camp - 屏障营地 (7)` → `屏障营地（庇护 7）`（补译层） |
| terms-0004 | medium | ✅ 已修 | `keywords.js` Retaliate `报复` → `反击` |
| terms-0005 | medium | ✅ 已修 | Tekeli-li 卡名/trait → `忒咳哩-哩！`（规则书同步） |
| terms-0006 | medium | ✅ 已修 | 规则书 `战役日志` → `剧本日志`（12 处） |
| terms-0007 | medium | ✅ 已修 | 规则书 agenda `议程` → `密谋`（5 处） |
| terms-0008 | medium | ✅ 已修 | Broken/Unbroken → `破功/运功`（英文别名/trait 保留） |
| terms-0009 | medium | ✅ 已修 | Titanic Ramp 统一 `巨大坡道`；keywords trait 巨型 → `巨大` |
| terms-0010 | medium | ✅ 已修 | `无名狂魔` → `无名疯狂`（规则书 2 处） |
| terms-0011 | medium | ✅ 已修 | Wooden Sledge 统一 `木制雪橇`（卡名错字由 card-text-fixes 修） |
| terms-0012 | medium | ✅ 已修 | `莱克营地遗址` / `水晶洞穴`（records.js 对齐卡面） |
| terms-0013 | medium | ✅ 已修 | 中文 `著` → `着`（生成器归一；保留著名/著作/著称等），现状 0 |
| terms-0014 | medium | ✅ 已修 | 剧情/指南 `牌组` → `牌库`（154 处）；`牌堆` 保留用于公共/忒咳哩-哩牌堆（层级术语） |
| terms-0015 | medium | ✅ 已修 | 结局清单英文标签/占位符 → 「庇护值：营地庇护值」「经验值：（按上述说明计算）」 |
| terms-0016 | medium | ✅ 已修 | `。.` / `：:` 等重复标点归一（生成器） |
| terms-0017 | medium | ✅ 已修 | 英文式编号（`引言 1:` / `导言 2.` / `进入 设置.`）→ 中文标点 |
| terms-0018 | medium | ⏸ 保留 | 卡面 `庇护7`（无「值」）与剧情/规则 `庇护值` 属卡面 vs 规则文本层级差异，按上游印刷格式保留（见 `../fix-batch.md` §5.6） |
| terms-0019 | medium | ✅ 已修 | 9 位伙伴名全部补中文（`story-text.campaign.records.partnerNames`，`localeKeys` 258/258 present） |
| terms-0020 | low | ✅ 已修 | `明瞭` → `明了`（3 处；`瞭望` 保留） |
| terms-0021 | low | ✅ 已修 | 规则书 `备件` → `备用零件` |
| terms-0022 | low | ✅ 已修 | 罗马数字 `第 I 部分` → `第I部分`（生成器归一，17+19 处） |

## 新增/更新的术语口径

| 英文 | 统一中文 | 说明 |
| --- | --- | --- |
| Retaliate | 反击 | `keywords.js` 与全部卡面对齐 |
| Agenda | 密谋 | 卡面/剧情/指南/规则书统一 |
| Campaign Log / Campaign Guide | 剧本日志 / 剧本手册 | 两者区分 |
| Deck | 牌库（规则/剧情）；牌堆（公共/忒咳哩-哩牌堆） | 规则层不再用「牌组」 |
| Shelter / Shelter Value | 庇护值（剧情/规则）；卡面「庇护N」 | 层级差异保留 |
| Broken / Unbroken | 破功 / 运功 | 英文别名数组保留 |
| Tekeli-li | 忒咳哩-哩 | 卡名/trait 带「！」，正文按语境 |
| Titanic | 巨大 | `巨型` 不再使用 |
| Level | 高度（高度等级 → 高度） | keywords 与卡面一致 |
| No Resolution | 未达成结局 | 八章统一 |
| MIA / XP | 失踪 / 经验值 | 日志行内不再用英文缩写 |

## 验证

```bash
cd games/arkhamhorror
node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs   # ok=true（含繁体/台港词/牌组/明瞭等残留扫描）
node --test tests/eote-rules.test.mjs tests/eote-story.test.mjs # 全绿
node tools/audit-eote-rules.mjs --check                          # exit 0
```
