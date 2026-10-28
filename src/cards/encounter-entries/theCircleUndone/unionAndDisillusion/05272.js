// 05272 看守人的注视
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 每位调查员检定意志(5)。
// 失败：结算你所在地点或幽灵看守人所在地点的闹鬼能力（二选一）。
// 一卡一文件：规则只在这里维护；闹鬼结算走 api.haunted，合法地点用 api.hauntedAt 判断。
export default {
  code: '05272',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const watcher = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '05086')
    for (const target of state.investigators.filter(entry => !entry.defeated && !entry.resigned)) {
      api.test?.(target.seat, 'willpower', 5, result => {
        if (result?.success) return
        const options = []
        if (api.hauntedAt?.(target.location)?.length) {
          options.push({ id: 'here', label: '结算你所在地点的闹鬼能力' })
        }
        if (watcher?.location && api.hauntedAt?.(watcher.location)?.length) {
          options.push({ id: 'watcher', label: '结算幽灵看守人所在地点的闹鬼能力' })
        }
        if (!options.length) {
          api.info?.('看守人的注视：两个地点都没有闹鬼能力，效果结束。')
          return
        }
        let answer = options[0].id
        if (options.length > 1 && typeof api.choose === 'function') {
          answer = api.choose({
            kind: 'treachery', source: '05272', seat: target.seat,
            prompt: '看守人的注视：检定失败，选择结算哪个地点的闹鬼能力。', options,
          })
        }
        const locationId = answer === 'watcher' ? watcher?.location : target.location
        if (locationId) api.haunted?.(target.seat, { locationId })
        api.info?.('看守人的注视：结算闹鬼能力。')
      })
    }
    return false
  },
}
