// 09736 失落的秘密（Secrets Lost） · 诡计 · secret_war
// 归属：战役共用 · theScarletKeys/_shared/secretWar。
// 卡面：显现 - 检定 [willpower](3)。你检定失败且每低于难度 1 点，选择自己手中一张非弱点卡牌，
//   将其放在一边，位于场外，作为一个空洞。如果你检定成功且超过难度至少 2 点，你可以受到 1 点恐惧，
//   以选择一个放在一边的空洞，将其加入所有者手牌。
//   Revelation - Test [willpower] (3). For each point you fail by, choose a non-weakness card in your hand
//   and set it aside, out of play, as a hollow. If you succeed by 2 or more, you may take 1 horror to choose
//   a set-aside hollow and add it to its owner's hand.
// 读点：
//   · 显现检定 = 条目 encounterResolve（entryRevelation 通道）+ api.test；
//   · 失败差值 = _shared.js 的 failedBy（与引擎 applyPenalty 同口径）；
//   · 空洞 = api.mechanics.tsk.hollow.hollow（tsk-hollow 唯一写入口，必须显式给 scope:'investigator' + seat）；
//     手牌离场走 api.putInDiscard({ fromHand: true }) + api.takeDiscardCard 把实体移出区域；
//   · 回收 = api.mechanics.tsk.hollow.recall(code, { to: 'hand' }) 去掉空洞记录 + api.putInHand(所有者)。
import { failedBy, isWeaknessCode } from '../../../_shared.js'

const CODE = '09736'
const DIFFICULTY = 3

// 手牌里可被设为空洞的候选（非弱点）。
const candidatesOf = inv => (inv.hand || [])
  .map((code, index) => ({ code, index }))
  .filter(item => !isWeaknessCode(item.code))

function chooseHandCard(inv, api, prompt) {
  const candidates = candidatesOf(inv)
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const answer = api.choose({
    kind: 'card', source: CODE, seat: inv.seat, prompt,
    options: candidates.map(item => ({ id: String(item.index), cardCode: item.code, label: api.cardName(item.code) })),
  })
  return candidates.find(item => String(item.index) === String(answer)) || candidates[0]
}

function setAsideFromHand(state, api, seat, code) {
  if (api.mechanics.tsk.hollow.isHollowed(code)) {
    // 原语按卡号去重：同名空洞已存在时，把这张实体移出游戏并披露（见 note）。
    api.putInDiscard(seat, code, { fromHand: true })
    const taken = api.takeDiscardCard(seat, code)
    if (taken) api.removeFromGameCards([taken])
    return false
  }
  api.putInDiscard(seat, code, { fromHand: true })
  api.takeDiscardCard(seat, code)
  api.mechanics.tsk.hollow.hollow({ code, source: CODE, scope: 'investigator', seat })
  return true
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', DIFFICULTY, result => {
      if (result.success) {
        const successBy = Math.max(0, Number(result.value ?? 0) - Number(result.difficulty ?? DIFFICULTY))
        if (successBy < 2) {
          api.info?.(`🔐 ${inv.name} 守住了自己的秘密。`)
          return
        }
        recall(state, inv, api)
        return
      }
      const points = failedBy(result, DIFFICULTY)
      for (let index = 0; index < points; index += 1) {
        if (inv.defeated || inv.resigned) return
        const chosen = chooseHandCard(inv, api, `失落的秘密：选择一张非弱点手牌放在一边作为空洞（剩余 ${points - index} 次）。`)
        if (!chosen) break
        setAsideFromHand(state, api, inv.seat, chosen.code)
      }
    })
    return false
  },
  note: 'approximation: 成功且超过难度 2 点时的「可以受到 1 点恐惧」由服务端选择事务询问；'
    + 'tsk-hollow 的 hollowCard 按卡号去重，同一卡号的第二张改用 removeFromGameCards 移出游戏并披露。'
    + '无缺读点。',
}

// 成功 2+：可选受到 1 点恐惧，换回一个放在一边的空洞到其所有者手牌。
function recall(state, inv, api) {
  const hollows = api.mechanics.tsk.hollow.cards()
  if (!hollows.length) return
  const answer = api.choose({
    kind: 'reaction', source: CODE, seat: inv.seat,
    prompt: '失落的秘密：受到 1 点恐惧，把一个放在一边的空洞加入其所有者手牌？',
    options: [{ id: 'skip', label: '不受恐惧' }, { id: 'take', label: '受到 1 点恐惧并取回一个空洞' }],
  })
  if (answer !== 'take') return
  api.horror(inv.seat, 1)
  const chosen = hollows.length === 1 ? hollows[0] : hollows.find(card => card.code === api.choose({
    kind: 'card', source: CODE, seat: inv.seat,
    prompt: '失落的秘密：选择一个放在一边的空洞加入其所有者手牌。',
    options: hollows.map(card => ({ id: card.code, cardCode: card.code, label: api.cardName(card.code) })),
  })) || hollows[0]
  if (!chosen) return
  api.mechanics.tsk.hollow.recall(chosen.code, { to: 'hand' })
  const owner = Number.isInteger(chosen.seat) ? chosen.seat : inv.seat
  api.putInHand(owner, chosen.code)
  api.info?.(`🔐 「${api.cardName(chosen.code)}」从空洞回到其所有者手中。`)
  void state
}
