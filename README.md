# 诡镇奇谈：卡牌版（arkhamhorror）

[桌游大厅](https://github.com/Dr-Liao/boardgame-hall-ai)的合作卡牌 Mod，包含规则引擎、战役内容、AI 队友、多人席位和浏览器牌桌。

![诡镇奇谈牌桌截图](docs/images/screenshot-table.jpg)

本目录是独立仓库 [boardgame-arkhamhorror](https://github.com/Dr-Liao/boardgame-arkhamhorror) 的 checkout，不是大厅仓库的 git submodule；父仓库会忽略其内容。Mod 必须位于大厅的 `games/arkhamhorror` 下运行。

当前可从大厅启动《夜之狂热》《敦威治遗产》《卡尔克萨之路》《失落的时代》和《万象无终》。`playable` 表示在本 Mod 明确声明的实现边界内可完成流程，不代表与桌游原版规则等价；提前开放但仍有已登记近似项的内容会同时标记 `earlyAccess`，差异以 `audit/` 账本为准。

## 安装

```bash
git clone https://github.com/Dr-Liao/boardgame-hall-ai.git
cd boardgame-hall-ai
git clone https://github.com/Dr-Liao/boardgame-arkhamhorror.git games/arkhamhorror
npm install
```

大厅不跟踪本目录；更新时分别在大厅根目录和 `games/arkhamhorror` 中执行 `git pull`。卡图不进入 git，首次显示时按需缓存；完整离线资源可在本目录运行 `npm run images:fetch`。

## 文档索引

- [架构与修改约定](ARCHITECTURE.md)：稳态分层、依赖方向、运行流程、状态与生成物边界
- [卡牌模型](docs/card-model.md)：能力 kind、scope、描述子和状态模型的唯一 schema 参考
- [一卡一文件操作手册](docs/card-entry-files.md)：脚手架、索引和单卡开发命令
- [内容迁移规范](docs/arkham-content-migration.md)：新循环的迁移顺序、并行边界和发布门槛
- [大厅 Mod 接口](https://github.com/Dr-Liao/boardgame-hall-ai/blob/main/docs/mod-api.md)：席位、投影、AI、存档和联机契约
- [测试说明](https://github.com/Dr-Liao/boardgame-hall-ai/blob/main/docs/testing.md)：大厅入口、fast/slow/assets 分层和浏览器回归

文档职责按上表划分：架构文档不保存阶段进度，模型文档不重复操作步骤，操作手册不重新定义 schema，迁移规范只定义迁移与验收流程。当前数量、覆盖率和差异状态由 `audit/` 生成账本提供，不在 README 手工维护。

日常验证从大厅根目录运行：

```bash
npm run test:mod -- arkhamhorror fast
npm run test:mod -- arkhamhorror assets
npm run test:mod -- arkhamhorror slow
npm run test:mod -- arkhamhorror browser
```

## 致谢

本项目参考了 [halogenandtoast/ArkhamHorror](https://github.com/halogenandtoast/ArkhamHorror) 的结构化卡牌数据、卡牌行为实现和卡图解析规则。来源与字段溯源记录在 `catalog/provenance.json`；参考项目未声明图片再分发许可，因此图片仅按既定规则解析或本地缓存。

## 版权声明

本应用中关于[《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game™）][arkham]的信息，包括文字与图像，版权归 © Fantasy Flight Games 所有。本项目是非官方的粉丝作品，并非由 Fantasy Flight Games 制作，也未获得其认可或支持，与其没有任何关联。

所有美术作品与插画的知识产权归各自的创作者所有。《诡镇奇谈：卡牌版》的全部图像与图形版权归 Fantasy Flight Games 所有。"Arkham Horror" 及相关名称、标志是其各自权利人的商标。

### Copyright Disclaimer

The information presented in this app about [Arkham Horror: The Card Game™][arkham], both textual and graphical, is © Fantasy Flight Games. This app is a fan project and is not produced, endorsed, or supported by, or affiliated with Fantasy Flight Games.

All artwork and illustrations are the intellectual property of their respective creators. All Arkham Horror: The Card Game™ images and graphics are copyrighted by Fantasy Flight Games.

[arkham]: https://www.fantasyflightgames.com/en/products/arkham-horror-the-card-game/
