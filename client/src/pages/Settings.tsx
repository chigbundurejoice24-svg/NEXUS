import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Shield, Bell, Wallet, Globe, ChevronRight,
  User as UserIcon, Key, Fingerprint, Mail, Smartphone, ToggleLeft, ToggleRight
} from 'lucide-react'
import { userProfile } from '@/data/mockData'

interface SettingItem {
  label: string
  description: string
  icon: React.ElementType
  badge?: string
  toggle?: boolean
}

interface SettingSection {
  title: string
  icon: React.ElementType
  items: SettingItem[]
}

const settingSections: SettingSection[] = [
  {
    title: 'Profile',
    icon: User,
    items: [
      { label: 'Personal Information', description: 'Name, email, phone', icon: UserIcon },
      { label: 'Verification Status', description: 'KYC & identity verification', icon: Shield, badge: 'Verified' },
    ],
  },
  {
    title: 'Security',
    icon: Shield,
    items: [
      { label: 'Change Password', description: 'Update your password', icon: Key },
      { label: 'Two-Factor Auth', description: 'Enable 2FA for extra security', icon: Fingerprint, toggle: true },
      { label: 'Biometric Login', description: 'Use fingerprint or face ID', icon: Fingerprint, toggle: true },
    ],
  },
  {
    title: 'Notifications',
    icon: Bell,
    items: [
      { label: 'Email Notifications', description: 'Transaction alerts & updates', icon: Mail, toggle: true },
      { label: 'Push Notifications', description: 'Real-time push alerts', icon: Smartphone, toggle: true },
      { label: 'Price Alerts', description: 'Crypto price change alerts', icon: Bell, toggle: false },
    ],
  },
  {
    title: 'Connected Wallets',
    icon: Wallet,
    items: [
      { label: 'MetaMask', description: '0x7A2b...C99D • Active', icon: Wallet },
      { label: 'WalletConnect', description: 'Not connected', icon: Wallet },
    ],
  },
  {
    title: 'Preferences',
    icon: Globe,
    items: [
      { label: 'Language', description: 'English (US)', icon: Globe },
      { label: 'Currency', description: 'USD / NGN', icon: Globe },
    ],
  },
]

export default function Settings() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    'Two-Factor Auth': true,
    'Biometric Login': false,
    'Email Notifications': true,
    'Push Notifications': true,
    'Price Alerts': false,
  })

  const toggleSwitch = (label: string) => {
    setToggles((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 max-w-3xl">
      <p className="text-sm text-aegis-secondary-dark">Manage your account and preferences</p>

      {/* Profile Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
      >
        <img
          src={userProfile.avatar}
          alt={userProfile.name}
          className="w-14 h-14 rounded-full object-cover border-2 border-aegis-accent-purple/20"
        />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-aegis-primary-dark dark:text-white">{userProfile.name}</h3>
          <p className="text-sm text-aegis-secondary-dark">{userProfile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-aegis-success-green/10 text-aegis-success-green px-2 py-0.5 rounded-full font-medium">
              {userProfile.verificationStatus}
            </span>
            <span className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-aegis-accent-purple px-2 py-0.5 rounded-full font-medium">
              {userProfile.level}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Settings Sections */}
      {settingSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionIndex * 0.05 }}
        >
          <h3 className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-3 px-1">
            {section.title}
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {section.items.map((item, itemIndex) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-aegis-bg-elevated/50 transition-colors text-left ${
                  itemIndex < section.items.length - 1 ? 'border-b border-border' : ''
                }`}
                onClick={() => item.toggle && toggleSwitch(item.label)}
              >
                <div className="w-9 h-9 rounded-lg bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-aegis-secondary-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{item.label}</p>
                  <p className="text-xs text-aegis-tertiary-dark truncate">{item.description}</p>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-aegis-success-green/10 text-aegis-success-green px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                {item.toggle ? (
                  <div className="flex-shrink-0">
                    {toggles[item.label] ? (
                      <ToggleRight size={24} className="text-aegis-accent-purple" />
                    ) : (
                      <ToggleLeft size={24} className="text-aegis-tertiary-dark" />
                    )}
                  </div>
                ) : (
                  <ChevronRight size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="w-full py-3 border border-red-200 dark:border-red-800 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
          Log Out
        </button>
      </motion.div>
    </div>
  )
}
