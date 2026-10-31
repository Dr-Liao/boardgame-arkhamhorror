// 06032 热诚
// 卡面：绑定(道尔女士)。快速。
//       强制 - 热诚入场后：弃掉希望和预见。
//       [action]如果热诚处于重整状态，将其横置或弃掉：攻击。以基础值为5的[combat]攻击。
//       (如果你弃掉热诚，本次检定自动成功。然后，你可以将热诚混洗入你的牌库，
//       以将希望或预见从你的弃牌堆放置入场。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06032 热诚：与 06031 同构。卡文中文版末尾把「热诚」误写成「希望」（数据源笔误），
// 按英文原文与卡面意图实现：混洗的是热诚自己，放入场的是希望或预见。

const PARTNERS = ['06031', '06033']

export default {
  code: '06032',
  fast: true,
  abilities: [
    {
      kind: 'action',
      label: '横置或弃掉热诚：攻击（基础战斗 5）',
      cost: { action: true },
      countsAs: 'fight',
      criteria: [({ source }) => !source?.exhausted],
      target: { kind: 'enemy', label: '同地点的敌人' },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !source) return
        const answer = api.choice({
          kind: 'effect', source: '06032', seat: inv.seat,
          prompt: '横置热诚，还是弃掉热诚？（弃掉时本次攻击自动成功）',
          options: [{ id: 'exhaust', label: '横置热诚' }, { id: 'discard', label: '弃掉热诚（本次攻击自动成功）' }],
        })
        const discarded = answer === 'discard'
        if (discarded) api.discardAsset(inv.seat, source)
        else api.exhaust(source)
        if (discarded) {
          api.damageEnemy(enemy, 1, inv.seat)
          api.info('「热诚」被弃掉：本次攻击自动成功，对敌人造成 1 点伤害。')
        } else {
          api.fight(inv.seat, enemy.id, { baseValue: 5 })
        }
        followUpPutPartnerInPlay({ inv, api, selfCode: '06032' })
      },
    },
    {
      kind: 'entersPlay',
      label: '强制 - 入场后：弃掉希望和预见',
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
        if (discarded) api.info(`「热诚」入场：弃掉希望和预见（共 ${discarded} 张）。`)
      },
    },
  ],
  modifiers: [],
}

// 与 06031 同构：「混洗回牌库，以将希望或预见从弃牌堆放置入场」。
function followUpPutPartnerInPlay({ inv, api, selfCode }) {
  const partners = PARTNERS.filter(code => (inv.discard || []).includes(code))
  if (!partners.length) return
  const answer = api.choice({
    kind: 'effect', source: selfCode, seat: inv.seat, canSkip: true,
    prompt: `是否将「${api.cardName(selfCode)}」混洗入牌库，将希望或预见从弃牌堆放置入场？`,
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
