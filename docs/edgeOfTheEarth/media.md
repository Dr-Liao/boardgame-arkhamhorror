# 七循环美术与 BGM（2026-11-08）

已接入 `web/campaign-presentation.js`、`web/scenario-music.js` 和 `web/music-player.js`，大厅、八个章节单元和牌桌使用本循环专属素材；按既有机制在进入战役或牌桌后播放音乐，准备弹窗不挂载播放器。

## 美术

使用 OpenAI 内置 image_gen 逐张原创生成 10 张素材：大厅主视觉、亡命冰原 I–III、致命幻景、失落之峰、古老者之城、疯狂之心 I–II，以及调查桌布。统一 1536 × 1024 WebP，午夜蓝／冰青／旧银主色，少量琥珀与虹彩紫。桌布中央保持低对比度。

运行资源位于 `web/img/campaigns/edgeOfTheEarth/`；`assets.json` 保存全部最终提示词、尺寸、文件大小、SHA-256 与原图映射。PNG 原图与总览分别保存在大厅仓库根 `artifacts/eote-media/originals/` 和 `artifacts/eote-media/contact-sheet.png`。均为原创 AI 场景图，非官方卡图。

## BGM 与 CDN

八关各 3 首，共 24 首不同曲目；16 首新增、8 首复用。按播放位置和独立曲目数计算，旧曲复用率均为 **33.3%**，低于 40%；循环内重复率为 0%。完整顺序见 `web/audio/music/SCENARIO-PLAYLISTS.md`。

新增曲目来自 [Incompetech 官方曲库](https://incompetech.com/music/royalty-free/pieces.json)，作者 Kevin MacLeod，按 [官方 Creative Commons 授权流程](https://incompetech.com/music/royalty-free/licenses/)保留 CC BY 4.0 署名。来源页面、ISRC、原始及转码文件哈希见 `web/audio/music/sources.json`，署名见 `CREDITS.txt`。沿用 128 kbps CBR MP3、44.1 kHz，不剪辑、不混音；原始下载保存在 `artifacts/eote-media/audio-originals/`。

16 首新增 BGM 已经现有上传工具传入 R2 `boardgame/arkhamhorror/music/common/`。本循环全部 24 首公开地址均完成实际 GET 校验：HTTP 200、`audio/mpeg`、文件大小及 SHA-256 与清单一致。逐曲 CDN URL 与结果见 `audit/eote-media-acceptance.json`。

## 验证

- 音乐资源、缓存、曲库、测试清单及 EotE 专项：18 项通过。
- 桌面 1440 × 950、手机 390 × 844：2 项浏览器测试通过；每个视口真实解码 10 张图片，逐章切换并实际播放全部 24 首 BGM。
- 截图：大厅仓库根 `artifacts/eote-media/browser-desktop.png`、`browser-mobile.png`。
- 额外架构／图片检查：43 项通过、2 项失败。失败是既有 `artifacts/arkham-polish/attack-impact.png` 不在允许的运行媒体目录，以及 `audit/presentation-report.json` 与卡图生成器结果漂移；本轮未修改这些文件。

复验命令（Mod 根目录）：`node --test tests/eote-media.test.mjs tests/music-assets.test.mjs tests/music-library.test.mjs tests/music-cache.test.mjs tests/suite-manifest.test.mjs`。浏览器测试 `tests/eote-media.browser.mjs` 使用现有 Playwright 配置与 `tests/music-server.mjs`，覆盖图片解码和真实音频播放。
