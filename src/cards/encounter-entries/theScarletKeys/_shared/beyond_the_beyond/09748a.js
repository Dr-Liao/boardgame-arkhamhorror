// 09748a 异星边境（Alien Frontier）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你从异星边境移动到它左/右的连接地点时，检定[agility](5)。失败受到 2 点伤害。
//   [action] 受到 1 点恐惧：查看阴影中一个地点或异界牌库顶卡牌的已揭示面。(团队每场游戏一次。)
// 背面：隐匿 1。强制 - 揭露此地点：左边受到 1 点伤害；右边受到 1 点恐惧。
// 读点：move 窗口（movement.js 移动后 triggerReaction，context { seat, location, from }）；
//   方向判定用 api.map.position（grid-map 坐标）；检定走 api.test；tskExposed 结算背面。
// 近似：① 坐标不存在（非网格章节）时不结算方向检定；② 异界牌库顶的私人查看没有读点，只记旗标。
const CODE = '09748a'

const miniCards = state => state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

function lookAtShadowOrOtherworld(state, inv, api) {
  const cards = miniCards(state).filter(card => !card.flipped)
  const options = [
    ...cards.map(card => ({ id: 'mini:' + card.id, label: '阴影中的地点（' + card.locationId + '）' })),
    { id: 'otherworld', label: '异界牌库顶牌' },
  ]
  const picked = options.length === 1 ? options[0].id : String(api.choice({
    kind: 'effect', source: CODE, seat: inv.seat,
    prompt: '选择要查看已揭示面的目标（阴影中的地点，或异界牌库顶牌）。', options,
  }))
  api.setScenarioFlag?.('tskLooked:' + picked, true)
  api.info?.('「异星边境」：查看' + (picked.startsWith('mini:') ? '阴影中一张地点的' : '异界牌库顶牌的') + '已揭示面（仅该调查员可见）。')
  return true
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, alienFrontier: 'horizontal' },
  abilities: [{
    kind: 'forced',
    trigger: 'move',
    label: '从异星边境移动到左/右连接地点：敏捷(5)，失败受 2 点伤害',
    criteria: ({ source, context }) => Boolean(source) && context?.seat != null
      && (String(context?.from) === String(source.id) || String(context?.from) === String(source.originalCode)),
    resolve: ({ source, context, api }) => {
      const seat = Number(context?.seat)
      if (!Number.isSafeInteger(seat) || !context?.location) return
      const from = api.map?.position?.(source.id)
      const to = api.map?.position?.(context.location)
      if (!from || !to || from.y !== to.y) return
      api.test(seat, 'agility', 5, {
        source: { type: 'location', code: CODE, label: '异星边境' },
        resolve: result => {
          if (result?.success) return
          api.damage(seat, 2)
          api.info?.('「异星边境」：敏捷检定失败，受到 2 点伤害。')
        },
      })
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    label: '[action] 受到 1 点恐惧：查看阴影地点或异界牌库顶的已揭示面（团队每场游戏一次）',
    cost: { action: 1, horror: 1 },
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('alienFrontierLookUsed') === true) return false
      const done = lookAtShadowOrOtherworld(state, inv, api)
      if (done) api.setScenarioFlag?.('alienFrontierLookUsed', true)
      return done
    },
  }, {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边受到 1 点伤害，右边受到 1 点恐惧',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.damage(seat, 1)
        api.info?.('「残骸之城（A）」：阴影左边揭露，受到 1 点伤害。')
      } else if (context.position === 'right') {
        api.horror(seat, 1)
        api.info?.('「残骸之城（A）」：阴影右边揭露，受到 1 点恐惧。')
      }
    },
  }],
  note: 'approximation: 左右方向用地图坐标同一行近似；坐标缺失时不结算检定；异界牌库顶私人查看'
    + '只记场景旗标（primitive-requests/09748a.json）。',
}
