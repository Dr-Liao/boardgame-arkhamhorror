// 08093 巨石锤
// 卡面：[action]：攻击。本次攻击将你的[willpower]加入你的技能值。你在本次攻击中造成+1伤害。
//       如果你成功并且该敌人为非[[精英]]，你可以将其朝着远离你的方向移动一个地点。
//       （如果你成功且超过难度3点或更多，改为造成+2伤害并可以将其朝着远离你的方向移动最多2个地点。）
//
// 读点：api.fight 的 addSkill:'willpower' + onSuccess 回调（伤害结算前可改 damageBonus），
// 敌人位移走 api.moveEnemy（目标为非精英且远离你＝不回到你所在地点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

const awayLocations = (state, inv, enemy) => (state.locations.find(location => location.id === enemy.location)?.connections || [])
  .filter(id => id !== inv.location && state.locations.some(location => location.id === id))

export default {
  code: '08093',
  abilities: [
    { kind: 'action', label: '攻击（加入意志，伤害 +1；成功可击退非精英敌人）', cost: { action: true },
      target: { kind: 'enemy' }, countsAs: 'fight',
      resolve: ({ inv, source, target, state, api }) => {
        const enemy = target?.entity || (target ? state.enemies.find(item => item.id === target.id) : null)
        if (!enemy) return
        api.fight(inv.seat, enemy.id, { addSkill: 'willpower', damageBonus: 1, assetId: source?.id,
          onSuccess: ({ result, opts }) => {
            const successBy = result ? result.value - result.difficulty : 0
            if (successBy >= 3) opts.damageBonus = (opts.damageBonus || 0) + 1
            if (enemy.elite || !state.enemies.includes(enemy)) return
            const steps = successBy >= 3 ? 2 : 1
            for (let i = 0; i < steps; i++) {
              const destinations = awayLocations(state, inv, enemy)
              if (!destinations.length) break
              const destination = destinations.length === 1 ? destinations[0] : api.choice({
                kind: 'location', source: '08093', seat: inv.seat,
                prompt: `选择将「${enemy.name}」击退到的地点。`,
                options: destinations.map(id => ({ id, label: api.locName(id) })),
              })
              api.moveEnemy(enemy, destination)
            }
          } })
      } },
  ],
  modifiers: [],
}
