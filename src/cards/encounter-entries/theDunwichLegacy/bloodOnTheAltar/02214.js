// 02214 隐藏密室
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：显现 - 将隐藏密室放置入场。
// 卡面：隐藏密室与其抽取的地点相互连接。
// 卡面：通往隐藏密室的门锁住了。你不能进入隐藏密室，除非密室的钥匙附属于隐藏密室。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 78 轮：血祭地窖底下翻出的密室与钥匙。

import { scenarioLocationId } from '../../_shared.js'

export default {
  code: '02214', scope: 'location',
  onFound(state, inv, api, { sourceLocation }) {
    const chamberId = scenarioLocationId(state, '02214') || 'location02214'
    api.place(chamberId)
    const chamber = state.locations.find(loc => loc.id === chamberId)
    if (!chamber) return
    if (sourceLocation && !sourceLocation.connections.includes(chamber.id)) sourceLocation.connections.push(chamber.id)
    if (sourceLocation && !chamber.connections.includes(sourceLocation.id)) chamber.connections.push(sourceLocation.id)
  },
}
