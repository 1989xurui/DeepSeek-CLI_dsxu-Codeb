import { useEffect, useState } from 'react'
import {
  type DsxuLimits,
  currentLimits,
  statusListeners,
} from './dsxuLimits.js'

export function useDsxuLimits(): DsxuLimits {
  const [limits, setLimits] = useState<DsxuLimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: DsxuLimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}
