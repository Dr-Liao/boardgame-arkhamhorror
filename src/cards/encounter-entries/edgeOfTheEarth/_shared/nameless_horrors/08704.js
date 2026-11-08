// 08704 窥看不可说之事（Peering Into the Unspeakable）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 抽取忒咳哩-哩牌库顶的 1 张卡牌（并结算其效果）。不要将其放到忒咳哩-哩牌库底，
//   改为混洗入任意一位调查员的牌库。如果没有以此效果抽取忒咳哩-哩弱点，窥看不可说之事获得涌动。
// 读点：tekeliDraw 取牌；去向 tekeliReturn(destination:'anyDeck')。单独结算一张忒咳哩-哩弱点需要
//   引擎的「按卡号结算弱点」读点（primitive-requests/p7-08704.json）；当前实现先完成抽牌与去向。
const CODE = '08704'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, drawTekeliliAndResolveThenShuffle: true },
  encounterResolve(state, inv, card, api) {
    const code = api.mechanics.tekeli.draw()
    if (!code) {
      api.info('「窥看不可说之事」：忒咳哩-哩牌库为空，获得涌动。')
      return { gainSurge: true }
    }
    const candidates = state.investigators.filter(other => !other.defeated && !other.resigned)
    const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({ kind: 'target', source: CODE, seat: inv.seat,
      prompt: '选择把这张忒咳哩-哩弱点洗入哪位调查员的牌库。',
      options: candidates.map(other => ({ id: String(other.seat), label: other.name || '调查员 ' + (other.seat + 1) })) }))
    const target = candidates.find(other => other.seat === seat) || candidates[0]
    api.mechanics.tekeli.return(code, { destination: 'anyDeck', seat: target.seat })
    api.info('👁️ 「窥看不可说之事」：忒咳哩-哩弱点洗入 ' + (target.name || '调查员') + ' 的牌库。')
    return true
  },
  note: '「抽出后立即结算该弱点」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08704.json）；抽牌与去向已接线。',
}

