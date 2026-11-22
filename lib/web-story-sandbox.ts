/**
 * 网页模拟器本地剧情沙盒（仅在浏览器非真实 SillyTavern 环境下启用）：
 * 提供初始 `chatMetadata`（时空/委托/行囊、纪要、七天风物日历）与本地演示 AI 响应器，
 * 让玩家无需配置真实 API 密钥即可在网页模拟器中完整体验小手机跨 App 叙事联动。
 */

import type { StoryAiMessage } from '@/st-extension/src/apps/shared/story-ai'
import { CALENDAR_KEY, calendarWindow } from '@/st-extension/src/apps/chronicle/calendar'
import { CHRONICLE_KEY } from '@/st-extension/src/apps/chronicle/store'
import { META_KEY } from '@/st-extension/src/apps/story-state/store'
import type { TheaterData } from '@/st-extension/src/apps/theater/types'

interface SandboxState {
  characterName: string
  chat: Array<{ mes: string; is_user: boolean; name?: string }>
  chatMetadata: Record<string, unknown>
}

const DEFAULT_TODAY = new Date(2026, 10, 22) // 2026-11-22

function seedCalendarDays() {
  const dates = calendarWindow(DEFAULT_TODAY)
  const templates = [
    { festival: '', event: '北码头木栈道加固施工', status: '上班/上学', weather: '多云', content: '市政工匠封闭了北侧两座旧栈桥更换防腐木板，往来货船改停南栈，鱼市摊贩顺势挪到了灯塔坡下。' },
    { festival: '', event: '听潮街煤气路灯换芯', status: '上班/上学', weather: '阴', content: '傍晚起整条听潮街逐盏更换黄铜灯芯，街角茶寮门口临时挂起了两串防风纸灯笼照路。' },
    { festival: '', event: '外海浓雾航道慢行通告', status: '上班/上学', weather: '雾', content: '入夜后海面起雾，港务局鸣响低频雾角，渡轮班次顺延半小时，码头酒馆比往常热闹不少。' },
    { festival: '小雪温炉节', event: '白鸥港冬酿开坛市集', status: '放假', weather: '小雪', content: '今年第一场碎雪落在钟楼尖顶，旧广场支起热麦酒与烤栗子木棚，居民们习惯在今晚互赠手写暖冬签。' },
    { festival: '', event: '钟楼报时齿轮例行停摆检修', status: '上班/上学', weather: '晴', content: '雪后初晴，老钟表匠登塔给大钟上油调校，正午十二响改由港口铜铃代敲。' },
    { festival: '', event: '旧书摊与航海图交换早市', status: '上班/上学', weather: '晴', content: '退潮后的石阶广场摆满旧书箱与过季海图，不少船员来淘换压舱读物。' },
    { festival: '', event: '南堤防波石巡查与海鸟投喂日', status: '放假', weather: '多云', content: '周末防波堤开放西段步道，面包房把隔夜麦饼分装成小袋供行人喂白鸥。' },
  ]
  return dates.map((date, idx) => ({ date, ...templates[idx % templates.length] }))
}

export function createInitialTheaterSeed(characterName: string): TheaterData {
  const key = `${characterName}::sim-chat-1`
  return {
    autoGenerate: true,
    stories: {
      [key]: {
        updatedAt: Date.now(),
        fingerprint: 'seed',
        square: [
          {
            author: '老酒保格伦',
            tag: '白鸥酒馆掌柜',
            time: '12 分钟前',
            text: '今儿第一场碎雪刚落，店里那口铜锅热红酒就见底了。二楼靠窗那桌客人点了壶桂花乌龙坐到现在，外头冷，屋里倒暖和。',
            topics: ['小雪温炉节', '白鸥港夜话'],
            comments: [
              { name: '码头信使阿青', text: '给我留半盅！送完最后一封加急信就过来烤火。' },
              { name: '面包师玛塔', text: '刚出炉的核桃碱水结给你捎了一篮放吧台啦。' },
            ],
            stats: '赞 28 · 转发 4',
          },
          {
            author: '信使阿青',
            tag: '港务快件员',
            time: '半小时前',
            text: '北栈桥围起来修木板，害我绕了半条听潮街，靴子全沾了雪沫子……不过路过茶寮闻见桂花香，总算回过一口气。',
            topics: ['港务日常'],
            comments: [{ name: '守塔人老周', text: '慢点跑，石板路滑得很。' }],
            stats: '赞 19 · 评论 6',
          },
        ],
        forum: [
          {
            board: '月港杂谈',
            title: '【闲聊】今年温炉节广场哪家的热冬酿最地道？',
            text: '刚从钟楼底下逛回来，碎雪配热甜酒真是绝了！大家今年都抽到什么暖冬签了？听说南街茶寮今晚还亮着灯。',
            tags: ['温炉节', '探店'],
            user: '夜航水手77',
            heat: '热度 342',
            comments: [
              '首推老格伦家的肉桂冬酿，喝完手心一直热到半夜。',
              '茶寮二楼视野绝佳，能直接看见港口雾灯和雪花。',
              '刚才路过看见信使阿青急匆匆往茶寮那边去了，大过节的还有急件？',
            ],
          },
        ],
        live: {
          room: '白鸥港 · 钟楼雪景慢直播 #104',
          title: '初雪夜的听潮街与灯塔微光',
          cast: '值班守望员',
          summary: '镜头正对着飘雪的石板街与远处温暖亮灯的听潮茶寮二楼木窗。',
          stats: '1,280 人正在围观',
          danmaku: [
            { fan: '听潮夜猫团', text: '下雪啦！！今年第一场雪！' },
            { fan: '冬酿品鉴会', text: '茶寮二楼窗边那盏小灯好有故事感' },
            { fan: '白鸥护卫队', text: '许愿今晚顺遂，热茶不断～' },
            { fan: '听潮夜猫团', text: '雾角响了两声，远航船只平安靠岸！' },
          ],
        },
        diary: [
          {
            date: '2026-11-22',
            role: '信使阿青',
            content: '靴子烘干了一半，火炉边的松木味让人犯困。今天把那封火漆信送到听潮茶寮时，特意多瞄了一眼二楼——他们聊得挺投机，~~其实我也有点想坐下来蹭杯热茶听听外海的事~~但信袋里还压着两封港务通告，只能装作酷酷地敬了个礼就下楼了。\nPS: 老格伦居然真给我留了半盅热冬酿加烤栗子！\nPPS: ~~下次再有茶寮的信，我绝对要慢吞吞走上十分钟再去敲门。~~',
          },
          {
            date: '2026-11-21',
            role: '老酒保格伦',
            content: '擦完最后一排矮脚杯，外头已经起雾了。最近港里生面孔多，但常来茶寮和酒馆落脚的那位客人倒是个守信的脾气。~~年纪大了就爱操心年轻人有没有添厚衣裳~~柜台底下那罐陈年桂花蜜明天托人捎过去吧。\nPS: 账本第三页又少算了两枚铜板，算了，当温炉节彩头。',
          },
        ],
      },
    },
  }
}

export function installWebStorySandbox(getCharacterName: () => string) {
  const state: SandboxState = {
    characterName: getCharacterName() || '小雪',
    chat: [
      { is_user: true, name: '旅行者', mes: '外头飘起初雪了，我们先上听潮茶寮二楼暖暖手吧。' },
      { is_user: false, name: getCharacterName() || '小雪', mes: '好呀，窗边正好能看见钟楼和港口的雾灯。对了，信使阿青刚才送来一封盖着火漆的委托信。' },
    ],
    chatMetadata: {
      [META_KEY]: {
        v: 1,
        stat_data: {
          时间: { 显示: '2026年11月22日 傍晚 18:30 · 初雪', 年: 2026, 月: 11, 日: 22, 时: 18, 分: 30, 星期: '日' },
          位置: { 区域: '白鸥港·听潮街', 地point: '听潮茶寮二楼', 地点: '听潮茶寮二楼临窗座', 细节: '窗外飘着细碎初雪，桌上温着一壶桂花乌龙' },
          任务: [
            { id: 'q-letter', 标题: '查验港务火漆密信', 描述: '阿青送来的信封里夹着半张旧灯塔钥匙图样，似乎指向今晚停摆检修的钟楼。', 状态: '进行中', 时间: '今晚子时前', 奖励: '旧港通行银徽' },
            { id: 'q-tea', 标题: '温炉节的暖冬签', 描述: '去旧广场市集挑一枚手写木签互赠留念。', 状态: '进行中', 时间: '温炉节当晚', 奖励: '冬酿热甜酒两盅' },
          ],
          背包: [
            { id: 'i-watch', 名称: '褪色黄铜怀表', 数量: 1, 描述: '表盖内侧刻着潮汐刻度，贴耳能听见清脆走针声', 稀有度: '稀有' },
            { id: 'i-tea', 名称: '桂花乌龙茶包', 数量: 3, 描述: '冲泡后暖意绵长，驱散海风寒气', 稀有度: '精良' },
          ],
          技能: [
            { id: 's-wind', 名称: '听风辨位', 等级: 2, 熟练度: 68, 类型: '感知', 描述: '借风雪声辨别街巷动静与脚步远近' },
          ],
        },
      },
      [CHRONICLE_KEY]: {
        v: 1,
        lastMessageIndex: 1,
        entries: [
          {
            code: 'AM0001',
            timeSpan: '2026-11-21',
            summary: '浓雾夜抵达白鸥港，在酒馆探得钟楼旧闻',
            text: '两人冒着海雾在白鸥港南栈靠岸，向老酒保格伦打听了钟楼检修与温炉节市集的消息，暂住听潮街。',
            keyDialogue: ['老酒保格伦：“明儿就是小雪温炉节，外头冷，有话留着炉火边慢慢说。”'],
            createdAt: Date.now() - 86400_000,
            startIndex: -1,
          },
          {
            code: 'AM0002',
            timeSpan: '2026-11-22',
            summary: '初雪傍晚落座听潮茶寮，收到阿青送来的火漆信',
            text: '碎雪初落时两人登上听潮茶寮二楼临窗座温茶叙话，港务信使阿青冒雪送来一封带有灯塔图样的火漆信。',
            keyDialogue: [`${getCharacterName() || '小雪'}：“趁雪还没积厚，我们先把信里的线索理一理吧。”`],
            createdAt: Date.now() - 1800_000,
            startIndex: 0,
          },
        ],
      },
      [CALENDAR_KEY]: {
        v: 1,
        days: seedCalendarDays(),
        notes: { '2026-11-22': '晚饭后一起逛温炉节初雪市集' },
      },
    },
  }

  const hostInstalledByUs = typeof window !== 'undefined' && !window.SillyTavern
  if (hostInstalledByUs) {
    ;(window as unknown as { SillyTavern?: unknown }).SillyTavern = {
      getContext: () => ({
        name1: '旅行者',
        name2: state.characterName,
        characterId: 0,
        chatId: 'sim-chat-1',
        characters: [
          { name: state.characterName, avatar: 'xiaoxue.png', description: '温柔机敏的旅伴，喜欢在雪天捧着热茶看海港灯火。' },
          { name: '信使阿青', avatar: 'aqing.png', description: '风风火火的白鸥港快件员，嘴硬心软。' },
          { name: '老酒保格伦', avatar: 'glenn.png', description: '白鸥酒馆掌柜，熟知港口大小旧事。' },
        ],
        chat: state.chat,
        chatMetadata: state.chatMetadata,
        saveMetadata: async () => {},
        updateChatMetadata: (patch: Record<string, unknown>) => Object.assign(state.chatMetadata, patch),
      }),
    }
  }

  const mockInstalledByUs = typeof window !== 'undefined' && !window.__stStageMockStoryAi
  if (mockInstalledByUs) {
    window.__stStageMockStoryAi = async (messages: StoryAiMessage[], jsonMode: boolean) => {
      await new Promise(resolve => setTimeout(resolve, 260))
      const sys = messages[0]?.content || ''
      const usr = messages[1]?.content || ''
      if (!jsonMode || sys.includes('UpdateVariable')) {
        return `<UpdateVariable>\n_.set('时间.显示', '2026年11月22日 入夜 19:15 · 初雪渐密');\n_.set('位置.细节', '茶香袅袅，窗外广场亮起了温炉节的暖黄灯串');\n</UpdateVariable>`
      }
      if (sys.includes('公共日历')) {
        const match = usr.match(/只补这些日期：(\[[^\n]+\])/)
        const wanted: string[] = match ? JSON.parse(match[1]) : calendarWindow(DEFAULT_TODAY)
        const base = seedCalendarDays()
        return JSON.stringify({
          days: wanted.map((d, i) => ({ ...base[i % base.length], date: d })),
        })
      }
      if (sys.includes('第三方视角中立客观记录')) {
        return JSON.stringify({
          timeSpan: '2026-11-22',
          summary: '雪夜茶寮细读密信，约定前往温炉节市集探查',
          text: '两人在茶寮灯下展开火漆信核对钟楼图样，商定趁温炉节夜市人流前往钟楼脚下查看动静。',
          keyDialogue: [`${state.characterName}：“外头风凉，围巾系紧些再出门。”`],
        })
      }
      return JSON.stringify({
        square: [
          {
            author: '面包师玛塔',
            tag: '暖炉烘焙坊',
            time: '刚刚',
            text: '最后一炉肉桂苹果派刚端上木架就被抢空啦！看见茶寮二楼的客人正往广场这边看呢，待会给你们留两块热乎的！',
            topics: ['小雪温炉节', '新鲜出炉'],
            comments: [{ name: '信使阿青', text: '玛塔婶婶偏心，我刚才路过怎么说卖完啦！' }],
            stats: '赞 36 · 评论 9',
          },
        ],
        forum: [
          {
            board: '港城风物',
            title: '【现场】钟楼底下的暖冬签木棚排起长队了',
            text: '雪花落在红绒布棚顶上特别好看，今年大家都写了不少心愿挂在铜铃绳上。',
            tags: ['市集直击'],
            user: '提灯路人',
            heat: '热度 418',
            comments: ['刚挂了一枚平安签！', '配着热红酒逛市集太惬意了。'],
          },
        ],
        live: {
          room: '白鸥港 · 温炉节市集直击 #108',
          title: '雪夜灯串点亮瞬间！热红酒香气飘满半条街',
          cast: '市集巡游志愿者',
          summary: '整条听潮街的黄铜路灯与市集彩灯同时点亮，暖光映在薄雪石板路上。',
          stats: '1,860 人正在围观',
          danmaku: [
            { fan: '暖冬祈愿团', text: '亮灯那一刻太美了！！' },
            { fan: '听潮夜猫团', text: '捕捉到二楼窗边的剪影～' },
          ],
        },
        diary: [
          {
            date: '2026-11-22',
            role: '面包师玛塔',
            content: '今天揉了整整四十斤面团，手腕酸得抬不起来，但看街坊们捧着热派呵白气的模样又觉得值当。傍晚瞧见茶寮二楼那两位凑在灯下看信，神情认真得很，~~年轻真好啊，连下雪天查桩怪事都像在约会似的~~。\nPS: 偷偷在留给他们的纸袋里多塞了两颗酒心太妃糖。',
          },
        ],
      })
    }
  }

  return {
    pushAiMessage(text: string) {
      state.characterName = getCharacterName() || state.characterName
      state.chat.push({ is_user: false, name: state.characterName, mes: text })
    },
    setCharacterName(name: string) {
      state.characterName = name || '小雪'
    },
    dispose() {
      if (hostInstalledByUs) Reflect.deleteProperty(window, 'SillyTavern')
      if (mockInstalledByUs) delete window.__stStageMockStoryAi
    },
  }
}
