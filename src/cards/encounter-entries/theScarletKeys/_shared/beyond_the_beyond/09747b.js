// 09747b 凌乱道路（Rambling Route）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：攻击或躲避在凌乱道路的每张隐匿迷你卡牌的难度 +2。
//   [action] 花费 X 资源：查看一张隐匿迷你卡牌的已揭示面。(团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 在你揭露此地点时：若它在阴影左边，失去 2 资源；若在中间，失去 1 行动。
// 读点与近似同 09747a（tskExposed 窗口 / 实体行动 / locationRule 数据）。
// 正面「攻击/躲避本地点隐匿迷你卡难度 +2」= locationRule.concealedFightEvadeBonus: 2
//   （与 09577 同键名）；引擎还缺「攻击/躲避隐匿迷你卡」动作 + per-location 难度读点，暂不生效。
const CODE = '09747b'

const miniCards = state => state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, ramblingRoute: true },
  locationRule: { concealedFightEvadeBonus: 2 },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[action] 花费 X 资源：查看一张隐匿迷你卡牌的已揭示面（团队每场游戏一次）',
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('ramblingRouteLookUsed') === true) {
        api.info?.('团队本场游戏已经用过「凌乱道路」的查看能力。')
        return false
      }
      const cards = miniCards(state).filter(card => !card.flipped)
      if (!cards.length) return false
      const options = cards.map(card => ({ id: card.id, label: '隐匿迷你卡（' + card.locationId + '）' }))
      const picked = cards.length === 1 ? options[0].id : String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择要查看已揭示面的隐匿迷你卡牌。', options,
      }))
      const card = cards.find(item => item.id === picked)
      if (!card) return false
      const paths = api.mechanics.map.paths(inv.location, card.locationId)
      const distance = Array.isArray(paths) && paths.length ? Math.max(1, paths[0].length - 1) : 1
      if (Number(inv.resources) < distance) return false
      api.spendResources(inv.seat, distance)
      api.setScenarioFlag?.('tskLookedMiniCard:' + card.id, true)
      api.setScenarioFlag?.('ramblingRouteLookUsed', true)
      api.info?.('「凌乱道路」：花费 ' + distance + ' 资源查看了一张隐匿迷你卡牌的已揭示面。')
      return true
    },
  }, {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边失去 2 资源，中间失去 1 行动',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.loseResources(seat, 2)
        api.info?.('「残骸之城（B）」：阴影左边揭露，失去 2 资源。')
      } else if (context.position === 'middle') {
        api.loseActions(seat, 1)
        api.info?.('「残骸之城（B）」：阴影中间揭露，失去 1 行动。')
      }
    },
  }],
  note: 'approximation: 与 09747a 同一近似（X 用最短连接数、私人查看记旗标、每场一次记旗标）。'
    + '正面「每张隐匿迷你卡攻防难度 +2」声明为 locationRule.concealedFightEvadeBonus:2（与 09577 同键名），'
    + '但引擎还没有「攻击/躲避隐匿迷你卡」动作与 per-location 难度读点，暂不生效。',
}
