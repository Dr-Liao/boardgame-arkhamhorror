# 食梦者完成验收

原始循环的八个章节、调查员与玩家卡、四种战役模式、共享幕间和尾声均已接线。“提前体验”展示标记已移除。

## 本轮补全

- 蜂拥使用调查员牌库中的实体卡，独立承受攻击并整组移动、交战与横置；离场回拥有者牌库底。
- 补全绑定牌个人集合、研究、强制投入、替代费用、重复行动、反应窗口、梦境起始奖励与旧存档修复。
- 补齐章节遗留规则、掩藏剧情、中心牌旋转、地图标记和完整冒险指南。
- 并行双线经真实玩家确认共享幕间，单次结算两袋变化与跨线剧情牌，保存后可以继续。
- 修复大厅在并行 AI 线推进时阻塞可行动真人的问题。

## 可复算证据

- 全库：仓库根目录运行 npm test。
- 原语与全卡：node tools/audit-tde-primitives.mjs --check；node tools/audit-tde-all-cards.mjs --check。
- 双线：node tools/audit-tde-parallel.mjs --check。
- 桌面、手机、完整指南和真实双人中转联机：npm run test:tde:browser。
- 重放：node tools/replay-fixtures.mjs --verify。窗口变化与旧基线的逐局核对见 audit/tde-replay-completion-review.json。
- 总发布门禁：node tools/audit-tde.mjs --check；node tools/audit-baseline.mjs --check。

原始简化说明保存在 audit/tde-completion-review.json；历史章节缺口及修复证据保存在 audit/tde-scenario-gap-triage.json，当前未解决集合为空。验收数字以工具输出为准。
