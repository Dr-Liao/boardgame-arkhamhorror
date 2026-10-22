// 01166 远古恶魔
// 归属：跨战役通用
// 遭遇组：ancient_evils
// 卡面：显现 - 在当前密谋上放置1个毁灭标记。本效果可以导致当前密谋推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01166', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.addDoom(1)
    api.info?.('🕯️ 远古恶魔：在当前密谋上放置 1 点毁灭。')
    return false
  },
}
