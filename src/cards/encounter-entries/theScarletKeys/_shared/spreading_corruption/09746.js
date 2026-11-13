// 09746 理智扭曲（Distorted Reasoning） · 诡计 · spreading_corruption
// 归属：战役共用 · theScarletKeys/_shared/spreadingCorruption。
// 卡面：显现 - 将理智扭曲放置入场，放到你的威胁区域。
//   你不能连续执行同一类型的行动。（类型包括激活、交战、躲避、攻击、调查、移动、打出、资源和抽取。）
//   强制 - 当你的回合结束时：检定 [willpower](3)。如果你检定成功，弃掉理智扭曲。
//   Revelation - Put Distorted Reasoning into play in your threat area.
//   You cannot perform the same type of action twice in a row. (Types include activate, engage, evade,
//   fight, investigate, move, play, resource, and draw.)
//   Forced - At the end of your turn: Test [willpower] (3). If you succeed, discard Distorted Reasoning.
// 读点：
//   · 威胁区入场 = api.threat + 条目 treacheryRule.threatArea（与 01182/07106 同款模板）；
//   · 「回合结束时检定」= turnEnded 窗口 + api.test；成功后 api.removeThreat（威胁区卡唯一弃置写入口）；
//   · 缺读点：「不能连续执行同一类型的行动」需要 legalMoves/validateMove 的行动类型限制读点；
//     引擎已有 trackActionHistory / consecutiveActions 窗口（只有记录与事后窗口，没有禁止读点），
//     见 primitive-requests/09746.json。
const CODE = '09746'
const DIFFICULTY = 3

const holderOf = (state, source) => (state.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info?.(`🌀 「理智扭曲」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced', trigger: 'turnEnded', silent: true,
    label: '你的回合结束时：检定意志(3)，成功后弃掉理智扭曲',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat
    },
    resolve: ({ state, inv, source, api }) => {
      const holder = holderOf(state, source) || inv
      if (!holder || holder.defeated || holder.resigned) return
      api.test(holder.seat, 'willpower', DIFFICULTY, {
        source: { type: 'scenario', action: 'activate', code: CODE, name: '理智扭曲', ability: true },
        target: { kind: 'card', code: CODE },
        resolve: result => {
          if (!result.success) return
          api.removeThreat(source)
          api.info?.(`🌀 ${holder.name} 摆脱了「理智扭曲」。`)
        },
      })
    },
  }],
  note: 'approximation: 「不能连续执行同一类型的行动」缺少 legalMoves 侧的限制读点（引擎只有 '
    + 'trackActionHistory / consecutiveActions 记录与事后窗口），当前只在 note 披露；'
    + '回合末检定与弃置已按 turnEnded 窗口实现。请求见 primitive-requests/09746.json。',
}
