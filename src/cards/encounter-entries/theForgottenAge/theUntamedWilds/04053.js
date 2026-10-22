// 04053 埃兹特里的遗迹
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：强制 - 在你调查埃兹特里的遗迹时，技能检定失败后：抽取遭遇牌库顶一张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 埃兹特里的遗迹（04053）：在此调查失败后抽取遭遇牌库顶 1 张。

export default {
  code: '04053', scope: 'location',
  locationRule: {
    afterTest({ inv, result, api }) {
      if (result.success || result.source?.label !== '调查') return
      api.drawEncounter(inv.seat)
    },
  },
}
