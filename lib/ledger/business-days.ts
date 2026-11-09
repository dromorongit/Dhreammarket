export function isBusinessDay(date: Date, holidays: string[]): boolean {
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const d = date.toISOString().slice(0, 10)
  return !holidays.includes(d)
}

export function addBusinessDays(from: Date, n: number, holidays: string[]): Date {
  const result = new Date(from.getTime())
  let count = 0
  while (count < n) {
    result.setUTCDate(result.getUTCDate() + 1)
    if (isBusinessDay(result, holidays)) count++
  }
  return result
}
