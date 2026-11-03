# 关卡冒险指南

“关卡设置”入口位于剧本书右侧、混乱标记提示卡下方。所有已注册关卡都必须随 Mod 提供中英指南：开场及条件分支、完整设置、特别规则、后续剧情、结局和结算。特别规则优先展示，后续剧情和结局默认折叠。

这是后续新增和迁移关卡的固定交付要求，已纳入[内容迁移规范](arkham-content-migration.md) §4.5.2、M3 剧本阶段及逐章确认。迁移时逐段核对指南来源，接入生成器并补齐译文，再运行下方命令；不能只添加布置摘要或以引擎已实现代替正文。指南缺项不得确认该章 `storyText`，入口或阅读未验收不得确认 `browserAcceptance`。来源锁、正文覆盖核对、生成物、测试和截图应进入该章证据路径。

浏览器打开面板时，从 `web/scenario-guides/<scenarioId>.json` 加载该关指南并缓存。指南正文跟随卡牌语言；界面标题跟随大厅语言。数据不进入权威对局状态或每次观察投影。加载失败时展示原有摘要和重试入口。

生成来源为仓库根目录的 `参考资源/ArkhamHorror-main/frontend/src/locales/`。优先保留中文译文；食梦者复用 `content/campaigns/theDreamEaters/story-source/` 的自译条目。遗漏的特别规则及未译段落由 `content/scenario-guide-translations.json` 和生成器中的共用短句补译。补译不标为官方中文。久远腹地从共享的 `heartOfTheElders.json` 分别提取上下两篇。

在本 Mod 目录执行：

```sh
node tools/import-scenario-guides.mjs --write
node tools/import-scenario-guides.mjs --check
node --test tests/scenario-guides.test.mjs
npx playwright test --config tests/playwright/playwright.config.mjs scenario-guides.browser.mjs
```

来源文件只用于重新生成；运行和发布只需要生成后的 `web/scenario-guides/`。生成器会拒绝未翻译的正文，检查也覆盖所有注册关卡的设置、结局、格式和关键特别规则。浏览器回归覆盖 1440 与 390 宽度、入口位置、折叠剧透、加载重试和键盘焦点。
