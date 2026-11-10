export interface ChronicleEntry {
  code: string; timeSpan: string; summary: string; text: string; keyDialogue: string[]; createdAt: number
}
export type ChronicleContent = Pick<ChronicleEntry, 'timeSpan' | 'summary' | 'text' | 'keyDialogue'>
export interface ChronicleData { v: 1; entries: ChronicleEntry[]; lastMessageIndex: number }
export interface ChronicleSettings { autoGenerate: boolean; interval: number; inject: boolean; autoCalendar: boolean }
