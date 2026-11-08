// 08089 快拔枪套
// 卡面：[free]：选择一张在你游戏区域，只占据1个手部槽位的[[枪械]]支援，将其附属到快拔枪套，
//       或与已附属的支援交换。附属的支援不占用手部槽位。(附属的支援仅限1张。)
//       [free]横置快拔枪套：执行一次已附属支援的攻击行动且无需支付其[action]费用。
//
// 读点：api.attachOrSwapControlledAsset（附属/交换，唯一读点；挂到 host.attachedToAsset）；
// api.cardAbilityOptions + api.resolveCardAbility(...,{ignoreCosts:true}) 执行附属支援的攻击能力。
//
// approximation:
//   1) 「只占 1 个手部槽位」用 trait=firearm 过滤，未再校验槽位数量（引擎无槽位查询 API）；
//   2) 附属后槽位豁免依赖引擎既有的「attachedToAsset 支援不再占用槽位」口径；
//   3) 第二能力固定取附属支援第一条含「攻击/开火/射击」的 action 能力。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08089',
  abilities: [
    { kind: 'free', label: '选择一张[[枪械]]支援附属到快拔枪套（或交换）', cost: { action: false },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const candidates = inv.assets.filter(asset => asset !== source && asset.attachedToAsset == null
          && api.cardType(asset.code) === 'asset'
          && api.cardTraits(asset.code).some(trait => String(trait).toLowerCase() === 'firearm'))
          .map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))
        if (!candidates.length) { api.info('没有可附属的[[枪械]]支援。'); return }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '08089', seat: inv.seat, prompt: '选择要附属（或交换）的[[枪械]]支援。', options: candidates,
        })
        api.attachOrSwapControlledAsset(inv.seat, source.id, picked)
      } },
    { kind: 'free', label: '横置：免费执行附属[[枪械]]的攻击行动', cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const attached = inv.assets.find(asset => asset.attachedToAsset === source.id)
        if (!attached) { api.info('快拔枪套上没有附属的[[枪械]]支援。'); return }
        const options = api.cardAbilityOptions(inv.seat, attached, { ignoreCosts: true })
        const attack = options.find(option => option.index != null && /攻击|开火|射击/.test(option.label)) || options[0]
        if (!attack) { api.info('附属支援没有可执行的攻击能力。'); return }
        api.resolveCardAbility(inv.seat, attached, { abilityIndex: attack.index, ignoreCosts: true })
      } },
  ],
  modifiers: [],
}
