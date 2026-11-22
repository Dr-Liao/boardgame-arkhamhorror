// 60477 鲜血诅咒（升级版，Marie Lambeau，3 XP）
// 卡面：每次技能检定最多投入 1 张。如果本次技能检定成功，对你所在地点一张有生命值的卡牌造成 1 点伤害。
export default {
  code: '60477',
  abilities: [{
    kind: 'commit',
    label: '检定成功：对同地点一张有生命值的卡牌造成 1 点伤害',
    skill: {
      maxPerTest: 1,
      onSuccessResolve: ({ state, inv, api }) => {
        const enemies = (state.enemies || []).filter(enemy => enemy.location === inv.location
          && Number.isFinite(enemy.health))
        const investigators = state.investigators.filter(owner => owner.location === inv.location
          && !owner.defeated)
        const options = [
          ...enemies.map(enemy => ({ id: `enemy:${enemy.id}`, label: enemy.name })),
          ...investigators.map(owner => ({ id: `seat:${owner.seat}`, label: owner.name })),
        ]
        if (!options.length) return
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'target', source: '60477', seat: inv.seat,
          prompt: '选择一张有生命值的卡牌造成 1 点伤害。', options,
        })
        if (String(answer).startsWith('enemy:')) {
          const enemy = enemies.find(item => `enemy:${item.id}` === String(answer))
          if (enemy) api.damageEnemy(enemy, 1, inv.seat, '60477')
        } else if (String(answer).startsWith('seat:')) {
          api.damage(Number(String(answer).slice(5)), 1)
        }
      },
    },
  }],
}
