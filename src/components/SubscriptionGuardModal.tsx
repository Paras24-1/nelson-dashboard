'use client'

import { ShieldAlert, MessageCircle, LogOut, Lock } from 'lucide-react'

interface SubscriptionGuardModalProps {
  orgName?: string
  orgPlan?: string
  onSignOut: () => void
}

export default function SubscriptionGuardModal({
  orgName = 'Your Organization',
  orgPlan = 'Standard',
  onSignOut
}: SubscriptionGuardModalProps) {
  const whatsappUrl = `https://wa.me/918360599157?text=Hi%2C%20I%20want%20to%20renew%20the%20subscription%20for%20my%20organization%3A%20${encodeURIComponent(orgName)}`

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-8 text-center space-y-6 shadow-2xl shadow-red-500/10 relative overflow-hidden">
        
        {/* Top Glow Background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon */}
        <div className="flex justify-center">
          <div className="relative p-4 rounded-3xl bg-red-500/10 text-red-400 border border-red-500/20 shadow-inner">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-red-500/30 text-red-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Subscription Inactive
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            Your workspace <span className="font-bold text-white">"{orgName}"</span> subscription has expired or is currently inactive. Dashboard access and automated AI features are temporarily locked.
          </p>
        </div>

        {/* Info Pill */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-around text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Organization</span>
            <span className="font-bold text-slate-200 truncate max-w-[140px] block">{orgName}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Plan</span>
            <span className="font-bold text-amber-400 uppercase">{orgPlan}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Status</span>
            <span className="font-bold text-red-400 uppercase">INACTIVE</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="space-y-3 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 group"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>Renew Subscription on WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Need help? Contact support on WhatsApp +91 83605 99157
        </p>

      </div>
    </div>
  )
}
