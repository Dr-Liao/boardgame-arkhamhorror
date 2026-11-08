import fs from 'node:fs'
let src = fs.readFileSync('findings-data.mjs', 'utf8')
src = src.replace("'08629': ['v3', '[action] 花费 2 个 elder_thing 钥匙：从混乱袋移除所有 elder_thing 标记；强制-修格斯/精英敌人进入地点时击败该地点的古老者敌人', 'removeElderThingTokens'", "'08629': ['v3', '[action] 花费 2 个 elder_thing 钥匙：从混乱袋移除所有 elder_thing 标记', 'removeElderThingTokens'")
fs.writeFileSync('findings-data.mjs', src, 'utf8')
