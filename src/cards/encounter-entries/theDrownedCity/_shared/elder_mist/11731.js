// 11731 古老迷雾（Elder Mist）· 诡计 · 共享遭遇组 elder_mist（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/elder_mist。
// 卡面（cards-data 11731）：
//   显现 - 将古老迷雾附属到最近的一处未附属古老迷雾地点。
//   附属地点的每位调查员[willpower]-1、[intellect]-1、[combat]-1和[agility]-1。
//   强制 - 附属地点的一位调查员成功超过难度至少2点后：弃掉古老迷雾。
//
// 读点（声明即接线）：
//   · 附属 = api.attachToLocation（location-attachments.js 的唯一写入口），目标用
//     api.mechanics.map.nearest（map-graph 的并列最近地点查询）；
//   · 「附属地点的调查员成功超过难度至少 2 点后」= testEnds 窗口（tests.js#closeTest，
//     context 带 seat/result；非玩家实体来源同样派出）+ 位置比对 + result.successBy ≥ 2；
//   · 弃掉 = api.scenario.detachLocationAttachment（地点附属的唯一移除写入口）。
//
// 近似：技能 -1 没有「地点附属给同地点调查员技能修正」的引擎读点（modifiers 只枚举调查员
//   自己的支援/威胁区与敌人/地点实体数值），因此 -1 部分只落 flags 数据，已在
//   artifacts/migration/tdc/p7/primitive-requests/shared-2.json 登记 pending 原语请求；
//   附属与「成功 2 点后弃掉」两条照常生效。
const CODE = '11731'

const attachedLocation = state => (state?.locations || []).find(location =>
  (location.attachments || []).some(item => (item.originalCode || item.code) === CODE)) || null

export default {
  code: CODE,
  name: '古老迷雾',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    quantity: 2,
    locationAttachment: true,
    attachedSkillModifiers: { willpower: -1, intellect: -1, combat: -1, agility: -1 },
    discardOnSuccessBy: 2,
  },
  // 第二轮：Lead 落地「地点附属 modifiers 对同地点调查员生效」读点
  // （src/engine/modifiers.js#modifierSourceRows 的 locationAttachment 行）。
  // audience:'here' 让同地点所有调查员命中（不只 controller）；条目仍由 api.attachToLocation 写附属。
  modifiers: [
    { target: 'skill:willpower', amount: -1, audience: 'here' },
    { target: 'skill:intellect', amount: -1, audience: 'here' },
    { target: 'skill:combat', amount: -1, audience: 'here' },
    { target: 'skill:agility', amount: -1, audience: 'here' },
  ],
  encounterResolve(state, inv, card, api) {
    const eligible = (state.locations || [])
      .filter(location => !(location.attachments || []).some(item => (item.originalCode || item.code) === CODE))
      .map(location => location.id)
    if (!eligible.length) return false
    const nearest = api.mechanics?.map?.nearest?.(inv.location, eligible) || []
    if (!nearest.length) return false
    const chosen = nearest.length === 1 ? nearest[0] : (api.choice({
      kind: 'location', source: CODE, seat: inv.seat,
      prompt: '「古老迷雾」：选择最近的一处未附属地点（并列）。',
      options: nearest.map(id => ({ id, label: api.locName?.(id) || id })),
    }) || nearest[0])
    api.attachToLocation(chosen, { code: CODE, originalCode: CODE, id: `${CODE}:${chosen}` })
    api.info?.(`🌫️ 「古老迷雾」附属到「${api.locName?.(chosen) || chosen}」。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced',
    trigger: 'testEnds',
    silent: true,
    label: '附属地点调查员成功超过难度至少 2 点后：弃掉古老迷雾',
    criteria: ({ state, context }) => {
      const location = attachedLocation(state)
      if (!location) return false
      const inv = state.investigators?.[context?.seat]
      if (!inv || inv.location !== location.id) return false
      const result = context?.result
      if (!result?.success) return false
      return Number(result.successBy) >= 2
    },
    resolve: ({ state, api }) => {
      const location = attachedLocation(state)
      if (!location) return false
      const attachment = (location.attachments || []).find(item => (item.originalCode || item.code) === CODE)
      if (!attachment) return false
      api.scenario?.detachLocationAttachment?.(location.id, attachment.id)
      api.info?.(`🌫️ 「古老迷雾」：附属地点的调查员成功超过难度至少 2 点，弃掉本卡。`)
    },
  }],
  note: '附属位置走 api.mechanics.map.nearest + api.attachToLocation；「成功超过 2 点后弃掉」走 testEnds '
    + '窗口（result.successBy）与地点附属移除写点。'
    + '「附属地点每位调查员 willpower/intellect/combat/agility -1」由条目 modifiers 声明：'
    + '读点 src/engine/modifiers.js#modifierSourceRows 的 locationAttachment 行（第二轮 Lead 落地），'
    + 'audience:\'here\' 对同地点所有调查员生效；附属离场后修正随之消失（无新状态字段）。',
}
