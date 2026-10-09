import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from '@/data/AppData'
import { Toaster } from '@/ui/kit'
import Shell from '@/ui/Shell'
import Landing from '@/pages/Landing'
import { Login, Register, Forgot, UpdatePassword, InviteAccept } from '@/pages/Auth'
import './index.css'

const Overview = lazy(() => import('@/pages/Overview'))
const Transactions = lazy(() => import('@/pages/Transactions'))
const Budgets = lazy(() => import('@/pages/Budgets'))
const Vaults = lazy(() => import('@/pages/Vaults'))
const Subscriptions = lazy(() => import('@/pages/Subscriptions'))
const Rules = lazy(() => import('@/pages/Rules'))
const Shared = lazy(() => import('@/pages/Shared'))
const Referrals = lazy(() => import('@/pages/Referrals'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Settings = lazy(() => import('@/pages/Settings'))
const Payroll = lazy(() => import('@/pages/Payroll'))
const Nation = lazy(() => import('@/pages/Nation'))

function Protected({ children }: { children: React.ReactNode }) {
  const { ready, mode, profile, error } = useApp()
  const loc = useLocation()
  if (!ready) return <Splash />
  if (!mode) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!profile) return error ? <div className="p-10 text-center text-sm text-bad">Could not load your profile: {error}</div> : <Splash />
  return <>{children}</>
}
const Splash = () => <div className="grid min-h-screen place-items-center text-sm text-muted">Loading Axial…</div>

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/app" element={<Protected><Shell /></Protected>}>
            {[['', Overview], ['transactions', Transactions], ['budgets', Budgets], ['vaults', Vaults], ['subscriptions', Subscriptions], ['rules', Rules], ['payroll', Payroll], ['nation', Nation], ['shared', Shared], ['referrals', Referrals], ['notifications', Notifications], ['settings', Settings]].map(([p, C]) => {
              const Page = C as React.ComponentType
              return <Route key={p as string} index={p === ''} path={p === '' ? undefined : (p as string)} element={<Suspense fallback={<div className="py-20 text-center text-sm text-muted">Loading…</div>}><Page /></Suspense>} />
            })}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
