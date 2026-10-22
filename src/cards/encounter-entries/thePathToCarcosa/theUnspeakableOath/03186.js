// 03186 疯狂礼物
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：险境。隐私。
// 卡面：显现 - 将疯狂礼物(怜悯)秘密加入你的手牌。
// 卡面：你不能攻击[[附身]]敌人。(FAQ，v2.0)
// 卡面：[action]：从放在一边的[[怪物]]敌人中随机选择1个敌人，并将其放在场景牌库底下，不要查看内容。从你手牌中弃掉疯狂礼物(怜悯)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03186', scope: 'treachery', encounterResolveCampaigns: ['carcosa'], hiddenRule: { cannotFightTraits: ['Lunatic'] },
  encounterResolve(state, inv) { inv.hand.push('03186'); inv.hiddenCards ||= []; inv.hiddenCards.push('03186'); return true } }
