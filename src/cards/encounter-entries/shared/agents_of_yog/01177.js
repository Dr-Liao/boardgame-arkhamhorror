// 01177 伊斯观察者
// 归属：跨战役通用
// 遭遇组：agents_of_yog
// 卡面：猎物 - 手牌最少。
// 卡面：强制 - 在伊斯观测者攻击你时：从你的手中随机弃掉1张卡牌。如果你不能，伊斯观测者该次攻击造成+1伤害和+1恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 01177 / yithianObserver：攻击时随机弃 1 张手牌。

export default { code: '01177', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } }
