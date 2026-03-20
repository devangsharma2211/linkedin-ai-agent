import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MessageSquare, Upload, BarChart3, Brain, LogOut,
  Sparkles, ChevronRight, User, Star, Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getProfile, getAnalysis, getMemory } from '../services/api'

const card = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function DashboardPage() {
  const { user, logout }          = useAuth()
  const [profile, setProfile]     = useState(null)
  const [analysis, setAnalysis]   = useState(null)
  const [memory, setMemory]       = useState(null)
  const navigate                  = useNavigate()

  useEffect(() => {
    getProfile().then(r => setProfile(r.data)).catch(() => {})
    getAnalysis().then(r => setAnalysis(r.data)).catch(() => {})
    getMemory().then(r => setMemory(r.data)).catch(() => {})
  }, [])

  const navCards = [
    { icon: <MessageSquare size={22} />, label: 'Open Chat', sub: 'Talk to your AI coach', color: '#6c63ff', to: '/chat' },
    { icon: <Upload size={22} />, label: profile ? 'Re-upload PDF' : 'Upload LinkedIn PDF', sub: profile ? 'Update your profile' : 'Get started', color: '#2dd4bf', to: '/upload' },
    { icon: <BarChart3 size={22} />, label: 'View Analysis', sub: analysis ? 'Report ready' : 'Upload PDF first', color: '#a78bfa', to: '/analysis' },
  ]

  return (
    <div className="page-root" style={S.root}>
      {/* Header */}
      <motion.header
        style={S.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={S.logoRow}>
          <div style={S.logoIcon}><Sparkles size={16} color="#fff" /></div>
          <span style={S.logoText}>LinkedAI</span>
        </div>
        <div style={S.headerRight}>
          <div style={S.userPill}>
            <div style={S.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</span>
          </div>
          <button style={S.logoutBtn} onClick={() => { logout(); navigate('/login') }}>
            <LogOut size={15} />
          </button>
        </div>
      </motion.header>

      <div style={S.content}>
        {/* Welcome */}
        <motion.div
          style={S.welcome}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 style={S.welcomeTitle}>
            Good to see you,{' '}
            <span className="shimmer-text">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p style={S.welcomeSub}>
            {profile ? 'Your profile is loaded. What would you like to work on?' : 'Upload your LinkedIn PDF to get started.'}
          </p>
        </motion.div>

        {/* Nav cards */}
        <motion.div
          style={S.cards}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
        >
          {navCards.map(c => (
            <motion.button
              key={c.label}
              variants={card}
              style={S.navCard}
              className="glass2"
              onClick={() => navigate(c.to)}
              whileHover={{ y: -4, borderColor: c.color + '44' }}
              whileTap={{ scale: 0.97 }}
            >
              <div style={{ ...S.navIcon, background: c.color + '18', border: `1px solid ${c.color}33` }}>
                <span style={{ color: c.color }}>{c.icon}</span>
              </div>
              <div style={S.navText}>
                <span style={S.navLabel}>{c.label}</span>
                <span style={S.navSub}>{c.sub}</span>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </motion.button>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          style={S.statsRow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {[
            { icon: <Brain size={16} color="var(--teal)" />, label: 'Sessions', value: memory?.total_sessions ?? 0 },
            { icon: <MessageSquare size={16} color="var(--accent2)" />, label: 'Messages', value: memory?.total_messages ?? 0 },
            { icon: <Star size={16} color="#f59e0b" />, label: 'Avg rating', value: memory?.avg_feedback_score ? memory.avg_feedback_score.toFixed(1) + ' / 5' : '—' },
            { icon: <Zap size={16} color="var(--accent)" />, label: 'Profile', value: profile ? 'Loaded' : 'Not loaded' },
          ].map(s => (
            <div key={s.label} style={S.stat} className="glass">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {s.icon}
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
              </div>
              <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20 }}>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Profile headline preview */}
        {profile?.headline && (
          <motion.div
            style={S.profilePreview}
            className="glass"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <User size={14} color="var(--accent2)" />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current headline</span>
            </div>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 18, fontStyle: 'italic', color: 'var(--text)' }}>
              {profile.headline}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

const S = {
  root: { minHeight: '100vh', position: 'relative', zIndex: 2 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 40px', borderBottom: '1px solid var(--border)',
    background: 'rgba(5,5,8,0.7)', backdropFilter: 'blur(16px)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 32, height: 32, borderRadius: 10,
    background: 'linear-gradient(135deg, #6c63ff, #2dd4bf)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  userPill: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px 6px 6px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 20,
  },
  avatar: {
    width: 26, height: 26, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--teal))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 12,
  },
  logoutBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: 'var(--surface)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', cursor: 'pointer',
  },
  content: { padding: '48px 40px', maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 },
  welcome: {},
  welcomeTitle: { fontFamily: "'Syne',sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 },
  welcomeSub: { color: 'var(--text2)', fontSize: 15, fontFamily: "'DM Mono',monospace" },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 },
  navCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '20px', borderRadius: 18,
    border: '1px solid var(--border)',
    cursor: 'pointer', textAlign: 'left',
    transition: 'border-color .2s',
    background: 'transparent',
    color: 'var(--text)',
  },
  navIcon: {
    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  navText: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  navLabel: { fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600 },
  navSub: { fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text3)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  stat: { borderRadius: 14, padding: '16px 18px' },
  profilePreview: { borderRadius: 16, padding: '20px 24px' },
}
