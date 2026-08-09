/** 轻量内置预设：只保存远程直链，不再随仓库分发图片文件。 */

import type { SpritePack } from './types'

type RemoteSpriteDef = readonly [tag: string, url: string]

interface PresetDef {
  id: string
  name: string
  description: string
  roleName: string
  outfit: string
  promptNote: string
  sprites: readonly RemoteSpriteDef[]
}

const CASUAL: readonly RemoteSpriteDef[] = [
  ['中性', 'https://i.ibb.co/xq4cf5cL/3dd68e58257c.webp'],
  ['关怀', 'https://i.ibb.co/zhxnSVDC/a649145f4804.webp'],
  ['感激', 'https://i.ibb.co/BHCvK9FK/f2a89a044460.webp'],
  ['喜悦', 'https://i.ibb.co/v6ZQ675V/da65a3d6f363.webp'],
  ['释然', 'https://i.ibb.co/5h6nTHr9/2e8dedc8c995.webp'],
  ['爱慕', 'https://i.ibb.co/0VBkYJS8/84cf5eacdcb6.webp'],
  ['悲伤', 'https://i.ibb.co/67brywRx/f4026cce61a5.webp'],
  ['害怕', 'https://i.ibb.co/svTgVcqT/24b9ec4fe0f8.webp'],
  ['困惑', 'https://i.ibb.co/PsLKDkVz/74e88f58013c.webp'],
  ['惊讶', 'https://i.ibb.co/8Djg9L3T/804de98cf50d.webp'],
  ['失望', 'https://i.ibb.co/ps3dq2r/331d09bc4bb5.webp'],
  ['领悟', 'https://i.ibb.co/fGqpR9wZ/90ae3698d869.webp'],
  ['逗乐', 'https://i.ibb.co/xqwJSBH1/acd0e14a6003.webp'],
  ['愤怒', 'https://i.ibb.co/Z4qKB6L/fd9668f6ceb7.webp'],
  ['好奇', 'https://i.ibb.co/wTFM3zG/cb05a7f6daec.webp'],
  ['期许', 'https://i.ibb.co/xKkHbDG1/247fdc8430fb.webp'],
  ['懊悔', 'https://i.ibb.co/DHgcqX50/0439ea39b11e.webp'],
  ['翻白眼吐舌', 'https://i.ibb.co/Dgs304F4/801e25cfe603.webp'],
]

const SHADOW: readonly RemoteSpriteDef[] = [
  ['爱慕', 'https://i.ibb.co/60pF1rrf/adbb1bd58d94.webp'],
  ['懊悔', 'https://i.ibb.co/TM4D64jN/8766ffda8f10.webp'],
  ['悲伤', 'https://i.ibb.co/ksCBgD1S/d547c9ec2684.webp'],
  ['逗乐', 'https://i.ibb.co/S4Fg4ZHP/b8dac8fb2dc4.webp'],
  ['愤怒', 'https://i.ibb.co/kgQY0dmZ/1d8b20b34a9c.webp'],
  ['感激', 'https://i.ibb.co/spj7cm0B/803c75db520f.webp'],
  ['关怀', 'https://i.ibb.co/MyW7mC51/805c6e6f2fda.webp'],
  ['害怕', 'https://i.ibb.co/NgH8zHKY/ad70f87dbe3a.webp'],
  ['好奇', 'https://i.ibb.co/PZZcZGT2/01878109e17e.webp'],
  ['惊讶', 'https://i.ibb.co/G47GR2Xn/0b6612046f08.webp'],
  ['困惑', 'https://i.ibb.co/MkrpPrX2/6bcaa9e1864e.webp'],
  ['领悟', 'https://i.ibb.co/B5rT02yj/92259638b108.webp'],
  ['期许', 'https://i.ibb.co/Ts3Ndt0/5c84cae66be6.webp'],
  ['失望', 'https://i.ibb.co/VcRDvnJZ/fa1338ba2d5b.webp'],
  ['释然', 'https://i.ibb.co/8ntLvxkC/e2cbd128cf32.webp'],
  ['妩媚', 'https://i.ibb.co/W42FK6ck/2da7682a5aca.webp'],
  ['喜悦', 'https://i.ibb.co/RZpHBGw/d196fad4ebd9.webp'],
  ['月光透视', 'https://i.ibb.co/Y4GNnH1g/c71429c95fb1.webp'],
  ['中性', 'https://i.ibb.co/Vc0rcqS3/e9572425090f.webp'],
]

const HEALING: readonly RemoteSpriteDef[] = [
  ['爱慕', 'https://i.ibb.co/Kz0qqXwy/943e80b09794.webp'],
  ['懊悔', 'https://i.ibb.co/ynDm48B2/d0455c0f8d56.webp'],
  ['悲伤', 'https://i.ibb.co/Cs1CJ9Jx/db1bc0f21b91.webp'],
  ['逗乐', 'https://i.ibb.co/xqhBPr9f/e17c1185bfe6.webp'],
  ['愤怒', 'https://i.ibb.co/d0Sv6wpv/585dae5c1cdc.webp'],
  ['感激', 'https://i.ibb.co/xW92rH4/0010903b4cc1.webp'],
  ['关怀', 'https://i.ibb.co/PsR6Q63Z/bb10d8ab6dd7.webp'],
  ['害怕', 'https://i.ibb.co/xtzGDZNX/347987abde75.webp'],
  ['好奇', 'https://i.ibb.co/bRrSvX2b/79f774151ac6.webp'],
  ['惊讶', 'https://i.ibb.co/b5YJS5h8/1c4feec0e58d.webp'],
  ['困惑', 'https://i.ibb.co/PvDLR31C/921b9266d04a.webp'],
  ['领悟', 'https://i.ibb.co/KpgfW9GX/d35fcbb4fc71.webp'],
  ['期许', 'https://i.ibb.co/chyS8pMV/85153d9f7564.webp'],
  ['失望', 'https://i.ibb.co/gbgDpg9c/81d8a3d4502c.webp'],
  ['释然', 'https://i.ibb.co/QvJ1gMXD/b00ab1b50e48.webp'],
  ['喜悦', 'https://i.ibb.co/svwRkfnV/df602cb11428.webp'],
  ['治愈绽放', 'https://i.ibb.co/PZhSQd5V/64b508544524.webp'],
  ['中性', 'https://i.ibb.co/SDzshHs8/ae718842095e.webp'],
]

const PRIEST: readonly RemoteSpriteDef[] = [
  ['启仪_变', 'https://i.ibb.co/wFsqCvGY/13b312237d50.webp'],
  ['施法_变', 'https://i.ibb.co/chdysgxL/0b5ab955de6c.webp'],
  ['爱慕', 'https://i.ibb.co/CKBg2km1/78ae74a2723f.webp'],
  ['爱慕_变', 'https://i.ibb.co/kVkkscbn/00260a4feba1.webp'],
  ['懊悔', 'https://i.ibb.co/YTKgtzjD/f7a718c449ff.webp'],
  ['悲伤', 'https://i.ibb.co/Kz6940LS/c14da4f09dbd.webp'],
  ['逗乐', 'https://i.ibb.co/0vbDwQL/520b7638c1b0.webp'],
  ['愤怒', 'https://i.ibb.co/3y9JmhK1/b0822e479741.webp'],
  ['感激', 'https://i.ibb.co/gMHYkGJ0/18f28786a9f4.webp'],
  ['感激_变', 'https://i.ibb.co/chVBLdKP/c0119e0d2181.webp'],
  ['关怀', 'https://i.ibb.co/R4M427Yv/be710e562c6f.webp'],
  ['关怀_变', 'https://i.ibb.co/jP6TYrr8/e3847545ce6f.webp'],
  ['害怕', 'https://i.ibb.co/xSrGj0Y4/a4e07cd690ab.webp'],
  ['好奇', 'https://i.ibb.co/wNNXFkm1/e2632830682d.webp'],
  ['好奇_变', 'https://i.ibb.co/rKCJjwN7/8e97d9255dfa.webp'],
  ['惊讶', 'https://i.ibb.co/TBpb5L25/1656c2d618d3.webp'],
  ['困惑', 'https://i.ibb.co/CpBn8429/07b8b190dcea.webp'],
  ['领悟', 'https://i.ibb.co/7JBZ1bdz/e34f5355ff9e.webp'],
  ['领悟_变', 'https://i.ibb.co/s9mbmZ4v/82b0711944b0.webp'],
  ['期许', 'https://i.ibb.co/9HnJTNd3/f02a51d2d3f7.webp'],
  ['期许_变', 'https://i.ibb.co/xp3Yrrm/87df334b9495.webp'],
  ['森林赐福觉醒', 'https://i.ibb.co/PsMKZxcD/25f73b4d1353.webp'],
  ['失望', 'https://i.ibb.co/wZYSGcb8/26282c1c0140.webp'],
  ['释然', 'https://i.ibb.co/278Vgcfj/7e310449df6f.webp'],
  ['释然_变', 'https://i.ibb.co/b5pKXttg/a2c01ff8d658.webp'],
  ['妩媚_变', 'https://i.ibb.co/Fb97dRp9/090dc1ec60bc.webp'],
  ['喜悦', 'https://i.ibb.co/BHTwvPpp/83fad5398fbb.webp'],
  ['喜悦_变', 'https://i.ibb.co/sdKxRR6K/ff4e310ca857.webp'],
  ['中性', 'https://i.ibb.co/4RkyVzmK/0cdecdd14d36.webp'],
  ['中性_变', 'https://i.ibb.co/1GXq8zXG/b0b8fd3ac8a0.webp'],
]

const BATTLE: readonly RemoteSpriteDef[] = [
  ['懊悔', 'https://i.ibb.co/9H2xWG2x/91152cce4459.webp'],
  ['悲伤', 'https://i.ibb.co/5XJp8LHf/3c211c8b83cc.webp'],
  ['逗乐', 'https://i.ibb.co/whg2hdCs/8cfebde27a4b.webp'],
  ['愤怒', 'https://i.ibb.co/tTZ4J7FQ/c3f950d3633c.webp'],
  ['感激', 'https://i.ibb.co/pvSmYKJ9/d94cbc8cfa25.webp'],
  ['关怀', 'https://i.ibb.co/R47nycMX/224cc7f5eb41.webp'],
  ['害怕', 'https://i.ibb.co/qLpXyBdK/d00f0cb7ac32.webp'],
  ['好奇', 'https://i.ibb.co/Kcjwtx4W/e08d99a6afda.webp'],
  ['惊讶', 'https://i.ibb.co/TBndwYZX/62cf3d53fcc0.webp'],
  ['困惑', 'https://i.ibb.co/PsMrjMmP/85e7abd8c74d.webp'],
  ['领悟', 'https://i.ibb.co/NnL183Sy/b06aaccd6bf5.webp'],
  ['期许', 'https://i.ibb.co/B5CyGzn6/c7c6f8f64085.webp'],
  ['失望', 'https://i.ibb.co/V0k3sS7f/6496d55b49bd.webp'],
  ['释然', 'https://i.ibb.co/qYvP9y6g/b9e5a2f36684.webp'],
  ['喜悦', 'https://i.ibb.co/5WRcBW8x/77e9f76adbe4.webp'],
  ['中性', 'https://i.ibb.co/5fpPBcb/25edd6692c97.webp'],
  ['自然共鸣觉醒', 'https://i.ibb.co/gbq20w38/75a67df38a8c.webp'],
]

const PRESET_DEFS: readonly PresetDef[] = [
  {
    id: 'preset_seraphina_casual',
    name: '塞拉菲娜·常服',
    description: '内置云端预设 · 日常常服',
    roleName: '塞拉菲娜',
    outfit: '常服',
    promptNote: '日常场景中穿的衣服。',
    sprites: CASUAL,
  },
  {
    id: 'preset_seraphina_shadow',
    name: '塞拉菲娜·暗影斗篷',
    description: '内置云端预设 · 夜间巡行服装',
    roleName: '塞拉菲娜',
    outfit: '暗影斗篷',
    promptNote: '夜晚外出巡夜时的服装。',
    sprites: SHADOW,
  },
  {
    id: 'preset_seraphina_healing',
    name: '塞拉菲娜·治愈白裙',
    description: '内置云端预设 · 白天外出服装',
    roleName: '塞拉菲娜',
    outfit: '治愈白裙',
    promptNote: '白天外出时的服装。',
    sprites: HEALING,
  },
  {
    id: 'preset_seraphina_priest',
    name: '塞拉菲娜·祭司仪式袍',
    description: '内置云端预设 · 森林仪式服装',
    roleName: '塞拉菲娜',
    outfit: '祭司仪式袍',
    promptNote: '粗麻多层长袍、露肩、藤蔓束带、翡翠胸针。适用：森林仪式、祈祷、神谕祝福。仪式中可切换至带“_变”后缀的成熟形态。',
    sprites: PRIEST,
  },
  {
    id: 'preset_seraphina_battle',
    name: '塞拉菲娜·战斗服',
    description: '内置云端预设 · 野外战斗服装',
    roleName: '塞拉菲娜',
    outfit: '战斗服',
    promptNote: '橄榄绿粗布抹胸、撕裂短裹裙、腹部交叉绑带，适用：野外战斗、训练、紧张对峙。',
    sprites: BATTLE,
  },
]

const LEGACY_PRESET_IDS = new Set(['preset_silver_loli', 'preset_raven_onee'])

/** baseUrl 为历史兼容参数；远程预设不再拼接扩展静态目录。 */
export function getPresetPacks(baseUrl = ''): SpritePack[] {
  void baseUrl
  return PRESET_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    author: '内置预设',
    description: def.description,
    roleName: def.roleName,
    outfit: def.outfit,
    promptNote: def.promptNote,
    promptNotePlacement: 'after-list',
    sprites: def.sprites.map(([tag, url]) => ({
      tag,
      url,
      remoteUrl: url,
      code: url.slice(url.lastIndexOf('/') + 1),
    })),
  }))
}

/** 当前和已移除的历史预设都视为只读预设，避免升级后误持久化。 */
export function isPresetPack(packId: string): boolean {
  return LEGACY_PRESET_IDS.has(packId) || PRESET_DEFS.some((def) => def.id === packId)
}
