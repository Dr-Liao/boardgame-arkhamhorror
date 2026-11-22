export default {
  code: '60502',
  abilities: [{
    kind: 'commit',
    label: '本次检定失败时：取消这次失败的所有结算效果',
    skill: { cancelFailureEffects: true },
  }],
}
