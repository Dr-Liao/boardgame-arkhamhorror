// 06128b 如梦恐惧（theSearchForKadath）· 背面故事卡（斯凯河）
// 卡面：取消该移动的效果。
// 卡面：如果没有[[生物]]敌人在斯凯河，从遭遇牌库顶弃牌直到弃掉1个[[生物]]敌人，将其生成并与你交战。
//       否则，增加1张蜂拥卡到斯凯河的1个[[生物]]敌人。
// 卡面：将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在斯凯河的离开检定失败并翻面后调用
// assetRule.resolve（「取消移动」由引擎的离开检定失败路径完成）。
const CREATURE = 'creature'

const traitsOf = (api, code) => (api.cardTraits?.(code) || [])
  .map(trait => String(trait).toLowerCase())

export default {
  code: '06128b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api, ctx = {}) {
      const seat = Number.isInteger(ctx.inv?.seat) ? ctx.inv.seat : state.currentSeat
      const locationId = ctx.location?.id || state.investigators?.[seat]?.location || 'skaiRiver'
      // 场上的蜂拥卡不是独立敌人实体（带 swarmHostId 的实例才是），这里只找头领级敌人。
      const creatures = (state.enemies || []).filter(enemy =>
        enemy.location === locationId && enemy.swarmHostId == null
        && traitsOf(api, enemy.originalCode || enemy.code).includes(CREATURE))
      if (creatures.length) {
        const target = creatures[0]
        api.swarm?.place?.(target, 1, { source: '06128b' })
        api.info?.(`🌊 如梦恐惧：给「${target.name || target.code}」加 1 张蜂拥卡。`)
        return
      }
      // 从遭遇牌库顶弃牌，直到弃出 1 个[[生物]]敌人；弃掉的其余卡进遭遇弃牌堆（api 统一入口）。
      for (let index = 0; index < 80; index += 1) {
        const codes = api.discardEncounterTop?.(1, { reshuffle: false }) || []
        if (!codes.length) break
        const code = codes[0]
        if (api.cardType?.(code) === 'enemy' && traitsOf(api, code).includes(CREATURE)) {
          const enemy = api.spawnEngaged?.(code, locationId, seat)
          api.info?.(`🌊 如梦恐惧：遭遇牌库顶弃出「${api.cardName?.(code) || code}」${enemy ? '并与你交战' : '（生成失败）'}。`)
          return
        }
      }
      api.info?.('🌊 如梦恐惧：遭遇牌库里没有可生成的[[生物]]敌人。')
    },
  },
}
