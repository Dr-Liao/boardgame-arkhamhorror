// 06033 预见
// 卡面：绑定(道尔女士)。快速。
//       强制 - 预见入场后：弃掉希望和热诚。
//       [action]如果预见处于重整状态，将其横置或弃掉：调查。以基础值为5的[intellect]调查。
//       (如果你弃掉预见，本次检定自动成功。然后，你可以将预见混洗入你的牌库，
//       以将希望或热诚从你的弃牌堆放置入场。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06033 预见：与 06031/06032 同构，动作改为「调查」。中文版末尾同样把「预见」误写成「希望」，按意图实现。

const PARTNERS = ['06031', '06032']

export default {
  code: '06033',
  fast: true,
  abilities: [
    {
      kind: 'action',
      label: '横置或弃掉预见：调查（基础智识 5）',
      cost: { action: true },
      criteria: [({ source }) => !source?.exhausted],
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const answer = api.choice({
          kind: 'effect', source: '06033', seat: inv.seat,
          prompt: '横置预见，还是弃掉预见？（弃掉时本次调查自动成功）',
          options: [{ id: 'exhaust', label: '横置预见' }, { id: 'discard', label: '弃掉预见（本次调查自动成功）' }],
        })
        const discarded = answer === 'discard'
        if (discarded) api.discardAsset(inv.seat, source)
        else api.exhaust(source)
        if (discarded) {
          api.discoverClue(inv.seat, 1)
          api.info('「预见」被弃掉：本次调查自动成功，发现所在地点的 1 个线索。')
        } else {
          api.investigate(inv.seat, { baseValue: 5 })
        }
        followUpPutPartnerInPlay({ inv, api, selfCode: '06033' })
      },
    },
    {
      kind: 'entersPlay',
      label: '强制 - 入场后：弃掉希望和热诚',
      resolve: ({ inv, api }) => {
        let discarded = 0
        for (const code of PARTNERS) {
          for (let guard = 0; guard < 6; guard++) {
            if ((inv.hand || []).includes(code)) api.moveCard({ code, from: 'hand', to: 'discard' })
            else if ((inv.deck || []).includes(code)) api.moveCard({ code, from: 'deck', to: 'discard' })
            else break
            discarded++
          }
        }
        if (discarded) api.info(`「预见」入场：弃掉希望和热诚（共 ${discarded} 张）。`)
      },
    },
  ],
  modifiers: [],
}

// 与 06031/06032 同构：「混洗回牌库，以将希望或热诚从弃牌堆放置入场」。
function followUpPutPartnerInPlay({ inv, api, selfCode }) {
  const partners = PARTNERS.filter(code => (inv.discard || []).includes(code))
  if (!partners.length) return
  const answer = api.choice({
    kind: 'effect', source: selfCode, seat: inv.seat, canSkip: true,
    prompt: `是否将「${api.cardName(selfCode)}」混洗入牌库，将希望或热诚从弃牌堆放置入场？`,
    options: [{ id: 'skip', label: '不' }, { id: 'yes', label: '洗入并放置' }],
  })
  if (answer !== 'yes') return
  const inPlay = (inv.assets || []).find(asset => asset.code === selfCode)
  if (inPlay) api.moveCard({ id: inPlay.id, from: 'play', to: 'deckTop' })
  else if ((inv.discard || []).includes(selfCode)) api.moveCard({ code: selfCode, from: 'discard', to: 'deckTop' })
  api.shuffleDeck(inv.seat)
  const pick = partners.length === 1 ? partners[0] : api.choice({
    kind: 'target', source: selfCode, seat: inv.seat,
    prompt: '选择从弃牌堆放置入场的支援。',
    options: partners.map(code => ({ id: code, label: api.cardName(code) })),
  })
  const chosen = partners.find(code => code === pick) || partners[0]
  api.moveCard({ code: chosen, from: 'discard', to: 'play' })
  api.info(`「${api.cardName(selfCode)}」洗回牌库：将「${api.cardName(chosen)}」从弃牌堆放置入场。`)
  for (const code of ['06031', '06032', '06033'].filter(code => code !== chosen)) {
    for (let guard = 0; guard < 6; guard++) {
      if ((inv.hand || []).includes(code)) api.moveCard({ code, from: 'hand', to: 'discard' })
      else if ((inv.deck || []).includes(code)) api.moveCard({ code, from: 'deck', to: 'discard' })
      else break
    }
  }
}
