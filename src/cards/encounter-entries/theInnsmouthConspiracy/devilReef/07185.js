// 07185 伏兵出水 · 魔鬼礁石（诡计）
//
// 印刷（中文）：
//   显现 - 将伏兵出水放置入场，放在密谋牌库旁。
//   强制 - 在你攻击淹没地点的敌人时，揭示混乱标记时：再揭示一个混乱标记。(每次检定最多一次。)
//   强制 - 当一轮结束时：从场上弃掉1张伏兵出水。(每轮最多一次。)
// 印刷（英文）：
//   Revelation - Put Aquatic Ambush into play next to the agenda deck.
//   Forced - When you reveal a chaos token while attacking an enemy at a flooded location:
//   Reveal an additional chaos token. (Max once per test.)
//   Forced - At the end of the round: Discard 1 copy of Aquatic Ambush from play. (Max once per round.)
//
// 引擎读点：
//   · 显现「放在密谋牌库旁」= `api.putNextToAgenda('07185')`（scenario-runtime，真实旁置实例，
//     与 07095/07107 同形）；`encounterResolve` 返回 true 表示该卡已「入场」，不再进遭遇弃牌堆
//     （读点 encounter.js#drawEncounter 的 placed 分支）。
//   · 「攻击淹没地点的敌人时再揭示一个混乱标记（每次检定最多一次）」=
//     `treacheryRule.extraTokenOnAttackAtFlooded: true`：读点 tests.js 的
//     `floodedAttackExtraTokenRule`（从 agendaAside 里找该宣告 + 检定目标是淹没地点的敌人，
//     floodLevel > 0），在本次检定揭示标记后额外揭示 1 个并计入同一检定（pendingTokens），
//     `extraFloodedAttackTokenUsed` 保证每次检定最多一次。
//   · 轮末弃 1 张（每轮最多一次，多张副本同轮只弃 1 张）=
//     `treacheryRule.discardOneAtRoundEnd: true`（phases.js#upkeepPhase 的旁置卡扫描；
//     同口径见 07095/07107）。
//
// 共用模板位置：07095 / 07107 的「显现 + 放在密谋牌库旁 + 轮末弃 1 张」三句同形；
// 额外混乱标记的读点与日志在 tests.js（主进程落地）。
//
// implemented：三句印刷正文全部有读点与测试（tests/tic-middle-remaining.test.mjs）。

export default {
  code: '07185',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    discardOneAtRoundEnd: true,
    extraTokenOnAttackAtFlooded: true,
  },
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda('07185')
    api.info?.('🌊 「伏兵出水」放在密谋牌库旁：在淹没地点攻击敌人揭示混乱标记时，会再揭示一个。')
    return true
  },
}
