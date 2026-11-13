// 09095 解锢灵魂（Uncage the Soul）· 秘术师事件 · 3 经验。
// 卡面：你可以弃掉一张你控制的[[法术]]或[[仪式]]支援。从你的手牌或弃牌堆打出一张
//       [[法术]]或[[仪式]]卡牌，其资源费用减少 3 点。
//
// 读点：api.discardAsset（可选弃置）；api.playCard（discount / noAction 同一打出管线）；
//       弃牌堆来源走 api.takeDiscardCard + api.putInHand 把实体取进手牌后走同一条打出管线，
//       打出失败时用 api.moveCard(to:'discard') 放回原区（净效果 = 从弃牌堆打出）。
//
// P1-8（2026-11-13）：① api.playCard 返回 false 时旧实现照写「已打出」成功日志 → 改为拿返回值、
// 失败给出原因并 return；② 引擎 doPlay 的 fromDiscard 只接受「弃牌堆顶的事件牌」或自身声明
// playableFromDiscard 的卡（actions.js:134-142），法术**支援**与非常规弃牌位置的事件都打不出 →
// 卡侧先用取牌原语把目标卡取进手牌再打；原生「从弃牌堆打出法术/仪式」通道仍需主进程补
// （play-channels.js#discard 目前只枚举事件）。
const SPELL_TRAITS = ['spell', 'ritual']
const hasSpellTrait = (code, api) => api.cardTraits(code).some(trait => SPELL_TRAITS.includes(String(trait).toLowerCase()))

export default {
  code: '09095',
  abilities: [
    {
      kind: 'played',
      label: '可弃掉法术/仪式支援；从手牌或弃牌堆打出法术/仪式卡，费用 -3',
      resolve: ({ state, inv, api }) => {
        const controlled = (inv.assets || []).filter(asset => hasSpellTrait(asset.code, api))
        if (controlled.length) {
          const answer = api.choice({
            kind: 'reaction', source: '09095', seat: inv.seat, canSkip: true,
            prompt: '是否弃掉一张你控制的[[法术]]或[[仪式]]支援？',
            options: [{ id: 'skip', label: '不弃掉' },
              ...controlled.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))],
          })
          if (answer && answer !== 'skip') {
            const asset = controlled.find(item => item.id === answer)
            if (asset) {
              api.discardAsset(inv.seat, asset)
              api.info(`🕊️ 「解锢灵魂」：弃掉「${api.cardName(asset.code)}」。`)
            }
          }
        }
        const hand = [...new Set((inv.hand || []).filter(code => hasSpellTrait(code, api)))]
        const discard = [...new Set((inv.discard || []).filter(code => hasSpellTrait(code, api)))]
        const options = [
          ...hand.map(code => ({ id: `hand:${code}`, cardCode: code, label: `手牌：${api.cardName(code)}` })),
          ...discard.map(code => ({ id: `discard:${code}`, cardCode: code, label: `弃牌堆：${api.cardName(code)}` })),
        ]
        if (!options.length) {
          api.info('「解锢灵魂」：手牌与弃牌堆没有[[法术]]或[[仪式]]卡牌。')
          return
        }
        const picked = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: '09095', seat: inv.seat,
          prompt: '选择一张费用减少 3 点打出的[[法术]]或[[仪式]]卡牌。',
          options,
        })
        const chosen = options.find(option => option.id === picked) || options[0]
        const fromDiscard = chosen.id.startsWith('discard:')
        const code = chosen.cardCode
        // 弃牌堆来源：把实体取进手牌（playCard 的手牌要求），失败时再放回弃牌堆。
        let moved = false
        if (fromDiscard) {
          const taken = api.takeDiscardCard?.(inv.seat, code)
          if (taken == null) {
            api.info(`🕊️ 「解锢灵魂」：弃牌堆里找不到「${api.cardName(code)}」。`)
            return
          }
          api.putInHand(inv.seat, code)
          moved = true
        }
        const played = api.playCard(inv.seat, code, { discount: 3, noAction: true })
        if (played === false) {
          if (moved) api.moveCard?.({ code, from: 'hand', to: 'discard', ownerSeat: inv.seat })
          api.info(`🕊️ 「解锢灵魂」：「${api.cardName(code)}」当前无法打出（不在手牌/资源不足/打出限制），未结算。`)
          return
        }
        api.info(`🕊️ 「解锢灵魂」：从${fromDiscard ? '弃牌堆' : '手牌'}打出「${api.cardName(code)}」，费用减少 3。`)
        void state
      },
    },
  ],
  modifiers: [],
}
