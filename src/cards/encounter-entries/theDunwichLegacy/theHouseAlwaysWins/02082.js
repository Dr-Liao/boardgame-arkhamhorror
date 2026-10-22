// 02082 引起怀疑
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：显现 - 在你所在地点的每个[[罪犯]]敌人上放置1个毁灭标记。如果未因本效果放置毁灭标记，失去2资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02082', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const criminals = state.enemies.filter(enemy => enemy.location === inv.location && enemy.traits?.includes('Criminal'))
    if (criminals.length) for (const enemy of criminals) enemy.doom = (enemy.doom || 0) + 1
    else inv.resources = Math.max(0, inv.resources - 2)
    return false
  },
}
