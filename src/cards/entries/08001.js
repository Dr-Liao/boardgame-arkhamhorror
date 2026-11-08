// 08001 丹妮拉·雷耶丝（Daniela Reyes）· 守卫者 · 机修工。
//
// 卡面（正面）：
//   [reaction] 敌人攻击你后（你触发的趁乱攻击除外），即便该攻击被取消：对该敌人造成 1 点伤害，
//     或自动躲避它。
//   [elder_sign] 效果：+1。如果你本轮被敌人攻击过，改为自动成功。
//
// 引擎读点（Lead 的 P5 支持项）：
//   · 敌人攻击结算时在 `inv.attackedSinceTurnEnd` 追加 `{ enemyId, round, kind }`（含被取消的攻击；
//     在调查员回合结束时清空）——旧印的「本轮被攻击过」与 08002 的「上个回合结束后攻击过你的敌人」
//     都读这一份权威记录，卡条目只读不写；
//   · enemyAttacked 窗口上下文带 `{ enemy, attack }`，`attack.kind === 'opportunity'` 即趁乱攻击。
export default {
  code: '08001',
  kind: 'investigator',
  // tracksAttacks：引擎在敌人攻击结算时把 {enemyId, round, kind} 记进 inv.attackedSinceTurnEnd
  // （src/engine/eote-investigator-support.js 的 noteEnemyAttackOnInvestigator；只对声明者写入），
  // 旧印与扳手都只读这份记录。
  investigator: { elderSign: { bonus: 1 }, tracksAttacks: true },
  elderSign: {
    label: '旧印：+1；本轮被敌人攻击过则改为自动成功',
    resolve: ({ inv, state }) => {
      const attackedThisRound = (inv.attackedSinceTurnEnd || []).some(entry => entry.round === state.round)
      return attackedThisRound ? { delta: 1, autoSuccess: true } : { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'enemyAttacked',
    label: '敌人攻击你后：对该敌人造成 1 点伤害，或自动躲避它',
    criteria: ({ inv, context, state, helpers }) => context.seat === inv.seat
      && Boolean(context.enemy) && state.enemies.includes(context.enemy)
      && context.attack?.kind !== 'opportunity'
      && (helpers.canDamageEnemy(context.enemy, inv.seat) || helpers.canAutoEvade(context.enemy, inv.seat)),
    resolve: ({ inv, context, api }) => {
      const enemy = context.enemy
      if (!enemy) return
      const canDamage = api.canDamageEnemy(enemy, inv.seat)
      const canEvade = api.canAutoEvade(enemy, inv.seat)
      if (!canDamage && !canEvade) return
      const options = [
        ...(canDamage ? [{ id: 'damage', label: `对「${enemy.name}」造成 1 点伤害` }] : []),
        ...(canEvade ? [{ id: 'evade', label: `自动躲避「${enemy.name}」` }] : []),
      ]
      const id = options.length === 1 ? options[0].id
        : api.choice({ kind: 'effect', source: '08001', seat: inv.seat, prompt: '敌人攻击你之后：', options })
      if (id === 'damage') api.damageEnemy(enemy, 1, inv.seat)
      else api.autoEvadeEnemy(enemy)
    },
  }],
}
