// 01178 提供力量
// 归属：跨战役通用
// 遭遇组：agents_of_yog
// 卡面：险境。
// 卡面：显现 - 你必须(选择以下一项)：抽取2张卡牌并在当前密谋上放置2个毁灭标记(本效果可以导致当前密谋推进)，或者受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01178', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    // 提供力量：险境。抽 2 张牌并放 2 点毁灭，或受到 2 点恐惧。
    const answer = api.choose({
      kind: 'treachery', source: code, seat: inv.seat, peril: true,
      prompt: '提供力量：抽 2 张牌并放 2 点毁灭，或受到 2 点恐惧。',
      options: [{ id: 'horror', label: '受到 2 点恐惧' }, { id: 'power', label: '抽 2 张牌并放置 2 点毁灭' }],
    })
    if (answer === 'power') { api.drawCards(inv.seat, 2); api.addDoom(2) }
    else api.horror(inv.seat, 2)
    return false
  },
}
