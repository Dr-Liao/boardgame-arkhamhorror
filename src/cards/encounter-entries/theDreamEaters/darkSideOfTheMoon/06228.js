// 06228 敌人「土星猫」（Cats from Saturn · [[生物]]·[[怪物]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// 猎手。蜂拥 X。X 为你的警报等级（如果没有当前调查员，则为所有调查员之中最高的警报等级）。
// 强制 - 土星猫的头领移动或被躲避后：弃掉其 1 张蜂拥卡牌。
//
// 依据 Haskell Enemy/Cards/.../CatsFromSaturn.hs（modifySelf SwarmingValue x、EnemyMovedTo/EnemyEvaded →
// chooseOne swarm → Discard）：
//   · Swarming X 的规格由 definition 的 encounterDefinitions 从卡文解析（alarmLevel 口径）；
//     入场放置/清空前不可击败/溢出伤害都由 TDE 共享层 encounterRules 统一结算（本条目不重复实现）；
//   · 移动后弃蜂拥卡 → enemyScript.onMoved（共享层派发）；被躲避后 → enemyScript.onEvaded
//     （本章 behavior.afterEvade 派发，引擎 afterEvade 钩子）。
const ALARM = 'alarmLevel'
const CATS = '06228'

function discardOneSwarmCard(state, enemy, api, label) {
  const cards = api.swarm?.cardsOf?.(enemy) || []
  if (!cards.length) return
  const chosen = cards.length === 1 ? cards[0] : cards.find(card =>
    String(card.id) === String(api.choice?.({
      kind: 'card', source: CATS, seat: state.campaign?.leadSeat ?? 0,
      prompt: '土星猫：选择要弃掉的 1 张蜂拥卡牌。',
      options: cards.map(card => ({ id: String(card.id), label: api.cardName?.(card.code) || card.code })),
    }))) || cards[0]
  api.swarm?.remove?.(enemy, chosen.id)
  api.info?.(`🐈 土星猫${label}：弃掉 1 张蜂拥卡牌（剩余 ${(api.swarm?.cardsOf?.(enemy) || []).length} 张，头领 X 仍按警报等级）。`)
}

export default {
  code: CATS,
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onSpawn(state, enemy, api) {
      // 入场放置已由共享层 enemySpawned 完成；这里只标注 X 的口径，便于日志/重放辨认。
      if (String(enemy?.originalCode || enemy?.code) !== CATS) return
      api.info?.(`🐈 土星猫（蜂拥 X）：X 取当前调查员的警报等级（没有当前调查员时取最高警报等级）。`)
    },
    onMoved(state, enemy, location, api, previous) {
      if (String(enemy?.originalCode || enemy?.code) !== CATS) return
      discardOneSwarmCard(state, enemy, api, '移动后')
    },
    onEvaded(state, enemy, api) {
      if (String(enemy?.originalCode || enemy?.code) !== CATS) return
      discardOneSwarmCard(state, enemy, api, '被躲避后')
    },
  },
  flags: { swarmingKind: 'alarmLevel', alarmCounter: ALARM },
  note: '被弃掉的蜂拥卡只从蜂拥区移除（api.swarm.remove）；「进遭遇弃牌堆」的收口见 primitive-requests/w-p8-c-swarm-discard.json。',
}
