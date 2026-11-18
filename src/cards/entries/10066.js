// 10066 假证（Fake Credentials）· 潜袭者资产 · 3 资源 · 手部槽
// 卡面：
//   [action] 选择你所在地点的一个敌人并横置假证：谈判。检定[智力](1)。假证上每有 1 疑点，
//   本次检定难度 +1。如果你检定成功，发现你所在地点的 1 个线索，并在假证上放置 1 资源，作为疑点。
//   如果你检定失败，你必须弃掉假证，或所选敌人攻击你。
//
// 读点（卡面 → 引擎）：
//   · 「[action] 选择敌人并横置」= kind 'action' + actionKind 'parley' + cost { action, exhaust } +
//     target { kind:'enemy' }：legalMoves 为每个同地点敌人展开一条带 targetId 的行动。
//   · 「疑点（资源）」= 资产实例的 uses（usesType 'resource'）——支援上的资源只经 api.addUses 写；
//     难度 = 1 + 当前 uses。
//   · 检定[智力] = api.test(seat, 'intellect', difficulty, { actionKind:'parley', resolve })。
//   · 成功：api.discoverClue（发现所在地点 1 线索）+ api.addUses(source, 1)。
//   · 失败：api.choice 二选一 —— api.discardSelf（移入所有者弃牌堆）或
//     api.enemyAttackByCard（卡牌效果造成的敌人攻击唯一入口）。
const CODE = '10066'

const suspicionOf = source => Math.max(0, Number(source?.uses) || 0)

export default {
  code: CODE,
  name: 'Fake Credentials',
  uses: 0,
  usesType: 'resource',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      cost: { action: true, exhaust: true },
      target: { kind: 'enemy' },
      label: '谈判：检定[智力](1 + 疑点)；成功发现线索并放置 1 疑点，失败则弃掉本卡或让该敌人攻击',
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const difficulty = 1 + suspicionOf(source)
        api.info(`🪪 ${inv.name} 出示假证与「${api.cardName(enemy.code)}」周旋：检定[智力](${difficulty})。`)
        api.test(inv.seat, 'intellect', difficulty, {
          actionKind: 'parley',
          source: { code: CODE, label: '谈判', name: api.cardName(CODE) },
          resolve: result => {
            if (result.success) {
              api.discoverClue(inv.seat)
              api.addUses(source, 1)
              api.info(`🪪 假证：发现 1 个线索，并在假证上放置 1 个疑点（当前 ${suspicionOf(source)}）。`)
              return
            }
            const answer = api.choice({
              kind: 'effect', source: CODE, seat: inv.seat,
              prompt: '假证：检定失败，弃掉假证，或让所选敌人攻击你。',
              options: [{ id: 'discard', label: '弃掉假证' }, { id: 'attack', label: '让所选敌人攻击你' }],
            })
            if (answer === 'attack') {
              api.enemyAttackByCard(enemy, `👹 假证：「${api.cardName(enemy.code)}」攻击 ${inv.name}。`, inv.seat)
            } else {
              api.discardSelf(CODE)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
