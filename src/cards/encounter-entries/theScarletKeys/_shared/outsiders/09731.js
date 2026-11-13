// 09731 无端存在（Paracausal Entity） · 敌人 · outsiders
// 归属：战役共用 · theScarletKeys/_shared/outsiders。
// 卡面：猎手。
//   强制 - 在无端存在与你交战时：查看你牌库顶的卡牌。如果不是弱点，将其放在一边，位于场外，作为一个空洞。
//   Hunter. Forced - When Paracausal Entity engages you: Look at the top card of your deck. If it is not
//   a weakness, set it aside, out of play, as a hollow.
// 读点：
//   · 猎手由章节遭遇定义提供（card-data#encounterDefinitions）；
//   · 「与你交战」：引擎的 enemyEngaged 窗口只注册、没有派发（enemies.js 只走旧式 triggerReaction）；
//     可用的等价时机是敌人移动后（movement.js 先自动交战、再开 enemyMoved 窗口，context 带 enemy/location），
//     因此 trigger 用 ['enemyMoved', 'enemyEngaged']，criteria 读 source.engagedSeat 是否已有交战对象；
//   · 查看牌库顶 = inv.deck 末位（只读）；「放在一边」= api.takeDeckCard + api.mechanics.tsk.hollow.hollow。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09731'

const engagedSeatOf = (state, source) => {
  const seat = source?.engagedSeat
  const inv = Number.isInteger(seat) ? state.investigators[seat] : null
  return inv && !inv.defeated && !inv.resigned ? inv : null
}

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: ['enemyMoved', 'enemyEngaged'], silent: true,
    limit: { scope: 'perWindow', owner: 'instance' },
    label: '与无端存在交战时：牌库顶非弱点牌放在一边成为空洞',
    criteria: ({ state, source }) => state.enemies.includes(source) && Boolean(engagedSeatOf(state, source)),
    resolve: ({ state, source, api }) => {
      const inv = engagedSeatOf(state, source)
      if (!inv) return
      const top = (inv.deck || []).at(-1)
      if (!top) return
      if (isWeaknessCode(top)) {
        api.info?.(`👁️ ${inv.name} 的牌库顶是弱点：无端存在没有夺走它。`)
        return
      }
      if (api.mechanics.tsk.hollow.isHollowed(top)) {
        api.info?.(`👁️ 牌库顶「${api.cardName(top)}」已有同名空洞，忽略本次（原语按卡号去重）。`)
        return
      }
      api.takeDeckCard(inv.seat, top)
      api.mechanics.tsk.hollow.hollow({ code: top, source: CODE, scope: 'investigator', seat: inv.seat })
      api.info?.(`👁️ 与「${source.name}」交战：${inv.name} 的牌库顶「${api.cardName(top)}」成为空洞。`)
    },
  }],
  note: 'approximation: 「交战时」用 enemyMoved（自动交战之后开窗）与 enemyEngaged 触发；引擎当前不派发 '
    + 'enemyEngaged，因此「生成即交战」与基础交战行动带来的交战时机会要到共享层接线后才覆盖。'
    + '同名空洞按 tsk-hollow 的卡号去重口径披露。请求见 primitive-requests/09731.json。',
}
