// 09732 天启噩兆（Apocalyptic Presage） · 敌人 · outsiders
// 归属：战役共用 · theScarletKeys/_shared/outsiders。
// 卡面：胜利 1。
//   强制 - 在天启噩兆入场时：每位调查员选择自己手中或游戏区域内控制的一张非弱点卡牌，
//   将其放在一边，位于场外，作为一个空洞。
//   [reaction] 在天启噩兆被击败时：不将其加入胜利区，改为将其弃掉，并选择至多 3 张放在一边的空洞，
//   将这些空洞加入所有者手牌。
//   Forced - When Apocalyptic Presage enters play: Each investigator chooses a non-weakness card they
//   control in their hand or play area and sets it aside, out of play, as a hollow.
//   [reaction] When Apocalyptic Presage is defeated: Instead of adding it to the victory display, discard it
//   and choose up to 3 set-aside hollows. Add them to their owners' hands.
// 读点：
//   · 「入场时」= enemySpawn 窗口（enemies.js#enterExistingEnemy 派发，context 带 enemy/location）；
//   · 空洞 = api.discardAsset（场上支援）/ api.putInDiscard({ fromHand: true })（手牌）+ api.takeDiscardCard，
//     再 api.mechanics.tsk.hollow.hollow（tsk-hollow 唯一写入口，scope:'investigator' + seat）；
//   · 「被击败时」= defeatEnemy 窗口（enemies.js#defeatEnemy 在胜利区结算后派发）；
//     回收 = api.mechanics.tsk.hollow.recall(code, { to: 'hand' }) + api.putInHand(所有者)；
//   · 「不加入胜利区」需要「击败去向覆盖」读点：enemy-outcomes 的 commitDestination 在 wouldAddToVictory
//     时直接返回 false（有印刷胜利点的敌人无法改去弃牌堆），见 primitive-requests/09732.json。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09732'
const RECALL_LIMIT = 3

// 手牌 + 场上支援里可被设为空洞的候选（非弱点）。
function candidatesOf(inv) {
  const hand = (inv.hand || []).map((code, index) => ({ kind: 'hand', code, index }))
    .filter(item => !isWeaknessCode(item.code))
  const assets = (inv.assets || []).map(asset => ({ kind: 'asset', code: asset.code, id: asset.id }))
    .filter(item => !isWeaknessCode(item.code))
  return [...hand, ...assets]
}

const keyOf = item => (item.kind === 'hand' ? `hand:${item.index}` : `asset:${item.id}`)
const labelOf = (item, api) => `${item.kind === 'hand' ? '手牌' : '场上'}：${api.cardName(item.code)}`

// 把选中的卡放在一边成为空洞（手牌 / 场上支援两条区域路径）。
function setAside(state, api, seat, item) {
  if (api.mechanics.tsk.hollow.isHollowed(item.code)) {
    api.info?.(`🌫️ 「${api.cardName(item.code)}」已有同名空洞，忽略本次（原语按卡号去重）。`)
    return false
  }
  if (item.kind === 'asset') {
    api.discardAsset(seat, item.id)
  } else {
    api.putInDiscard(seat, item.code, { fromHand: true })
    api.takeDiscardCard(seat, item.code)
  }
  api.mechanics.tsk.hollow.hollow({ code: item.code, source: CODE, scope: 'investigator', seat })
  return true
}

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemySpawn', silent: true,
    label: '入场时：每位调查员把手牌或场上一张非弱点卡牌放在一边成为空洞',
    criteria: ({ source, context }) => context?.enemy?.id === source.id,
    resolve: ({ state, source, api }) => {
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        const candidates = candidatesOf(inv)
        if (!candidates.length) continue
        const chosen = candidates.length === 1 ? candidates[0] : candidates.find(item => keyOf(item) === api.choose({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: `${inv.name}：天启噩兆入场，选择一张非弱点卡牌放在一边作为空洞。`,
          options: candidates.map(item => ({ id: keyOf(item), cardCode: item.code, label: labelOf(item, api) })),
        })) || candidates[0]
        if (chosen) setAside(state, api, inv.seat, chosen)
      }
      api.info?.(`🌫️ 「${source.name}」入场：每位调查员的至多 1 张卡牌成为空洞。`)
    },
  }, {
    kind: 'reaction', trigger: 'defeatEnemy',
    label: '被击败时：选择至多 3 张放在一边的空洞加入所有者手牌',
    criteria: ({ source, context }) => context?.enemy?.id === source.id,
    resolve: ({ inv, source, api }) => {
      const hollows = api.mechanics.tsk.hollow.cards()
      if (!hollows.length) {
        api.info?.('🌫️ 「天启噩兆」被击败：没有放在一边的空洞。')
        return
      }
      const seat = Number.isInteger(inv?.seat) ? inv.seat : api.scenario.decideSeat()
      let remaining = Math.min(RECALL_LIMIT, hollows.length)
      const pool = [...hollows]
      while (remaining > 0 && pool.length) {
        const picked = pool.length === 1 ? pool[0] : pool.find(card => card.code === api.choose({
          kind: 'card', source: CODE, seat,
          prompt: `天启噩兆：选择一张放在一边的空洞加入其所有者手牌（还可选 ${remaining} 张）。`,
          options: [{ id: 'done', label: '不再选择' },
            ...pool.map(card => ({ id: card.code, cardCode: card.code, label: api.cardName(card.code) }))],
        }))
        if (!picked) break
        pool.splice(pool.indexOf(picked), 1)
        remaining -= 1
        api.mechanics.tsk.hollow.recall(picked.code, { to: 'hand' })
        const owner = Number.isInteger(picked.seat) ? picked.seat : seat
        api.putInHand(owner, picked.code)
        api.info?.(`🌫️ 「${api.cardName(picked.code)}」从空洞回到其所有者手中。`)
      }
      api.info?.(`🌫️ 「${source.name}」被击败：回收了放在一边的空洞。`)
    },
  }],
  note: 'approximation: 「不加入胜利区，改为弃掉」需要击败去向覆盖读点（enemy-outcomes#commitDestination 在'
    + '有印刷胜利点时拒绝改道），当前只实现「回收至多 3 张空洞」；同名空洞按 tsk-hollow 的卡号去重口径披露。'
    + '请求见 primitive-requests/09732.json。',
}
