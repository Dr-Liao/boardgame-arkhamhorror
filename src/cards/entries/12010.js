// 12010 戴克斯特·德雷克（Dexter Drake）· 秘术师 · 魔术师（2026 核心盒）。
//
// 卡面：
//   [reaction] 你打出一张支援后：将另一张你控制的非剧情支援返回你的手牌，或打出你手牌中一张
//     不同的支援（支付其费用）。（每轮仅限一次）
//   [elder_sign] 效果：+1。你可以将你所在地点一张非剧情支援返回其所有者的手牌。
//
// 引擎读点：
//   · 「你打出支援后」= `assetPlayed` 窗口（actions.js：打出资产后向**任意监听者**派发，
//     context: seat/assetId/cardCode/location）。调查员条目直接监听该窗口即可；
//     limit: 'oncePerRound' 记账每轮一次。
//   · 「返回另一张支援」= api.returnAssetToHand（唯一返手入口）；
//     「打出手中另一张支援并付费」= api.playCardFromHandFree({ discount: 0, noAction: true })
//     （discount 0 = 按正常费用支付；noAction = 反应效果不额外消耗行动点）。
//   · 旧印返手同样走 api.returnAssetToHand；「非剧情支援」= 玩家支援（各调查员 assets）。

const code = '12010'

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '12010-eldersign',
    label: '旧印：+1。可将你所在地点一张非剧情支援返回其所有者手牌',
    resolve: ({ inv, state, api }) => {
      const candidates = []
      for (const owner of state.investigators) {
        if (owner.location !== inv.location) continue
        for (const asset of owner.assets || []) {
          if (typeof api.canLeavePlay === 'function' && !api.canLeavePlay(asset)) continue
          candidates.push({ owner, asset })
        }
      }
      if (!candidates.length) return { delta: 1 }
      const id = candidates.length === 1 ? candidates[0].asset.id : api.choice({
        kind: 'target', source: '12010-eldersign', seat: inv.seat, canSkip: true,
        prompt: '旧印：是否将你所在地点一张非剧情支援返回其所有者手牌？',
        options: [{ id: 'skip', label: '不返回' },
          ...candidates.map(({ owner, asset }) => ({ id: asset.id, label: `${api.cardName(asset.code)}（${owner.name}）` }))],
      })
      if (id === 'skip') return { delta: 1 }
      const picked = candidates.find(({ asset }) => asset.id === id)
      if (picked) api.returnAssetToHand(picked.owner.seat, picked.asset)
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'assetPlayed',
    label: '你打出支援后：返回另一张非剧情支援，或支付费用打出手中另一张支援',
    limit: 'oncePerRound',
    criteria: [({ inv, context }) => Number(context?.seat) === inv.seat],
    resolve: ({ inv, context, api }) => {
      const playedId = context?.assetId ?? null
      const playedCode = context?.cardCode ?? null
      const playedName = playedCode ? api.cardName(playedCode) : null
      const returnables = (inv.assets || []).filter(asset => asset.id !== playedId
        && (typeof api.canLeavePlay !== 'function' || api.canLeavePlay(asset)))
      const playables = [...new Set(inv.hand || [])].filter(playCode => playCode !== playedCode
        && api.cardType(playCode) === 'asset'
        && (!playedName || api.cardName(playCode) !== playedName)
        && api.playCostOf(inv.seat, playCode) <= (inv.resources || 0))
      const options = [
        ...returnables.map(asset => ({ id: `return:${asset.id}`, label: `将「${api.cardName(asset.code)}」返回手牌` })),
        ...playables.map(playCode => ({ id: `play:${playCode}`, cardCode: playCode,
          label: `支付 ${api.playCostOf(inv.seat, playCode)} 资源打出「${api.cardName(playCode)}」` })),
      ]
      if (!options.length) return
      const answer = api.choice({
        kind: 'effect', source: code, seat: inv.seat, canSkip: true,
        prompt: '「戴克斯特·德雷克」：返回一张支援，或打出手中另一张支援。',
        options: [{ id: 'skip', label: '什么也不做' }, ...options],
      })
      if (answer === 'skip') return
      const returned = /^return:(.+)$/.exec(answer)
      if (returned) {
        const picked = returnables.find(asset => asset.id === returned[1])
        if (picked) api.returnAssetToHand(inv.seat, picked)
        return
      }
      const codeToPlay = /^play:(.+)$/.exec(answer)?.[1]
      if (codeToPlay) api.playCardFromHandFree(inv.seat, codeToPlay, { discount: 0, noAction: true })
    },
  }],
}
