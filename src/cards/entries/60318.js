// 60318 虎口拔牙
// 卡面：你将虎口拔牙投入一次技能检定后，从你牌库顶弃掉卡牌，直到弃掉一张可以投入本次检定的[rogue]技能。将其投入本次检定。将以此效果弃掉的所有弱点混洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../cards-data.js'

function discardUntilRogueSkill(inv, api) {
  const weaknesses = []
  for (;;) {
    const [card] = api.discardTopOfDeck(inv.seat, 1)
    if (!card) break
    if (api.cardType(card) === 'skill' && api.cardFactions(card).includes('rogue')
      && api.canCommitCard(inv.seat, card, { from: 'discard' })
      && api.commitOrigins.commit(inv.seat, { from: 'discard', code: card })) break
    if (['weakness', 'basicweakness'].includes(ALL_CARDS[card]?.subtype)) weaknesses.push(card)
  }

  let returned = false
  for (const code of weaknesses) {
    if (api.moveCard({ code, from: 'discard', to: 'deckTop' }, { seat: inv.seat })) returned = true
  }
  if (returned) api.shuffleDeck(inv.seat)
}

export default {
  code: '60318',
  abilities: [{
    kind: 'commit',
    label: '弃至可投入的游荡者技能并投入，途中弃掉的弱点洗回牌库',
    skill: { onCommit: ({ inv, api }) => discardUntilRogueSkill(inv, api) },
  }],
}
