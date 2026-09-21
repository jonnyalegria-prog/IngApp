// ISO 8601 weeks run Monday–Sunday, so the week "ends" on the same day as a
// Sunday class — the key below doubles as "which class-week is this".
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

export function getWeekKey(date = new Date()): string {
  const { year, week } = isoWeek(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}
