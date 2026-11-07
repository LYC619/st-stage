import type { EmojiItem, PhotoItem } from './types'
export { DEFAULT_PLAYER_AVATAR, DEFAULT_CONTACT_AVATAR } from './avatars-data'

export const SISTER_LOCATIONS: Record<string, string> = {
  TOILET: '厕所，妹妹正在上厕所',
  SCHOOL: '妹妹正在学校上课',
  LIVING_ROOM: '客厅，妹妹正在和玩家待在一起，会吐槽为什么还用微信发消息',
  SISTER_ROOM: '妹妹正在自己的卧室',
}

export const PLAYER_LOCATIONS: Record<string, string> = {
  LIVING_ROOM: '玩家此时在客厅',
  COMPANY: '玩家此时在公司',
}

export const PLAYER_EMOJIS: Record<string, EmojiItem> = {
  simper: { id: 'simper', name: '傻笑', description: '傻笑的熊猫头表情包，代表搞怪，沙雕的傻笑。', file: 'emojies/player/simper.png' },
  angry: { id: 'angry', name: '生气', description: '熊猫头愤怒表情，代表有点搞怪的生气含义。', file: 'emojies/player/angry.png' },
  dislike: { id: 'dislike', name: '嫌弃', description: '捏着鼻子的熊猫头龙图，代表有点搞怪的嫌弃含义。', file: 'emojies/player/dislike.png' },
  a_sexy_pic: { id: 'a_sexy_pic', name: '来张涩图', description: '二次元美少女在说“来一份色图”的表情包，代表“给我发张色图”的含义。', file: 'emojies/player/a_sexy_pic.png' },
  embrace_arm: { id: 'embrace_arm', name: '抱胸', description: '双手抱胸的熊猫头龙图，代表有点搞怪的“抱臂旁观、冷眼看戏、略带嘲讽地看你表演”的含义。', file: 'emojies/player/embrace_arm.png' },
  point: { id: 'point', name: '指', description: '拿手指着的熊猫头龙图，代表有点搞怪的“点名你、看穿你、调侃你，带一点警告和揶揄”的含义。', file: 'emojies/player/point.png' },
  frown: { id: 'frown', name: '皱眉', description: '双手抱胸，皱着眉头的熊猫头表情包，代表有点搞怪的怀疑态度。', file: 'emojies/player/frown.png' },
  grin: { id: 'grin', name: '坏笑', description: '一个动漫玩偶的傻笑表情包，代表有点意味深长，坏笑的含义。', file: 'emojies/player/grin.png' },
  happy: { id: 'happy', name: '高兴', description: '黄色橘猫的笑脸，代表有点搞怪的开心含义。', file: 'emojies/player/happy.png' },
  huge: { id: 'huge', name: '惊鸿一瞥', description: '虎哥的惊鸿一瞥表情包，代表有点搞怪的“注视着你”含义。', file: 'emojies/player/huge.png' },
  laugh: { id: 'laugh', name: '乐', description: '黄豆爆笑的表情包，代表着幸灾乐祸的爆笑。', file: 'emojies/player/laugh.png' },
  laugh2: { id: 'laugh2', name: '乐2', description: '憋笑的熊猫头龙图，代表着幸灾乐祸的憋不住笑了。', file: 'emojies/player/laugh2.png' },
  lusful: { id: 'lusful', name: '色', description: '猫和老鼠中汤姆的夸张颜艺表情包，代表着看见色图时露出的好色表情。', file: 'emojies/player/lusful.png' },
  cry: { id: 'cry', name: '哭', description: '熊猫头捂嘴哭表情包，代表着有点搞怪，沙雕的哭。', file: 'emojies/player/cry.png' },
  shock: { id: 'shock', name: '惊讶', description: '黄色橘猫惊讶的表情，表示有点搞怪的惊讶。', file: 'emojies/player/shock.png' },
}

export const CONTACT_EMOJIS: Record<string, EmojiItem> = {
  angry: { id: 'angry', name: '生气', description: '妹妹Q版形象的生气表情，代表有点赌气含义。', file: 'emojies/sister/angry.png' },
  confuseed: { id: 'confuseed', name: '疑惑', description: '妹妹Q版形象的疑惑表情。', file: 'emojies/sister/confused.png' },
  frown: { id: 'frown', name: '皱眉', description: '双手抱胸，皱着眉头的熊猫头表情包，代表有点搞怪的怀疑态度。', file: 'emojies/sister/frown.png' },
  furious: { id: 'furious', name: '愤怒', description: '妹妹Q版形象的愤怒表情，代表有点萌的愤怒含义。', file: 'emojies/sister/furious.png' },
  gloomy: { id: 'gloomy', name: '阴沉', description: '妹妹Q版形象的阴沉表情，代表有点心情不好的含义。', file: 'emojies/sister/gloomy.png' },
  great: { id: 'great', name: '伟大', description: '小猫激动地张开双臂，下面写着“伟大”的表情包，代表有点搞怪的感激态度。', file: 'emojies/sister/great.png' },
  grin: { id: 'grin', name: '坏笑', description: '玩偶奇怪笑容的表情包，代表有点搞怪的，不怀好意的坏笑。', file: 'emojies/sister/grin.png' },
  happy: { id: 'happy', name: '高兴', description: '妹妹Q版形象的高兴表情，代表有心情好。', file: 'emojies/sister/happy.png' },
  laugh: { id: 'laugh', name: '大笑', description: '黄豆表情大笑的表情包，代表幸灾乐祸的嘲笑态度。', file: 'emojies/sister/laugh.png' },
  look: { id: 'look', name: '看', description: '萌系人物意味深长看着的表情，代表讨好的态度，可用于要好处的后面。', file: 'emojies/sister/look.png' },
  omg: { id: 'omg', name: 'omg', description: '萌系人物夸张的表情，代表“我的天”的意思。', file: 'emojies/sister/omg.png' },
  shy: { id: 'shy', name: '害羞', description: '妹妹Q版形象害羞的表情。', file: 'emojies/sister/shy.png' },
  simper: { id: 'simper', name: '傻笑', description: '傻笑的熊猫头表情包，代表搞怪，沙雕的傻笑。', file: 'emojies/sister/simper.png' },
  smile: { id: 'smile', name: '微笑', description: '妹妹Q版形象微笑的表情。', file: 'emojies/sister/smile.png' },
  speechless: { id: 'speechless', name: '无语', description: '妹妹Q版形象无语的表情。', file: 'emojies/sister/speechless.png' },
  surprise: { id: 'surprise', name: '惊讶', description: '妹妹Q版形象惊讶的表情。', file: 'emojies/sister/surprise.png' },
  wronged: { id: 'wronged', name: '委屈', description: '妹妹Q版形象委屈的表情。', file: 'emojies/sister/wronged.png' },
  surprise_cat: { id: 'surprise_cat', name: '惊讶猫1', description: '小猫夸张的表情，代表有点搞怪的惊讶含义。', file: 'emojies/sister/surprise_cat.png' },
  surprise_cat_2: { id: 'surprise_cat_2', name: '惊讶猫2', description: '一只橘猫夸张的表情，代表有点搞怪的惊讶含义。', file: 'emojies/sister/surprise_cat_2.png' },
}

export const CONTACT_PHOTOS: Record<string, PhotoItem> = {
  bedroom1: { id: 'bedroom1', name: '卧室自拍1', description: '妹妹在卧室的自拍：撩起卫衣，露出内衣，表情害羞', file: 'photos/bedroom1.png' },
  bedroom2: { id: 'bedroom2', name: '卧室自拍2', description: '妹妹在卧室的自拍：撩起卫衣和内衣，用手遮住胸部，表情平静', file: 'photos/bedroom2.png' },
  bedroom3: { id: 'bedroom3', name: '卧室自拍3', description: '妹妹在卧室的自拍：上半身裸体，露出胸部，一只手比着“耶”，坏笑表情', file: 'photos/bedroom3.png' },
  bedroom4: { id: 'bedroom4', name: '卧室自拍4', description: '妹妹在卧室的自拍：脱掉长裤，露出内裤', file: 'photos/bedroom4.png' },
  bedroom5: { id: 'bedroom5', name: '卧室自拍5', description: '妹妹在卧室的自拍：脱掉长裤和内裤，用手遮住小穴', file: 'photos/bedroom5.png' },
  bedroom6: { id: 'bedroom6', name: '卧室自拍6', description: '妹妹在卧室的自拍：脱掉长裤和内裤，用衣服拉链挡住了一部分小穴', file: 'photos/bedroom6.png' },
  bedroom7: { id: 'bedroom7', name: '卧室自拍7', description: '妹妹在卧室的自拍：脱掉长裤和内裤，主动分开小穴', file: 'photos/bedroom7.png' },
  pee1: { id: 'pee1', name: '上厕所自拍1', description: '尿尿时的俯视自拍', file: 'photos/pee1.png' },
  pee2: { id: 'pee2', name: '上厕所自拍2', description: '尿尿时正对小穴的自拍', file: 'photos/pee2.png' },
}

export const FALLBACK_DIALOGUES = {
  keywords: [
    { pattern: '爱你|喜欢', branches: [ { min_mood: 50, reply: '我也爱你，哥哥~' }, { min_mood: 20, reply: '哥哥真好~' }, { min_mood: 0, reply: '嗯...' } ] },
    { pattern: '吃', branches: [ { min_mood: 30, reply: '我想吃你做的菜~' }, { min_mood: 0, reply: '我还没想好呢，要不你给我带点？' } ] },
    { pattern: '在吗', reply: '有事说事' },
    { pattern: '回来带杯可乐|可乐', reply: '打钱' },
    { pattern: '想你', branches: [ { min_mood: 40, reply: '我也想你...♡' }, { min_mood: 0, reply: '嗯，我也是。' } ] },
    { pattern: '照片|涩图|看', reply: 'photo:bedroom1' },
  ],
  default_text: '嗯嗯，知道了。',
  red_packet_reply: '谢谢老板，老板大气！',
}
