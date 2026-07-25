'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'
import { ChevronDown, UserCheck, UserX, Check } from 'lucide-react'

interface Employee {
  id: string
  name: string
  email: string
}

interface Props {
  conversationId: string
  currentAssignedTo: string | null
  currentAssigneeName?: string
  onAssigned: () => void
}

export default function AssignDropdown({
  conversationId,
  currentAssignedTo,
  currentAssigneeName,
  onAssigned
}: Props) {
  const [open, setOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { profile } = useOrg()

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchEmployees = async () => {
    if (!profile?.org_id) return
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'employee')
      .eq('org_id', profile.org_id)
      .order('name')
    setEmployees(data || [])
    setLoading(false)
  }

  const handleOpen = () => {
    if (!open) fetchEmployees()
    setOpen(o => !o)
  }

  const handleAssign = async (employeeId: string | null) => {
    setAssigning(true)
    try {
      // Update conversation
      await supabase
        .from('conversations')
        .update({
          assigned_to: employeeId,
          assignment_status: employeeId ? 'assigned' : 'unassigned'
        })
        .eq('id', conversationId)

      // Upsert assignment record
      if (employeeId) {
        await supabase
          .from('conversation_assignments')
          .upsert({
            conversation_id: conversationId,
            assigned_to: employeeId,
            assigned_by: profile?.id,
            status: 'active',
            assigned_at: new Date().toISOString()
          }, { onConflict: 'conversation_id' })

        // Log the action
        await supabase
          .from('assignment_logs')
          .insert({
            conversation_id: conversationId,
            user_id: profile?.id,
            action: 'assigned',
            details: `Assigned to employee`
          })
      } else {
        // Unassign
        await supabase
          .from('conversation_assignments')
          .delete()
          .eq('conversation_id', conversationId)

        await supabase
          .from('assignment_logs')
          .insert({
            conversation_id: conversationId,
            user_id: profile?.id,
            action: 'unassigned',
            details: 'Removed assignment'
          })
      }

      onAssigned()
    } catch (err) {
      console.error('Assignment error:', err)
    } finally {
      setAssigning(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        disabled={assigning}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
          currentAssignedTo
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-200'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
        }`}
      >
        {currentAssignedTo ? (
          <>
            <UserCheck className="w-3 h-3" />
            <span className="max-w-[80px] truncate">{currentAssigneeName || 'Assigned'}</span>
          </>
        ) : (
          <>
            <UserX className="w-3 h-3" />
            <span>Unassigned</span>
          </>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="p-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Assign to
            </p>

            {loading ? (
              <p className="px-3 py-2 text-xs text-gray-400">Loading...</p>
            ) : employees.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No employees found</p>
            ) : (
              employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleAssign(emp.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {emp.name[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-left truncate">{emp.name}</span>
                  {currentAssignedTo === emp.id && (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </button>
              ))
            )}

            {/* Unassign option */}
            {currentAssignedTo && (
              <>
                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                >
                  <UserX className="w-4 h-4" />
                  <span>Remove assignment</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
