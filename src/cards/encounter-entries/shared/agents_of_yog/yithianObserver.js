// yithianObserver 伊斯观察者
// 归属：跨战役通用
// 遭遇组：agents_of_yog
// 卡面：攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: 'yithianObserver', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } }
