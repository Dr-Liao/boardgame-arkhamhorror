// 06136b 巴哈那港的货物（theSearchForKadath）· 背面故事卡（巴哈那港）
// 卡面：位于巴哈那港的每位调查员可以将自己弃牌堆中的一张[[道具]]或[[供给]]卡牌返回自己手牌。
// 卡面：记住调查员「在巴哈那港口获取补给」。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
const RETURN_TRAITS = ['item', 'supply']

const traitsOf = (api, code) => (api.cardTraits?.(code) || [])
  .map(trait => String(trait).toLowerCase())

export default {
  code: '06136b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api, ctx = {}) {
      const locationId = ctx.location?.id || 'baharna'
      for (const inv of (state.investigators || [])) {
        if (inv.defeated || inv.resigned || inv.location !== locationId) continue
        const candidates = (inv.discard || [])
          .map((code, index) => ({ code, index }))
          .filter(entry => traitsOf(api, entry.code).some(trait => RETURN_TRAITS.includes(trait)))
        if (!candidates.length) continue
        const answer = api.choose?.({
          kind: 'card', source: '06136b', seat: inv.seat, canSkip: true,
          prompt: '巴哈那港的货物：选择弃牌堆中的一张[[道具]]或[[供给]]返回手牌。',
          options: [
            ...candidates.map(entry => ({ id: String(entry.index), cardCode: entry.code, label: api.cardName?.(entry.code) || entry.code })),
            { id: 'skip', label: '不返回' },
          ],
        }) ?? 'skip'
        if (answer === 'skip') continue
        const picked = candidates.find(entry => String(entry.index) === String(answer))
        if (!picked) continue
        api.drawDiscard?.(inv.seat, picked.index)
        api.info?.(`📦 巴哈那港的货物：${inv.name} 把「${api.cardName?.(picked.code) || picked.code}」收回手牌。`)
      }
      api.setScenarioFlag?.('obtainedSuppliesFromBaharna', true)
      api.info?.('📦 记住：调查员「在巴哈那港口获取补给」。')
    },
  },
}
