import { ownTurn } from '../../engine/matcher.js'

const code = '12052'
const play = { type: 'asset', trait: 'Item', discount: 2 }

export default {
  code: '12052',
  playCondition: [
    ownTurn(),
    {
      when: ({ inv, helpers }) => helpers.playHandCardOptions(inv.seat, play).length > 0,
      message: '手牌中没有可减费打出的[[道具]]支援',
    },
  ],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '减费打出道具，回合结束时将一张受控道具返回手牌',
    resolve: ({ inv, api }) => {
      const candidates = api.playHandCardOptions(inv.seat, play)
      if (!candidates.length) return
      const picked = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat,
        prompt: '变戏法：选择要减费打出的道具。',
        options: candidates.map(cardCode => ({ id: cardCode, label: api.cardName(cardCode), cardCode })),
      })
      if (!candidates.includes(picked) || !api.playAsEffect(inv.seat, picked, { discount: play.discount })) return
      api.addEffect({
        sourceCode: code, duration: 'endOfTurn',
        abilities: [{
          kind: 'forced', trigger: 'turnEnded', label: '将一张你控制的道具返回手牌',
          effect: { type: 'returnAssetToHand', trait: 'Item', source: code },
        }],
      }, inv.seat)
    },
  }],
}
