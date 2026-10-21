// 01068 记忆抹消
// 卡面：快速。在一个阶段开始后打出。
// 卡面：选择你所在地点的一个非[[精英]]敌人。将所选敌人的印刷文本框视为如同空白(除[[特性]]外)，直到本阶段结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01068 记忆抹消

export default {
  code: '01068',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "phaseBegins",
      "label": "记忆抹消",
      "effect": {
        "type": "blankEnemy"
      }
    },
  ],
  modifiers: [

  ],
}
