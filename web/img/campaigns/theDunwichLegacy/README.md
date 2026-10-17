# 敦威治遗产图像资源

2026-10-16 使用 OpenAI 内置 image_gen 原创生成，共 10 张，非官方卡牌插画。统一采用暗青、苔绿、旧纸赭色与琥珀灯光，章节场景从新英格兰乡野恐怖过渡到异空间。

| 画面 | 网页文件 |
| --- | --- |
| 课外活动 · 雨夜校园 | `scenarios/extracurricularActivity/scene.webp` |
| 百赌百胜 · 四叶草俱乐部 | `scenarios/theHouseAlwaysWins/scene.webp` |
| 米斯卡塔尼克博物馆 · 封闭展厅 | `scenarios/theMiskatonicMuseum/scene.webp` |
| 疯狂列车 · 断裂的高架桥 | `scenarios/theEssexCountyExpress/scene.webp` |
| 血色祭坛 · 村庄的秘密 | `scenarios/bloodOnTheAltar/scene.webp` |
| 无人知晓 · 无形之物的足迹 | `scenarios/undimensionedAndUnseen/scene.webp` |
| 毁灭之地 · 哨兵山之门 | `scenarios/whereDoomAwaits/scene.webp` |
| 迷失时空 · 破碎的异界 | `scenarios/lostInTimeAndSpace/scene.webp` |
| 敦威治遗产 · 乡野迷雾 | `hub/dunwich-village.webp` |
| 敦威治调查桌面 | `table/investigation-desk.webp` |

全部为 1672 × 941 横幅，网页使用 WebP（quality 0.92，保留原尺寸），总计约 4.73 MiB。原始 PNG 保存在项目 `artifacts/dunwich-media/originals/`。`assets.json` 记录每张图片的完整生成提示词、尺寸、大小、SHA-256 和原图路径。

`web/campaign-presentation.js` 将八张章节图用于关卡选择与对应历史章节的调查纪事；大厅使用独立村庄主视觉，没有章节的故事使用同一主视觉；游戏桌面使用低对比度调查桌背景。
