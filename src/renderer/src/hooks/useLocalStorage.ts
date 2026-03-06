import { useState, useCallback } from 'react'

type Updater<T> = T | ((prev: T) => T)

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  parse?: (s: string) => T,
): [T, (value: Updater<T>) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    if (parse) return parse(stored)
    // Strings are stored as raw values (no JSON encoding)
    if (typeof defaultValue === 'string') return stored as T
    try {
      return JSON.parse(stored) as T
    } catch {
      return defaultValue
    }
  })

  const set = useCallback((value: Updater<T>) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      localStorage.setItem(key, typeof next === 'string' ? next : JSON.stringify(next))
      return next
    })
  }, [key])

  return [state, set]
}
