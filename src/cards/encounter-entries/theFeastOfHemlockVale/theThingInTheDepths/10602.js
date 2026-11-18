// 10602 攫噬触须 · 敌人 ×5（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[异形]]。[[植物]]。[[突变]]。
//   涌动。（黑夜[night]）冷漠。
//   生成 - 鳄龟混种所在地点。
//   X 为当前天数。（印刷生命值是 -2 占位，真实值 X = 当前天数。）
//
// 行为接线：behavior.spawnLocation 把生成地点改到鳄龟混种所在地点；
// behavior.enemyStatModifier('health') 让健康值等于当前天数；
// behavior.enemySpawned 按昼夜刷新冷漠（引擎匹配器在昼夜上是 duringPeriod，但 aloof 是实例布尔字段）。
export default {
  code: '10602',
  scope: 'enemy',
  implemented: true,
  flags: {
    quantity: 5, traits: ['Abomination', 'Flora', 'Mutated'],
    surge: true, aloofAtNight: true, spawnAtChelydranHybrid: true, healthEqualsDayNumber: true,
  },
  note: '数据型敌人条目（规则在 behavior）；「生成 - 鳄龟混种所在地点」与逐日健康值均由 behavior 读点注入。',
}
