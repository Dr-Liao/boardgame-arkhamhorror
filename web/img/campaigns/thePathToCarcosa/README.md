# 卡尔克萨之路图像资源

2026-10-15 使用 OpenAI image_gen 原创生成；并非官方卡牌插画。共 9 张横幅画面：八章场景及一张调查桌面。统一采用暗青、旧金、黄衣与褪色绯红的油画质感。

| 画面 | 文件 | 用途 |
| --- | --- | --- |
| 剧院黄幕 | `hub/theatre.webp` | 战役大厅、默认故事背景、谢幕 |
| 镜中晚宴 | `scenarios/theLastKing/scene.webp` | 最后的王 |
| 历史协会档案馆 | `scenarios/echoesOfThePast/scene.webp` | 往昔回响 |
| 疗养院长廊 | `scenarios/theUnspeakableOath/scene.webp` | 难以言喻的誓言 |
| 巴黎雨夜 | `scenarios/aPhantomOfTruth/scene.webp` | 真相的幻影 |
| 地下墓穴 | `scenarios/thePallidMask/scene.webp` | 苍白面具 |
| 黑星下的修道院 | `scenarios/blackStarsRise/scene.webp` | 黑星升起 |
| 哈利湖与失落之城 | `scenarios/dimCarcosa/scene.webp` | 卡尔克萨终章 |
| 黄衣剧本调查桌 | `table/investigation-desk.webp` | 全战役游戏桌面 |

`assets.json` 记录尺寸、文件大小、SHA-256 和项目内原图路径。PNG 原图保存在仓库根目录的 `artifacts/carcosa-media/originals/`；网页使用保持原尺寸的 WebP（quality 0.92），9 张共约 3.46 MiB。章节图由 `web/campaign-presentation.js` 注册，调查纪事按所选历史章节切换图片。

配套音乐位于 `web/audio/music/campaigns/thePathToCarcosa/`；完整来源与 CC BY 4.0 署名在音乐目录的 `sources.json` 和 `CREDITS.txt`。

当前战役清单仍为 `catalog-only`，资源已注册但正式开局尚未开放。本次只增加展示资源与音乐，不改变规则验收或发布门槛；大厅截图使用测试预览数据。
