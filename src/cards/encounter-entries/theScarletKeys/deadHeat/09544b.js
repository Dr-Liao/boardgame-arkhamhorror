// 09544b 末绽之花（动荡面）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：变换 - 治愈场上每个敌人 1 点伤害。然后，若由调查员变换此密钥，将其翻到其[[稳定]]面。
//
// 一张卡一个文件：物理卡与稳定面同一个密钥实体（id 09544）；behavior.shiftLastBlossom 读取
// keyCard / keyId / face / shiftEffect，经 shiftKey 原语翻面并结算治疗。
export default {
  code: '09544b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    keyCard: true,
    keyId: '09544',
    face: 'unstable',
    stableFaceCode: '09544a',
    shiftEffect: 'healAllEnemies',
    shiftEffects: { healDamage: 1, scope: 'allEnemies', flipIfInvestigatorShifted: true },
  },
  note: '近似：动荡面的「若由调查员变换则翻回稳定面」在统一翻面后不再二次处理；敌人强制变换与调查员变换都各翻面一次。',
}
