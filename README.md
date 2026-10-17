# 诡镇奇谈：卡牌版（arkhamhorror）

[桌游大厅](../../README.md) 的合作卡牌 Mod，实现《诡镇奇谈：卡牌版》（Arkham Horror: The Card Game）的规则引擎、战役内容、AI 队友和浏览器牌桌。玩家与 0~3 名 AI 队友一起扮演调查员，合作完成战役。

![诡镇奇谈牌桌截图](docs/images/screenshot-table.jpg)

本目录是独立的 git 仓库，以子模块形式挂在大厅的 `games/arkhamhorror`，需要放在大厅内运行。

## 致敬

本项目深受 [halogenandtoast/ArkhamHorror](https://github.com/halogenandtoast/ArkhamHorror) 的启发，并以它作为主要参考。那是一个非官方、严格遵循规则的浏览器版《诡镇奇谈：卡牌版》（Haskell 后端 + Vue 前端，在线版本见 [arkhamhorror.app](https://arkhamhorror.app)），多年来积累了极其完整的卡牌与剧本实现。

我们从中参考的内容包括：

- 结构化卡牌数据（英文主表与简中、繁中卡表），作为本项目卡牌目录的导入来源；
- Haskell 源码中的卡牌定义与行为实现，用于核对规则细节；
- 卡图的解析与回退规则。

参考源在本地以只读方式保存，不做修补；卡牌字段的来源记录在 `catalog/provenance.json`。参考项目没有声明图片再分发许可，因此本项目只沿用卡图的解析规则，卡背等通用图片改用文字或 CSS 回退。

感谢 halogenandtoast 及所有贡献者的长期投入。

## 玩法

- **战役**：《夜之狂热》（3 关）和《敦威治遗产》（8 章）可以从大厅完整游玩；《卡尔克萨之路》正在迁移，目前只收录目录、尚不可启动；《失落的时代》（三循环）已完成目录与来源基线，规则与剧本尚未迁移，大厅不可启动。
- **调查员与构筑**：从各职业调查员中选择角色，可手动构筑或自动构筑。AI 队友会自动分配调查员并按属性契合度组出合法牌组。
- **回合循环**：神话阶段 → 调查阶段（每位调查员 3 个行动）→ 敌人阶段 → 重整阶段。
- **核心行动**：移动、调查（收集线索推进「幕」）、攻击、躲避、打出卡牌、使用资产能力；技能检定从混乱袋抽取标记。
- **跨关成长**：关卡结算后进入关间，处理经验、创伤、战役记录和卡组升级，再进入下一关。

规则采用本 Mod 的简化实现边界，未实现的机制默认阻断而不是近似放行。

## AI 队友

诡镇是大厅里合作类 Mod 的完整示例：

- 一个调查员每回合有 3 个行动点，AI 在同一回合内的多步决策共享对话历史（回合内记忆）。
- AI 只能看到自己座位的观察投影，读不到其他人的手牌、牌库顺序或未触发的剧情。
- 模型不可用时，兜底行动以对局随机数状态为种子，同一局可复现。
- 战术交流、备忘等功能由大厅提供，详见 [大厅 README](../../README.md#战术交流与备忘)。

## 安装

在大厅根目录：

```bash
git submodule update --init
npm install
```

卡图约 1.9 GB，不在仓库中。首次显示时会自动缓存，也可以在本目录运行 `npm run images:fetch` 一次性下载（`npm run images:estimate` 预估大小，`npm run images:verify` 校验）。

Windows 发布时，卡图单独打成资源包：在大厅根目录双击 `build-windows-assets.bat` 或运行 `npm run build:windows:assets`。

## 测试

在大厅根目录运行：

```bash
npm run test:arkham:fast     # 日常回归：规则、AI、卡牌逻辑，约 8 秒
npm run test:arkham:assets   # 资源与生成器校验：卡池导入、展示资源、媒体许可，约 30 秒
npm run test:arkham:slow     # 长跑：整局模拟与存读档迁移，约 2 分钟
npm run test:arkham          # 全量：每个文件独立进程并行，约 2.5 分钟
npm run test:arkham:browser  # 浏览器回归（复用系统 Edge）
```

改动规则、默认值或 AI 时先跑 `fast`，只改卡牌数据或素材时再跑 `assets`。分层清单在 `tests/suites.mjs`，新增用例必须声明所属层级，否则守卫用例会报错。

HTTP 和浏览器回归会加载大厅的 `lib/server.js`，所以需要在大厅目录内运行。其中包含「同一种子产生相同 AI 决策序列」的复现性断言。更多说明见 [测试说明](../../docs/testing.md)。

## 文档

- [ARCHITECTURE.md](ARCHITECTURE.md)：目录职责、依赖方向、运行流程、内容扩展和修改约定
- [docs/arkham-content-migration.md](docs/arkham-content-migration.md)：扩展战役的迁移流程
- 大厅侧的适配入口：`index.js`、`src/integration/hall-integration.js`、`src/ai/agent-plans.js`

## 版权声明

本项目是非官方的粉丝作品，与 Fantasy Flight Games 无关，也未获得其认可或支持。《诡镇奇谈：卡牌版》的文本、设定和图片版权归 Fantasy Flight Games 及各自的创作者所有。
