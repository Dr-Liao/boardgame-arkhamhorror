// 09004 文森特·李（Vincent Lee）· 探求者 · 医生
// 卡面：
//   [reaction] 在你的一张卡牌效果治愈了一名调查员或一名调查员的 [[盟友]] 支援的伤害后：
//     把你场外的一张《术后恢复》加入该调查员的手牌。
//   [elder_sign] 效果：+1。你可以治疗同地点一名调查员或 [[盟友]] 支援上的 1 点伤害。
//   开局：你以每位调查员 1 张《术后恢复》放在场外开始游戏（Additional Setup）。
//
// 读点（卡面 → 引擎读点）：
//   · 伤害被治疗的统一窗口 `damageHealed`（harm-threat.js#openDamageHealedWindow）：
//     context = { seat/cardSeat(治疗者), healedSeat(被治疗者或盟友控制者), assetId, amount }。
//   · 场外区 = state.setAside；条目 `investigator.setup.setAsideSignature`
//     → src/engine/tsk-investigator-support.js#runTskInvestigatorSetup 开局预置；
//     读取走 api.investigatorTools.tskSetAside(seat, code)。
//   · 取回场外卡：P1-6 修正。api.moveCard（src/engine/deck-ops.js#moveCardTo → card-ops.js#findZoneCard）
//     对共享区（setAside）只按 `spec.code` 匹配（card-ops.js:222-231），旧实现只传 id 会永远
//     「没有找到要移动的牌」；现在补 code 并校验返回值（返回 code 表示真的移动了）。
//     moveCard 的 `ownerSeat` 同时承担「来源归属筛选」与「目标手牌归属」，共享区来源过滤要求
//     实例 ownerSeat === spec.ownerSeat，所以第一步必须先落回文森特自己的手牌。
//   · 交给被治疗的调查员：第二步走 api.playerTools.giveHandCard（api-misc.js:1510，手牌跨座位
//     转移原语，允许不同地点）。直传 moveCard 做不到「从文森特的 setAside 到别人的手牌」——
//     同一个 ownerSeat 不能既表示来源座位又表示目标座位；已把该缺口列给主进程。
//   · 旧印治疗 1 点伤害：api.investigatorsAt + api.healDamage。
export default {
  code: '09004',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 1 },
    setup: { setAsideSignature: { code: '09006', perInvestigator: true } },
  },
  elderSign: {
    id: '09004-eldersign',
    label: '文森特旧印：+1；可治疗同地点调查员或盟友的 1 点伤害',
    resolve: ({ state, inv, api }) => {
      const options = []
      for (const other of api.investigatorsAt(inv.location)) {
        if ((other.damage || 0) > 0) options.push({ id: `inv:${other.seat}`, label: `${other.name}（伤害 ${other.damage}）` })
      }
      for (const other of api.investigatorsAt(inv.location)) {
        for (const asset of other.assets || []) {
          if (api.cardType(asset.code) === 'asset' && (asset.damage || 0) > 0) options.push({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（${other.name}）` })
        }
      }
      if (options.length) {
        const answer = api.choice({ kind: 'target', source: '09004', seat: inv.seat, canSkip: true,
          prompt: '是否治疗同地点调查员或盟友上的 1 点伤害？', options: [{ id: 'skip', label: '不治疗' }, ...options] })
        if (answer !== 'skip') {
          const [kind, id] = String(answer).split(':')
          if (kind === 'asset') {
            // 治疗「盟友支援上的伤害」走 api.healAsset（支援实例），不能把 assetId 当座位号传给 healDamage。
            const owner = api.investigatorsAt(inv.location).find(other => (other.assets || []).some(item => item.id === id))
            const card = owner?.assets.find(item => item.id === id)
            if (owner && card) api.healAsset(card, { damage: 1, owner })
          } else {
            api.healDamage(Number(id) || inv.seat, 1)
          }
        }
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'damageHealed',
    label: '治疗后：把场外一张《术后恢复》加入被治疗调查员的手牌',
    // 卡面是「你的一张卡牌效果治愈了……」，不限定被治疗者地点；只要治疗者是本人即可。
    criteria: ({ inv, context }) => context?.cardSeat === inv.seat && Number.isInteger(context?.healedSeat),
    resolve: ({ state, inv, context, api }) => {
      const healedSeat = context.healedSeat
      const setAside = (api.investigatorTools.tskSetAside?.(inv.seat, '09006') || [])[0]
      if (!setAside) return
      // 第一步：场外 → 手牌。ownerSeat 必须是被移动卡实例的归属座位（setAside 按实例 ownerSeat 过滤）。
      const moved = api.moveCard({ code: '09006', id: setAside.id, from: 'setAside', to: 'hand', ownerSeat: inv.seat })
      if (!moved) {
        api.info('🩹 场外没有可加入手牌的《术后恢复》。')
        return
      }
      // 第二步：交给被治疗的调查员（跨座位手牌转移原语；同一座位不需要转移）。
      const targetSeat = state.investigators?.[healedSeat] ? healedSeat : inv.seat
      if (targetSeat !== inv.seat) {
        const handed = api.playerTools?.giveHandCard?.(inv.seat, targetSeat, '09006', { allowDifferentLocation: true })
        if (!handed) api.info(`🩹 未能把《术后恢复》交给调查员 ${targetSeat + 1}（目标不可用）。`)
      }
      api.info(`🩹 《术后恢复》加入 ${state.investigators[targetSeat]?.name || '该调查员'} 的手牌。`)
    },
  }],
  modifiers: [],
}
