import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Mail, Lock, ArrowRight, Loader2, Linkedin } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { register, login, getMeWithToken } from '../services/api'

const fade = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

export default function AuthPage() {
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', linkedin_url: '' })
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'register') {
        await register({ name: form.name, email: form.email, password: form.password, linkedin_url: form.linkedin_url || null })
        toast.success('Account created! Please log in.')
        setMode('login')
      } else {
        const res = await login({ email: form.email, password: form.password })
        const { access_token } = res.data
        // Pass token directly — no interceptor timing issue
        const meRes = await getMeWithToken(access_token)
        loginUser(access_token, meRes.data)
        toast.success(`Welcome back, ${meRes.data.name}!`)
        navigate('/dashboard')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-root" style={S.root}>
      {/* Left panel — branding */}
      <motion.div
        style={S.left}
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={S.logo}>
          <div style={S.logoIcon}>
            <Linkedin size={20} color="#fff" />
          </div>
          <span style={S.logoText}>LinkedAI</span>
        </div>

        <div style={S.leftContent}>
          <motion.p style={S.tagline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            Your LinkedIn profile,<br />
            <span className="shimmer-text" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: '1.1em' }}>
              reimagined by AI.
            </span>
          </motion.p>

          <motion.div style={S.features} initial="hidden" animate="visible" variants={stagger}>
            {['Deep AI profile analysis', 'CRUD via natural conversation', 'Memory-powered personalization', 'Hooks, hashtags & full rewrites'].map(f => (
              <motion.div key={f} variants={fade} style={S.feature}>
                <div style={S.featureDot} />
                <span style={{ color: 'var(--text2)', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{f}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Decorative ring */}
        <div style={S.ring} />
        <div style={S.ring2} />
      </motion.div>

      {/* Right panel — form */}
      <motion.div
        style={S.right}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="glass2" style={S.card}>
          {/* Mode toggle */}
          <div style={S.tabs}>
            {['login', 'register'].map(m => (
              <button key={m} style={{ ...S.tab, ...(mode === m ? S.tabActive : {}) }} onClick={() => setMode(m)}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={S.form}
            >
              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <Field icon={<User size={15} />} placeholder="Full name" value={form.name} onChange={set('name')} required />
                  </motion.div>
                )}
              </AnimatePresence>

              <Field icon={<Mail size={15} />} type="email" placeholder="Email address" value={form.email} onChange={set('email')} required />
              <Field icon={<Lock size={15} />} type="password" placeholder="Password" value={form.password} onChange={set('password')} required />

              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <Field icon={<Linkedin size={15} />} placeholder="LinkedIn URL (optional)" value={form.linkedin_url} onChange={set('linkedin_url')} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                style={S.btn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
              >
                {loading
                  ? <Loader2 size={18} style={{ animation: 'spin-slow 1s linear infinite' }} />
                  : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>
                }
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

function Field({ icon, ...props }) {
  return (
    <div style={S.field}>
      <span style={S.fieldIcon}>{icon}</span>
      <input style={S.input} {...props} />
    </div>
  )
}

const S = {
  root: {
    display: 'flex', minHeight: '100vh',
    position: 'relative', zIndex: 2,
  },
  left: {
    flex: 1, padding: '48px 56px',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative', overflow: 'hidden',
    borderRight: '1px solid var(--border)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #6c63ff, #2dd4bf)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' },
  leftContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 48 },
  tagline: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(28px, 3.5vw, 48px)',
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },
  features: { display: 'flex', flexDirection: 'column', gap: 16 },
  feature: { display: 'flex', alignItems: 'center', gap: 12 },
  featureDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--accent)', flexShrink: 0,
    boxShadow: '0 0 8px var(--glow)',
  },
  ring: {
    position: 'absolute', right: -120, top: '50%',
    transform: 'translateY(-50%)',
    width: 400, height: 400,
    borderRadius: '50%',
    border: '1px solid rgba(108,99,255,0.1)',
    pointerEvents: 'none',
  },
  ring2: {
    position: 'absolute', right: -60, top: '50%',
    transform: 'translateY(-50%)',
    width: 280, height: 280,
    borderRadius: '50%',
    border: '1px solid rgba(45,212,191,0.08)',
    pointerEvents: 'none',
  },
  right: {
    width: '44%', minWidth: 380,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 40,
  },
  card: {
    width: '100%', maxWidth: 420,
    borderRadius: 24,
    padding: 40,
  },
  tabs: {
    display: 'flex', gap: 4,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1, padding: '9px 0',
    border: 'none', borderRadius: 9,
    background: 'transparent',
    color: 'var(--text2)',
    fontFamily: "'Syne', sans-serif",
    fontSize: 13, fontWeight: 500,
    cursor: 'pointer', transition: 'all .2s',
  },
  tabActive: {
    background: 'var(--accent)',
    color: '#fff',
    boxShadow: '0 4px 16px rgba(108,99,255,0.4)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: {
    position: 'relative',
    display: 'flex', alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute', left: 14,
    color: 'var(--text3)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--text)',
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    outline: 'none',
    transition: 'border .2s',
  },
  btn: {
    marginTop: 8,
    padding: '14px',
    background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
    border: 'none', borderRadius: 12,
    color: '#fff',
    fontFamily: "'Syne', sans-serif",
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 8px 24px rgba(108,99,255,0.4)',
  },
}
