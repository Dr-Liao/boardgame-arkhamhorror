# EOTE 卡面翻译修复记录（cards，2026-11-09）

> 审计基线：[`findings.json`](findings.json)（32 条）、[`notes.md`](notes.md)、[`_dump.md`](_dump.md)。
> 修复入口：`content/campaigns/edgeOfTheEarth/card-text-fixes.js`（`applyEoteTextFixes` / `EOTE_CARD_TEXT_FIX_META`），由 `tools/import-cards.mjs#mergeCatalog` 在导入时调用后重生成 `src/cards/cards-data.js`。
> 结果：**30 条已修复、2 条保留说明**；`node tools/import-cards.mjs --check` exit 0。

## 1. 修复手段

| 手段 | 内容 |
| --- | --- |
| 按卡号规则表（28 条） | `CODE_RULES[code]` 对指定字段做定点替换（误译/错字/术语/数字体例），仅对 `eoep`/`eoec` 08 段生效 |
| 通用规则 | ✅ en 含 `[fast]` 时把 zh `[free]` 改为 `[fast]`（53 张）<br>✅ `[frost]` → `[frost]标记`<br>✅ 标点归一（`。.`、半角标点、双空格、行末标点）<br>✅ 引文署名统一（80 处 → `H. P. 洛夫克拉夫特《…》`）<br>✅ 删除上游 `(FAQ，v2.1)` 勘误注记（en 无对应内容，2 处）<br>✅ 12 张卡阿拉伯数字体例（`一张→1张`、`两次→2次`） |
| 字段范围 | `nameZh / subNameZh / textZh / backNameZh / backTextZh / flavorZh / backFlavorZh`，只改展示字段，不动规则/构筑元数据 |

## 2. 逐条状态（32 条）

| id | 严重度 | 结论 | 修复内容 |
| --- | --- | --- | --- |
| cards-0001 | medium | ✅ 已修 | 53 张卡的 `[free]` → `[fast]`（58 token） |
| cards-0002 | medium | ✅ 已修 | 08520 `[[目标]]` 恢复方括号 |
| cards-0003 | low | ⏸ 保留 | 卡面换行/分段与 en 排版不同，内容一致（见 `../fix-batch.md` §5.1） |
| cards-0004 | low | ✅ 已修 | 多余半角空格清理（9 字段） |
| cards-0005 | low | ✅ 已修 | `。 (…)。` → `（…）。` 句末标点去重 |
| cards-0006 | low | ✅ 已修 | `-1[icon]` 空格统一 |
| cards-0007 | low | ✅ 已修 | `[frost]` → `[frost]标记` |
| cards-0008 | low | ✅ 已修 | 关键词行「目标 -」补空格 |
| cards-0009 | low | ✅ 已修 | 规则行句末标点补齐（7 处） |
| cards-0010 | low | ✅ 已修 | `简单/ 普通` → `简单/普通` |
| cards-0011 | low | ✅ 已修 | 12 张卡数字体例统一 |
| cards-0012 | low | ✅ 已修 | 删除 2 处 `(FAQ，v2.1)` |
| cards-0013 | high | ✅ 已修 | 08586 `受到2点伤害` → `受到2点恐惧` |
| cards-0014 | high | ✅ 已修 | 08022/08036/08050 → 「每有一个不同的职阶」 |
| cards-0015 | medium | ✅ 已修 | 08622 `剧本手册` → `剧本日志` |
| cards-0016 | low | ✅ 已修 | 08671 `承受者的牌库` → `其持有者的牌库` |
| cards-0017 | low | ✅ 已修 | 08650–08653 强制能力去「可以」（4 张） |
| cards-0018 | low | ✅ 已修 | 08112 `经其` → `将其` |
| cards-0019 | low | ✅ 已修 | 08596 补「你所在地点」 |
| cards-0020 | low | ⏸ 保留 | 08706/08707「险境」中文正确，en 缺 Peril（见 `../fix-batch.md` §5.2） |
| cards-0021 | medium | ✅ 已修 | 08037 `地区探测` → `地区勘测` |
| cards-0022 | medium | ✅ 已修 | 08008 `雷蒙特·杰克` → `蒙特雷·杰克` |
| cards-0023 | low | ✅ 已修 | 14 张卡统一「隐藏值」 |
| cards-0024 | low | ✅ 已修 | 08114/08115 统一「每套牌库仅限1张」 |
| cards-0025 | low | ✅ 已修 | 08076 等统一「毁灭标记」 |
| cards-0026 | low | ✅ 已修 | 08048 等统一「忽略」 |
| cards-0027 | low | ✅ 已修 | 08127 等统一「标准伤害」 |
| cards-0028 | low | ✅ 已修 | 08673 等 `战斗值` → `攻击值` |
| cards-0029 | low | ✅ 已修 | 08509 `战役` → `剧本` |
| cards-0030 | medium | ✅ 已修 | 08615/08513/08127 → `木制雪橇`（错字 `雪撬`） |
| cards-0031 | low | ✅ 已修 | `复盖` → `覆盖` |
| cards-0032 | low | ✅ 已修 | 80 处引文署名统一格式 |

## 3. 验证

```bash
cd games/arkhamhorror
node tools/import-cards.mjs --check    # exit 0
node --test tests/import-cards.test.mjs  # 通过（唯一失败为工作区既有调查员可选池计数，本批未触碰）
```

- 生成物：`src/cards/cards-data.js` 由工具重生成（未手改）；
- 逐卡中英对照快照仍见 [`_dump.md`](_dump.md)（审计时点，修复后差异见 `card-text-fixes.js` 规则表）；
- 卡面规则行为未改：`cards-data.js` 只改中文展示字段，`ALL_CARDS` 的规则/构筑元数据不变。
