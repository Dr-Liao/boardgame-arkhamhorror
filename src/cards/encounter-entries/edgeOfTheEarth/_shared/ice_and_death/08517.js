// 08517 零能见度（Zero Visibility）· 诡计 · ice_and_death
// 卡面：显现 - 将零能见度放置入场，放到你的威胁区域。作为离开有诡计附属的地点的额外费用，
//   你必须花费 1 个行动。强制 - 当你的回合结束时：检定[agility](2)。如果你检定成功，弃掉零能见度。
// 读点：威胁区放置走 api.threat；回合结束检定走威胁区条目 abilities（强制窗口 turnEnded）；
//   「离开有诡计附属地点 +1 行动」需要引擎的移动附加费读点（primitive-requests/p7-08517.json）。
const CODE = '08517'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { threat: true, moveSurchargeFromTreacheryLocation: 1 },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info('🌫️ 「零能见度」进入 ' + (inv.name || '调查员') + ' 的威胁区域。')
    return true
  },
  abilities: [{
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束：敏捷(2)，成功弃掉零能见度',
    criteria: ({ state, inv, source, context }) => context?.seat === inv?.seat
      && (inv?.threat || []).some(card => card.id === source.id),
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'agility', 2, { source: { type: 'treachery', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeThreat(source)
        api.info('🌫️ 「零能见度」散去了。')
      } })
    },
  }],
  note: '「离开有诡计附属地点的额外 1 行动」需要引擎的移动附加费读点（primitive-requests/p7-08517.json）；威胁区结算与回合结束检定已接线。',
}

