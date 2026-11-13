// 09718 现实塌缩（Reality Collapse） · 诡计 · strange_happenings
// 归属：战役共用 · theScarletKeys/_shared/strangeHappenings。
// 卡面：险境。显现 - 你必须（选择一项）：花费 1 个线索，或选择并弃掉一半的非弱点手牌（向上取整）。
//   Peril. Revelation - You must either (choose one): Spend 1 clue or choose and discard half of the
//   non-weakness cards in your hand (rounded up).
// 读点：
//   · 显现走 entryRevelation → encounterResolve（content/campaigns/theScarletKeys/card-data.js 的
//     encounterDefinitions 给所有 tskc 诡计打 entryRevelation，引擎在 treachery-tokens.js#resolveTreacheryBody
//     的条目通道调用本函数）；
//   · 「花费 1 个线索」= api.spendClues（唯一线索写入点，同时同步组线索池）；
//   · 「选择并弃掉 N 张手牌」= api.discardChosen（唯一实现：逐张询问、canDiscardFromHand 过滤、
//     afterHandDiscard 窗口），因此弱点不会被选中；
//   · 险境本身由卡面数据提供（card-data 的 peril 解析），条目不再重复声明。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09718'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const half = Math.ceil((inv.hand || []).filter(code => !isWeaknessCode(code)).length / 2)
    const options = []
    if ((inv.clues || 0) > 0) options.push({ id: 'clue', label: '花费 1 个线索' })
    if (half > 0) options.push({ id: 'discard', label: `选择并弃掉 ${half} 张非弱点手牌` })
    if (!options.length) {
      api.info?.('「现实塌缩」没有可支付的选项（既没有线索，也没有非弱点手牌）。')
      return false
    }
    const answer = options.length === 1 ? options[0].id : api.choose({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '现实塌缩：花费 1 个线索，或弃掉一半的非弱点手牌（向上取整）。',
      options,
    })
    if (answer === 'clue') {
      api.spendClues(inv.seat, 1)
      api.info?.(`🌀 ${inv.name} 花费 1 个线索稳住现实。`)
      return false
    }
    const discarded = api.discardChosen(inv.seat, half, CODE)
    api.info?.(`🌀 ${inv.name} 的现实塌缩：弃掉了 ${discarded} 张手牌。`)
    return false
  },
  note: 'approximation: 「选择一项」由服务端选择事务只问一次；线索不足时自动只剩弃牌分支（卡面「必须」口径）。'
    + '不涉及缺读点。',
}
