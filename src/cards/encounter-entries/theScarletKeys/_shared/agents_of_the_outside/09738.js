// 09738 物质颠倒（Matter Inversion） · 诡计 · agents_of_the_outside
// 归属：战役共用 · theScarletKeys/_shared/agentsOfTheOutside。
// 卡面：显现 - 附属到一个没有附属物质颠倒的[[域外]]敌人上。如果你不能，物质颠倒获得涌动。
//   附属的敌人失去冷漠，获得反击，得到 +1 攻击和 +1 躲避。
//   强制 - 成功躲避附属的敌人后：弃掉物质颠倒，并抽取 1 张你放在一边的空洞。
//   Revelation - Attach to an [[Outsider]] enemy without a copy of Matter Inversion attached. If you
//   cannot, Matter Inversion gains surge. Attached enemy loses aloof, gains retaliate, and gets +1 fight
//   and +1 evade. Forced - After attached enemy is successfully evaded: Discard Matter Inversion and draw
//   1 of your set-aside hollows.
// 读点：
//   · 附属 = api.attachEncounterToEnemy（敌人附属唯一写入口）；涌动 = 返回 { gainSurge: true }；
//   · 「失去冷漠」= api.clearEnemyAloof（02063 四叶草俱乐部的同一写入口）；
//   · 「成功躲避后」= evadeSuccess 窗口（combat.js/enemies.js 两处通用躲避结算都派发）+ api.attack；
//   · 「抽取放在一边的空洞」= api.mechanics.tsk.hollow.recall(code, { to: 'hand' }) + api.putInHand(所有者)；
//   · 弃掉本卡 = api.cardsInPlayTreacheries + api.discardCardInPlay；
//   · 「+1 攻击/+1 躲避/获得反击」缺少「附属卡对宿主敌人的数值/关键词修正」读点：
//     modifiers 的 entity 行只读敌人自己/所在地点/幕/议程（不读 enemy.attachments），
//     combat.js 的 grantRetaliate 也只接受本次检定的一次性授予，见 primitive-requests/09738.json。
import { hasTrait } from '../../../_shared.js'

const CODE = '09738'

const attachedTo = enemy => (enemy.attachments || [])
  .some(card => (card.originalCode || card.code) === CODE)

const hostOf = (state, source) => (state.enemies || [])
  .find(enemy => (enemy.attachments || []).includes(source)) || null

function discardSelf(api, source) {
  const row = api.cardsInPlayTreacheries().find(entry => entry.attachment === source)
  if (!row) return false
  return api.discardCardInPlay(row)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const candidates = state.enemies.filter(enemy => hasTrait(enemy, 'Outsider') && !attachedTo(enemy))
    if (!candidates.length) {
      api.info?.('「物质颠倒」找不到没有同卡附属的[[域外]]敌人：获得涌动。')
      return { gainSurge: true }
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: CODE, seat: inv.seat,
      prompt: '物质颠倒：选择一个没有附属同卡的[[域外]]敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
    })) || candidates[0]
    api.attachEncounterToEnemy(CODE, chosen.id)
    api.clearEnemyAloof(chosen)
    api.info?.(`♻️ 「物质颠倒」附属到「${chosen.name}」：它失去冷漠。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced', trigger: 'evadeSuccess', silent: true,
    label: '成功躲避附属的敌人后：弃掉物质颠倒并抽取 1 张放在一边的空洞',
    criteria: ({ state, source, context }) => {
      const host = hostOf(state, source)
      return Boolean(host) && context?.enemy?.id === host.id
    },
    resolve: ({ state, inv, source, api }) => {
      const host = hostOf(state, source)
      if (!host) return
      discardSelf(api, source)
      const hollows = api.mechanics.tsk.hollow.cards()
      if (!hollows.length) {
        api.info?.('「物质颠倒」被弃掉：没有放在一边的空洞可抽取。')
        return
      }
      const seat = Number.isInteger(inv?.seat) ? inv.seat : api.scenario.decideSeat()
      const owned = hollows.filter(card => card.scope === 'team' || card.seat === seat)
      const pool = owned.length ? owned : hollows
      const chosen = pool.length === 1 ? pool[0] : pool.find(card => card.code === api.choose({
        kind: 'card', source: CODE, seat,
        prompt: '物质颠倒：选择 1 张放在一边的空洞加入手牌。',
        options: pool.map(card => ({ id: card.code, cardCode: card.code, label: api.cardName(card.code) })),
      })) || pool[0]
      if (!chosen) return
      api.mechanics.tsk.hollow.recall(chosen.code, { to: 'hand' })
      api.putInHand(Number.isInteger(chosen.seat) ? chosen.seat : seat, chosen.code)
      api.info?.(`♻️ 「${api.cardName(chosen.code)}」从空洞回到手中。`)
      void state
    },
  }],
  note: 'approximation: 「失去冷漠」走 api.clearEnemyAloof；弃置走 cardsInPlayTreacheries + discardCardInPlay。'
    + '缺读点：「+1 攻击 / +1 躲避 / 获得反击」需要附属卡对宿主敌人的数值与关键词修正读点（entity 行不读 '
    + 'enemy.attachments），当前只在日志/note 披露，请求见 primitive-requests/09738.json。',
}
