// 04266 鲜血失色
// 卡面：作为打出鲜血失色的额外费用，受到最多3点伤害。
// 卡面：攻击。本次攻击不使用[combat]，改为使用[willpower]。支付本卡牌费用时你每受到一点伤害，本次攻击得到+1[willpower]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04266 鲜血失色：可额外受到最多 3 点伤害，换取意志攻击加成（旧 bloodletting）。

export default {
  code: '04266',
  abilities: [
    {
      kind: 'played', label: '鲜血失色',
      // 卡面「攻击。」= Fight 行动：打出按攻击结算，不引发借机攻击。
      countsAs: 'fight',
      resolve: ({ inv, api }) => {
        const max = Math.min(3, api.maxHealth(inv.seat) - inv.damage > 0 ? 3 : 0)
        const amount = Number(api.choice({ kind: 'resource', source: '04266', seat: inv.seat,
          prompt: '选择额外承受的伤害（每点 +1 意志与 +1 伤害）。',
          options: Array.from({ length: max + 1 }, (_, index) => ({ id: String(index), label: `${index} 点伤害` })) }))
        if (amount) {
          api.directDamage(inv.seat, amount)
          if (inv.defeated) return
        }
        const targets = api.enemiesAt(inv.location)
        if (!targets.length) { api.info('没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04266', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = targets.find(enemy => enemy.id === chosen) || targets[0]
        api.fight(inv.seat, target.id, { skill: 'willpower', combatBonus: amount, damageBonus: amount })
      },
    },
  ],
  modifiers: [

  ],
}
