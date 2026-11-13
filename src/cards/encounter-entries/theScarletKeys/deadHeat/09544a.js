// 09544a 末绽之花（稳定面）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：变换 - 治愈你所在地点每位调查员各 1 点伤害和 1 点恐惧。将此密钥翻到其[[动荡]]面。
//
// 一张卡一个文件：密钥实体由 P2 原语 campaign.tsk.keys 记账（稳定面 09544a / 动荡面 09544b）；
// 本条目声明物理卡身份、稳定面与 Shift 文本数据。behavior.shiftLastBlossom 读取
// keyCard / keyId / face / shiftEffect，经 shiftKey 原语翻面并结算治疗。
export default {
  code: '09544a',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    keyCard: true,
    keyId: '09544',
    face: 'stable',
    unstableFaceCode: '09544b',
    shiftEffect: 'healInvestigatorsAtBearerLocation',
    shiftEffects: { healDamage: 1, healHorror: 1, scope: 'bearerLocationInvestigators' },
  },
  note: '近似：持有者不是调查员时稳定面无治疗效果；玩家经 P4 交互发起的 Shift 目前不会自动结算 Shift 文本（见 primitive-requests/09544a.json）。',
}
