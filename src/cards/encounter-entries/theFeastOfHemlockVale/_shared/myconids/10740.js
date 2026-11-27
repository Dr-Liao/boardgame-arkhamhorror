// 10740 迷神孢子（Psychotropic Spores）· 诡计 · 共享遭遇组 myconids（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/myconids。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Put Psychotropic Spores into play in your threat area. Limit 1 per investigator.
//   Forced - The first time you draw 1 or more cards from your deck each round: Take 1 direct horror.
//   [action]: Test [intellect] (3). If you succeed, discard Psychotropic Spores.
//   (You may take 1 direct horror for this test to automatically succeed.)
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「放进你的威胁区域」= api.threat（scenario-runtime.js 的威胁区唯一写入口，走 afterThreatEntered）；
//     返回 { placed: true } 阻止它按普通诡计进遭遇弃牌堆（与 07299 同一返回值契约）。
//   · 「每位调查员仅限 1 张」= 结算前查 inv.threat 里是否已有同卡，已有则不再放置（结算后按常规弃掉）。
//   · 整批抽牌后触发轮内首次抽牌。可在摆脱检定前选择支付直接恐惧，使该检定自动成功。
const CODE = '10740'
const NAME = '迷神孢子'
const SKILL = 'intellect'
const DIFFICULTY = 3

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { sharedThreatAction: true },
  flags: {
    encounterGroup: 'myconids',
    quantity: 2,
    traits: ['Hazard', 'Flora'],
    threatArea: true,
    limitPerInvestigator: 1,
    test: { skill: SKILL, difficulty: DIFFICULTY, discardOnSuccess: true },
    autoSuccessCost: { directHorror: 1 },
    forcedFirstDrawEachRound: { directHorror: 1 },
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`「${NAME}」：你的威胁区域已有 1 张（每位调查员仅限 1 张），本张不再放置。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🍄 「${NAME}」进入 ${inv.name} 的威胁区域。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced',
    trigger: 'cardsDrawn',
    silent: true,
    label: '每轮首次从自己的牌库抽牌：受到 1 点直接恐惧',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.firstThisRound !== false
      && inv.threat.some(card => card.id === source.id),
    resolve: ({ inv, api }) => api.directHorror(inv.seat, 1),
  }, {
    kind: 'action',
    actionKind: 'activate',
    label: '迷神孢子：检定智力(3)，成功则弃掉本卡',
    resolve: ({ state, inv, source, api }) => {
      const pay = api.choose({
        kind: 'cost', source: CODE, seat: inv.seat,
        prompt: '是否受到 1 点直接恐惧，使本次检定自动成功？',
        options: [{ id: 'test', label: '照常检定' }, { id: 'horror', label: '受到 1 点直接恐惧' }],
      }) === 'horror'
      if (pay) api.directHorror(inv.seat, 1)
      if (inv.defeated || inv.resigned) return
      const sourceId = source.id
      api.test(inv.seat, SKILL, DIFFICULTY, {
        autoSuccess: pay,
        source: { type: 'treachery', code: CODE, action: 'activate', ability: true },
        resolve(result) {
          if (!result.success) return
          const current = state.investigators.flatMap(owner => owner.threat).find(card => card.id === sourceId)
          if (current) api.removeThreat(current)
        },
      })
    },
  }],
}
