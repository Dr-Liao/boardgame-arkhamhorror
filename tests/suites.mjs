// Arkham 回归分层清单。每一个 tests/*.test.mjs 都必须恰好落在一个 tier 里，
// 由 suite-manifest.test.mjs 守住，避免新增用例悄悄从快测里漏掉。
//
// 分层依据是 tier 级实测墙钟（Windows / node 22.23.1 / i9-13900K，2026-10-24 P0+P1 重测；
// 机器不同会有差异，日常以 `node tools/test-timings.mjs <tier>` 输出为准）：
//   fast   ≈ 25s   改规则、AI、卡牌逻辑时的日常回归（golden replay 按分组并行）
//   slow   ≈ 64s   整局模拟/长跑联机；最重的几个文件已拆分减量（见 SLOW_TESTS 注释）
//   assets ≈ 25s   生成器、媒体许可与资源完整性校验，要读 13MB 卡池与参考资源
//   all    ≈ 82s   所有文件同一个 node --test 池并行：墙钟 = 最慢单文件 + 排队，不是 tier 相加
//
// 逐文件秒数**不再写死在注释里**：引擎/内容变重后注释会迅速失真（P0 审计发现的 130.3s/71.7s
// 分别已偏离 3–4 倍）。需要逐文件耗时时跑：
//   node tools/test-timings.mjs <fast|slow|assets|all> [--top=N] [--json=out.json]
// 重新分层前请先跑它，别凭文件名的直觉。

export const FAST_TESTS = Object.freeze([
  'availability.test.mjs',
  'game-settings.test.mjs', // 开局高级设置：卡牌范围 / 回档 / AI 感知剧情
  'content-schema.test.mjs',
  'content-registry.test.mjs',
  'hall-boundary.test.mjs',
  'card-identity.test.mjs',
  'state-presentation.test.mjs',
  'view-privacy.test.mjs', // 观察投影隐私边界（阶段 A 拆分护栏：手牌/牌组/选项/私人检定）
  'hall-static.test.mjs', // 大厅静态资源（P7 前就存在但漏登记，P7 合并时补入并实测全绿）
  'view-shared-state.test.mjs', // 观察投影共享状态（同上）
  'view-static.test.mjs', // 观察投影静态内容（同上）
  'attack-style.test.mjs',
  'rules-n3.test.mjs',
  'p0-regressions.test.mjs', // P0：选择 id / 弱点 / 基础弱点池 / 能力 API / 杜克 / 苍白面具
  'card-fidelity-p0.test.mjs', // 卡牌保真度审计 P0 逐卡行为回归（24 张高严重度）
  'card-fidelity-p1.test.mjs', // 卡牌保真度审计 P1/P2：地点限制与双实现收敛
  'card-fidelity-core-p3.test.mjs', // 卡牌保真度 P3：核心包批次
  'card-fidelity-dunwich-p3.test.mjs', // 卡牌保真度 P3：敦威治机制批次
  'card-fidelity-carcosa-p3.test.mjs', // 卡牌保真度 P3：卡尔克萨机制批次
  'card-fidelity-tfa-p3.test.mjs', // 卡牌保真度 P3：失落时代首批
  'encounter-handler-guard.test.mjs', // campaignRule 诡计必须有条目结算或章节显式登记
  'p1-regressions.test.mjs', // P1：全灭继续 / 02178 去向 / 03186 攻击限制
  'ability-layer.test.mjs',
  'card-entries.test.mjs', // 一卡一文件 / 索引 / 禁止批次大文件
  'encounter-entries.test.mjs', // 非玩家条目：一卡一文件 / 归属 / 索引 / 跨条目查询单独 import
  'architecture-guard.test.mjs',
  'phase6-guard.test.mjs', // Phase 6 门禁：引擎里无卡号 / 无战役名
  'phase6-implementation.test.mjs', // Phase 6（6e-1）实现账本：通道判定 / 摘要形状 / isPlayable 一致
  'phase6-campaign.test.mjs', // Phase 6（6e-17）战役插件化：公开投影 / agentHints / observation 守卫
  'card-lifecycle.test.mjs',
  'phase1-state.test.mjs', // A1 效果实体 / B1 目标枚举 / playCondition / schema v7
  'phase2-primitives.test.mjs', // C1-C4 语义原语 / B2-B6 / 逃生卡迁移门禁
  'phase3-content.test.mjs', // D1 非玩家卡通道 / D3 剧本声明 / D4 战役结果声明
  'migration-tools.test.mjs', // Phase 5 迁移账本 / 读点一致 / 工具纯函数
  'card-rules.test.mjs', // Phase 5（5a）卡号级规则数据读点
  'phase5-migration.test.mjs', // 5c 逃生卡改写后的行为（地点附属 / 连抽遭遇 / 检索）
  'replay.test.mjs', // 日志/指纹/重放/撤销的契约（含 4 局随机走子）
  'replay-golden.test.mjs', // golden replay 基线一致性 / 待决选择自检 / 动作覆盖率（只读 JSON）
  'replay-golden-notz-gathering.test.mjs', // golden replay 分组 1：夜之狂热·集结 5 局
  'replay-golden-notz-long.test.mjs', // golden replay 分组 2：midnight-masks 长局 + strict 3 人随机局
  'replay-golden-campaigns.test.mjs', // golden replay 分组 3：卡尔克萨 / 敦威治 / 失落时代 5 局
  'decision-http.test.mjs',
  'ai-completion.test.mjs',
  'ai-story.test.mjs',
  'ai-dialogue.test.mjs',
  'card-interactions.test.mjs',
  'turn-end-window.test.mjs', // 收尾窗口的快速卡 / 被击败前的救命卡窗口
  'script-actions.test.mjs',
  'script-card-ownership.test.mjs',
  'engagement-flow.test.mjs',
  'reaction-preferences.test.mjs',
  'auto-pass.test.mjs', // P0：自动跳过纯判定 + Mod autoPassChoice 钩子（大厅代答的输入契约）
  'card-filters.test.mjs',
  'arkhamdb-import.test.mjs',
  'deck-library.test.mjs',
  'campaign-http-n4.test.mjs',
  'core-n4.test.mjs',
  'scenario-n4b.test.mjs',
  'core-n4b.test.mjs',
  'core-acceptance.test.mjs',
  'core-special-acceptance.test.mjs',
  'core-encounter-acceptance.test.mjs',
  'core-timing-acceptance.test.mjs',
  'core-scenario-acceptance.test.mjs',
  'core-story-acceptance.test.mjs',
  'core-ledger.test.mjs',
  'campaign-experience.test.mjs',
  'hub-concurrent.test.mjs',
  'checkpoint-rewind.test.mjs',
  'flow-n5.test.mjs',
  'dunwich-migration.test.mjs',
  'dunwich-player-gaps.test.mjs',
  'dunwich-encounter-acceptance.test.mjs',
  'dunwich-scenario-acceptance.test.mjs',
  'dunwich-ledger.test.mjs',
  'carcosa-investigators.test.mjs',
  'carcosa-player-acceptance.test.mjs',
  'carcosa-opening.test.mjs',
  'carcosa-middle-a.test.mjs',
  'carcosa-middle-b.test.mjs',
  'carcosa-final.test.mjs',
  'carcosa-campaign.test.mjs',
  'carcosa-scenario-acceptance.test.mjs',
  'carcosa-rules.test.mjs',
  'carcosa-campaign-card-acceptance.test.mjs',
  'carcosa-all-card-ledger.test.mjs',
  'carcosa-pending-encounters.test.mjs',
  'carcosa-literal-behavior.test.mjs',
  'carcosa-implementation-gaps.test.mjs',
  'tfa-migration.test.mjs',
  'tfa-launch-supplies.test.mjs',
  'tfa-interludes.test.mjs',
  'tfa-visibility.test.mjs',
  'tfa-p2-hooks.test.mjs',
  'tfa-p2-restart.test.mjs',
  'tfa-player-p1.test.mjs',
  'tfa-encounter-p1.test.mjs',
  'tfa-investigators.test.mjs',
  'tfa-mechanics.test.mjs',
  'tfa-player-acceptance.test.mjs',
  'tfa-scenario-acceptance.test.mjs',
  'tfa-engine-integration.test.mjs',
  'tfa-engine-setups.test.mjs',
  'tfa-untamed-wilds.test.mjs',
  'tfa-doom-of-eztli.test.mjs',
  'tfa-threads-of-fate.test.mjs',
  'tfa-boundary-beyond.test.mjs',
  'tfa-heart-of-the-elders-part1.test.mjs',
  'tfa-heart-of-the-elders-part2.test.mjs',
  'tfa-city-of-archives.test.mjs',
  'tfa-depths-of-yoth.test.mjs',
  'tfa-shattered-aeons.test.mjs',
  'tfa-turn-back-time.test.mjs',
  'tfa-story.test.mjs',
  'tfa-rules.test.mjs',
  'tfa-supply-picker.test.mjs',
  'tcu-primitives-haunted.test.mjs', // 万象无终第 2 步原语 P2.1（闹鬼）
  'tcu-primitives-spectral-deck.test.mjs', // 第 2 步原语 P2.2（幽灵界第二遭遇牌堆）
  'tcu-primitives-spectral-location.test.mjs', // 第 2 步原语 P2.3（幽灵地点与翻面）
  'tcu-primitives-tarot.test.mjs', // 第 2 步原语 P2.4（塔罗牌组）
  'tcu-primitives-circle.test.mjs', // 第 2 步原语 P2.5（阵法多技能检定）
  'tcu-primitives-story-investigators.test.mjs', // 第 2 步原语 P2.6（无牌组故事调查员）
  'tcu-primitives-parley.test.mjs', // 第 2 步原语 P2.7（通用谈判）
  'tcu-primitives-bonded.test.mjs', // 第 2 步原语 P2.8（绑定）
  'tcu-primitives-tarot-slot.test.mjs', // 第 2 步原语 P2.9（塔罗槽位与开局入场）
  'tcu-primitives-campaign-records.test.mjs', // 第 2 步原语 P2.10（Memento/看守人/战役资产）
  'tcu-primitives-location-state.test.mjs', // 第 2 步原语 P2.11（裂口/火盆）
  'tcu-primitives-enemy-faces.test.mjs', // 第 2 步原语 P2.12（异端者多面/放逐）
  'tcu-primitives-cosmos.test.mjs', // 第 2 步原语 P2.13（Cosmos/未知地点牌库）
  'tcu-primitives-p7.test.mjs', // P7 玩家卡批次新增原语（openingHandBonus / leavesPlay resolve / eventPlayed / conditionalIcons）
  'tcu-migration.test.mjs', // 万象无终 P1：范围/三包/9 章占位/不可启动
  'tcu-scenario-acceptance.test.mjs', // 万象无终 P8：逐章账本/来源锁/内容结构接线
  'tcu-story.test.mjs', // 万象无终 P9：剧情导入/分支/幕间/隐私
  'tcu-campaign-card-acceptance.test.mjs', // 万象无终 P10：237 战役卡 + 34 关联面逐卡字面验收
  'tcu-all-card-ledger.test.mjs', // 万象无终 P10：377 条印刷记录全卡账本守卫
  'tcu-rules.test.mjs', // 万象无终 P4：关键词清单/规则书条目/卡文直达/机制登记
  'tcu-interactions.test.mjs', // 万象无终 P5：塔罗/选人/闹鬼协议与面板模型
  'tcu-investigators.test.mjs', // 万象无终 P6：六位调查员 + 13 张专属卡 + 序章故事调查员逐人验收
  'tcu-player-m2-1.test.mjs', // 万象无终 P7：M2-1 玩家卡 05020–05041 逐卡行为
  'tcu-player-m2-2.test.mjs', // 万象无终 P7：M2-2 玩家卡 05042/05109–05119/05151–05160 逐卡行为
  'tcu-player-m2-3.test.mjs', // 万象无终 P7：M2-3 玩家卡 05186–05196/05229–05237/05273–05274 逐卡行为
  'tcu-player-m2-4.test.mjs', // 万象无终 P7：M2-4 玩家卡 05275–05283/05313–05324 逐卡行为
  'tcu-player-ledger.test.mjs', // 万象无终 P7：M2 玩家卡账本/availability/campaign 接线
  'tcu-scenario-hooks.test.mjs', // 万象无终 P8：behavior.encounterDeckFor（幽灵遭遇牌堆自动路由）
  'tcu-prologue.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-deaths-doorstep.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-greater-good.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-witching-hour.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-clutches-chaos.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-shared-encounters.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-black-throne.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-secret-name.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-wages-of-sin.test.mjs', // 万象无终 P8：章节/共享组/账本测试
  'tcu-union-disillusion.test.mjs', // 万象无终 P8：章节/共享组/账本测试
])

export const SLOW_TESTS = Object.freeze([
  'campaign-n4.test.mjs', // N4 战役快速回归（升级/回滚/结局/创伤/牌组迁移）
  'campaign-n4-purchase-stress.test.mjs', // 连续取消购卡压测：默认 50 轮，N4_CANCEL_LOOPS=300 跑原深度
  'campaign-n4-matrix.test.mjs', // /2/4 人整局合法走子矩阵（原 7 组含难度，难度差异由混沌袋用例覆盖）
  'replay-fuzz.test.mjs', // Phase 4 门禁：随机对局重放（默认 40 局，REPLAY_FUZZ_FULL=1 跑 100 局）
  'replay-fuzz-walker.test.mjs', // Phase 4 门禁：随机走子器不变量（默认 2,000 步，FULL=5,000 步）
  'decision-invariants.test.mjs',
  'dunwich-rules.test.mjs',
  'p2-hub-http.test.mjs',
  'dunwich-player-acceptance.test.mjs',
  'core-final-acceptance.test.mjs',
  'notz-n4.test.mjs',
  'save-migration.test.mjs',
  'hall-online.test.mjs', // 联机集成，含四人长跑；从大厅回归迁入
])

export const ASSET_TESTS = Object.freeze([
  'audit-resources.test.mjs',
  'import-cards.test.mjs',
  'presentation-images.test.mjs',
  'image-cache.test.mjs',
  'music-cache.test.mjs',
  'music-library.test.mjs',
  'scenario-images.test.mjs',
  'image-translation.test.mjs',
  'presentation-http.test.mjs',
  'presentation-polish.test.mjs',
  'p6-content.test.mjs',
  'p7-images.test.mjs',
  'music-assets.test.mjs',
  'tcu-media.test.mjs',
  'carcosa-migration.test.mjs',
  'carcosa-story.test.mjs',
])
