# 《沉没之城》剧情自译规范（narrative-guides worker）

本目录 `content/campaigns/theDrownedCity/story-source/zh-CN/` 存放《The Drowned City》的**自译**简体中文
剧情正文。参考工程没有本循环的 `locales/zh/`，因此中文不是官方译文，生成器会在 `TDC_STORY_META.officialChinese = false`，
并逐键记录缺译（`chineseGaps`）。**严禁把英文原文塞进中文值充数**：生成器会把这样的叶子判为缺译并报错。

## 1. 输入与输出

- 英文事实源（只读）：`参考资源/ArkhamHorror-main/frontend/src/locales/en/theDrownedCity/<file>.json`
- 自译输出：本目录 `<file>.json`（整文件），或 `<stem>.part<N>.json`（分段，按 N 升序深合并，只写分到的子树）。
- 输出必须是 UTF-8、两空格缩进、合法 JSON；**键结构、键名、数组长度与英文完全镜像**（不要加注释键/元数据键）。

## 2. 翻译规则

1. 只翻译字符串值；键名/结构/数组长度不变。
2. 完整忠实翻译：不摘要、不删句、不合并段落。HTML 段落数、列表项数与英文一致。
3. 原样保留、不翻译：
   - HTML 标签与属性：`<p ...>`、`<span ...>`、`<b>`、`<ul><li>`、`<img ...>`、`<section class='encounter-sets'>…</section>`；
   - 占位符：`{setImgPath}`、`{'{'}runeA{'}'}`、`{'{'}cultist{'}'}`、`{xp}`、`{fast}`、`{name}` 等（花括号内一律不动）；
   - 键引用：`@:theDrownedCity.additionalRulesAndClarifications.floodTokens` 之类整串保留；
   - 强调标记成对保留：`_斜体_` → `_中文_`，`*加粗*` → `*中文*`；
   - 卡牌/游戏符号 token：`[elder_thing]`、`[guardian]`、`[per_investigator]`、`[auto_fail]` 等。
4. 译名一律用本地卡表 `nameZh`（优先）或下方固定表；同一专有名词全文件、全 worker 一致。
5. 不得保留整句英文。仅当英文是纯符号/编号时才可原样（实际几乎不存在）。

## 3. 固定译名表

| English | 中文 |
| --- | --- |
| The Drowned City | 沉没之城 |
| R'lyeh | 拉莱耶 |
| Cthulhu / Great Cthulhu | 克苏鲁 / 伟大的克苏鲁 |
| Dagon | 达贡 |
| Arkham | 阿卡姆 |
| Miskatonic University / River | 米斯卡塔尼克大学 / 米斯卡塔尼克河 |
| Arkham Advertiser / Arkham Asylum / Orne Library | 阿卡姆广告报 / 阿卡姆疯人院 / 奥恩图书馆 |
| Randall Tillinghast / Tillinghast Esoterica | 兰道尔·蒂林哈斯特 / 蒂林哈斯特密所 |
| Ruby Standish / Andy Van Nortwick | 露比·斯坦迪什 / 安迪·范·诺特维克 |
| Sadie Sheldon / Naomi O'Bannion | 萨迪·谢尔顿 / 内奥米·欧巴尼恩 |
| Ursula Downs / Gustaf | 厄休拉·唐斯 / 古斯塔夫 |
| Southside / Rivertown / Downtown / Graveyard / Independence Square | 南区 / 河岸城 / 商业区 / 墓地 / 独立广场 |
| Ma's Boarding House | 玛莎寄宿公寓 |
| The Cassandra | 卡桑德拉号 |
| New Horizons Industries | 新视野工业 |
| Western Wall / Drowned Quarter / Apiary / Grand Vault | 西墙 / 淹没城区 / 养育场 / 大秘库 |
| Court of the Ancients / Obsidian Canyons / Sepulchre of the Sleeper | 古代议庭 / 黑曜石峡谷 / 沉睡者墓穴 |
| The Doom of Arkham | 阿卡姆的毁灭 |
| Tasks: Walk in Faith / Toe the Line / No Place Like Home / Good Money | 信仰之行 / 坚守底线 / 没有比家更好的地方 / 好钱 |
| Tasks: Do No Harm / Prove Your Worth / Dreams of Destruction / Plumb the Depths | 不伤害他人 / 证明你的价值 / 毁灭之梦 / 探究深渊 |
| Barrier Node / Obsidian Claw / Shard of Y'ch'lecht / Tidal Tablet | 屏障节点 / 黑曜石之爪 / 伊克雷希特碎片 / 潮汐碑匾 |
| Grisly "Mask" / Horror in Clay | 骇人“面具” / 黏土恐怖 |
| Star Spawn / Deep One / Pilgrim | 星之眷族 / 深潜者 / 朝圣者 |

卡表查询（在 `games/arkhamhorror/` 下）：

```powershell
node --input-type=module -e "import {ALL_CARDS} from './src/cards/cards-data.js'; console.log(Object.entries(ALL_CARDS).filter(([k,v])=>v.name==='Deep One Thrall').map(([k,v])=>v.nameZh))"
```

地图/卡名清单也可查 `artifacts/migration/tdc/p7/chapter-inventory.json`（含每章卡号/中文名）。

## 4. 读取长文本

`read` 工具会截断超长行。需要看某个叶子的完整英文时（在 `games/arkhamhorror/` 下）：

```powershell
node tools/import-tdc-story.mjs --dump <file>.json --path <叶子路径，如 expeditionToRlyeh.body>
node tools/import-tdc-story.mjs --dump <file>.json   # 全部叶子（输出很大，谨慎）
```

路径按英文 JSON 结构用 `.` 连接，数组用 `[i]`，例如 `specialRules[0].body`。

## 5. 自检（必须通过）

在 `games/arkhamhorror/` 下运行：

```powershell
node tools/import-tdc-story.mjs --verify-source <file>.json
# 分段翻译时只校验自己那部分：
node tools/import-tdc-story.mjs --verify-source <file>.json --only <rootKey>
```

要求：`缺 0；疑似未译 0；多余 0`。不合格就继续改，直到通过。

## 6. 边界

- 只写本目录下分到的那一个 JSON 文件；不改其它文件，不跑 `--write` 生成器，不动 `参考资源/`。
- 不写 `story-text.js`（由 `node tools/import-tdc-story.mjs --write` 统一生成）。
- 完成后汇报：输出路径、叶子数、`--verify-source` 最后一行、保留英文的专有名词（如有）。
