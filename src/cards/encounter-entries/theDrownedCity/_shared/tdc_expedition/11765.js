// 11765 露比·斯坦迪什 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11765，原文见该卡 textZh）：
//   你得到+1[agility]。
//   [fast]如果你所在地点没有处于重整状态的敌人，横置露比·斯坦迪什：移动到一处连接地点。
//
// 读点（声明即接线）：
//   · 「你得到 +1 敏捷」= modifiers 的 { target: 'skill:agility', amount: 1 }；
//   · 「[fast] 如果你所在地点没有处于重整状态的敌人，横置：移动到一处连接地点」= 0 行动能力（cost.action:false）+ cost { exhaust: true }，criteria 判定同地点无重整敌人，移动走 api.moveInvestigator。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。

const destinationOf = (state, fromId) => ((state.locations || []).find(item => item.id === fromId)?.connections || [])
  .filter(id => (state.locations || []).some(item => item.id === id))

const CODE = '11765'

export default {
  code: CODE,
  name: '露比·斯坦迪什',
  scope: 'storyAsset',
  implemented: true,
  flags: { expedition: true, traits: ['Ally', 'Criminal'], slots: ['ally'], unique: true },
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[fast] 横置：移动到一处连接地点',
    cost: { action: false, exhaust: true },
    criteria: ({ state, inv }) => (state.enemies || []).every(enemy => enemy.location !== inv.location || enemy.exhausted)
      && destinationOf(state, inv.location).length > 0,
    resolve: ({ state, inv, api }) => {
      const destinations = destinationOf(state, inv.location)
      const id = destinations.length === 1 ? destinations[0] : api.choice({
        kind: 'location', source: CODE, seat: inv.seat,
        prompt: '「露比·斯坦迪什」：选择要移动到的连接地点。',
        options: destinations.map(locationId => ({ id: locationId, label: api.locName(locationId) })),
      })
      if (!id) return
      api.moveInvestigator(inv.seat, id)
      api.info('🏃 ' + inv.name + ' 移动到 ' + api.locName(id) + '（「露比·斯坦迪什」）。')
    },
  }],
  note: '[fast] 移动写成 0 行动能力（cost.action:false，不引发借机攻击）；印刷的「没有处于重整状态的敌人」'
    + '与「一处连接地点」都已接线（criteria + api.moveInvestigator）。',
}
