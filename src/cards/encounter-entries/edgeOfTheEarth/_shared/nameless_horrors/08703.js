// 08703 渎神幻象（Blasphemous Visions）· 诡计 · nameless_horrors
// 卡面：显现 - 将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，不要查看内容。然后将渎神幻象放置入场，
//   放到你的威胁区域。你抽取的每张忒咳哩-哩弱点的效果额外结算一次。
//   [action]：检定[willpower](3)。如果你检定成功，弃掉渎神幻象。
// 弱点结算读取 tekeliliDoubleResolution，弃掉本卡的行动由威胁区能力提供。
const CODE = '08703'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { threat: true, tekeliliDoubleResolution: true },
  encounterResolve(state, inv, card, api) {
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
    if (!Array.isArray(shuffled) || !shuffled.length) api.info('「渎神幻象」：没有忒咳哩-哩可洗入。')
    api.threat(inv.seat, CODE)
    api.info('🌀 「渎神幻象」进入 ' + (inv.name || '调查员') + ' 的威胁区域。')
    return true
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '意志(3)：成功弃掉渎神幻象',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, { source: { type: 'treachery', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeThreat(source)
        api.info('🌀 「渎神幻象」消散了。')
      } })
    },
  }],
}

