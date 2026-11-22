// 60161 赏金（Bounty）
// 卡面：快速。你所在地点的一个敌人被击败后打出：你所在地点的调查员获得总计 X 资源，由你分配。X 为该敌人印刷生命值，最多 6。
// 读点：played 描述子 fast + trigger defeatEnemy（enemies.js 窗口 context.enemy/location）+ api.gainResources。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60161'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'defeatEnemy',
    label: '敌人被击败后：所在地点的调查员分配 X 资源（X=印刷生命值，最多 6）',
    criteria: [({ inv, context }) => context?.location === inv.location && context?.enemy],
    resolve: ({ state, inv, context, api }) => {
      const enemy = context.enemy
      const total = Math.min(6, Math.max(1, Number(enemy.health) || Number(api.cardDef?.(enemy.code)?.health) || 1))
      const receivers = state.investigators.filter(inv2 => !inv2.defeated && !inv2.resigned
        && inv2.location === inv.location)
      if (!receivers.length) return
      let remaining = total
      while (remaining > 0) {
        const id = receivers.length === 1 ? String(receivers[0].seat) : api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat, prompt: '分配剩余 ' + remaining + ' 资源给哪位调查员？',
          options: receivers.map(inv2 => ({ id: String(inv2.seat), label: inv2.name })),
        })
        const receiver = receivers.find(inv2 => String(inv2.seat) === String(id)) || receivers[0]
        api.gainResources(receiver.seat, 1)
        remaining--
      }
    },
  }],
  modifiers: [],
}
