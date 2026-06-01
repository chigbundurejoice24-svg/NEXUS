import { Search, Bell, Menu, ChevronDown } from 'lucide-react'
import { userProfile } from '@/data/mockData'
import { useNavigate } from 'react-router-dom'

interface TopHeaderProps {
  title: string
  onMenuToggle: () => void
}

export default function TopHeader({ title, onMenuToggle }: TopHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="h-[72px] flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-aegis-bg-elevated transition-colors"
        >
          <Menu size={20} className="text-aegis-secondary-dark" />
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-aegis-primary-dark dark:text-white">
          {title}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <button className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <Search size={18} className="text-aegis-secondary-dark" />
        </button>

        {/* Notifications */}
        <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <Bell size={18} className="text-aegis-secondary-dark" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-aegis-success-green" />
        </button>

        {/* User Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-aegis-bg-elevated transition-colors"
        >
          <img
            src={userProfile.avatar}
            alt={userProfile.name}
            className="w-8 h-8 rounded-full object-cover border border-border"
          />
          <span className="hidden sm:block text-sm font-medium text-aegis-primary-dark dark:text-white">
            {userProfile.name}
          </span>
          <ChevronDown size={14} className="hidden sm:block text-aegis-tertiary-dark" />
        </button>
      </div>
    </header>
  )
}
