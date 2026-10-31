// 06127b 神秘生物（theSearchForKadath）· 背面故事卡（乌撒）
// 卡面：检查剧本日志。如果猫群收到了祖格鼠的贡品，阅读以下内容：……失去你所有剩余的行动并结束你的回合。
// 卡面：如果调查员强行进入神庙，阅读以下内容：……将乌撒之猫敌人生成并与你交战。
// 卡面：无论结果如何：将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06127b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api, ctx = {}) {
      const inv = ctx.inv || state.investigators?.[state.currentSeat] || null
      const locationId = ctx.location?.id || inv?.location || null
      if (api.campaignRecord?.('theCatsCollectedTheirTributeFromTheZoogs') === true && inv) {
        api.loseActions?.(inv.seat, Math.max(0, Number(inv.actionsLeft) || 0))
        api.endTurn?.(inv.seat)
        api.info?.('🐈 乌撒：猫群索要身体爱抚作为贡品——失去剩余行动并结束回合。')
      }
      if (api.campaignRecord?.('theInvestigatorsForcedTheirWayIntoTheTemple') === true && inv) {
        const spawned = api.spawnEngaged?.('06145', locationId, inv.seat)
        if (spawned) api.info?.('🐈 乌撒：猫群包围了你——乌撒之猫生成并与你交战。')
      }
    },
  },
}
