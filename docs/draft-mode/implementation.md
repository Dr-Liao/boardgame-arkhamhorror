# 三选一模式实现说明

## 使用流程

1. 开始新游戏时，在“游戏高级设置”中将“游戏模式”切换为“选牌模式”。默认是“普通模式”，下方说明随所选模式切换。
2. 选择调查员后，进入“卡组构筑”页逐张三选一；初始阶段共有三次免费刷新。专属卡和弱点自动加入，不赠送普通底牌。
3. 选满调查员要求的卡组大小后，确认准备并开始关卡。
4. 关后到达原战役允许升级的窗口时，在“升级”页选择卡牌及替换目标，或跳过。禁止升级的检查点不开放三选一，直接按战役流程继续。选完一张不会自动补货；每花费 1 XP 刷新可获得新的一组。
5. 可锁定整组三张候选并跨关保留，代价为放弃下一关的免费刷新。返回后仍可付费刷新。
6. 在下一关开始前，已确认准备的玩家可从选牌页面使用“返回三选一升级”重新进入；返回不会重新发放免费候选。
7. 永久牌直接加入牌组并结算选入效果。关后购入扩容牌时自动进入免费 0 经验补牌三选一，补满才可确认准备；补牌状态可保存和恢复。旧存档中的未补齐牌组也不能出发，可返回后点击“补足牌组”恢复流程。

选牌页中部同时显示资源费用分布和卡牌类型构成（支援、事件、技能、弱点等）；类型统计包含专属卡与弱点，重复卡按实际张数计数。底部按类型展示完整卡面列表，同一卡牌合并显示并标注张数，点击卡面可查看详情。手机端卡面采用双列布局。

候选来自当前运行时已开放且有实现的玩家卡池，包含核心包升级卡，并按调查员构筑范围与当前牌组筛选。模式取消普通重复数量限制，保留卓越、卡文单张限制与调查员构筑要求。没有底牌或功能保底。同名升级的基础抽取权重乘以 2，再与其他合法候选统一归一化。

## 实现归属

- `src/deck/draft-mode.js`：服务端候选生成、初始选牌、关后刷新、购买、锁定、跨关恢复与存档校验。
- `draftDeckStatus` 与 `draftDecksReady`：统一计算当前牌组大小、缺口与合法性，为私人观察投影、确认准备和关卡启动提供校验；`refill` 表示补牌阶段。
- `src/campaign/campaign.js`、`web/deck-rules.js`：复用升级差价与优惠逻辑；三选一模式放开普通重复数量，0 经验替换免费。
- `src/engine/campaign-flow.js`：完整关末结算后，以本关最终经验收益计算 `(最终经验 + 1) × 2`，不翻倍旧经验；进入升级窗口时生成或保留候选。
- `src/engine/chaos-bag.js`：加入模式赠与的 `+1`、`0` 标记，阻止剧本移除最后一枚赠与标记，支持重建混乱袋与逐线初始化。
- `web/hub.js`、`web/draft-mode.js`：高级设置入口、三选一界面、替换选择、卡组列表和资源费用构成。

模式设置保存在 `state.deckMode`，每位调查员的选牌进度保存在对应战役记录的 `draftMode`。候选、剩余初始刷新次数、整组锁定和已发放候选所属关次随存档保留；随机只使用对局随机源，动作可重放。未启用模式的旧存档不新增选牌状态。候选仅投影给所属玩家；双线战役按所属线保存。

## 验证

在 Arkham Horror 目录运行：

```powershell
node --test tests/draft-mode.test.mjs tests/game-settings.test.mjs tests/hub-concurrent.test.mjs tests/tde-hub-modes.test.mjs tests/architecture-guard.test.mjs tests/suite-manifest.test.mjs
npx playwright test --config tests/playwright/playwright.config.mjs draft-mode.browser.mjs
npm run test:fast
```

模式用例覆盖：初始刷新次数、非法候选与绕过构筑的拒绝、重复数量及单张限制、同名升级加权和差价、0 经验免费替换、购后消耗候选、付费刷新、跨关锁定、准备后返回、多人和双线隐私、最终经验结算，以及 JSON 存档和确定性重放。

2026-11-09 增补永久牌与扩容回归：初始永久牌不占张数、选入创伤、初始扩大目标、关后扩容后的零经验补牌、补牌存档往返及旧缺牌存档的出发阻断。`tests/draft-refill.browser.mjs` 使用独立的关间测试夹具，通过真实购买和补牌动作验收桌面／移动端；日志在 `artifacts/draft-permanent-regression.log`、`artifacts/draft-refill-browser-final.log`，全量快测在 `artifacts/draft-permanent-fast.log`。

浏览器用例覆盖真实高级设置开局、初始刷新、选牌完成、首关结算、关后升级与整组锁定，检查桌面 1440 和移动 390 宽度无横向溢出。测试中的关末跳转使用大厅单机调试通道固定结局，不代表逐战役完整通关验收。

验证日志与截图放在 `artifacts/draft-regression-final.log`、`artifacts/draft-browser-acceptance.log`、`artifacts/draft-mode/`。全量快测日志为 `artifacts/draft-fast-final.log`；该次运行仍有五项未通过，分别为音乐文案中文检查、TIC P8 重放基线、TCU P1 账本，以及 TIC P10 的账本内容与逐字节复算检查，未重写这些基线或账本。
