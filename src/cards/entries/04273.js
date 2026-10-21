// 04273 陈旧猎枪
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+3[combat]并造成+2伤害。如果本次攻击期间揭示了[skull]或[auto_fail]符号，猎枪卡膛了。(本次攻击自动失败。你再次激活本攻击能力之前，你必须执行以下能力：“[action]：你解决了卡膛情况。”)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04273 旧霰弹枪：战斗 +3 的攻击；揭示骷髅或自动失败则卡膛，成功造成 2 点伤害。

export default {
  code: '04273',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '花费 1 子弹：攻击（战斗 +3，伤害 +2）', cost: { action: true, uses: 1 },
      countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04273', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'combat', api.enemyFight(enemy), {
          source: { label: '攻击', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemy.code },
          skillBonus: 3,
          resolve: result => {
            if ((result.drawn || []).some(token => token === 'skull' || token === 'autofail')) {
              api.info('💥 「' + api.cardName('04273') + '」卡膛，本次攻击自动失败。')
              return
            }
            if (!result.success) return
            api.damageEnemy(enemy, 2, inv.seat)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
