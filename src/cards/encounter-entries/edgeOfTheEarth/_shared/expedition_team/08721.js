// 08721 罗尔德·埃尔斯沃思 · 伙伴。使用（5 补给）。
const CODE = '08721'

const attachedAtLocation = location => (location.attachments || []).filter(attachment => attachment.code)

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true },
  uses: 5, usesType: 'supplies',
  betweenActionsAnyTurn: true,
  abilities: [{
    kind: 'free', actionKind: 'activate',
    label: '横置并花费 1 补给：令地点附属诡计的文本框视为空白至回合结束',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, helpers }) => state.phase === 'investigation'
      && state.locations.some(location => attachedAtLocation(location).some(attachment => helpers.cardType(attachment.code) === 'treachery')),
    resolve: ({ inv, api }) => {
      const candidates = api.cardsInPlayTreacheries().filter(card => card.hostType === 'location')
      if (!candidates.length) return
      const id = candidates.length === 1 ? candidates[0].attachment.id : api.choice({
        kind: 'card', source: CODE, seat: inv.seat, prompt: '选择要视为空白的地点附属诡计。',
        options: candidates.map(({ attachment, code, host }) => ({
          id: attachment.id, cardCode: code, label: api.cardName(code) + '（' + host.name + '）',
        })),
      })
      const target = candidates.find(card => card.attachment.id === id)
      if (target) api.blankLocationAttachment(target.attachment, { until: 'endOfTurn' })
    },
  }],
}
