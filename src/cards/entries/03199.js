// 03199 诱捕陷阱
// 卡面：附属到你所在地点。每个地点仅限1张。
// 卡面：强制 - 在一个非[[精英]]敌人进入被附属地点后：横置该敌人，它与所有调查员解除交战，并将诱捕陷阱附属到它上。
// 卡面：强制 - 在被附属敌人将要重整时：改为弃掉诱捕陷阱。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03199 诱捕陷阱：附属到所在地点。

import { attachToChosenLocation } from './_shared.js'

export default {
  code: '03199',
  abilities: [
    {
      kind: 'played', label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03199', source: 'snareTrap' }),
    },
  ],
  snareAttachment: true,
  modifiers: [

  ],
}
