# 《地球边缘》本地中文补充层（locale-supplement）

> **完成状态（2026-11-09）**：4 个文件共 **288 条 entry** 全部填好（`chapters-a` 31 / `chapters-b` 68 / `chapters-c` 97 / `campaign` 92），生成后章节 469/469、战役 258/258 present，`chineseGaps` 全空。验收见 `docs/edgeOfTheEarth/translate/fix-batch.md` 与 `docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs`。
> 用途：`参考资源/`（ArkhamHorror-main）是**只读**的第三方参考工程，不能修改。本目录是该工程 zh locale 的**本地补充/修正层**：
> `tools/import-eote-story.mjs` 在读取参考 locale 后按下表覆盖对应叶子（文件 + 点路径），再生成 `content/campaigns/edgeOfTheEarth/story-text.js`；
> `tools/import-scenario-guides.mjs` 随后从 story-text 生成 `web/scenario-guides/*.json`。
>
> 本目录只被**生成工具**读取，运行时不加载；改完必须重跑：
> `node tools/import-eote-story.mjs --write && node tools/import-scenario-guides.mjs`

## 文件

| 文件 | 覆盖的参考 locale 文件 | 说明 |
| --- | --- | --- |
| `chapters-a.json` | `scenarios/iceAndDeath.json`（part1–3） | 《亡命冰原》I–III 缺译/未译 + 人工修正 |
| `chapters-b.json` | `scenarios/fatalMirage.json`、`scenarios/toTheForbiddenPeaks.json` | 致命幻景、失落之峰 |
| `chapters-c.json` | `scenarios/cityOfTheElderThings.json`、`scenarios/theHeartOfMadness.json`（part1–2） | 古老者之城、疯狂之心 I–II |
| `campaign.json` | `base.json` | 序幕/检查点/幕间/尾声/特别规则/记录标签 |

每条 entry 字段：

- `file`：参考 locale 文件（如 `scenarios/iceAndDeath.json` / `base.json`），**不要改**
- `path`：该文件内的点路径叶子，**不要改**
- `en`：英文原文（只读参考，不要改）
- `status`：`missing` / `untranslated`（需要翻译）或 `fix-present`（已有中文但有错/有占位符，需要修正）
- `currentZh`（仅 fix-present）：当前中文，供参考，不要直接复制，要按 `fixNote` 修好
- `fixNote`（可选）：修正要求
- `zh`：**要填的中文**。填好后不要再留空；不要删改其它字段

## 翻译规范（重要）

1. **简体中文**（zh-CN）。不要繁体字：尤其「著」作「着」（本语料最典型的错误）、「於/與/裡/來/個/說/這/麼/們/時/後/現/發/開/關/題/對/給/沒/會/學/覺/應/該/讓/從/進/遠/邊/過/還/樣」等一律用简体。
2. **不夹英文**：不要出现连续英文单词/整句（`FAQ` 之类也不要）；专名用既有译名。
3. **保留游戏记号**：图标 token 原样保留：`[skull]`、`[cultist]`、`[tablet]`、`[elder_thing]`、`[auto_fail]`、`[elder_sign]`、`[frost]`、`[per_investigator]`、`[free]`、`[fast]`、`[action]`、`[reaction]`、`[willpower]`、`[intellect]`、`[combat]`、`[agility]`、`[wild]`，以及特性 `[[古老者]]`、`[[探险]]` 之类。不要把 `[x]` 改成中文。
4. **标点全角**：中文句读用「，。：；！？、（）“”」（不要 `。.`、`: `、半角逗号）。段落之间用 `\n\n`（JSON 字符串里写 `\n\n`），列表项用 `• ` 开头并保持每项一行。
5. **术语统一**（详见 `docs/edgeOfTheEarth/translate/terms/glossary.md`）：doom=毁灭标记；clue=线索；horror=恐惧；damage=伤害；asset=支援；event=事件；skill=技能；treachery=诡计；enemy=敌人；location=地点；agenda=密谋；act=幕；resolution=结局；scenario=冒险（关卡名）/剧本（规则文本）；campaign=战役；shelter=庇护值；supplies=物资/补给品；partner=伙伴；expedition=探险队；frost=寒霜标记；keys=钥匙；seals=封印；investigator=调查员；deck=牌库；discard pile=弃牌堆；scenario log=剧本日志；difficulty=难度（简单/普通/困难/专家）；checkpoint=检查点；interlude=幕间；epilogue=尾声；prologue=序幕。
6. **专名**：忒咳哩-哩（Tekeli-li）、米斯卡塔尼克、阿卡姆、菲奥多西亚号、菲奥多西亚号、埃里伯斯火山、特罗尔山、罗斯岛、疯狂山脉；9 位伙伴与 5 位调查员以卡面译名为准（艾米·肯斯勒博士、威廉·戴尔教授、丹佛斯、罗尔德·埃尔斯沃思、高田弘子、艾弗里·克莱普尔、玛拉·辛哈医生、詹姆斯·“曲奇”·弗雷德里克斯、伊里亚·阿什瓦克；诺曼·威瑟斯、丹妮拉·雷耶丝、陈丽丽、鲍勃·詹金斯、蒙特雷·杰克）。
7. **风格**：与现有译文一致——克苏鲁式书面叙事、第二人称「你/你们」，保留 `• ` 列表与括号说明；数字沿用阿拉伯数字（1/2/3），但「一张/两位」等量词按中文习惯；引语用“”；书名用《》。
8. 段落/列表**不要合并成一段**：源 en 的口语段落、列表项、条件分支各占自己的行；译文按语义断段，用 `\n\n` 分隔。
9. **不要机翻痕迹**：通读一遍，确保是通顺的中文叙事/规则文本；长段落可适度调整语序，但**不得增删规则信息**（数字、条件、目标、检定难度必须与 en 一致）。
10. 只改本目录 4 个 JSON 中被指派的那一个文件；不要改游戏代码/其它文件。

## 校验

填完后 Lead 会运行：

```bash
cd games/arkhamhorror
node tools/import-eote-story.mjs --write
node tools/import-scenario-guides.mjs
node tools/import-eote-story.mjs --check
```

生成物中若仍有 `en` 回退或空 zh，说明对应 `zh` 没填；生成器会把补译层标记为「本仓补译」（`meta.zhSupplement`），不冒充官方中文。
