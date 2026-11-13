// 09735 记忆变体（Memory Variant） · 诡计 · secret_war
// 归属：战役共用 · theScarletKeys/_shared/secretWar。
// 卡面：显现 - 将记忆变体放置入场，放在密谋牌库旁。
//   强制 - 事件被打出后：不将其弃掉，改为放在一边，位于场外，作为一个空洞。
//   [action]：检定 [willpower](4)。如果你检定成功，弃掉记忆变体。任意调查员均可以触发本能力。
//   Revelation - Put Memory Variant into play next to the agenda deck.
//   Forced - After an event is played: Instead of discarding it, set it aside, out of play, as a hollow.
//   [action]: Test [willpower] (4). If you succeed, discard Memory Variant. Any investigator may trigger
//   this ability.
// 读点：
//   · 「放在密谋牌库旁」= api.putNextToAgenda（agendaAside 唯一写入口）；返回 { placed: true } 阻止进遭遇弃牌堆；
//   · 「事件被打出后」= eventPlayed 窗口（actions.js#doPlay 派发，context 带 cardId/cardCode/seat）；
//     把刚打出的事件从弃牌堆取出 → api.takeDiscardCard，再 api.mechanics.tsk.hollow.hollow（tsk-hollow 唯一写入口）；
//   · 「弃掉记忆变体」= api.discardAgendaAside(实例 id)（agendaAside 的弃置写入口）；
//   · 缺读点：引擎的 nonPlayerAbilitySources 不枚举 state.agendaAside，因此本卡的强制/行动需要
//     「密谋牌库旁卡牌作为能力来源」的读点，见 primitive-requests/09735.json。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09735'
const DIFFICULTY = 4

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda(CODE)
    api.info?.('🧠 「记忆变体」被放到密谋牌库旁。')
    return { placed: true }
  },
  abilities: [{
    kind: 'forced', trigger: 'eventPlayed', silent: true,
    label: '事件被打出后：改为放在一边，位于场外，作为一个空洞',
    criteria: ({ context }) => Boolean(context?.cardCode) && !isWeaknessCode(context.cardCode),
    resolve: ({ state, context, api }) => {
      const code = context.cardCode
      const seat = Number.isInteger(context.seat) ? context.seat : state.currentSeat
      if (!state.investigators[seat]) return
      if (api.mechanics.tsk.hollow.isHollowed(code)) {
        api.info?.(`🧠 「${api.cardName(code)}」已经有同名空洞，忽略本次（原语按卡号去重）。`)
        return
      }
      if (!api.takeDiscardCard(seat, code)) {
        // 「打出后回到手牌」的事件仍在手里；先入弃牌堆再取出，保持「放在一边」的区域口径。
        api.putInDiscard(seat, code, { fromHand: true })
        api.takeDiscardCard(seat, code)
      }
      api.mechanics.tsk.hollow.hollow({ code, source: CODE, scope: 'investigator', seat })
      api.info?.(`🧠 「${api.cardName(code)}」没有进弃牌堆，被放在一边成为空洞。`)
    },
  }, {
    kind: 'action', actionKind: 'activate', range: 'anywhere',
    label: '检定意志(4)：成功后弃掉记忆变体（任意调查员可触发）',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', DIFFICULTY, {
        source: { type: 'scenario', action: 'activate', code: CODE, name: '记忆变体', ability: true },
        target: { kind: 'card', code: CODE },
        resolve: result => {
          if (!result.success) return
          const removed = source?.id ? api.discardAgendaAside(source.id) : null
          if (!removed) {
            api.info?.('🧠 「记忆变体」已不在密谋牌库旁。')
            return
          }
          api.info?.(`🧠 ${inv.name} 摆脱了「记忆变体」。`)
        },
      })
    },
  }],
  note: 'approximation: 「放在密谋牌库旁」与弃置都走 agendaAside 原语；强制与 [action] 已按引擎窗口/描述子实现，'
    + '但 engine 的 nonPlayerAbilitySources 当前不枚举 agendaAside，需共享层接线后才会自动派发'
    + '（tsk-hollow 对同一卡号只保留一条空洞记录，重复同名时按去重口径披露）。请求见 primitive-requests/09735.json。',
}
