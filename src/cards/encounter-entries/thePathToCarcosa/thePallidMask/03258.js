// 03258 地下墓穴讲师
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：生成 - 最近的未揭示地点。
// 卡面：[action]：谈判。检定[intellect](4)以解读这位导师的疯话。如果你检定成功，查看场上任意一个地下墓穴地点的已揭示面。(FAQ，v1.3)(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
// 谈判是引擎的通用 Parley 原语（src/engine/parley.js）：条目声明 actionKind:'parley' 的
// action 描述子；「团队每场游戏仅限一次」由 criteria 读 scenarioFlags（与旧实现同一标记）。

import { chooseEntryOption, entryDistance } from '../../_shared.js'

export default {
  code: '03258', scope: 'enemy', implemented: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      label: '谈判地下墓穴讲师（智识 4）：查看一处地下墓穴地点的揭示面',
      cost: { action: 1 },
      criteria: ({ state }) => !state.scenarioFlags?.catacombsLecturerUsed,
      resolve: ({ state, inv, api }) => {
        // 卡面「团队每场游戏仅限一次」：旧实现是在行动开始时置位（失败也算用掉）。
        api.setScenarioFlag('catacombsLecturerUsed', true)
        api.test(inv.seat, 'intellect', 4, {
          source: { type: 'scenario', action: 'parley', name: '谈判', code: '03258', ability: true },
          resolve: result => {
            if (!result.success) return
            const locations = state.locations.filter(location =>
              String(location.originalCode || '').startsWith('0324') && !location.revealed)
            const location = chooseEntryOption(api, {
              kind: 'location', source: '03258', seat: inv.seat,
              prompt: '选择查看一处地下墓穴地点的揭示面。',
            }, locations)
            if (!location) return
            api.privateInfo(inv.seat,
              `地下墓穴讲师：你查看了「${location.name}」（${location.originalCode}）的揭示面：`
              + `帷幕 ${(location.shroud || 0) + (location.shroudMod || 0)}，线索 ${location.clues || 0}`
              + `，连接 ${(location.connections || []).map(id => state.locations.find(item => item.id === id)?.name || id).join('、') || '无'}。`)
          },
        })
      },
    },
  ],
  enemyScript: {
    onSpawnLocation(state, code, fallback, seat, api) {
      const origin = state.investigators[seat]?.location || fallback
      const unrevealed = state.locations.filter(location => !location.revealed)
      if (!unrevealed.length) return null
      const nearest = Math.min(...unrevealed.map(location => entryDistance(state, origin, location.id)))
      return chooseEntryOption(api, {
        kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择最近的未揭示地点生成地下墓穴讲师。',
      }, unrevealed.filter(location => entryDistance(state, origin, location.id) === nearest))?.id || null
    },
  },
}
