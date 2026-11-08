// 08688 潜藏的疯狂（Latent Madness）· 诡计 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 检定[willpower](4)。你检定失败且每低于难度 1 点，将忒咳哩-哩牌库顶的 1 张卡牌
//   洗入你的牌库，不要查看内容（每有 1 张卡牌不能洗入你的牌库，受到 1 点恐惧）。
// 读点：entryRevelation + encounterResolve（treachery-tokens.js 的条目通道）。
export default {
  code: '08688', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const failedBy = Math.max(0, 4 - Number(result.value || 0))
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = failedBy > 0 && size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(failedBy, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = failedBy - done
      api.info('「潜藏的疯狂」：洗入 ' + done + ' 张忒咳哩-哩' + (missing > 0 ? '，' + missing + ' 张无法洗入。' : '。'))
      if (missing > 0) api.horror(inv.seat, missing)
    })
    return false
  },
}

