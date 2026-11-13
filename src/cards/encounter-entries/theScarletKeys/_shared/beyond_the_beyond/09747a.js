// 09747a 凌乱道路（Rambling Route）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：攻击或躲避在凌乱道路的每张隐匿迷你卡牌的难度 +2。
//   [action] 花费 X 资源：选择一张隐匿迷你卡牌，其相邻地点与你的地点连接次数为 X。
//   查看其已揭示面（不将其揭露）。(团队每场游戏仅限一次。)
// 背面：隐匿 1。强制 - 在你揭露此地点时：若它在阴影左边，受到 1 点伤害；若在右边，受到 1 点恐惧。
// 读点：tskExposed 窗口（P4 揭露后时机）→ 背面强制；[action] 是实体行动（parley.js 枚举带
//   actionKind 的 action），费用/查看走 ctx.api；
//   正面「攻击/躲避本地点隐匿迷你卡难度 +2」= 条目数据 `locationRule.concealedFightEvadeBonus: 2`
//   （与 dealingsInTheDark 的 09577「大巴扎」同一条印刷规则、同一个键名；供引擎补读点后统一读取）。
// 缺读点（需要引擎）：
//   · 引擎既没有「攻击/躲避隐匿迷你卡」这个基础动作（tsk-concealed 只给 expose 与 concealTargetScope
//     的目标范围，7 章 behavior 各自用 expose 近似），也没有 per-location 的攻防难度修正读点
//     （locationRule.difficultyAfterCommit 只服务调查检定；entityModifierTotal 没有该 target）；
//     因此本条只保留数据声明，难度 +2 目前不生效。
// 近似：① 私人查看没有投影读点，用场景旗标记录已看；② X 用「当前地点到该迷你卡地点的最短连接数」
//   近似「相邻地点与你相距 X 连接」；③ 团队每场一次用场景旗标。见 primitive-requests/09747a.json。
const CODE = '09747a'

const miniCards = state => state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

function walkMiniCard(state, api, inv) {
  const cards = miniCards(state).filter(card => !card.flipped)
  if (!cards.length) {
    api.info?.('场上没有可查看的隐匿迷你卡牌。')
    return false
  }
  const options = cards.map(card => ({
    id: card.id,
    label: '隐匿迷你卡（' + card.locationId + ' · ' + (card.position || '正面') + '）',
  }))
  const picked = cards.length === 1 ? options[0].id : String(api.choice({
    kind: 'effect', source: CODE, seat: inv.seat,
    prompt: '选择要查看已揭示面的隐匿迷你卡牌（花费 X 资源，X = 到其地点的连接数）。',
    options,
  }))
  const card = cards.find(item => item.id === picked)
  if (!card) return false
  const paths = api.mechanics.map.paths(inv.location, card.locationId)
  const distance = Array.isArray(paths) && paths.length ? Math.max(1, paths[0].length - 1) : 1
  if (Number(inv.resources) < distance) {
    api.info?.('资源不足：查看该迷你卡需要 ' + distance + ' 资源。')
    return false
  }
  api.spendResources(inv.seat, distance)
  api.setScenarioFlag?.('tskLookedMiniCard:' + card.id, true)
  api.info?.('「凌乱道路」：花费 ' + distance + ' 资源，查看了一张隐匿迷你卡牌的已揭示面'
    + '（身份只对该调查员可见，已记录在剧本旗标）。')
  return true
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, ramblingRoute: true },
  locationRule: {
    // 与 09577 同键名；读点待引擎补：攻击/躲避隐匿迷你卡时 +2 难度。
    concealedFightEvadeBonus: 2,
  },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[action] 花费 X 资源：查看一张隐匿迷你卡牌的已揭示面（团队每场游戏一次）',
    resolve: ({ state, inv, api }) => {
      if (api.scenarioFlag?.('ramblingRouteLookUsed') === true) {
        api.info?.('团队本场游戏已经用过「凌乱道路」的查看能力。')
        return false
      }
      const done = walkMiniCard(state, api, inv)
      if (done) api.setScenarioFlag?.('ramblingRouteLookUsed', true)
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
  note: 'approximation: X 用最短连接数近似；私人查看以场景旗标记账（没有「仅某座位可见」的投影读点）；'
    + '团队每场一次用旗标。正面「每张隐匿迷你卡攻防难度 +2」声明为 locationRule.concealedFightEvadeBonus:2'
    + '（与 09577 同键名），但引擎还没有「攻击/躲避隐匿迷你卡」动作与 per-location 难度读点，暂不生效'
    + '（primitive-requests/09747a.json）。',
}
