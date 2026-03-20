import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import Preloader from './components/Preloader'
import Scene3D from './components/Scene3D'
import './index.css'

// Lazy-load pages for faster initial load
const AuthPage     = lazy(() => import('./pages/AuthPage'))
const DashboardPage= lazy(() => import('./pages/DashboardPage'))
const UploadPage   = lazy(() => import('./pages/UploadPage'))
const ChatPage     = lazy(() => import('./pages/ChatPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))

// Route guard — redirects to /login if not authenticated
function Private({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

// Animated page wrapper
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
}
function Page({ children }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}

function AppInner() {
  const [preloaderDone, setPreloaderDone] = useState(false)
  const { loading } = useAuth()

  return (
    <>
      {/* Always-on 3D background */}
      <Scene3D />

      {/* Preloader — shown until GSAP timeline finishes */}
      <AnimatePresence>
        {!preloaderDone && (
          <Preloader onComplete={() => setPreloaderDone(true)} />
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#13131e',
            color: '#f0eeff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
          },
          success: { iconTheme: { primary: '#2dd4bf', secondary: '#050508' } },
          error:   { iconTheme: { primary: '#ff5f6d', secondary: '#050508' } },
        }}
      />

      {/* App routes */}
      {preloaderDone && !loading && (
        <Suspense fallback={null}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login"    element={<Page><AuthPage /></Page>} />
              <Route path="/dashboard" element={<Private><Page><DashboardPage /></Page></Private>} />
              <Route path="/upload"   element={<Private><Page><UploadPage /></Page></Private>} />
              <Route path="/chat"     element={<Private><Page><ChatPage /></Page></Private>} />
              <Route path="/analysis" element={<Private><Page><AnalysisPage /></Page></Private>} />
              <Route path="*"         element={<Navigate to="/login" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  )
}
