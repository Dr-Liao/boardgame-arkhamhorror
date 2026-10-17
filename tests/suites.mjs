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
  'content-schema.test.mjs', // 0.6
  'content-registry.test.mjs', // 0.5
  'hall-boundary.test.mjs', // 0.2
  'card-identity.test.mjs', // 0.8
  'state-presentation.test.mjs', // 0.7
  'rules-n3.test.mjs', // 3.4
  'decision-http.test.mjs', // 1.7
  'ai-completion.test.mjs', // 1.6
  'ai-story.test.mjs', // 0.8
  'ai-dialogue.test.mjs', // 0.1
  'card-interactions.test.mjs', // 0.6
  'script-actions.test.mjs', // 0.6
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
  'tfa-migration.test.mjs', // 0.1
])

export const SLOW_TESTS = Object.freeze([
  'campaign-n4.test.mjs', // 130.3 —— 单个文件占了整套回归的 40%
  'decision-invariants.test.mjs', // 13.4
  'dunwich-rules.test.mjs', // 9.0
  'p2-hub-http.test.mjs', // 7.3
  'dunwich-player-acceptance.test.mjs', // 7.0
  'core-final-acceptance.test.mjs', // 6.0
  'notz-n4.test.mjs', // 5.8
  'save-migration.test.mjs', // 3.7
])

export const ASSET_TESTS = Object.freeze([
  'audit-resources.test.mjs', // 25.5
  'import-cards.test.mjs', // 22.1
  'presentation-images.test.mjs', // 1.6
  'image-cache.test.mjs', // 0.2
  'image-translation.test.mjs', // 0.5
  'presentation-http.test.mjs', // 0.9
  'presentation-polish.test.mjs', // 0.6
  'p6-content.test.mjs', // 2.6
  'p7-images.test.mjs', // 0.7
  'music-assets.test.mjs', // 0.6
  'carcosa-migration.test.mjs', // 0.5
  'carcosa-story.test.mjs', // 0.8
])
