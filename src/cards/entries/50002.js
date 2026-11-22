export default {
  code: '50002',
  abilities: [{
    kind: 'played', noOpportunityAttack: true, label: '所选地点的敌人和调查员各受 3 点伤害',
    effect: { type: 'dealDamageAll', amount: 3, location: 'choice', investigators: true,
      exposeConcealed: true, fx: 'dynamite', code: '50002' },
  }],
}
