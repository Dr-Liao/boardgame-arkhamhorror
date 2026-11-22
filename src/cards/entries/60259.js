// 60259 法老卷轴（Scroll of the Pharaohs）
// 卡面：使用(4秘密)。[action] 花 1 秘密并横置：对你所在地点一位调查员或一个[[盟友]]支援造成 1 点恐惧。
// 然后若卷轴上没有秘密，弃掉它，抽 3 张牌，并在剧本日志中记录「你揭开了法老的秘密」。
// 读点：action 描述子 cost.uses+exhaust + api.horror / api.addAssetHorror；api.drawCards；api.setCampaignRecord。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60259'

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'action',
    label: '花 1 秘密并横置：对一位调查员/盟友造成 1 恐惧；用尽后弃掉、抽 3、记录秘密',
    cost: { action: true, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const targets = []
      for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned
        && item.location === inv.location)) {
        targets.push({ id: 'i:' + owner.seat, seat: owner.seat, assetId: null, label: owner.name })
        for (const asset of owner.assets || []) {
          if (allyTrait(api.cardTraits(asset.code))) {
            targets.push({ id: 'a:' + asset.id, seat: owner.seat, assetId: asset.id,
              label: api.cardName(asset.code) })
          }
        }
      }
      if (targets.length) {
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择受到 1 点恐惧的调查员或盟友。',
          options: targets.map(item => ({ id: item.id, label: item.label })),
        })
        const target = targets.find(item => item.id === id) || targets[0]
        if (target.assetId) {
          const owner = state.investigators.find(item => item.seat === target.seat)
          const asset = (owner?.assets || []).find(item => item.id === target.assetId)
          if (asset) api.addAssetHorror(asset, 1)
        } else {
          api.horror(target.seat, 1)
        }
      }
      const card = (inv.assets || []).find(asset => asset.id === source?.id)
      if (card && Number(card.uses) <= 0) {
        api.discardSelf(CODE)
        api.drawCards(inv.seat, 3)
        api.setCampaignRecord('youHaveUnearthedTheSecretsOfThePharaohs', true)
        api.info('法老卷轴用尽了：你揭开了法老的秘密（剧本日志已记录）。')
      }
    },
  }],
  modifiers: [],
}
