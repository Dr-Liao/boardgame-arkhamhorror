// 09052 存在之谜（Existential Riddle）· 探寻者（Seeker）事件 · 1 经验。
//
// 卡面：谈判。选择一个你所在地点的非[[精英]]敌人并检定[意志]或[智力](8)。你每有一张其他手牌，
//       本次检定得到难度 -1。如果你检定成功，自动躲避所选敌人并将存在之谜附属到该敌人。
//       所附属敌人获得冷漠。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ actionKind:'parley'（不引发借机攻击）。
//   · 技能检定 → api.test(seat, skill, difficulty, { resolve })（检定结果契约 B3）。
//   · 「自动躲避」→ api.autoEvadeEnemy；「附属到该敌人」→ api.attachSelfTo（手铐/藏身处的同一写点）；
//     「所附属敌人获得冷漠」→ api.grantHidingSpotAloof（turn-flow 每次重算 aloof 时读它，因此能持续）。
const CODE = '09052'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      // 「谈判。」：按谈判行动结算（不引发借机攻击）。
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '谈判：检定[意志]或[智力](8 - 其他手牌数)；成功则自动躲避该敌人并附属，敌人获得冷漠',
      resolve: ({ inv, api }) => {
        const candidates = api.enemiesAt(inv.location).filter(enemy => !enemy.elite)
        if (!candidates.length) {
          api.info('「存在之谜」：你所在地点没有非[[精英]]敌人。')
          return
        }
        const enemyId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「存在之谜」：选择一个非[[精英]]敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === enemyId)
        if (!enemy) return
        const skill = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「存在之谜」：选择本次谈判使用的技能。',
          options: [{ id: 'willpower', label: '意志' }, { id: 'intellect', label: '智力' }],
        })
        // 本卡已离手，所以手牌张数就是「其他手牌」。
        const otherCards = (inv.hand || []).length
        const difficulty = Math.max(0, 8 - otherCards)
        api.info(`🌀 「存在之谜」：${inv.name} 与「${enemy.name}」谈判（难度 8 - ${otherCards} = ${difficulty}）。`)
        api.test(inv.seat, skill === 'intellect' ? 'intellect' : 'willpower', difficulty, {
          source: { code: CODE, label: '谈判', name: '存在之谜' },
          resolve: result => {
            if (!result.success) return
            api.autoEvadeEnemy(enemy)
            if (api.attachSelfTo(CODE, enemy.id)) {
              api.grantHidingSpotAloof(enemy)
              api.info(`🌀 「存在之谜」附属到「${enemy.name}」：该敌人获得冷漠。`)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
