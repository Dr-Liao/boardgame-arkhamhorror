// 05234 诱敌（潜袭者 · 0 经验）
// 卡面：躲避。自动躲避你所在地点的一个非[[精英]]敌人。
// 卡面：[reaction]在你打出诱敌时，提升其费用2点：「一个非[[精英]]敌人」变为「最多2个非[[精英]]敌人」。
// 卡面：[reaction]在你打出诱敌时，提升其费用2点：「你所在地点」变为「与你所在地点之间连接次数不超过2的地点」。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05234 诱敌：自动躲避 1 个非精英敌人；可支付 +2/+4 资源把范围扩到「最多 2 个」与「2 次连接内」。
//
// 实现备注：两条 [reaction] 都是「打出时提升费用以改变目标范围」。引擎没有「打出费用反应」通道，
// 这里在 resolve 开头一次询问结算方式并立即支付额外资源（费用数值与净效果与卡面一致；差异只是
// 支付发生在打出之后，而不是打出前的反应窗口里）。

// 与 fromId 相距不超过 2 次连接的地点（含直接连接与二段连接），不含自身。
function locationsWithinTwo(state, fromId) {
  const connectionsOf = id => state.locations.find(location => location.id === id)?.connections || []
  const direct = connectionsOf(fromId)
  const out = []
  for (const id of [...direct, ...direct.flatMap(connectionsOf)]) {
    if (id === fromId || out.includes(id)) continue
    if (!state.locations.some(location => location.id === id)) continue
    out.push(id)
  }
  return out
}

export default {
  code: '05234',
  // 卡面两项都以「躲避」为目标：没有任何可自动躲避的非精英敌人（所在地点或 2 次连接内）时不能打出。
  playCondition: [{
    when: ({ state, inv }) => {
      const local = (state.enemies || []).some(enemy => !enemy.defeated && !enemy.elite && enemy.location === inv.location)
      if (local) return true
      return locationsWithinTwo(state, inv.location)
        .some(id => (state.enemies || []).some(enemy => !enemy.defeated && !enemy.elite && enemy.location === id))
    },
    message: '附近没有可自动躲避的非[[精英]]敌人，不能打出「诱敌」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '诱敌：自动躲避非精英敌人',
      resolve: ({ state, inv, api }) => {
        const resources = inv.resources || 0
        const nearIds = locationsWithinTwo(state, inv.location)
        const localPool = () => state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && enemy.location === inv.location)
        const nearPool = () => state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && nearIds.includes(enemy.location))
        const hasLocal = localPool().length > 0
        const hasNear = nearPool().length > 0
        const candidatesModes = [
          { id: 'base', label: '你所在地点的一个非精英敌人', extra: 0, upToTwo: false, far: false, available: hasLocal },
          { id: 'pair', label: '最多 2 个非精英敌人（费用 +2）', extra: 2, upToTwo: true, far: false, available: hasLocal },
          { id: 'far', label: '2 次连接内地点的一个非精英敌人（费用 +2）', extra: 2, upToTwo: false, far: true, available: hasNear },
          { id: 'farPair', label: '2 次连接内地点最多 2 个非精英敌人（费用 +4）', extra: 4, upToTwo: true, far: true, available: hasNear },
        ]
        // 只提供「有合法目标且付得起额外费用」的模式（修复：范围模式不再在无远处目标时回落到本地）。
        const modes = candidatesModes.filter(mode => mode.available && resources >= mode.extra)
        if (!modes.length) { api.info('没有可自动躲避的非[[精英]]敌人。'); return }
        const modeId = modes.length === 1 ? modes[0].id : api.choice({
          kind: 'effect', source: '05234', seat: inv.seat,
          prompt: '诱敌：选择结算方式（卡面的两条 [reaction] 用提升费用扩大目标范围）。',
          options: modes.map(mode => ({ id: mode.id, label: mode.label })),
        })
        const mode = modes.find(item => item.id === modeId) || modes[0]
        // 目标地点：基础版本只限所在地点；范围模式只在 2 次连接内地点里选。
        let targetLocation = inv.location
        if (mode.far) {
          const withEnemies = nearIds.filter(id => state.enemies.some(enemy =>
            !enemy.defeated && !enemy.elite && enemy.location === id))
          if (!withEnemies.length) { api.info('「诱敌」：2 次连接内没有非[[精英]]敌人。'); return }
          targetLocation = withEnemies.length === 1 ? withEnemies[0] : api.choice({
            kind: 'location', source: '05234', seat: inv.seat,
            prompt: '选择敌人所在的地点（与你相距不超过 2 次连接）。',
            options: withEnemies.map(id => ({ id, label: api.locationName(id) })),
          })
        }
        let candidates = state.enemies.filter(enemy => enemy.location === targetLocation && !enemy.defeated && !enemy.elite)
        if (!candidates.length) { api.info('没有可自动躲避的非[[精英]]敌人。'); return }
        if (mode.extra) {
          api.loseResources(inv.seat, mode.extra)
          api.info(`🎭 ${inv.name} 为「诱敌」额外支付 ${mode.extra} 资源。`)
        }
        const limit = mode.upToTwo ? 2 : 1
        const evaded = []
        for (let count = 0; count < limit && candidates.length; count++) {
          const options = [
            ...(count > 0 ? [{ id: 'skip', label: '不再躲避' }] : []),
            ...candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
          ]
          const pickedId = options.length === 1 ? options[0].id : api.choice({
            kind: 'target', source: '05234', seat: inv.seat, canSkip: count > 0,
            prompt: count === 0 ? '选择要自动躲避的非[[精英]]敌人。' : '是否再自动躲避 1 个非[[精英]]敌人？',
            options,
          })
          if (pickedId === 'skip') break
          const enemy = candidates.find(item => item.id === pickedId)
          if (!enemy) break
          api.autoEvade(enemy)
          evaded.push(enemy)
          candidates = candidates.filter(item => item !== enemy)
        }
        if (!evaded.length) { api.info('「诱敌」没有躲避任何敌人。'); return }
        api.info(`🎭 「诱敌」自动躲避了 ${evaded.length} 个非[[精英]]敌人：${evaded.map(enemy => enemy.name).join('、')}。`)
      },
    },
  ],
}
