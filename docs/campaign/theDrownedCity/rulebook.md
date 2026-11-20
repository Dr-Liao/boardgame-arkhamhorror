# 沉没之城 P3 规则与验收

规则书新增 12 个中英条目。图鉴中的循环卡牌直达战役概览，涉及专门规则的卡面另有对应主题入口。西墙与黑曜石峡谷分别说明整行和共边连接，阿卡姆的末日第二部单列部位板块及行动牌库。[规则书数据](../../../web/tdc-rules.js) · [战役指南，第 2–3 页](https://images-cdn.fantasyflightgames.com/filer_public/c1/3b/c13b0e74-62bb-49bc-bc85-036ab9d1ef10/ahc84_campaign_guide-web_1.pdf#page=2)

| 关键词 | 代表卡号 | 验收要点 |
| --- | --- | --- |
| 警戒 Alert | `11511`、`11637`、`11702b` | 躲避已准备敌人失败后攻击，警戒攻击不耗竭。 |
| 巡逻 Patrol | `11537b`、`11551`、`11670`、`11701`、`11721` | 已准备且未交战才移动，按卡文约束筛选淹没、空地点与敌人目标，沿最短路径走一步。 |
| 无情 Relentless | `11573`、`11671`、`11725` | 普通攻击步骤后准备并再攻一次，首击取消也计入，巨型敌人分别攻击符合条件的调查员。 |
| 封印 Seal | `11028`、`11043`、`11060`、`11070` | 入场要求袋中存在合格标记，只封印一枚，离场释放。 |

代表卡号取自锁定卡表。关键词审计分别列出印刷关键词的卡面与授予、移除或引用关键词的卡面。专项用例通过中立敌人描述子以及已有入场封印支援验证通用规则。卡牌逐条行为按后续阶段迁移。[关键词账本](../../../audit/tdc-rules.json) · [官方 Grimoire 警戒口径](https://images-cdn.fantasyflightgames.com/filer_public/76/b3/76b332d5-7047-458f-91b6-82c8500cc445/arkham_grimoire.pdf#page=4)

`npm run test:tdc` 执行关键词、原语和循环卡文导航测试。 `npm run test:tdc:browser` 从真实大厅启动规则书和图鉴，覆盖桌面 1440×950 和移动端 390×844、简中和英文、相关主题跳转和返回，以及卡牌详情关闭规则书后恢复链接焦点。浏览器报告及截图保存在工作区的 `artifacts/migration/tdc/reports/`。[浏览器用例](../../../tests/tdc-rules.browser.mjs)

`npm run audit:tdc:rules` 检查规则账本、代表卡和验收文件指纹。 `npm run audit:tdc:check` 验证迁移确认项。[迁移确认](../../../audit/tdc-migration.json)

重新记录验收时，在同一报告目录保留四份 UTF-8 报告。专项单测以 `--test-reporter=spec` 写入 `p3-node.log`，浏览器命令生成 `p3-browser.json`，严格回放对比 `replay-before-recovered.json` 并写入 `p3-replay.log`，快速回归 `npm run test:fast -- --test-concurrency=12` 写入 `p3-fast-accepted.log`。四项通过后，运行 `npm run audit:tdc:rules:record` 和 `npm run audit:tdc` 更新账本。
