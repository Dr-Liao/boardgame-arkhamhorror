// 05096 守密人
// 归属：战役共用 · theCircleUndone；遭遇组：silver_twilight_lodge
// 卡面：生成 - 任意无人地点。冷漠。反击。
// 卡面：强制 - 在神话阶段结束时：在守密人上放置 1 个毁灭标记。
// 卡面：[action]：谈判。检定[intellect](3)。如果你检定成功，移除守密人上的所有毁灭标记。
//
// 近似：「如果可以」的毁灭放置限制（CannotPlaceDoomOnThis）当前引擎没有通用读点，
// 这里无条件放置，记入 status.json 的 approximations。

export default {
  code: '05096',
  scope: 'enemy',
  implemented: true,
  enemyRule: { spawnAnyEmpty: true },
  enemySpawnRule: { doomAtMythosEnd: 1 },
  enemyScript: {
    encounterAction(state, inv, enemy) {
      return {
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyKeeperOfSecrets',
        enemyId: enemy.id, actions: 1,
        label: '谈判守密人（智识 3）：成功移除其上所有毁灭标记',
      }
    },
    performEncounterAction(state, inv, enemy, move, api) {
      if (move.rule !== 'parleyKeeperOfSecrets') return false
      const bonus = enemy.roundFightEvadeBonus?.round === state.round
        ? Number(enemy.roundFightEvadeBonus.amount) || 0 : 0
      api.test(inv.seat, 'intellect', 3 + bonus, result => {
        if (!result.success) return
        enemy.doom = 0
        api.info?.('守密人身上的毁灭标记被全部移除。')
      }, 0, { type: 'scenario', action: 'parley', name: '谈判', code: '05096', ability: true })
      return true
    },
  },
}
