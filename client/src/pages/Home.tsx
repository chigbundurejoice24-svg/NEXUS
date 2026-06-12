import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '@/lib/trpc'

/**
 * Home.tsx — smart entry point.
 * Logged-in users → Dashboard. Everyone else → Auth.
 */
export default function Home() {
  const navigate = useNavigate()
  useEffect(() => {
    if (getToken()) {
      navigate('/', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate])
  return null
}
