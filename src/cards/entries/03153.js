// 03153 灵力风暴
// 卡面：攻击。本次攻击不使用[combat]，改为使用[willpower]。如果你检定成功，本次攻击不造成标准伤害，改为对该敌人所在地点的每个敌人造成2点伤害(所有额外伤害只对被攻击敌人造成)。如果本次攻击期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，对该敌人所在地点的每位调查员造成1点伤害。(FAQ v2.0)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03153 灵魂风暴：用意志攻击一名交战敌人（没有交战时攻击同地点的敌人）。

export default {
  code: '03153',
  abilities: [
    {
      kind: 'played', label: '灵魂风暴',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!candidates.length) { api.info('这里没有可攻击的敌人。'); return }
        const targetId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'enemy', source: '03153', seat: inv.seat, prompt: '选择灵力风暴攻击的敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const target = candidates.find(enemy => enemy.id === targetId) || candidates[0]
        api.fight(inv.seat, target.id, { skill: 'willpower', stormOfSpirits: true })
      },
    },
  ],
  modifiers: [

  ],
}
