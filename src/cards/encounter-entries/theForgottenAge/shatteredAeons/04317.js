// 04317 断了的线
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 如果一位手牌、牌库、弃牌堆或游戏区域内有古代遗物的调查员退场：立即推进到密谋3b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04317', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r4') } } }
