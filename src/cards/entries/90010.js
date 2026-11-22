export default {
  code: '90010',
  abilities: [{
    kind: 'weakness', label: '债务：每轮最多支付三次，结算目标为九个资源',
    weakness: { type: 'threat', debt: true, debtPaymentLimit: 3, debtTarget: 9, resources: 0, xpPenalty: 2 },
  }],
}
