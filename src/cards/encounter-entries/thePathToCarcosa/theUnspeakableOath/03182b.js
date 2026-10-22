// 03182b 丹尼尔·契斯特菲尔德
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：猎物 - [combat]最高。
// 卡面：[action]如果你控制黑玛瑙扣环：谈判。你把扣环拿给丹尼尔看，他蹒跚着退后了几步，瘫倒在地一动不动。将他加入胜利区。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03182b', scope: 'enemy',
  enemyRule: { prey: 'highestCombat' },
  enemyScript: { danielPossessed: true },
}
