// 06230 诡计「严密监视」（Close Watch · [[阴谋]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：显现 - 检定敏捷（4）。如果你检定失败，
// 你必须弃掉你控制的印刷费用最高的支援，或将你的警报等级提高 1 级。
//
// 依据 Haskell Treachery/Cards/.../CloseWatch.hs（AssetWithHighestPrintedCost → choose discard / raiseAlarmLevel）：
//   · 检定 + 失败二选一 → encounterResolve（选项依赖「你控制的支援」，声明式 test 表达不了）；
//   · 弃支援走 api.discardAsset（唯一弃支援写入口），警报等级走 api.counters；
//   · 印刷费用从 ALL_CARDS 读（不落到实例快照）。
import { ALL_CARDS } from '../../_shared.js'

const ALARM = 'alarmLevel'
const CLOSE_WATCH = '06230'

const costOf = asset => Number(ALL_CARDS[asset?.code]?.cost) || 0
const controllableAssets = inv => (inv.assets || []).filter(asset => !asset.removedFromGame && !asset.returnedToHand)
const highestCostAssets = inv => {
  const assets = controllableAssets(inv)
  if (!assets.length) return []
  const best = Math.max(...assets.map(costOf))
  return assets.filter(asset => costOf(asset) === best)
}

export default {
  code: CLOSE_WATCH,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, treachery, api) {
    api.test?.(inv.seat, 'agility', 4, result => {
      if (result.success) return
      const assets = highestCostAssets(inv)
      const options = []
      if (assets.length) options.push({ id: 'discard', label: '弃掉你控制的印刷费用最高的支援' })
      options.push({ id: 'alarm', label: '你的警报等级 +1' })
      const answer = options.length === 1 ? options[0].id : api.choice?.({
        kind: 'cost', source: CLOSE_WATCH, seat: inv.seat,
        prompt: '「严密监视」：弃掉印刷费用最高的支援，或警报等级 +1。', options,
      })
      if (answer === 'discard' && assets.length) {
        const asset = assets.length === 1 ? assets[0] : assets.find(item =>
          String(item.id) === String(api.choice?.({
            kind: 'asset', source: CLOSE_WATCH, seat: inv.seat,
            prompt: '选择要弃掉的支援（印刷费用最高）。',
            options: assets.map(item => ({ id: String(item.id), label: api.cardName?.(item.code) || item.code })),
          }))) || assets[0]
        api.discardAsset?.(inv.seat, asset.id)
        api.info?.(`👁️ 「严密监视」：${inv.name} 弃掉了「${api.cardName?.(asset.code) || asset.code}」。`)
        return
      }
      api.counters.add(inv.seat, ALARM, 1)
      api.info?.(`👁️ 「严密监视」：${inv.name} 的警报等级 +1。`)
    })
    return false
  },
}
