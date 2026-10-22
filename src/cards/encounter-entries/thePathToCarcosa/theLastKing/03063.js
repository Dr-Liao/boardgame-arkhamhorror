// 03063 可怕的真相
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：强制 - 在本密谋将因达到毁灭阈值而推进时：改为移除场上所有毁灭标记，并结算冒险参考卡牌底下的随机一张令人作呕的现实卡牌。如果冒险参考卡牌底下没有卡牌，改为推进到密谋2b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03063', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r3') } } }
