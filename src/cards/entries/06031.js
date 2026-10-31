// 06031 希望
// 卡面：绑定(道尔女士)。快速。
//       强制 - 希望入场后：弃掉热诚和预见。
//       [action]如果希望处于重整状态，将其横置或弃掉：躲避。以基础值为5的[agility]尝试躲避。
//       (如果你弃掉希望，本次检定自动成功。然后，你可以将希望混洗入你的牌库，
//       以将热诚或预见从你的弃牌堆放置入场。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06031 希望：
//   · 快速（绑定资产以快速关键词入场）。
//   · entersPlay = 强制「弃掉热诚和预见」：把 06032/06033 从手牌/牌库弃掉（06030 的放置入场走
//     api.playCardFromHandFree → 完整 doPlay → 本 entersPlay 会执行；这是该强制效果的唯一实现点）。
//   · [action]：横置或弃掉自己 → 躲避（基础敏捷 5）；弃掉时自动成功。
//     「然后可以把希望混洗入牌库，以把热诚/预见从弃牌堆放置入场」：把希望放回牌库并移动一张伙伴入场，
//     伙伴入场后自己的强制（弃掉另外两张）再次结算。

const PARTNERS = ['06032', '06033']

export default {
  code: '06031',
  fast: true,
  abilities: [
    {
      kind: 'action',
      label: '横置或弃掉希望：躲避（基础敏捷 5）',
      cost: { action: true },
      countsAs: 'evade',
      criteria: [({ source }) => !source?.exhausted],
      target: { kind: 'enemy', label: '与你交战的敌人', query: ({ candidate, inv }) => candidate?.entity?.engagedSeat === inv.seat },
      resolve: ({ state, inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !source) return
        const answer = api.choice({
          kind: 'effect', source: '06031', seat: inv.seat,
          prompt: '横置希望，还是弃掉希望？（弃掉时本次躲避自动成功）',
          options: [{ id: 'exhaust', label: '横置希望' }, { id: 'discard', label: '弃掉希望（本次躲避自动成功）' }],
        })
        const discarded = answer === 'discard'
        if (discarded) api.discardAsset(inv.seat, source)
        else api.exhaust(source)
        if (discarded) {
          api.autoEvade(enemy)
          api.info('「希望」被弃掉：本次躲避自动成功。')
        } else {
          api.evade(inv.seat, { enemyId: enemy.id, baseValue: 5 })
        }
        followUpPutPartnerInPlay({ state, inv, api, selfCode: '06031' })
      },
    },
    {
      kind: 'entersPlay',
      label: '强制 - 入场后：弃掉热诚和预见',
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
        if (discarded) api.info(`「希望」入场：弃掉热诚和预见（共 ${discarded} 张）。`)
      },
    },
  ],
  modifiers: [],
}

// 「你可以将希望混洗入牌库，以将热诚或预见从你的弃牌堆放置入场」——
// 把自身移回牌库并让一张伙伴从弃牌堆入场；伙伴的强制（弃掉另外两张）随后结算。
function followUpPutPartnerInPlay({ state, inv, api, selfCode }) {
  const partners = PARTNERS.filter(code => (inv.discard || []).includes(code))
  if (!partners.length) return
  const answer = api.choice({
    kind: 'effect', source: selfCode, seat: inv.seat, canSkip: true,
    prompt: `是否将「${api.cardName(selfCode)}」混洗入牌库，将热诚或预见从弃牌堆放置入场？`,
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
  // 刚入场的伙伴的强制：弃掉另外两张（含刚洗入牌库的自己）。
  for (const code of ['06031', '06032', '06033'].filter(code => code !== chosen)) {
    for (let guard = 0; guard < 6; guard++) {
      if ((inv.hand || []).includes(code)) api.moveCard({ code, from: 'hand', to: 'discard' })
      else if ((inv.deck || []).includes(code)) api.moveCard({ code, from: 'deck', to: 'discard' })
      else break
    }
  }
}
