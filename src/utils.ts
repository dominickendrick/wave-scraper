import { format } from 'date-fns'

export const getDate = (today: Date = new Date()): string => {
  return format(today, "yyyy-MM-dd")
}

export const parseDate = (dateString: string): Date => {
  return new Date(dateString)
}
