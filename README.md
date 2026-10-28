# 诡镇奇谈：卡牌版（arkhamhorror）

[桌游大厅](../../README.md) 的合作卡牌 Mod，实现《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game）的规则引擎、战役内容、AI 队友和浏览器牌桌。玩家与 0~3 名 AI 队友一起扮演调查员，合作完成战役。

![诡镇奇谈牌桌截图](docs/images/screenshot-table.jpg)

本目录是独立的 git 仓库（[boardgame-arkhamhorror](https://github.com/Dr-Liao/boardgame-arkhamhorror)），以子模块形式挂在大厅仓库 [boardgame-hall-ai](https://github.com/Dr-Liao/boardgame-hall-ai) 的 `games/arkhamhorror`，需要放在大厅内运行。

## 玩法

- **战役**：核心包与《夜之狂热》之外，还有敦威治遗产、卡尔克萨之路、失落的时代、万象无终四部扩展，都可以从大厅直接启动。
- **调查员与构筑**：按职业选择调查员，可手动构筑或自动构筑；AI 队友会自动分配调查员并按属性契合度组出合法牌组。
- **回合循环**：神话阶段 → 调查阶段（每位调查员 3 个行动）→ 敌人阶段 → 重整阶段。
- **核心行动**：移动、调查（收集线索推进「幕」）、攻击、躲避、打出卡牌、使用资产能力；技能检定从混乱袋抽取标记。
- **跨关成长**：关卡结算后进入关间，处理经验、创伤、战役记录和卡组升级，再进入下一关。

规则采用本 Mod 的简化实现边界，未实现的机制默认阻断而不是近似放行；逐卡验收与简化清单记录在 `audit/` 账本中，不宣称与原版规则等价。

## 结构

```
index.js                Mod 唯一入口，大厅只依赖这里
src/engine/             权威状态机、合法动作、能力与结算、混乱袋
src/cards/              卡牌目录与卡牌行为
src/deck/               可用性、构筑规则与牌组生成
src/campaign/           战役图、记录、经验、升级与剧情
src/ai/                 AI 观察、剧情上下文与协作计划
src/integration/        大厅策略、观察投影与只读 API
content/                内容包、战役与关卡注册
catalog/ presentation/  卡牌原始数据、字段溯源与卡图解析
web/                    浏览器端 JS、CSS、字体、音频与图片
tests/ tools/ audit/    回归、导入审计工具与可复现账本
```

- 大厅只通过 `index.js` 加载本 Mod。规则引擎是唯一权威：玩家、AI 和 HTTP 请求都只能提交它公开的动作，并依次通过 `legalMoves`、`validateMove`、`applyMove` 校验。
- 卡牌按「一卡一文件」组织：玩家卡在 `src/cards/entries/`，非玩家卡按归属落在 `src/cards/encounter-entries/`，聚合文件只做兼容。
- 浏览器只能访问 `web/` 目录，界面与规则数据在 Node 侧共享。目录职责、依赖方向与修改约定见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## AI 队友

- 一个调查员每回合有 3 个行动点，AI 在同一回合内的多步决策共享对话历史。
- AI 只能看到自己座位的观察投影，读不到其他人的手牌、牌库顺序或未触发的剧情。
- 模型不可用时，兜底行动以对局随机数状态为种子，同一局可复现。
- 战术交流、备忘等功能由大厅提供，详见 [大厅 README](../../README.md#功能一览)。

## 安装

本 Mod 不能单独运行，需要放在大厅仓库的 `games/arkhamhorror` 下：

```bash
git clone https://github.com/Dr-Liao/boardgame-hall-ai.git
cd boardgame-hall-ai
git clone https://github.com/Dr-Liao/boardgame-arkhamhorror.git games/arkhamhorror
npm install
```

大厅不跟踪本目录；已经克隆过的话，在 `games/arkhamhorror` 里 `git pull` 即可更新。

卡图约 1.9 GB，不在仓库中：首次显示时会自动缓存，也可以在本目录运行 `npm run images:fetch` 一次性下载（`npm run images:estimate` 预估大小，`npm run images:verify` 校验）。Windows 发布时卡图单独打成资源包，在大厅根目录运行 `npm run build:windows:assets`。

## 测试

在大厅根目录运行：

```bash
npm run test:mod -- arkhamhorror fast     # 日常回归：规则、AI、卡牌逻辑与重放
npm run test:mod -- arkhamhorror assets   # 资源与生成器校验
npm run test:mod -- arkhamhorror slow     # 长跑：整局模拟、存读档与联机集成
npm run test:mod -- arkhamhorror browser  # 浏览器回归，含大厅开局与联机界面
```

分层规则与新增用例的归属在 `tests/suites.mjs`；各循环的审计账本与验收工具在 `tools/` 与 `audit/`。本 Mod 在大厅上的集成回归在 `tests/hall-*`，大厅自身的回归不再依赖诡镇。更多说明见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [测试说明](../../docs/testing.md)。

## 文档

- [ARCHITECTURE.md](ARCHITECTURE.md)：目录职责、依赖方向、运行流程与修改约定
- [docs/card-model.md](docs/card-model.md)：卡牌模型与声明式能力描述子
- [docs/card-entry-files.md](docs/card-entry-files.md)：一卡一文件的行为目录与固定执行流程
- [docs/arkham-content-migration.md](docs/arkham-content-migration.md)：扩展战役的迁移流程与验收门槛

## 致敬

本项目深受 [halogenandtoast/ArkhamHorror](https://github.com/halogenandtoast/ArkhamHorror) 的启发，并以其作为主要参考。那是一个非官方、严格遵循规则的浏览器版《诡镇奇谈：卡牌版》（Haskell 后端 + Vue 前端，在线版本见 [arkhamhorror.app](https://arkhamhorror.app)）。

我们参考了它的结构化卡牌数据、源码中的卡牌定义与行为实现，以及卡图的解析与回退规则。参考源在本地只读保存，字段来源记录在 `catalog/provenance.json`。参考项目没有声明图片再分发许可，因此本项目只沿用卡图的解析规则，卡背等通用图片改用文字或 CSS 回退。

感谢 halogenandtoast 及所有贡献者的长期投入。

## 版权声明

本应用中关于[《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game™）][arkham]的信息，包括文字与图像，版权归 © Fantasy Flight Games 所有。本项目是非官方的粉丝作品，并非由 Fantasy Flight Games 制作，也未获得其认可或支持，与其没有任何关联。

所有美术作品与插画的知识产权归各自的创作者所有。《诡镇奇谈：卡牌版》的全部图像与图形版权归 Fantasy Flight Games 所有。"Arkham Horror" 及相关名称、标志是其各自权利人的商标。

### Copyright Disclaimer

The information presented in this app about [Arkham Horror: The Card Game™][arkham], both textual and graphical, is © Fantasy Flight Games. This app is a fan project and is not produced, endorsed, or supported by, or affiliated with Fantasy Flight Games.

All artwork and illustrations are the intellectual property of their respective creators. All Arkham Horror: The Card Game™ images and graphics are copyrighted by Fantasy Flight Games.

[arkham]: https://www.fantasyflightgames.com/en/products/arkham-horror-the-card-game/
