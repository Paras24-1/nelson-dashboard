'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { 
  ShoppingBag, CheckCircle2, Truck, Timer, Search, Plus, 
  Trash2, X, AlertCircle, RefreshCw, Loader2, ArrowRight, 
  Mail, Calendar, Phone, DollarSign, ChevronRight, ChevronDown, Check
} from 'lucide-react'
import { STATUS_TITLES, STATUS_COLORS } from '@/lib/order-constants'
import FeatureUpgradePaywall from '@/components/FeatureUpgradePaywall'

export const dynamic = 'force-dynamic'

interface Order {
  id: string
  reference_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  items: string
  total_amount: number
  status: string
  created_at: string
  updated_at: string
}

// Stage stepper definition for delivery pipeline
const STAGES = ['placed', 'processing', 'shipped', 'out_for_delivery', 'delivered']

export default function OrdersPage() {
  const { profile, org, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-955">
      {/* Top Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-500 shrink-0" />
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Order Status Automation
            </h1>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {org?.has_orders_crm ? (
          <OrdersDashboardContent />
        ) : (
          <FeatureUpgradePaywall featureName="Order Status Automation" orgName={org?.name || 'Your Team'} />
        )}
      </div>
    </div>
  )
}

function OrdersDashboardContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  
  // Create Order Form State
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderItems, setOrderItems] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // State for tracking inline actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load orders')
      const data = await res.json()
      setOrders(data)
    } catch (err) {
      console.error('Fetch orders error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Create Order Submit
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!customerName.trim() || !customerEmail.trim() || !orderItems.trim()) {
      setFormError('Please fill out all required fields.')
      return
    }

    if (!customerEmail.includes('@')) {
      setFormError('Please enter a valid customer email address.')
      return
    }

    try {
      setCreateLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          items: orderItems,
          totalAmount: parseFloat(totalAmount) || 0.00
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')

      // Reset form & reload
      setCustomerName('')
      setCustomerEmail('')
      setCustomerPhone('')
      setOrderItems('')
      setTotalAmount('')
      setShowCreateModal(false)
      fetchOrders()
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving order.')
    } finally {
      setCreateLoading(false)
    }
  }

  // Update Status Stage
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      setActionLoadingId(orderId)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      // Update locally
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
    } catch (err: any) {
      alert(`Error updating order: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Delete/Cancel Order
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel and delete this order?')) return
    try {
      setActionLoadingId(orderId)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Failed to delete order')

      setOrders(prev => prev.filter(o => o.id !== orderId))
      if (expandedOrderId === orderId) setExpandedOrderId(null)
    } catch (err: any) {
      alert(`Error deleting order: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Filter & Search Logic
  const filteredOrders = orders.filter(o => {
    const query = search.toLowerCase()
    const matchesSearch = 
      o.reference_number.toLowerCase().includes(query) ||
      o.customer_name.toLowerCase().includes(query) ||
      o.customer_email.toLowerCase().includes(query)
    
    const matchesFilter = statusFilter === 'all' || o.status === statusFilter
    return matchesSearch && matchesFilter
  })

  // Calculate Metrics
  const totalCount = orders.length
  const pendingCount = orders.filter(o => o.status === 'placed' || o.status === 'processing').length
  const shippedCount = orders.filter(o => o.status === 'shipped' || o.status === 'out_for_delivery').length
  const deliveredCount = orders.filter(o => o.status === 'delivered').length

  const getStatusLabel = (status: string) => STATUS_TITLES[status] || status
  
  const getStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || '#10b981'
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border"
        style={{ borderColor: `${color}40`, backgroundColor: `${color}15`, color }}
      >
        {getStatusLabel(status)}
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100/20">
            Automated Delivery Triggers
          </span>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-2">
            Orders Workflow Dashboard
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Create reference orders, adjust delivery stages, and trigger automatic transactional updates.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create New Order
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Orders', count: totalCount, icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Pending & Active', count: pendingCount, icon: Timer, color: 'text-amber-500 bg-amber-500/10' },
          { label: 'In Transit', count: shippedCount, icon: Truck, color: 'text-purple-500 bg-purple-500/10' },
          { label: 'Delivered', count: deliveredCount, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
        ].map((it, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">{it.label}</span>
              <span className="text-2xl font-black text-gray-955 dark:text-white block mt-1 tracking-tight">
                {loading ? '—' : it.count}
              </span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${it.color}`}>
              <it.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name, email, or order reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-700 dark:text-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
          >
            <option value="all">All Stages</option>
            {Object.keys(STATUS_TITLES).map((s) => (
              <option key={s} value={s}>{STATUS_TITLES[s]}</option>
            ))}
          </select>
          <button
            onClick={fetchOrders}
            className="p-2 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-500 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders database display */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
        {loading && orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider animate-pulse">Loading orders...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-bold text-gray-850 dark:text-gray-250">No orders found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm px-6">There are no orders that match your search or filter requirements. Click "Create New Order" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-150 dark:border-gray-800 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 bg-gray-50/30 dark:bg-gray-955/20 select-none">
                  <th className="px-6 py-4">Ref Number</th>
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Date Placed</th>
                  <th className="px-6 py-4">Status Stage</th>
                  <th className="px-6 py-4 text-right">Total Price</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                {filteredOrders.map((ord) => {
                  const isExpanded = expandedOrderId === ord.id
                  const formattedDate = new Date(ord.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })

                  return (
                    <React.Fragment key={ord.id}>
                      <tr 
                        className={`hover:bg-gray-50/40 dark:hover:bg-gray-850/40 transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-50/10 dark:bg-emerald-950/5' : ''}`}
                        onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-1">
                            {ord.reference_number}
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-gray-850 dark:text-white leading-normal">{ord.customer_name}</div>
                          <div className="text-[10px] text-gray-400 tracking-tight font-medium mt-0.5">{ord.customer_email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-gray-650 dark:text-gray-350">{formattedDate}</span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(ord.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-extrabold text-gray-900 dark:text-white tracking-tight">₹{ord.total_amount.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteOrder(ord.id)}
                            disabled={actionLoadingId === ord.id}
                            className="p-2 border border-transparent rounded-lg hover:border-rose-100 hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded steppers and pipelines panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-6 py-5 bg-gray-50/40 dark:bg-gray-955/20 border-b border-gray-150 dark:border-gray-800">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div>
                                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Order Items / Summary</h4>
                                  <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-300 font-bold whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {ord.items}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Change Delivery Stage</h4>
                                  <div className="flex items-center gap-3">
                                    <select
                                      value={ord.status}
                                      onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                                      disabled={actionLoadingId === ord.id}
                                      className="flex-1 max-w-xs px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:opacity-50"
                                    >
                                      {Object.keys(STATUS_TITLES).map((s) => (
                                        <option key={s} value={s}>{STATUS_TITLES[s]}</option>
                                      ))}
                                    </select>
                                    
                                    {actionLoadingId === ord.id && (
                                      <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider animate-pulse">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-505" /> Updating & Emailing...
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-2.5">
                                    🚨 Updates trigger an immediate transactional HTML email notification to <span className="text-gray-600 dark:text-gray-300 underline font-black">{ord.customer_email}</span>.
                                  </p>
                                </div>
                              </div>

                              {/* Visual Delivery Stepper Pipeline */}
                              {ord.status !== 'cancelled' ? (
                                <div className="pt-4">
                                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-4.5">Delivery Pipeline Tracking</h4>
                                  <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-2">
                                    
                                    {/* Connection Line */}
                                    <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-800 hidden md:block z-0" />
                                    
                                    {STAGES.map((stg, sIdx) => {
                                      const currentIdx = STAGES.indexOf(ord.status)
                                      const isCompleted = sIdx <= currentIdx
                                      const isActive = ord.status === stg
                                      
                                      const color = STATUS_COLORS[stg] || '#10b981'

                                      return (
                                        <div key={stg} className="relative flex items-center md:flex-col gap-3 md:gap-2 z-10 flex-1">
                                          <div 
                                            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm ${
                                              isActive 
                                                ? 'scale-110 ring-4 ring-offset-2 dark:ring-offset-gray-900' 
                                                : ''
                                            }`}
                                            style={{ 
                                              borderColor: isCompleted ? color : '#e5e7eb',
                                              backgroundColor: isCompleted ? color : '#ffffff',
                                              // @ts-ignore
                                              '--tw-ring-color': `${color}33`
                                            }}
                                          >
                                            {isCompleted ? (
                                              <Check className="w-4 h-4 text-white font-extrabold" />
                                            ) : (
                                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                            )}
                                          </div>
                                          
                                          <div className="text-left md:text-center">
                                            <span 
                                              className={`text-[10px] font-extrabold uppercase tracking-wide block transition-colors ${
                                                isActive ? 'text-gray-900 dark:text-white font-black' : isCompleted ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
                                              }`}
                                            >
                                              {STATUS_TITLES[stg]}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 p-4 border border-red-500/20 bg-red-500/5 rounded-2xl flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-rose-500" />
                                  <span className="text-xs text-rose-500 font-bold uppercase tracking-wider">This order has been cancelled. No further tracking updates are active.</span>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-955/20">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wide">Generate Reference Order</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-805 text-gray-405 hover:text-gray-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateOrder}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-2xl flex items-center gap-2 text-xs text-rose-500 font-bold uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Customer Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. john@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Phone Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. +919876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Total Amount (INR) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="e.g. 1500.00"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Order Items & Specifications *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="e.g. 1x Silk Handloom Saree (Green)&#10;2x Cotton Kurtis (Blue)"
                    value={orderItems}
                    onChange={(e) => setOrderItems(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-955 text-gray-905 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-150 dark:border-gray-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-gray-955/20">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-650 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
                >
                  {createLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <>Generate Order <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
