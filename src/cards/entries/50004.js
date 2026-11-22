export default {
  code: '50004',
  keepOnPlay: true,
  abilities: [{
    kind: 'played', label: '附属到当前地点，阻挡非精英敌人并改换其生成地点',
    effect: { type: 'attachBarricade', code: '50004', redirectSpawn: true },
  }],
}
