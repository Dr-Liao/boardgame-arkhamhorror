// 08558b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08558b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["coastalWaters","hedgeMaze","standingStones"], placeRevealed: true } },
}
