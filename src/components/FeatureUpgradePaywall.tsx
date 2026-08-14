'use client'

import { useState } from 'react'
import { Lock, Sparkles, PhoneCall } from 'lucide-react'

interface FeatureUpgradePaywallProps {
  featureName: string
  orgName: string
}

export default function FeatureUpgradePaywall({ featureName, orgName }: FeatureUpgradePaywallProps) {
  const [requestLoading, setRequestLoading] = useState(false)
  const [requested, setRequested] = useState(false)

  const handleRequestUpgrade = () => {
    setRequestLoading(false)
    setRequested(true)
    
    // Open WhatsApp link to request access
    const text = `Hello! I want to upgrade and activate the "${featureName}" feature for my dashboard organization: ${orgName}`
    window.open(`https://wa.me/919831282280?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-gray-50/20 dark:bg-gray-950/20 rounded-3xl border border-dashed border-gray-250 dark:border-gray-800">
      <div className="relative max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-150 dark:border-gray-850 shadow-xl text-center">
        
        {/* Glow decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        
        {/* Shield lock Icon */}
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg relative z-10 mb-6">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Feature Locked
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
          The <span className="font-bold text-gray-800 dark:text-gray-200">"{featureName}"</span> addon is currently disabled for your organization. Contact your administrator to activate this panel.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={handleRequestUpgrade}
            disabled={requestLoading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
            {requested ? 'Request Sent' : 'Request Activation'}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <PhoneCall className="w-3.5 h-3.5" />
          Powered by {orgName === 'Iwebmagics' ? 'Iwebmagics' : 'VoxAI'} Engine
        </div>

      </div>
    </div>
  )
}
