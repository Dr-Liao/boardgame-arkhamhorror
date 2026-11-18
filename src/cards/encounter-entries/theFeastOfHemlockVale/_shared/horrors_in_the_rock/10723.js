// 10723 钙化（Calcification）· 诡计 · 共享遭遇组 horrors_in_the_rock（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10723）：
//   显现 - 将钙化放置入场，放到你的威胁区域。每位调查员仅限 1 张。
//   强制 - 在每轮你第一次移动时：受到 1 点直接伤害。
//   [action]：检定[敏捷](3)。如果你检定成功，弃掉钙化。
//   （你可以受到 1 点直接伤害以使本次检定自动成功。）
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；重复副本按「每位调查员仅限 1 张」直接弃置；
//   · 「每轮第一次移动」= move 窗口 + `limit { perRound, owner: instance }`
//     （limits.js 的每轮每实例上限；同一张卡每轮只结算一次）；
//   · 直接伤害 = api.directDamage；摆脱行动 = 威胁区条目的 action/activate 描述子
//     （moves.js 用 controlledAbilityCards 枚举威胁区行动），检定成功走 api.removeThreat；
//   · 「受到 1 点直接伤害自动成功」：引擎没有 test 前的 autoSuccess 选项，按「支付后直接成功」
//     近似（跳过检定与标记揭示，见 note）。
const CODE = '10723'
const DIFFICULTY = 3

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Hazard', 'Blight'],
    quantity: 2,
    limitPerInvestigator: 1,
    test: { skill: 'agility', difficulty: DIFFICULTY },
    firstMovePerRoundDirectDamage: 1,
    autoSuccessByDirectDamage: 1,
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🪨 「钙化」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🪨 「钙化」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'move',
    silent: true,
    label: '每轮第一次移动时：受到 1 点直接伤害',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat && (inv.threat || []).includes(source)
    },
    resolve: ({ state, inv, source, api }) => {
      const holder = holderOf(state, source) || inv
      api.directDamage(holder.seat, 1)
      api.info?.(`🪨 「钙化」：${holder.name} 本轮第一次移动，受到 1 点直接伤害。`)
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    label: '[action] 敏捷(3)：成功弃掉钙化（可受到 1 点直接伤害自动成功）',
    criteria: ({ state, inv, source }) => Boolean(holderOf(state, source))
      && (inv.threat || []).includes(source),
    resolve: ({ inv, source, api }) => {
      const answer = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '钙化：是否受到 1 点直接伤害，使本次检定自动成功？',
        options: [
          { id: 'auto', label: '受到 1 点直接伤害（自动成功）' },
          { id: 'test', label: '检定敏捷(3)' },
        ],
      }))
      if (answer === 'auto') {
        api.directDamage(inv.seat, 1)
        api.removeThreat(source)
        api.info?.(`🪨 「钙化」：${inv.name} 受到 1 点直接伤害，自动成功并弃掉钙化。`)
        return
      }
      api.test(inv.seat, 'agility', DIFFICULTY, {
        source: { type: 'scenario', code: CODE, name: '钙化', ability: true },
        resolve: result => {
          if (!result?.success) return
          api.removeThreat(source)
          api.info?.(`🪨 「钙化」：${inv.name} 检定成功，弃掉钙化。`)
        },
      })
    },
  }],
  note: 'approximation: 「受到 1 点直接伤害以使检定自动成功」在引擎里没有 test 前 autoSuccess 读点，'
    + '按「支付伤害后直接成功」结算（不揭示混乱标记、不触发检定窗口）；正常检定分支走既有 api.test。',
}
