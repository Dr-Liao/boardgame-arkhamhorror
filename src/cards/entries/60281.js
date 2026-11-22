// 60281 法老卷轴（研究完成·三）
// 卡面：研究完成。使用(4秘密)。[action] 受到 1 点恐惧并花费 1 或 2 秘密：调查([intellect])。本次调查 +3[intellect]。
// 成功时每花费 1 秘密，发现你所在地点额外 1 个线索。
// 读点：action 描述子 cost {action, horror, uses} + api.investigate(skillBonus, onSuccess)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60281'

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'action',
    label: '受 1 恐惧并花 1-2 秘密：调查 +3，成功时每秘密额外 1 线索',
    cost: { action: true, horror: 1, uses: 1 },
    resolve: ({ inv, source, api }) => {
      const spendMore = api.choice({
        kind: 'choice', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '是否额外花费 1 秘密（总共 2）？',
        options: [{ id: 'one', label: '只花费 1 秘密' }, { id: 'two', label: '花费 2 秘密' }],
      })
      const spent = spendMore === 'two' ? 2 : 1
      if (spent > 1) api.addUses(source, -1)
      api.investigate(inv.seat, {
        skillBonus: 3, source: CODE,
        onSuccess: () => {
          for (let index = 0; index < spent; index++) api.discoverClue(inv.seat, 1, inv.location)
        },
      })
    },
  }],
  modifiers: [],
}
