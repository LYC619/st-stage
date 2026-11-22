export type TheaterChannel = 'all' | 'square' | 'forum' | 'live' | 'diary'

export interface SquarePost {
  author: string
  tag: string
  time: string
  text: string
  topics: string[]
  comments: Array<{ name: string; text: string }>
  stats: string
  liked?: boolean
  pinned?: boolean
}

export interface ForumPost {
  board: string
  title: string
  text: string
  tags: string[]
  user: string
  heat: string
  comments: string[]
  pinned?: boolean
}

export interface LiveShow {
  room: string
  title: string
  cast: string
  summary: string
  stats: string
  danmaku: Array<{ fan: string; text: string }>
}

export interface DiaryEntry {
  date: string
  role: string
  content: string
  pinned?: boolean
}

export interface TheaterFeeds {
  square: SquarePost[]
  forum: ForumPost[]
  live: LiveShow | null
  diary: DiaryEntry[]
}

export interface TheaterStory extends TheaterFeeds {
  updatedAt: number
  fingerprint: string
}

export interface TheaterData {
  autoGenerate: boolean
  stories: Record<string, TheaterStory>
}
