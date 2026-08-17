'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useOrg } from '@/contexts/OrgContext'
import { useTheme } from 'next-themes'
import AdminPanel from '@/components/admin/AdminPanel'
import SettingsPanel from '@/components/admin/SettingsPanel'
import { 
  Menu, X, BarChart2, MessageSquare, Calendar, Users, 
  Send, Sun, Moon, Settings, LogOut, Package, PhoneCall, ShoppingBag, Mail, Shield, MessageCircle, Globe, GitBranch
} from 'lucide-react'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  const { profile, org, signOut } = useOrg()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const isDark = theme === 'dark'

  const toggleSidebar = () => setIsOpen(!isOpen)
  const closeSidebar = () => setIsOpen(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  useEffect(() => {
    if (org?.name) {
      document.title = `${org.name} — Workspace Dashboard`
    }
  }, [org?.name])

  const navItems = [
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart2,
      visible: isAdmin
    },
    {
      name: 'Chats',
      href: '/chats',
      icon: MessageSquare,
      visible: true
    },
    {
      name: 'Voice AI',
      href: '/voice',
      icon: PhoneCall,
      visible: true
    },
    {
      name: 'Comments',
      href: '/comments',
      icon: MessageCircle,
      visible: true
    },
    {
      name: 'Followups',
      href: '/followups',
      icon: Calendar,
      visible: true
    },
    {
      name: 'Followup Workflows',
      href: '/workflows',
      icon: GitBranch,
      visible: true
    },
    {
      name: 'Lead CRM',
      href: '/leads',
      icon: Users,
      visible: true
    },
    {
      name: 'Products',
      href: '/products',
      icon: Package,
      visible: true
    },
    {
      name: 'Orders & Status',
      href: '/orders',
      icon: ShoppingBag,
      visible: true
    },
    {
      name: 'Email Inbox',
      href: '/emails',
      icon: Mail,
      visible: true
    },
    {
      name: 'Bulk Message',
      href: '/bulk',
      icon: Send,
      visible: true
    },
    {
      name: 'Leads Scraper',
      href: '/scraper',
      icon: Globe,
      visible: true
    }
  ]

  return (
    <>
      {/* Hamburger Menu Trigger Button */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-150 dark:border-gray-700/50 transition-all shadow-sm"
        title="Open navigation menu"
      >
        <Menu className="w-4.5 h-4.5 text-gray-600 dark:text-gray-350" />
      </button>

      {/* Slide-out Sidebar Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`
        fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-250 dark:border-gray-800 z-50 
        transform transition-transform duration-300 ease-in-out flex flex-col justify-between
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* Top Section */}
        <div className="flex-grow overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-emerald-600 dark:bg-emerald-800 text-white">
            <span className="font-bold text-sm">{org?.name || 'Navigation Menu'}</span>
            <button 
              onClick={closeSidebar}
              className="p-1 rounded-lg hover:bg-emerald-755 dark:hover:bg-emerald-950 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1">
            {navItems.filter(item => item.visible).map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}

            {/* Team Option (Admin Panel Trigger) */}
            {isAdmin && (
              <button
                onClick={() => {
                  closeSidebar()
                  setShowAdmin(true)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Team</span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2 bg-gray-50 dark:bg-gray-950">
          
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800/50 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Settings Trigger */}
          {isAdmin && (
            <button
              onClick={() => {
                closeSidebar()
                setShowSettings(true)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          )}

          {/* Privacy Policy */}
          <Link
            href="/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800/50 transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>Privacy Policy</span>
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

      </div>

      {/* Shared Modals */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
