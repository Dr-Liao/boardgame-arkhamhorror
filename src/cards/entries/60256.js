// 60256 密教记录（Occult Records）
// 卡面：使用(3秘密)。[free] 你的回合期间，花费 1 秘密并横置：治愈你所在地点一位调查员 2 点恐惧。
// 然后检定[willpower](2)；失败则随机弃掉 1 张手牌。
// 读点：free 描述子（player window，cost.uses+exhaust）+ api.healHorror；api.test；api.discardRandomFromHand。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60256'

export default {
  code: CODE,
  uses: 3,
  usesType: 'secrets',
  abilities: [{
    kind: 'free',
    label: '花 1 秘密并横置：治愈 2 点恐惧，然后意志(2) 失败随机弃牌',
    cost: { exhaust: true, uses: 1 },
    criteria: [({ state, inv }) => state.investigators.some(owner => !owner.defeated && !owner.resigned
      && owner.location === inv.location && (owner.horror || 0) > 0)],
    resolve: ({ state, inv, api }) => {
      const targets = state.investigators.filter(owner => !owner.defeated && !owner.resigned
        && owner.location === inv.location && (owner.horror || 0) > 0)
      if (!targets.length) return
      const id = targets.length === 1 ? String(targets[0].seat) : api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat, prompt: '选择要治愈恐惧的调查员。',
        options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })),
      })
      const target = targets.find(owner => String(owner.seat) === String(id)) || targets[0]
      api.healHorror(target.seat, 2)
      api.test(inv.seat, 'willpower', 2, {
        source: { code: CODE, label: '密教记录' },
        resolve: result => {
          if (!result.success) api.discardRandomFromHand(inv.seat, 1)
        },
      })
    },
  }],
  note: 'approximation: 「你的回合期间」用 free 玩家窗口近似（引擎 free 描述子没有单独的 ownTurn 时机，criteria 未限定阶段）；已登记请求。',
  modifiers: [],
}
