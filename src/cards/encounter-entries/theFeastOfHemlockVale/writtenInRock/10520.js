// 10520 塌方 · 诡计（writtenInRock）
// 卡面：显现 - 将塌方附属到矿车正朝向的地点。如果无法，塌方获得涌动。
// 强制 - 当矿车将移动进入附属地点：取消这次移动，并对矿车内的每位调查员与[[居民]]支援
// 各造成 2 点伤害。[action]：检定战斗或敏捷（2）。如果成功，弃掉塌方。
// 位于相邻地点的调查员可以触发此能力。
// 一张卡一个文件：显现与丢弃检定经 api.resolveScenarioEvent 交给章节 behavior 的
// events.writtenInRockCaveIn（附属）与 actions/performAction（writtenInRockCaveInTest）；
// 「取消移动」在 behavior.moveMineCartOnce 里读取地点附属。
export default {
  code: '10520',
  scope: 'treachery',
  implemented: true,
  flags: {
    caveIn: true,
    attachToFacingLocation: true,
    surgeIfCannotAttach: true,
    cancelCartMoveDamage: 2,
    discardTest: { skills: ['combat', 'agility'], difficulty: 2, nearbyTrigger: true },
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('writtenInRockCaveIn', { seat: inv?.seat }) === true
  },
  note: '近似：地点附属用 location.attachments 的轻量卡对象表示；「相邻地点可触发」由章节行动面板枚举。',
}
