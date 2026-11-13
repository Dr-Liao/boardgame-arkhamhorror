// 09690 拟态克星（Mimetic Nemesis）／异界镇压者 · enemy
//
// 归属：关卡专用 · theScarletKeys/withoutATrace（P7）。
// 卡面（中）：警戒。猎手。庞大。反击。
//   强制 - 在你将要对本敌人造成伤害时，改为选择并弃掉相同数量的放在一边的空洞。
//   强制 - 当一轮结束时：本敌人所在地点的每位调查员必须选择自己手中一张非弱点卡牌，
//   将其放在一边，作为一个空洞；或本敌人攻击自己。
//
// 读点（本章 `behavior.js`，规则只在章节实现一次）：
//   · enemyRule.insteadOfDamageHollows → behavior.enemyDamageAmount（伤害改为弃掉等量空洞，返回 0）
//   · enemyRule.roundEndHollowOrAttack → behavior.roundEnded（轮末本地调查员空洞化一张手牌或被攻击）
// 印刷关键词（警戒/猎手/庞大/反击）由 `card-data.js#encounterDefinitions` 从卡文解析，条目不再抄一遍；
// 「无生命值」由卡表 `health: null` 表达（伤害仍累积，但不会因伤害达到生命值被击败）。
export default {
  code: '09690',
  name: '拟态克星',
  scope: 'enemy',
  implemented: true,
  note: 'approximation: 弃掉空洞按空洞区顺序取前 N 张（官方由玩家逐张选择）；'
    + '「无生命值」走卡表 health:null，伤害不会把它击败，所以弃空洞是唯一的减伤路径。',
  enemyRule: {
    insteadOfDamageHollows: true,
    roundEndHollowOrAttack: true,
  },
}
