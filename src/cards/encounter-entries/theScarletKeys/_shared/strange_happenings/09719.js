// 09719 瓢泼大雨（Downpour） · 诡计 · strange_happenings
// 归属：战役共用 · theScarletKeys/_shared/strangeHappenings。
// 卡面：显现 - 检定[willpower](3)。你检定失败且每低于难度 1 点，你必须受到 1 点恐惧，
//   或将你的 1 个线索放到你所在地点。
//   Revelation - Test [willpower] (3). For each point you fail by, you must either take 1 horror,
//   or place 1 of your clues on your location.
// 读点：
//   · 显现检定 = 条目 encounterResolve（entryRevelation 通道）+ api.test（场景运行时通道）；
//   · 失败差值 = _shared.js 的 failedBy（与引擎 applyPenalty 同口径：max(0, difficulty - value)）；
//   · 「受到 1 点恐惧」= api.horror；「把 1 个线索放到所在地点」= api.spendClues + api.addCluesToLocation
//     （两处都是唯一写入口，线索总数/组线索池由引擎同步）。
import { failedBy } from '../../../_shared.js'

const CODE = '09719'
const DIFFICULTY = 3

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', DIFFICULTY, result => {
      if (result.success) {
        api.info?.(`🌧️ ${inv.name} 顶住了瓢泼大雨。`)
        return
      }
      const points = failedBy(result, DIFFICULTY)
      for (let index = 0; index < points; index += 1) {
        if (inv.defeated || inv.resigned) return
        const options = [{ id: 'horror', label: '受到 1 点恐惧' }]
        if ((inv.clues || 0) > 0) options.push({ id: 'clue', label: '把 1 个线索放到你所在地点' })
        const answer = options.length === 1 ? options[0].id : api.choose({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `瓢泼大雨：选择受到 1 点恐惧，或把 1 个线索放到所在地点（剩余 ${points - index} 次）。`,
          options,
        })
        if (answer === 'clue' && (inv.clues || 0) > 0) {
          api.spendClues(inv.seat, 1)
          api.addCluesToLocation(inv.location, 1)
          api.info?.(`🌧️ ${inv.name} 把 1 个线索放到了「${api.locationName(inv.location)}」。`)
        } else {
          api.horror(inv.seat, 1)
        }
      }
    })
    return false
  },
  note: 'approximation: 失败后逐点询问（每次一点），与卡面「每低于难度 1 点」的次数一致；线索不足时自动只剩恐惧分支。',
}
