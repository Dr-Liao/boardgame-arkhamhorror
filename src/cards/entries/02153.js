// 02153 催眠术
// 卡面：快速。在一个敌人攻击你所在地点的一位调查员时打出。
// 卡面：取消该次攻击。然后，从混乱袋中随机揭示一个标记。如果该标记有[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，对该敌人造成其自身的伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02153 催眠术

export default {
  code: '02153',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "enemyAttack",
      "label": "催眠术",
      "resolve": ({ inv, api }) => {
        const reaction = api.reactionContext()
        if (reaction?.when !== 'enemyAttack') return
        api.cancelCurrentAttack()
        const token = api.revealChaosTokens(1)[0]
        if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
          const enemy = reaction.context?.enemy || reaction.enemy
          if (enemy) api.damageEnemy(enemy, enemy.damage || 0, inv.seat)
        }
      }
    },
  ],
  modifiers: [

  ],
}
