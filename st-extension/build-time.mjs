export const BUILD_TIME_ENV = 'ST_STAGE_BUILD_TIME'

const EXPLICIT_BUILD_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
const VERSION_SUFFIX = /\+(\d{12})$/

export function resolveBuildTime(env = process.env, now = new Date()) {
  const explicit = env[BUILD_TIME_ENV]
  if (explicit === undefined || explicit === '') {
    return now.toLocaleString('sv-SE').slice(0, 16)
  }
  return parseExplicitBuildTime(explicit)
}

export function buildVersion(manifestVersion, buildTime) {
  return `${manifestVersion ?? '0.0.0'}+${buildTime.replace(/[-: ]/g, '')}`
}

export function buildTimeFromVersion(version) {
  const match = VERSION_SUFFIX.exec(String(version ?? ''))
  if (!match) {
    throw new Error('version.json must contain a version suffix like +YYYYMMDDHHmm')
  }
  const compact = match[1]
  return parseExplicitBuildTime(
    `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)} ${compact.slice(8, 10)}:${compact.slice(10, 12)}`,
  )
}

function parseExplicitBuildTime(value) {
  const match = EXPLICIT_BUILD_TIME.exec(value)
  if (!match) {
    throw new Error(`${BUILD_TIME_ENV} must use exact format YYYY-MM-DD HH:mm`)
  }
  const [, y, mo, d, h, mi] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error(`${BUILD_TIME_ENV} must be a real local calendar minute`)
  }
  return value
}
