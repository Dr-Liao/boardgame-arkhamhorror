// 10544 紧锢孽种 / Grappling Spawn · 敌人（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse（2 份，进遭遇牌库）。
// 卡面：Hunter.（Night）Retaliate.；「+X 生命，X 为其当前楼层（最少 +1）」。
// 读点：behavior.enemySpawned 按昼/夜设置 retaliate；behavior.enemyStatModifier 返回 health 修正。

export default {
  "code": "10544",
  "scope": "enemy",
  "implemented": true,
  "flags": {
    "grapplingSpawn": true,
    "hunter": true,
    "nightRetaliate": true,
    "floorHealthBonus": true,
    "floorHealthMinimum": 1
  },
  "note": "近似：卡面是「(Night) Retaliate」——由 enemySpawned 按当时昼/夜写实例 retaliate；本关没有昼/夜切换，生成后不再改。"
}
