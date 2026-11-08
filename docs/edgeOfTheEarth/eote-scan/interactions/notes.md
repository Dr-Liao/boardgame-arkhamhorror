# EOTE D2 交互可感知性审计（Lead）

## 结论
- 交互事务链路与隐私投影**实现完整**：choice/prompt 走服务端选择事务、UI 直接渲染；deckTop/crossSeat/tekeli/key/supplies 有明确逐观察者过滤（src/integration/mechanic-view.js eoteView）；scenarioFlags 走白名单（observation.js:44）。
- 浏览器证据**真实存在**：6 份账本 passed、截图路径 200 张全部存在；spec 断言覆盖真实 API/牌桌/选择，不是纯“无报错”。
- **主要缺口 1（medium）**：EOTE 动态文案（label 488/491、prompt 192/192、info 281/281 为中文）在 EN locale 无翻译回退；英文玩家会看到中文按钮/选择/日志。
- **主要缺口 2（medium）**：古者之城 tablet+frost 自动失败原因 lastAutoFailReason 写后无读，玩家不可见自动失败原因。
- 低：frostRevealedThisTest 死写；浏览器账本未覆盖 EN 动态文案与逐卡感知；机械 silent-ability 候选为误报。

## 证据

| 项 | 值 |
| --- | --- |
| EOTE 动态 label | 491（中文 488） |
| EOTE 动态 prompt | 192（中文 192） |
| EOTE api.info 日志 | 286（中文 286） |
| 浏览器账本 | 6 份 passed / 截图 200 张存在 |

## 复现

```bash
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/eote-label-stats.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-analysis.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/scenario-flags-audit.mjs
```