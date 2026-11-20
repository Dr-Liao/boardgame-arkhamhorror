import { ALL_CARDS } from '../cards-data.js'

const code = '11094'
const isSurvivorSkill = cardCode => {
  const card = ALL_CARDS[cardCode]
  return card?.type === 'skill' && [card.klass, ...(card.factions || [])].includes('survivor')
}

function eligibleSkills(inv, canCommit) {
  return [...new Set(inv.discard)].filter(discarded => isSurvivorSkill(discarded) && canCommit(discarded))
}

export default {
  code,
  abilities: [{
    kind: 'reaction', trigger: 'beforeCommitCards',
    limit: { scope: 'perRound', owner: 'player' },
    label: '选择弃牌堆的生存者技能并弃 1 张手牌：投入所选技能；结算后放到牌库底',
    criteria: ({ inv, context, helpers }) => inv.seat === context.seat
      && helpers.discardableHandCards().length > 0
      && eligibleSkills(inv, card => helpers.canCommitCard(card, { from: 'discard' })).length > 0,
    resolve: ({ inv, api }) => {
      const skills = eligibleSkills(inv, card => api.canCommitCard(inv.seat, card, { from: 'discard' }))
      if (!skills.length) return
      const skill = skills.length === 1 ? skills[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat, prompt: '选择要从弃牌堆投入的生存者技能。',
        options: skills.map(card => ({ id: card, cardCode: card, label: api.cardName(card) })),
      })
      if (api.chooseOptionalHandDiscard(inv.seat, code, { required: true })) {
        const committed = api.commitOrigins.commit(inv.seat, { from: 'discard', code: skill })
        if (committed) api.setCommitDestination(committed, 'deckBottom')
      }
    },
  }],
}
