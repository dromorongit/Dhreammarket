'use client'

import { useState, useEffect, useCallback } from 'react'

type HolidayItem = { date: string }

interface Props {
  initial: string[]
}

export default function HolidayEditor({ initial }: Props) {
  const [dates, setDates] = useState<string[]>(initial)
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(false)

  const show = useCallback((text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
  }, [])

  useEffect(() => {
    setDates(initial)
  }, [initial])

  const request = useCallback(async (action: 'add' | 'remove', date: string) => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, action }),
      })
      const json = await res.json()
      if (!res.ok) {
        show(json.error ?? 'Request failed', 'error')
        return
      }
      setDates(json.holidayList ?? [])
      if (action === 'add') {
        setInput('')
        show('Holiday added', 'success')
      } else {
        show('Holiday removed', 'success')
      }
    } catch {
      show('Request failed', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const date = input.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      show('Enter a valid YYYY-MM-DD date', 'error')
      return
    }
    if (dates.includes(date)) {
      show('Date is already a holiday', 'error')
      return
    }
    request('add', date)
  }

  const handleRemove = (date: string) => {
    request('remove', date)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-1">Business Day Payout Holidays</h1>
      <p className="text-sm text-gray-600 mb-6">
        Dates vendors are not paid out on. Business-day payouts release earnings
        two business days after the order completedAt, skipping weekends and these dates.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          id="holiday-date"
          type="text"
          maxLength={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="YYYY-MM-DD"
          className="flex-1 min-w-[120px] border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Add holiday
        </button>
      </form>

      <div className="rounded border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dates.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-gray-500 text-sm col-span-2">
                  No holidays configured.
                </td>
              </tr>
            ) : (
              dates.map((date) => (
                <tr key={date}>
                  <td className="px-4 py-3 text-gray-900">{date}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(date)}
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-800 underline font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {message && (
        <div
          className={`mt-4 rounded px-3 py-2 text-sm ${
            messageType === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
