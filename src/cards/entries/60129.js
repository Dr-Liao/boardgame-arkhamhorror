export default {
  code: '60129',
  abilities: [{
    kind: 'played', fast: true, label: '对同一地点的每名敌人和每位调查员造成 3 点伤害',
    effect: {
      type: 'dealDamageAll', amount: 3, location: 'choice', investigators: true,
      exposeConcealed: true, fx: 'dynamite', code: '60129',
    },
  }],
}
