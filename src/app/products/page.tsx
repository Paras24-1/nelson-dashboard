'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  X, 
  Package, 
  Upload, 
  Image as ImageIcon,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { Product } from '@/types'

export const dynamic = 'force-dynamic'

export default function ProductsPage() {
  const { profile, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <ProductsContent />
}

function ProductsContent() {
  const { org } = useOrg()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Search state
  const [search, setSearch] = useState('')

  // Add/Edit drawer state
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // Form fields
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  
  // Image Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  // Delete modal state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (org?.id) {
      fetchProducts()
    }
  }, [org?.id])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProducts(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const openAddDrawer = () => {
    setEditingProduct(null)
    setName('')
    setPrice('')
    setDescription('')
    setImageUrl(null)
    setShowDrawer(true)
  }

  const openEditDrawer = (product: Product) => {
    setEditingProduct(product)
    setName(product.name)
    setPrice(product.price !== null ? String(product.price) : '')
    setDescription(product.description || '')
    setImageUrl(product.image_url)
    setShowDrawer(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const extension = file.name.split('.').pop()
      const filename = `products/${org?.id}/${timestamp}-${randomStr}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filename, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filename)

      setImageUrl(urlData?.publicUrl || null)
    } catch (err: any) {
      alert(err.message || 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setSaveLoading(true)
      const payload = {
        name,
        price: price ? parseFloat(price) : null,
        description,
        image_url: imageUrl
      }

      const method = editingProduct ? 'PATCH' : 'POST'
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setShowDrawer(false)
      fetchProducts()
    } catch (err: any) {
      alert(err.message || 'Failed to save product')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return

    try {
      setDeleteLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`/api/products/${confirmDeleteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setConfirmDeleteId(null)
      fetchProducts()
    } catch (err: any) {
      alert(err.message || 'Failed to delete product')
    } finally {
      setDeleteLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-950">
      
      {/* Top Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500 shrink-0" />
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Products Catalog
            </h1>
          </div>
        </div>

        <button
          onClick={openAddDrawer}
          className="flex items-center gap-2 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Search Bar */}
        <div className="max-w-md relative select-none">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="border border-gray-150 dark:border-gray-850 bg-white/40 dark:bg-gray-900/30 rounded-2xl p-4 space-y-4 animate-pulse">
                <div className="w-full h-36 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 flex items-center justify-center mb-4 shadow-sm text-gray-400">
              <Package className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">No products found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
              {search ? 'Try adjusting your search terms.' : 'Get started by creating your first catalog product.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div 
                key={product.id}
                className="group relative flex flex-col border border-gray-150 dark:border-gray-800/80 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-500/20 dark:hover:border-emerald-500/10 transition-all duration-200"
              >
                {/* Image Frame */}
                <div className="relative w-full h-36 bg-gray-50 dark:bg-gray-950 rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-850/50">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Package className="w-10 h-10 text-gray-300 dark:text-gray-700 opacity-60" />
                  )}
                  
                  {/* Action Controls */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                    <button
                      onClick={() => openEditDrawer(product)}
                      className="p-1.5 rounded-lg bg-white/95 dark:bg-gray-900/95 border border-gray-150 dark:border-gray-750 text-gray-500 hover:text-emerald-500 shadow-sm transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(product.id)}
                      className="p-1.5 rounded-lg bg-white/95 dark:bg-gray-900/95 border border-gray-150 dark:border-gray-750 text-gray-500 hover:text-red-500 shadow-sm transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Meta details */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-xs font-black text-gray-900 dark:text-white truncate" title={product.name}>
                      {product.name}
                    </h3>
                    {product.price !== null && (
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-100/10 shrink-0">
                        ${product.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal line-clamp-3 font-medium">
                    {product.description || 'No description provided.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Drawer Overlay for Add/Edit Form */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          
          <div className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col justify-between transform transition-transform duration-300">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 dark:border-gray-850 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  Scope: {org?.name || 'Standard Tenant'}
                </p>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Product Name */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. BBA Degree Course Package"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold"
                />
              </div>

              {/* Price */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Price ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Product Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed description of what is included in this course/product..."
                  rows={4}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none font-semibold leading-relaxed"
                />
              </div>

              {/* Image Upload */}
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  Product Image
                </label>
                
                {imageUrl ? (
                  <div className="relative w-full h-40 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                    <img src={imageUrl} alt="Uploaded product" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white shadow-md transition-colors"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 bg-gray-55/50 hover:bg-gray-100/50 dark:bg-gray-900/30 dark:hover:bg-gray-900/60 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:border-emerald-500/40"
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400" />
                        <span className="text-[11px] text-gray-500 font-bold">Upload Product Thumbnail</span>
                        <span className="text-[9px] text-gray-400 font-semibold">PNG, JPG up to 5MB</span>
                      </>
                    )}
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                />
              </div>

            </form>

            {/* Footer */}
            <div className="p-5 border-t border-gray-150 dark:border-gray-850 bg-gray-50 dark:bg-gray-900 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading || uploading || !name.trim()}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {saveLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Save Product'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-500 border border-red-100/10">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">Delete Product?</h3>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              Are you sure you want to delete this product? This action will permanently remove it from the catalog database. This cannot be undone.
            </p>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-650 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {deleteLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
