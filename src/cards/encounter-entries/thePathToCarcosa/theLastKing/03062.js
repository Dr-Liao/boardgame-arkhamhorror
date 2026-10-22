// 03062 礼节性迟到
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔克萨「最后的国王」密谋脚本。

export default {
  code: '03062', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      if (!state.storyAssets?.length) return
      const fewest = Math.min(...state.storyAssets.map(asset => asset.clues || 0))
      const candidates = state.storyAssets.filter(asset => (asset.clues || 0) === fewest)
      const target = candidates.length === 1 ? candidates[0] : candidates.find(asset =>
        (asset.id || asset.code) === api.choose({
          kind: 'target', source: '03062', seat: state.campaign.leadSeat ?? 0,
          prompt: '选择黛安娜·迪瓦恩出现的旁人。',
          options: candidates.map(asset => ({ id: asset.id || asset.code, label: asset.name || asset.id || asset.code })),
        }))
      if (target) api.spawn('03081', target.location)
      api.shuffleDiscard()
    },
  },
}
