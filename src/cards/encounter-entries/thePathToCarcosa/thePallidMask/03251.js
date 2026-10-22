// 03251 百魂之井
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 你在百魂之井结束回合后：你必须受到1点直接恐惧，或随机弃掉你2张手牌。
// 卡面：强制 - 在百魂之井揭示时：将地下墓穴牌库顶的1张地下墓穴放置入场，放在百魂之井的上方、下方或右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 颤栗水池（03251 的「百魂之井」）与颤栗水池（03255）：回合结束时二选一的强制效果。
// 第 114 轮：从 thePallidMask 的 behavior.turnEnded 分支迁来，读点是 locationRule.onTurnEnd。

export default {
  code: '03251', scope: 'location',
  locationRule: {
    onTurnEnd(state, location, api, inv) {
      const answer = api.choose({
        kind: 'harm', source: location?.originalCode || location?.code, seat: inv.seat,
        prompt: '百魂之井：选择受到1点直接恐惧，或随机弃掉2张手牌。',
        options: [{ id: 'horror', label: '受到1点直接恐惧' }, { id: 'discard', label: '随机弃2张手牌' }],
      })
      if (answer === 'horror') api.directHorror(inv.seat, 1)
      else api.discardRandom(inv.seat, 2)
    },
  },
}
