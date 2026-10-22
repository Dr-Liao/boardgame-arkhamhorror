// 02113 哎呀！
// 卡面：快速。在你攻击与你交战的敌人时技能检定失败，并且低于难度2点及以内后打出。
// 卡面：对你所在地点的另一个敌人造成本次攻击的伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02113 哎呀！

export default {
  code: '02113',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "attackFail",
      "criteria": {
        "failedByAtMost": 2,
        "enemyEngagedWithYou": true
      },
      "label": "哎呀！",
      "resolve": ({ state, inv, api }) => {
        const reaction = api.reactionContext()
        const context = reaction?.context || reaction
        if (context?.when !== 'attackFail' && reaction?.when !== 'attackFail') return
        const original = context.enemy
        const targets = state.enemies.filter(enemy => enemy.location === inv.location && enemy.id !== original?.id)
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '02113', seat: inv.seat, prompt: '选择承受这次攻击伤害的另一名敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const target = targets.find(enemy => enemy.id === id)
        if (!target) return
        api.setReactionFlag('redirected', true)
        const damage = Math.max(0, context.attackDamage || 1)
        api.damageEnemy(target, damage, inv.seat, '02113')
        api.info(`${inv.name} 的攻击落空后改为对「${target.name}」造成 ${damage} 点伤害。`)
      }
    },
  ],
  modifiers: [

  ],
}
