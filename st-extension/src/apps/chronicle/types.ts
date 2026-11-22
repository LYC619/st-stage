export interface ChronicleEntry {
  code: string
  timeSpan: string
  summary: string
  text: string
  keyDialogue: string[]
  createdAt: number
  /** 生成该条纪要前的消息游标；删除最新一条时可据此回退游标，避免已删楼层变成死区。 */
  startIndex?: number
}

export type ChronicleContent = Pick<ChronicleEntry, 'timeSpan' | 'summary' | 'text' | 'keyDialogue'>

export interface ChronicleData {
  v: 1
  entries: ChronicleEntry[]
  lastMessageIndex: number
}

export interface ChronicleSettings {
  autoGenerate: boolean
  interval: number
  inject: boolean
  autoCalendar: boolean
  injectCalendar: boolean
}
