// 04299 瓦卢西亚之子 · 幽嘶深渊
// 显现：放在密谋牌库旁；每张都给蛇族敌人 +1 攻击、+1 躲避。
// 强制：每轮结束时弃掉场上一张瓦卢西亚之子。

const CODE = '04299'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda(CODE)
    api.info?.('瓦卢西亚之子被放在密谋牌库旁：每个蛇族敌人 +1 攻击值、+1 躲避值。')
    return { placed: true }
  },
  treacheryRule: {
    discardOneAtRoundEnd: true,
    agendaAsideEnemyStat: { trait: 'Serpent', fight: 1, evade: 1 },
  },
}
