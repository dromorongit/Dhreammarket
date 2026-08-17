'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { MdClose } from 'react-icons/md'

export type CookiePreferences = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    const consentDate = localStorage.getItem('cookie-consent-date')
    
    if (!consent) {
      setShowBanner(true)
    } else {
      const savedPreferences = JSON.parse(consent)
      setPreferences(savedPreferences)
    }
  }, [])

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs))
    localStorage.setItem('cookie-consent-date', new Date().toISOString())
    setPreferences(prefs)
    setShowBanner(false)
    setShowSettings(false)
  }

  const acceptAll = () => {
    savePreferences({ necessary: true, analytics: true, marketing: true })
  }

  const acceptNecessary = () => {
    savePreferences({ necessary: true, analytics: false, marketing: false })
  }

  if (!showBanner) return null

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8">
          {!showSettings ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-deep-navy mb-2">
                    We use cookies to enhance your experience
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We use cookies and similar tracking technologies to understand how you use our platform and to improve your browsing experience. You can manage your cookie preferences at any time.
                  </p>
                </div>
                <button
                  onClick={() => setShowBanner(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="primary" onClick={acceptAll} className="flex-1 sm:flex-none">
                  Accept All
                </Button>
                <Button variant="outline" onClick={acceptNecessary} className="flex-1 sm:flex-none">
                  Necessary Only
                </Button>
                <Button variant="ghost" onClick={() => setShowSettings(true)} className="flex-1 sm:flex-none">
                  Manage Preferences
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-deep-navy">Cookie Preferences</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Necessary Cookies</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Essential for the website to function properly. Cannot be disabled.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-5 h-5 rounded border-slate-300 text-royal-blue focus:ring-royal-blue cursor-not-allowed opacity-50"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Analytics Cookies</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Help us understand how you use our website to improve your experience.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-royal-blue focus:ring-royal-blue cursor-pointer"
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Marketing Cookies</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Used to deliver personalized ads and track campaign effectiveness.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-royal-blue focus:ring-royal-blue cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="primary" onClick={() => savePreferences(preferences)} className="flex-1 sm:flex-none">
                  Save Preferences
                </Button>
                <Button variant="outline" onClick={acceptAll} className="flex-1 sm:flex-none">
                  Accept All
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}