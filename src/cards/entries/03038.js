// 03038 藏身地点
// 卡面：快速。将藏身地点附属到任意一个地点上。
// 卡面：位于被附属地点的每个非[[精英]]敌人获得冷漠。
// 卡面：强制 - 当敌军阶段结束时，如果有重整敌人在被附属地点：弃掉藏身地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03038 藏身地点：快速事件；附属到任一已揭示的地点（敌人阶段结束时有未横置敌人则弃置）。
// grantsHidingSpot：附属期间让该地点的敌人 aloof（读点在 processPlayerEnemyEntry）。

import { attachToChosenLocation } from './_shared.js'

export default {
  code: '03038',
  grantsHidingSpot: true,
  abilities: [
    {
      kind: 'played', fast: true, label: '附属到任意地点',
      resolve: ({ state, inv, api }) => {
        const attachment = attachToChosenLocation(state, inv, api, {
          code: '03038', source: 'hidingSpot', anyLocation: true,
        })
        if (!attachment) return
        // 已在场的非精英敌人也立刻获得冷漠。
        for (const enemy of state.enemies.filter(item => item.location === attachment.location && !item.elite)) {
          api.grantHidingSpotAloof(enemy)
        }
      },
    },
  ],
  modifiers: [

  ],
}
