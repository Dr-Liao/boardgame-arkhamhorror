// 08008 可靠的长鞭（Trusty Bullwhip，蒙特雷·杰克的专属支援）
//
// 卡面：快速。蒙特雷·杰克牌库专用。
//   [action]：攻击。本次攻击使用 [agility] 而不是 [combat]。如果本次攻击成功，你可以横置
//   可靠的长鞭，以自动躲避受攻击的敌人，或使本次攻击 +1 伤害。
//
// 读点：`api.fight(..., { skill: 'agility', onSuccess })`——攻击成功回调在伤害结算之前，
// 可改写 `opts.damageBonus` 或调用 `api.autoEvadeEnemy`。横置是可选代价，只在成功时询问。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
export default {
  code: '08008',
  fast: true,
  abilities: [
    { kind: 'action', label: '攻击（敏捷）', cost: { action: true }, countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ inv, target, source, api }) => {
        if (!target) return
        const whipId = source?.id ?? null
        api.fight(inv.seat, target.id, { skill: 'agility', assetId: whipId,
          onSuccess: ({ enemy, opts }) => {
            const whip = (inv.assets || []).find(asset => asset.id === whipId)
            if (!whip || whip.exhausted) return
            const choice = api.choice({ kind: 'effect', source: whipId || '08008', seat: inv.seat,
              prompt: '横置可靠的长鞭：自动躲避受攻击的敌人，或使本次攻击 +1 伤害？',
              options: [{ id: 'evade', label: '横置：自动躲避该敌人' },
                { id: 'damage', label: '横置：本次攻击 +1 伤害' },
                { id: 'skip', label: '不横置' }] })
            if (choice !== 'evade' && choice !== 'damage') return
            whip.exhausted = true
            if (choice === 'evade') {
              if (enemy && !enemy.defeated) api.autoEvadeEnemy(enemy)
            } else {
              opts.damageBonus = (opts.damageBonus || 0) + 1
            }
          } })
      } },
  ],
  modifiers: [],
}
