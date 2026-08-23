'use client'

import { useState } from 'react'
import { X, MapPin, Send, Navigation, Loader2 } from 'lucide-react'

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSendLocation: (locationData: {
    name: string
    address: string
    latitude: string
    longitude: string
  }) => Promise<void>
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSendLocation
}: LocationPickerModalProps) {
  const [name, setName] = useState('Kartik Herbal Remedies')
  const [address, setAddress] = useState('Main Market, City Center')
  const [latitude, setLatitude] = useState('28.6139')
  const [longitude, setLongitude] = useState('77.2090')
  const [sending, setSending] = useState(false)
  const [locating, setLocating] = useState(false)

  if (!isOpen) return null

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      (err) => {
        console.error('Geolocation error:', err)
        alert('Could not get your current location. Please enter manually.')
        setLocating(false)
      }
    )
  }

  const handleSend = async () => {
    if (!latitude || !longitude) {
      alert('Please provide valid Latitude and Longitude')
      return
    }
    setSending(true)
    try {
      await onSendLocation({
        name: name || 'Location',
        address: address || '',
        latitude,
        longitude
      })
      onClose()
    } catch (err: any) {
      console.error('Send location error:', err)
      alert(`Failed to send location: ${err.message || String(err)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Send Location Card</h2>
              <p className="text-xs text-slate-400">Send WhatsApp location to lead</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={locating}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            <span>{locating ? 'Detecting Location...' : 'Use My Current Location'}</span>
          </button>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Location Name / Business:</label>
              <input
                type="text"
                placeholder="e.g. Kartik Herbal Clinic"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Address Details:</label>
              <input
                type="text"
                placeholder="e.g. Main Market, Opposite Bus Stand"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Latitude:</label>
                <input
                  type="text"
                  placeholder="28.6139"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Longitude:</label>
                <input
                  type="text"
                  placeholder="77.2090"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Live Location Card Preview */}
          <div className="bg-[#0b141a] p-3 rounded-xl border border-slate-800">
            <div className="bg-[#005c4b] p-3 rounded-xl text-white space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="truncate">{name || 'Location Name'}</span>
              </div>
              <p className="text-[11px] text-slate-200 line-clamp-2">{address || 'Address'}</p>
              <div className="text-[10px] text-emerald-300/80 font-mono pt-1">
                Lat: {latitude}, Lng: {longitude}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Send Location</span>
          </button>
        </div>

      </div>
    </div>
  )
}
