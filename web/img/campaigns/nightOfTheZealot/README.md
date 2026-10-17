# 狂热之夜图像资源

2026-10-18 使用 OpenAI 内置 image_gen 补充三张逐关原创插图，非官方卡牌插画。新图延续初始包已有的午夜蓝黑、雨夜反光、旧纸褐色与病态黄绿色，以及墨水和水粉绘本质感。

| 画面 | 网页文件 |
| --- | --- |
| 聚集之夜 · 坍塌的书房 | `scenarios/theGathering/scene.webp` |
| 午夜假面 · 雨夜追踪 | `scenarios/theMidnightMasks/scene.webp` |
| 吞噬者之下 · 林中仪式 | `scenarios/theDevourerBelow/scene.webp` |
| 调查员事务所 | `hub/office-hero.webp` |
| 默认故事插图 | `story/default.png` |
| 阿卡姆调查地图 | `table/investigation-map.webp` |

三张逐关插图均为 1672 × 941 横幅，网页使用 WebP（quality 0.92）；PNG 原图保存在项目 `artifacts/night-of-the-zealot-media/originals/`。`assets.json` 记录尺寸、文件大小、SHA-256、场景要求和原图路径。

`web/campaign-presentation.js` 按场景编号注册三张插图；未选择场景时仍使用原有 `story/default.png`。
