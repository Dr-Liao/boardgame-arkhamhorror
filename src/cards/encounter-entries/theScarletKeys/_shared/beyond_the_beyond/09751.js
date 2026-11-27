// 09751 超维恐怖（Paradimensional Terror）· 诡计 · beyond_the_beyond
// 卡面：险境。显现 - 你必须决定（选择一项）：
//   · 将每张诱饵翻面。混洗场上所有隐匿迷你卡牌，然后将这些迷你卡牌正面朝下随机放到先前位置。
//   · 每位调查员受到 1 点伤害和 1 点恐惧。
// 读点：encounterResolve（各战役 encounter-rules 的统一诡计结算入口）；重排走
//   tsk 机制面的 concealed.reshuffle（不增删，只重排当前地点/位置）；伤害/恐惧走 api.damage / api.horror。
//
// P1-5（2026-11-13）：遭遇结算面传给 encounterResolve 的是 scenarioRuntime，它的机制面**只在
//   `api.mechanics.tsk` 下**（api-mechanics.js 的 `tsk` 命名空间），没有顶层 `api.tsk`；而能力面
//   （ctx.api）同时有摊平的 `api.tsk` 与 `api.mechanics.tsk`。两个入口指向同一份状态视图
//   （同一个 createMechanicsApi 实例），因此这里用兼容 helper 优先 mechanics.tsk、能力面回退 tsk。
// 诱饵公开翻面后，原位置上的所有迷你卡重新混洗并盖回；险境由抽取管线读取印刷关键词。
const CODE = '09751'

// 兼容 helper：遭遇结算面（scenarioRuntime）只有 api.mechanics.tsk；能力面（ctx.api）两者都有。
// 同一段结算里两个入口读写同一份状态，故优先 mechanics.tsk，旧入口回退。
const tskApi = api => api?.mechanics?.tsk || api?.tsk || null

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: { peril: true, terror: true },
  encounterResolve(state, inv, card, api) {
    const answer = String(api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「超维恐怖」：选择一项。',
      options: [
        { id: 'decoys', label: '将每张诱饵翻面，并混洗场上所有隐匿迷你卡牌后放回先前位置' },
        { id: 'harm', label: '每位调查员受到 1 点伤害和 1 点恐惧' },
      ],
    }))
    if (answer === 'decoys') {
      const concealed = tskApi(api)?.concealed
      const decoys = concealed.flipDecoys()
      if (decoys.length) {
        const spots = state.scenarioFlags?.withoutATrace?.spots || {}
        const positions = decoys.map(card => {
          const spot = spots[card.id]
          return spot ? `${spot.x},${spot.y}` : api.locationName(card.locationId)
        })
        api.publicInfo(`「超维恐怖」翻开了 ${decoys.length} 张诱饵：${positions.join('、')}。`)
      }
      const after = concealed.reshuffle().length
      api.info?.(`「超维恐怖」：混洗 ${after} 张隐匿迷你卡并正面朝下放回原位。`)
      return { choice: 'decoys', cards: after }
    }
    const group = (state.investigators || []).filter(member => !member.defeated && !member.resigned)
    for (const member of group) {
      api.damage(member.seat, 1)
      api.horror(member.seat, 1)
    }
    api.info?.('「超维恐怖」：' + group.length + ' 位调查员各受到 1 点伤害与 1 点恐惧。')
    return { choice: 'harm', investigators: group.length }
  },
}
