// 04100 毒蛇召来
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：venom
// 卡面：显现 - 你必须(选择以下一项)：将放在一边的一张中毒弱点卡牌放置入场，放到你的威胁区域，或抽取遭遇牌库顶2张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04100', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const answer = api.choose({
      kind: 'harm', source: '04100', seat: inv.seat,
      prompt: '毒蛇召来：把放在一边的中毒弱点放入威胁区域，或抽取遭遇牌库顶 2 张。',
      options: [{ id: 'poison', label: '让一位调查员中毒' }, { id: 'cards', label: '抽出遭遇牌顶 2 张' }],
    })
    if (answer === 'poison') {
      // 卡面：放到「你的」威胁区域，不能改选其他调查员。
      api.poison(inv.seat)
    } else {
      api.drawEncounter(inv.seat)
      if (!inv.defeated && !inv.resigned) api.drawEncounter(inv.seat)
    }
    return false
  },
}
