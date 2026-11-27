// 08594 罗尔德·埃尔斯沃思 · 坚毅伙伴
import { ALL_CARDS } from '../../_shared.js'

const CODE = '08594'

function isNonWeaknessTreachery(cardCode) {
  const card = ALL_CARDS[cardCode]
  return card?.type === 'treachery' && !['weakness', 'basicweakness'].includes(card.subtype)
}

function treacheriesPresent(state) {
  return [...(state.investigators || []).flatMap(inv => inv.threat || []), ...(state.agendaAside || []),
    ...[...(state.locations || []), ...(state.enemies || []), ...(state.agendas || []), ...(state.acts || [])]
      .flatMap(host => host.attachments || [])].some(card => isNonWeaknessTreachery(card.originalCode || card.code))
}

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'supplies', betweenActionsAnyTurn: true,
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置或花费 1 补给：令一张非弱点诡计视为空白至本回合结束',
    criteria: ({ state, source }) => state.phase === 'investigation'
      && (!source.exhausted || source.uses > 0) && treacheriesPresent(state),
    resolve: ({ inv, source, api }) => {
      const cards = api.cardsInPlayTreacheries().filter(entry => isNonWeaknessTreachery(entry.code))
      const costs = []
      if (!source.exhausted) costs.push({ id: 'exhaust', label: '横置罗尔德·埃尔斯沃思' })
      if (api.availableUses(source) > 0) costs.push({ id: 'supply', label: '花费 1 补给' })
      if (!cards.length || !costs.length) return
      const payment = costs.length === 1 ? costs[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择支付方式。', options: costs })
      if (payment === 'exhaust') api.exhaust(source)
      else if (payment === 'supply') {
        if (!api.spendUses(source, 1, { allowSubstitution: true })) return
      } else return
      const targetId = cards.length === 1 ? cards[0].attachment.id : api.choice({
        kind: 'card', source: CODE, seat: inv.seat, prompt: '选择文本框视为空白的非弱点诡计。',
        options: cards.map(({ attachment, code, host }) => ({
          id: attachment.id, cardCode: code, label: api.cardName(code) + '（' + (host?.name || '场上') + '）',
        })),
      })
      const target = cards.find(entry => entry.attachment.id === targetId)
      if (target) api.blankTreacheryInPlay(target.attachment)
    },
  }],
}
