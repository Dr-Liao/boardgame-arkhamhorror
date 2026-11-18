// 10005 磁通量稳定器（Flux Stabilizer）· 关闭面 · 永久 · 凯特·温斯罗普牌组专用
// 卡面：
//   永久。凯特·温斯罗普牌组专用。
//   强制 - 在线索放置到磁通量稳定器后：查找你的绑定卡牌或弃牌堆，找出 1 张以太电流并将其
//   混洗入你的牌库。将磁通量稳定器翻面（保留所有的标记和附属）。
//
// 读点（卡面 → 引擎读点）：
//   · 永久资产：卡面数据 permanent=true，setup.js 会在开局把牌库里的永久卡放入场；
//     凯特这张由 `investigator.startsWith = ['10005']` 直接以关闭面开场（见 10004.js）。
//   · 强制触发：窗口 `assetCluesPlaced`（windows.js 注册；唯一派发点 api-clue.js#transferControlledClues，
//     context = { seat, asset, amount, location }）。criteria 锁定「线索放到的是本实例」。
//   · 绑定检索：api.bonded.shuffleCopyIntoDeck(seat, '10005', code)（P2 原语：从场外绑定集合或
//     弃牌堆取 1 张同名副本，洗入牌库；场外集合惰性创建）。
//   · 翻面：api.flipAsset(source, '10005b')（physical-faces.js：同一物理实例只替换印刷面，
//     id / 横置 / 控制者 / 位置 / 线索 / 使用次数 / 附属全部保留）。
//
// 「1 张以太电流」有两个同名的绑定面（10006 尤格斯星 = 攻击，10007 幽嘶 = 躲避）。印刷检索
// 允许玩家二选一，因此两张都在场外集合/弃牌堆时用 api.choice 询问；只有 1 张可用时直接取它。
// 选择结果再交给 shuffleCopyIntoDeck（原语本身只按 code 取牌，不替玩家选）。
function availableCopies(state, inv, codes) {
  const sets = Object.entries(state.bondedSets || {})
    .filter(([key]) => key === '10005' || key.startsWith('10005@'))
    .map(([, set]) => set)
  return codes.filter(code => {
    if ((inv.discard || []).includes(code)) return true
    // 场外集合尚未创建 = 两张副本都还在场外。
    if (!sets.length) return true
    return sets.some(set => (set.cards || []).includes(code))
  })
}

export default {
  code: '10005',
  name: '磁通量稳定器（关闭）',
  abilities: [
    {
      kind: 'forced',
      trigger: 'assetCluesPlaced',
      label: '线索放到磁通量稳定器后：找出 1 张以太电流洗入牌库，然后翻面',
      criteria: [({ inv, source, context }) => Boolean(source)
        && context?.asset === source
        && context?.seat === inv.seat
        && (Number(context?.amount) || 0) > 0],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const available = availableCopies(state, inv, ['10006', '10007'])
        let code = available[0] || null
        if (available.length > 1) {
          code = available[Number(api.choice({
            kind: 'target', source: '10005', seat: inv.seat,
            prompt: '查找 1 张「以太电流」洗入你的牌库。',
            options: [
              { id: '10006', label: '以太电流（尤格斯星：攻击）', cardCode: '10006' },
              { id: '10007', label: '以太电流（幽嘶：躲避）', cardCode: '10007' },
            ],
          }))] || available[0]
        }
        const found = code ? api.bonded.shuffleCopyIntoDeck(inv.seat, '10005', code) : false
        if (found) api.info(`🧲 磁通量稳定器：把「${api.cardName(code)}」洗入 ${inv.name} 的牌库。`)
        else api.info('🧲 磁通量稳定器：绑定卡牌与弃牌堆里没有可查找的「以太电流」。')
        api.flipAsset(source, '10005b')
        api.info('🧲 磁通量稳定器翻至（开启）面（保留所有标记与附属）。')
      },
    },
  ],
  modifiers: [],
}
