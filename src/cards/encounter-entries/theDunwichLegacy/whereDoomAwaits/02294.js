// 02294 钥之虔信徒
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：生成 - 山脚。
// 卡面：强制 - 当敌军阶段结束时，钥之虔信徒朝哨兵峰移动一次。如果钥之虔信徒已经在哨兵峰，改为将其弃掉并在当前密谋上增加2个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02294', scope: 'enemy', enemyRule: { alteredHerald: true },
  enemySpawnRule: { spawnMode: 'original', spawnFrom: '02282' },
}
