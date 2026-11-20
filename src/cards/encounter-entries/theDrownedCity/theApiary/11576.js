// 11576 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第二轮「地点附属离开检定」原语：附属于地点的遭遇卡声明 treacheryRule.onLeave 后，
// 引擎在离开宿主地点时开多技能检定窗口（读点 src/engine/movement.js#moveAfterCosts）；
// 结算后按声明弃置附属（discardOnResolve），移动不取消（cancelOnFail:false）。
export default {
  code: '11576',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    onLeave: {
      test: { skills: ['agility', 'combat'], difficulty: 4 },
      cancelOnFail: false,
      discardOnResolve: true,
      onFail(state, location, api, inv, { skill } = {}) {
        // 战力：受到 2 点直接伤害。
        if (String(skill) === 'combat') {
          api.directDamage(inv.seat, 2)
          return
        }
        // 敏捷：弃掉你控制的一张支援，然后受到 1 点伤害（让玩家选择具体支援）。
        const assets = [...(inv.assets || [])]
        const picked = assets.length > 1 && typeof api.choice === 'function'
          ? api.choice({
            kind: 'asset', source: '11576', seat: inv.seat, prompt: '选择要弃掉的一张支援。',
            options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
          })
          : assets[0]?.id
        const asset = assets.find(item => item.id === picked) || assets[0]
        if (asset) api.discardAsset(inv.seat, asset.id)
        api.damage(inv.seat, 1)
      },
    },
  },
  note: "印刷：显现 - 将本卡牌附属到你所在地点。强制 - 你离开附属地点时：检定敏捷(4) 或战力(4)。如果你失败且检定了敏捷：弃掉你控制的一张支援并受到 1 点伤害。如果你失败且检定了战力：受到 2 点直接伤害。弃掉饥饿的墙壁。已接线：treacheryRule.onLeave（引擎 movement.js 离开宿主地点窗口：requestChoice 选技能 → 检定 → 失败结算 → 弃置附属；移动不取消）；敏捷分支「弃掉你控制的一张支援」经 onLeave.onFail 的 api.choice 让玩家选择具体支援后弃置。成功后无惩罚、诡计仍按 discardOnResolve 弃置（与印刷一致）。卡面其余文本（附属到地点）由显现流程 / 章节 attachEncounterToLocation 读取，本条目只声明离场规则。全部子句已接线。",
  abilities: [],
}
