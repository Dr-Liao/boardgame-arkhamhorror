// Arkham 回归分层清单。每一个 tests/*.test.mjs 都必须恰好落在一个 tier 里，
// 由 suite-manifest.test.mjs 守住，避免新增用例悄悄从快测里漏掉。
//
// 分层依据是单文件实测耗时（Windows / node 22，逐文件 `node --test` 计时）：
//   fast  ≈ 40s  改规则、AI、卡牌逻辑时的日常回归
//   slow  ≈ 180s 整局模拟，单项就超过 fast 全部合计（campaign-n4 一个文件 130s）
//   assets ≈ 60s 生成器、媒体许可与资源完整性校验，要读 13MB 卡池与 参考资源
// 括号内是实测秒数；重新分层前请先重新计时，别凭文件名的直觉。

export const FAST_TESTS = Object.freeze([
  'availability.test.mjs', // 0.4
  'game-settings.test.mjs', // 开局高级设置：卡牌范围 / 回档 / AI 感知剧情
  'content-schema.test.mjs', // 0.6
  'content-registry.test.mjs', // 0.5
  'hall-boundary.test.mjs', // 0.2
  'card-identity.test.mjs', // 0.8
  'state-presentation.test.mjs', // 0.7
  'attack-style.test.mjs', // 0.7
  'rules-n3.test.mjs', // 3.4
  'p0-regressions.test.mjs', // P0：选择 id / 弱点 / 基础弱点池 / 能力 API / 杜克 / 苍白面具
  'p1-regressions.test.mjs', // P1：全灭继续 / 02178 去向 / 03186 攻击限制
  'ability-layer.test.mjs', // 0.9
  'card-entries.test.mjs', // 0.4 —— 一卡一文件 / 索引 / 禁止批次大文件
  'architecture-guard.test.mjs', // 0.1
  'phase6-guard.test.mjs', // 0.1 —— Phase 6 门禁：引擎里无卡号 / 无战役名
  'phase6-implementation.test.mjs', // 0.4 —— Phase 6（6e-1）实现账本：通道判定 / 摘要形状 / isPlayable 一致
  'phase6-campaign.test.mjs', // 0.2 —— Phase 6（6e-17）战役插件化：公开投影 / agentHints / observation 守卫
  'card-lifecycle.test.mjs', // 0.3
  'phase1-state.test.mjs', // 1.2 —— A1 效果实体 / B1 目标枚举 / playCondition / schema v7
  'phase2-primitives.test.mjs', // 1.3 —— C1-C4 语义原语 / B2-B6 / 逃生卡迁移门禁
  'phase3-content.test.mjs', // 1.3 —— D1 非玩家卡通道 / D3 剧本声明 / D4 战役结果声明
  'migration-tools.test.mjs', // 0.5 —— Phase 5 迁移账本 / 读点一致 / 工具纯函数
  'card-rules.test.mjs', // 0.1 —— Phase 5（5a）卡号级规则数据读点
  'phase5-migration.test.mjs', // 1.2 —— 5c 逃生卡改写后的行为（地点附属 / 连抽遭遇 / 检索）
  'replay.test.mjs', // 4.2 —— 日志/指纹/重放/撤销的契约（含 4 局随机走子）
  'replay-golden.test.mjs', // 11.2 —— golden replay 基线（4 战役 / 5 关卡 / 529 步逐步指纹）
  'decision-http.test.mjs', // 1.7
  'ai-completion.test.mjs', // 1.6
  'ai-story.test.mjs', // 0.8
  'ai-dialogue.test.mjs', // 0.1
  'card-interactions.test.mjs', // 0.6
  'script-actions.test.mjs', // 0.6
  'script-card-ownership.test.mjs', // 1.0
  'engagement-flow.test.mjs', // 0.8
  'reaction-preferences.test.mjs', // 0.6
  'card-filters.test.mjs', // 0.4
  'arkhamdb-import.test.mjs', // 0.4
  'deck-library.test.mjs', // 0.5
  'campaign-http-n4.test.mjs', // 1.5
  'core-n4.test.mjs', // 1.0
  'scenario-n4b.test.mjs', // 1.7
  'core-n4b.test.mjs', // 0.6
  'core-acceptance.test.mjs', // 2.5
  'core-special-acceptance.test.mjs', // 1.3
  'core-encounter-acceptance.test.mjs', // 1.7
  'core-timing-acceptance.test.mjs', // 1.5
  'core-scenario-acceptance.test.mjs', // 1.3
  'core-story-acceptance.test.mjs', // 1.8
  'core-ledger.test.mjs', // 0.6
  'campaign-experience.test.mjs', // 2.0
  'hub-concurrent.test.mjs', // 1.4
  'checkpoint-rewind.test.mjs', // 1.7
  'flow-n5.test.mjs', // 2.4
  'dunwich-migration.test.mjs', // 1.3
  'dunwich-player-gaps.test.mjs', // 1.4
  'dunwich-encounter-acceptance.test.mjs', // 0.9
  'dunwich-scenario-acceptance.test.mjs', // 1.2
  'dunwich-ledger.test.mjs', // 0.3
  'carcosa-investigators.test.mjs', // 1.5
  'carcosa-player-acceptance.test.mjs', // 1.5
  'carcosa-opening.test.mjs', // 0.4
  'carcosa-middle-a.test.mjs', // 0.4
  'carcosa-middle-b.test.mjs', // 0.6
  'carcosa-final.test.mjs', // 0.4
  'carcosa-campaign.test.mjs', // 0.4
  'carcosa-scenario-acceptance.test.mjs', // 0.1
  'carcosa-rules.test.mjs', // 1.1
  'carcosa-campaign-card-acceptance.test.mjs', // 0.6
  'carcosa-all-card-ledger.test.mjs', // 0.3
  'carcosa-pending-encounters.test.mjs', // 0.6
  'carcosa-literal-behavior.test.mjs', // 0.4
  'carcosa-implementation-gaps.test.mjs', // 0.6
  'tfa-migration.test.mjs', // 0.1
  'tfa-launch-supplies.test.mjs', // 1.0
  'tfa-interludes.test.mjs', // 2.4
  'tfa-visibility.test.mjs', // 0.4
  'tfa-p2-hooks.test.mjs', // 0.3
  'tfa-p2-restart.test.mjs', // 0.1
  'tfa-player-p1.test.mjs', // 0.4
  'tfa-encounter-p1.test.mjs', // 2.8
  'tfa-investigators.test.mjs', // 4.1
  'tfa-mechanics.test.mjs', // 0.6
  'tfa-player-acceptance.test.mjs', // 0.4
  'tfa-scenario-acceptance.test.mjs', // 0.1
  'tfa-engine-integration.test.mjs', // 0.2
  'tfa-engine-setups.test.mjs', // 0.6
  'tfa-untamed-wilds.test.mjs', // 0.2
  'tfa-doom-of-eztli.test.mjs', // 0.2
  'tfa-threads-of-fate.test.mjs', // 0.2
  'tfa-boundary-beyond.test.mjs', // 0.2
  'tfa-heart-of-the-elders-part1.test.mjs', // 0.2
  'tfa-heart-of-the-elders-part2.test.mjs', // 0.2
  'tfa-city-of-archives.test.mjs', // 0.2
  'tfa-depths-of-yoth.test.mjs', // 0.2
  'tfa-shattered-aeons.test.mjs', // 0.2
  'tfa-turn-back-time.test.mjs', // 0.2
  'tfa-story.test.mjs', // 0.2
  'tfa-rules.test.mjs', // 0.3
  'tfa-supply-picker.test.mjs', // 0.1
])

export const SLOW_TESTS = Object.freeze([
  'campaign-n4.test.mjs', // 130.3 —— 单个文件占了整套回归的 40%
  'replay-fuzz.test.mjs', // 71.7 —— Phase 4 门禁：100 局随机对局重放 + 5,000 步随机走子器
  'decision-invariants.test.mjs', // 13.4
  'dunwich-rules.test.mjs', // 9.0
  'p2-hub-http.test.mjs', // 7.3
  'dunwich-player-acceptance.test.mjs', // 7.0
  'core-final-acceptance.test.mjs', // 6.0
  'notz-n4.test.mjs', // 5.8
  'save-migration.test.mjs', // 3.7
  'hall-online.test.mjs', // 联机集成，含四人长跑；从大厅回归迁入，重新计时后再调整
])

export const ASSET_TESTS = Object.freeze([
  'audit-resources.test.mjs', // 25.5
  'import-cards.test.mjs', // 22.1
  'presentation-images.test.mjs', // 1.6
  'image-cache.test.mjs', // 0.2
  'music-cache.test.mjs', // 0.2
  'scenario-images.test.mjs', // 0.3
  'image-translation.test.mjs', // 0.5
  'presentation-http.test.mjs', // 0.9
  'presentation-polish.test.mjs', // 0.6
  'p6-content.test.mjs', // 2.6
  'p7-images.test.mjs', // 0.7
  'music-assets.test.mjs', // 0.6
  'carcosa-migration.test.mjs', // 0.5
  'carcosa-story.test.mjs', // 0.8
])
