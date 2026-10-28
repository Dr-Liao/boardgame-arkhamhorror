// 03094 恶灵作祟
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hauntings
// 卡面：显现 - 附属到你所在地点。
// 卡面：强制 - 在你离开附属地点后：你必须受到1点恐惧或失去1个行动。
// 卡面：[action]将你的1个线索放到附属地点：弃掉恶灵作祟。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03094', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  treacheryRule: {
    attachmentAction(state, inv, location, attachmentIndex) {
      return {
        action: 'encounterAction', rule: 'discardSpiritsTorment',
        locationId: location.id, attachmentIndex, actions: 1,
        label: '将 1 个线索放回地点，弃掉怨灵作祟',
        reason: inv.clues > 0 ? null : '需要花费 1 个线索',
      }
    },
  },
  encounterResolve(state, inv, card, api, { location }) {
    if (!location) return false
    // 附属写入走引擎原语（scenario-runtime 的 attachToLocation，落 location.attachments）。
    // 旧实现还额外写 `location.haunted = true`（布尔），但引擎的闹鬼读点只认关卡定义/授予能力，
    // 这个布尔没有任何读取方；本次一并删除，离场强制由 Carcosa 的 locationLeft 按附属判定。
    const attachment = api.attachToLocation?.(location.id, {
      id: `torment:${state.round}:${state.moveCount}:${(location.attachments || []).length}`,
      code: '03094', originalCode: '03094',
    })
    return Boolean(attachment)
  },
}
