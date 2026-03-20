import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Send, Plus, ChevronLeft, Brain, Sparkles,
  Loader2, User, Bot, ThumbsUp, ThumbsDown, History,
  ChevronUp, LogOut, LayoutDashboard, Upload, BarChart3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sendMessage, getSessions, getSession, endSession, rateMessage, getMemory } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function ChatPage() {
  const navigate                       = useNavigate()
  const { user, logout }               = useAuth()
  const [sessions, setSessions]        = useState([])
  const [activeId, setActiveId]        = useState(null)
  const [messages, setMessages]        = useState([])
  const [input, setInput]              = useState('')
  const [sending, setSending]          = useState(false)
  const [sidebarOpen, setSidebarOpen]  = useState(true)
  const [memory, setMemory]            = useState(null)
  const [showMemory, setShowMemory]    = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const bottomRef                      = useRef()
  const textareaRef                    = useRef()

  // Load sessions on mount
  useEffect(() => {
    getSessions().then(r => setSessions(r.data)).catch(() => {})
    getMemory().then(r => setMemory(r.data)).catch(() => {})
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load a session's messages
  const openSession = useCallback(async (id) => {
    if (activeId && activeId !== id) {
      endSession(activeId).catch(() => {})
    }
    setActiveId(id)
    const res = await getSession(id)
    setMessages(res.data)
  }, [activeId])

  // Start fresh session
  const newSession = () => {
    if (activeId) endSession(activeId).catch(() => {})
    setActiveId(null)
    setMessages([])
    textareaRef.current?.focus()
  }

  // Auto-resize textarea
  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setSending(true)

    // Optimistic user message
    const tempId = Date.now()
    setMessages(m => [...m, { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() }])

    try {
      const res = await sendMessage(text, activeId)
      const { reply, session_id, updated_profile } = res.data
      setActiveId(session_id)

      // Replace temp + add assistant reply
      setMessages(m => [
        ...m.filter(x => x.id !== tempId),
        { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() },
        { id: Date.now() + 1, role: 'assistant', content: reply, created_at: new Date().toISOString(), real: true }
      ])

      if (updated_profile) toast.success('✏️ Profile updated!')

      // Refresh sessions sidebar
      getSessions().then(r => setSessions(r.data))
    } catch (err) {
      toast.error('Failed to send message')
      setMessages(m => m.filter(x => x.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  const rate = async (msgId, score) => {
    try {
      await rateMessage(msgId, score)
      toast.success(score >= 4 ? '👍 Feedback saved' : '👎 Got it, I\'ll adjust')
      getMemory().then(r => setMemory(r.data))
    } catch { toast.error('Could not save rating') }
  }

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            style={S.sidebar}
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div style={S.sidebarHeader}>
              <div style={S.logoMini}>
                <Sparkles size={14} color="var(--accent)" />
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>LinkedAI</span>
              </div>
              <button style={S.iconBtn} onClick={() => setSidebarOpen(false)}>
                <ChevronLeft size={16} />
              </button>
            </div>

            <button style={S.newChat} onClick={newSession}>
              <Plus size={15} /> New Chat
            </button>

            {/* Memory badge */}
            {memory && (
              <button style={S.memoryBadge} onClick={() => setShowMemory(v => !v)}>
                <Brain size={14} color="var(--teal)" />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                  {memory.total_sessions} sessions · {memory.total_messages} msgs
                </span>
              </button>
            )}

            {/* Sessions list */}
            <div style={S.sessionList}>
              <p style={S.sectionLabel}><History size={11} /> Recent</p>
              {sessions.length === 0 && (
                <p style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>No sessions yet</p>
              )}
              {sessions.map(s => (
                <button
                  key={s.id}
                  style={{ ...S.sessionItem, ...(activeId === s.id ? S.sessionActive : {}) }}
                  onClick={() => openSession(s.id)}
                >
                  <p style={S.sessionTitle}>{s.title || 'Untitled session'}</p>
                  {s.summary && <p style={S.sessionSub}>{s.summary.slice(0, 60)}…</p>}
                </button>
              ))}
            </div>

            {/* User popup menu */}
            <div style={{ position: 'relative' }}>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    style={S.userMenu}
                    className="glass2"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    {/* User info header */}
                    <div style={S.userMenuHeader}>
                      <div style={{ ...S.avatar, width: 36, height: 36, fontSize: 15 }}>
                        {user?.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif" }}>{user?.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono',monospace" }}>{user?.email}</p>
                      </div>
                    </div>

                    <div style={S.userMenuDivider} />

                    {/* Menu items */}
                    {[
                      { icon: <LayoutDashboard size={14} />, label: 'Dashboard',  action: () => { navigate('/dashboard'); setShowUserMenu(false) } },
                      { icon: <Upload size={14} />,          label: 'Upload PDF', action: () => { navigate('/upload');    setShowUserMenu(false) } },
                      { icon: <BarChart3 size={14} />,        label: 'Analysis',  action: () => { navigate('/analysis'); setShowUserMenu(false) } },
                      { icon: <Brain size={14} />,            label: 'My Memory', action: () => { setShowMemory(v => !v); setShowUserMenu(false) } },
                    ].map(item => (
                      <button key={item.label} style={S.userMenuItem} onClick={item.action}>
                        <span style={{ color: 'var(--accent2)' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}

                    <div style={S.userMenuDivider} />

                    <button
                      style={{ ...S.userMenuItem, color: 'var(--danger)' }}
                      onClick={() => { logout(); navigate('/login') }}
                    >
                      <LogOut size={14} />
                      <span>Log out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clickable user chip */}
              <motion.button
                style={S.userChip}
                onClick={() => setShowUserMenu(v => !v)}
                whileHover={{ background: 'var(--surface2)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div style={S.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono',monospace" }}>{user?.email}</p>
                </div>
                <motion.div
                  animate={{ rotate: showUserMenu ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp size={14} color="var(--text3)" />
                </motion.div>
              </motion.button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat */}
      <div style={S.main}>
        {/* Top bar */}
        <div style={S.topbar} className="glass">
          {!sidebarOpen && (
            <button style={S.iconBtn} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, color: 'var(--text2)' }}>
            {activeId ? `Session #${activeId}` : 'New conversation'}
          </span>
          <div style={{ flex: 1 }} />
          {memory && (
            <div style={S.memoryPill}>
              <Brain size={12} color="var(--teal)" />
              <span>Memory active</span>
            </div>
          )}
        </div>

        {/* Memory panel */}
        <AnimatePresence>
          {showMemory && memory && (
            <motion.div
              style={S.memoryPanel}
              className="glass"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <p style={S.memoryTitle}><Brain size={14} /> What I know about you</p>
              <div style={S.memoryGrid}>
                {[
                  ['Tone', memory.tone_preference],
                  ['Industry', memory.industry_focus],
                  ['Goals', memory.career_goals],
                  ['Style', memory.communication_style],
                  ['Strengths', memory.key_strengths],
                ].filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} style={S.memoryItem}>
                    <span style={S.memoryKey}>{k}</span>
                    <span style={S.memoryVal}>{v?.slice(0, 80)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div style={S.messages}>
          {messages.length === 0 && (
            <motion.div style={S.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={S.emptyIcon}><Sparkles size={32} color="var(--accent)" /></div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700 }}>
                How can I help with your profile?
              </h3>
              <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 380, textAlign: 'center' }}>
                Ask me anything — analysis, rewrites, hooks, hashtags. Or say "change my headline to…" to update it directly.
              </p>
              <div style={S.suggestions}>
                {[
                  'What are the weaknesses in my profile?',
                  'Rewrite my About section',
                  'Give me 5 post hooks for my industry',
                  'Add Python to my skills',
                ].map(s => (
                  <button key={s} style={S.suggestion} onClick={() => { setInput(s); textareaRef.current?.focus() }}>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                style={{ ...S.msgRow, ...(msg.role === 'user' ? S.msgRowUser : {}) }}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                {/* Avatar */}
                <div style={{ ...S.msgAvatar, ...(msg.role === 'user' ? S.msgAvatarUser : S.msgAvatarBot) }}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>

                {/* Bubble */}
                <div style={{ ...S.bubble, ...(msg.role === 'user' ? S.bubbleUser : S.bubbleBot) }}>
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p style={{ margin: '0 0 8px', lineHeight: 1.7, fontSize: 14 }}>{children}</p>,
                      code: ({children}) => <code style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: 4 }}>{children}</code>,
                      ul: ({children}) => <ul style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ul>,
                      li: ({children}) => <li style={{ marginBottom: 4, fontSize: 14 }}>{children}</li>,
                      strong: ({children}) => <strong style={{ color: 'var(--accent2)' }}>{children}</strong>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Rating for assistant messages */}
                  {msg.role === 'assistant' && msg.real && (
                    <div style={S.rateRow}>
                      <button style={S.rateBtn} onClick={() => rate(msg.id, 5)}>
                        <ThumbsUp size={12} />
                      </button>
                      <button style={S.rateBtn} onClick={() => rate(msg.id, 2)}>
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {sending && (
            <motion.div style={S.msgRow} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ ...S.msgAvatar, ...S.msgAvatarBot }}>
                <Bot size={14} />
              </div>
              <div style={{ ...S.bubble, ...S.bubbleBot, ...S.typing }}>
                <span style={S.dot} /> <span style={{ ...S.dot, animationDelay: '.15s' }} /> <span style={{ ...S.dot, animationDelay: '.3s' }} />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={S.inputBar} className="glass">
          <textarea
            ref={textareaRef}
            style={S.textarea}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message LinkedAI…"
            rows={1}
          />
          <motion.button
            style={{ ...S.sendBtn, opacity: input.trim() ? 1 : 0.4 }}
            onClick={handleSend}
            disabled={!input.trim() || sending}
            whileHover={input.trim() ? { scale: 1.05 } : {}}
            whileTap={input.trim() ? { scale: 0.95 } : {}}
          >
            {sending ? <Loader2 size={18} style={{ animation: 'spin-slow 1s linear infinite' }} /> : <Send size={18} />}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

const S = {
  root: { display: 'flex', height: '100vh', position: 'relative', zIndex: 2, overflow: 'hidden' },

  // Sidebar
  sidebar: {
    width: 272, height: '100vh', flexShrink: 0,
    borderRight: '1px solid var(--border)',
    background: 'rgba(5,5,8,0.9)',
    backdropFilter: 'blur(20px)',
    display: 'flex', flexDirection: 'column', padding: '20px 12px',
    gap: 8, overflowY: 'auto',
  },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  logoMini: { display: 'flex', alignItems: 'center', gap: 6 },
  newChat: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px',
    background: 'rgba(108,99,255,0.12)',
    border: '1px solid rgba(108,99,255,0.25)',
    borderRadius: 10, color: 'var(--accent2)',
    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'background .2s',
  },
  memoryBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px',
    background: 'rgba(45,212,191,0.06)',
    border: '1px solid rgba(45,212,191,0.15)',
    borderRadius: 8, color: 'var(--teal)', cursor: 'pointer',
  },
  sessionList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 },
  sectionLabel: {
    display: 'flex', alignItems: 'center', gap: 5,
    color: 'var(--text3)', fontSize: 11,
    fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em',
    textTransform: 'uppercase', padding: '8px 4px 4px',
  },
  sessionItem: {
    width: '100%', textAlign: 'left',
    padding: '10px 12px', borderRadius: 10,
    background: 'transparent', border: 'none',
    cursor: 'pointer', transition: 'background .15s',
    color: 'var(--text)',
  },
  sessionActive: { background: 'var(--surface2)' },
  sessionTitle: { fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sessionSub: { color: 'var(--text3)', fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userChip: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 12,
    background: 'var(--surface)', border: '1px solid var(--border)',
    cursor: 'pointer', width: '100%', color: 'var(--text)',
    transition: 'background .15s',
  },
  userMenu: {
    position: 'absolute', bottom: 'calc(100% + 8px)',
    left: 0, right: 0,
    borderRadius: 14, padding: '8px',
    zIndex: 50,
  },
  userMenuHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 8px 12px',
  },
  userMenuDivider: {
    height: 1, background: 'var(--border)',
    margin: '4px 0',
  },
  userMenuItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '9px 10px',
    background: 'transparent', border: 'none',
    borderRadius: 8, color: 'var(--text2)',
    fontFamily: "'Syne',sans-serif", fontSize: 13,
    cursor: 'pointer', transition: 'background .15s',
    textAlign: 'left',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--teal))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
  },

  // Main
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 20px', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    background: 'var(--surface)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text2)', cursor: 'pointer',
  },
  memoryPill: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px',
    background: 'rgba(45,212,191,0.08)',
    border: '1px solid rgba(45,212,191,0.2)',
    borderRadius: 20,
    color: 'var(--teal)', fontSize: 11,
    fontFamily: "'DM Mono',monospace",
  },

  // Memory panel
  memoryPanel: {
    padding: '16px 24px', borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  memoryTitle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: "'Syne',sans-serif", fontSize: 12,
    color: 'var(--teal)', marginBottom: 10,
  },
  memoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 },
  memoryItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  memoryKey: { fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  memoryVal: { fontSize: 12, color: 'var(--text2)' },

  // Messages
  messages: { flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  msgRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  msgAvatarBot: { background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)' },
  msgAvatarUser: { background: 'linear-gradient(135deg, #2dd4bf, #0891b2)' },
  bubble: {
    maxWidth: '72%', borderRadius: 18,
    padding: '12px 16px', lineHeight: 1.6,
  },
  bubbleBot: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    background: 'linear-gradient(135deg, rgba(108,99,255,0.25), rgba(139,92,246,0.2))',
    border: '1px solid rgba(108,99,255,0.3)',
    borderTopRightRadius: 4,
  },
  rateRow: { display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' },
  rateBtn: {
    padding: '4px 8px', border: '1px solid var(--border)',
    borderRadius: 6, background: 'transparent',
    color: 'var(--text3)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
    transition: 'all .15s',
  },
  typing: {
    display: 'flex', alignItems: 'center', gap: 5, minWidth: 60,
  },
  dot: {
    display: 'inline-block',
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--accent2)',
    animation: 'bounce 1.2s ease-in-out infinite',
  },

  // Empty state
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: '60px 24px', textAlign: 'center',
    margin: 'auto',
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    background: 'rgba(108,99,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 40px var(--glow)',
  },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  suggestion: {
    padding: '8px 14px', border: '1px solid var(--border2)',
    borderRadius: 20, background: 'var(--surface)',
    color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
    fontFamily: "'DM Mono',monospace", transition: 'all .15s',
  },

  // Input
  inputBar: {
    display: 'flex', alignItems: 'flex-end', gap: 10,
    padding: '12px 16px', margin: '12px 16px',
    borderRadius: 18,
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none',
    color: 'var(--text)', fontFamily: "'Syne',sans-serif",
    fontSize: 14, resize: 'none', outline: 'none',
    lineHeight: 1.6, maxHeight: 180, overflowY: 'auto',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
    border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(108,99,255,0.5)',
    transition: 'opacity .2s',
  },
}
