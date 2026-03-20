import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAnalysis, getProfile } from '../services/api'
import { BarChart3, Sparkles, Hash, Zap, BookOpen, Loader2 } from 'lucide-react'

const Section = ({ icon, title, color, children }) => (
  <motion.div
    className="glass"
    style={{ borderRadius: 18, padding: 28, borderColor: color + '30' }}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ color }}>{icon}</span>
      <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600 }}>{title}</h3>
    </div>
    {children}
  </motion.div>
)

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getAnalysis()
      .then(r => setAnalysis(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative', zIndex: 2 }}>
      <Loader2 size={32} color="var(--accent)" style={{ animation: 'spin-slow 1s linear infinite' }} />
    </div>
  )

  if (!analysis) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)', position: 'relative', zIndex: 2, flexDirection: 'column', gap: 12 }}>
      <BarChart3 size={40} color="var(--text3)" />
      <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 18 }}>No analysis yet. Upload your LinkedIn PDF first.</p>
    </div>
  )

  const hooks     = tryParse(analysis.hooks, [])
  const hashtags  = tryParse(analysis.hashtags, [])
  const skills    = tryParse(analysis.suggested_skills, [])

  return (
    <div className="page-root" style={{ padding: '40px', maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2 }}>
      <motion.h1
        style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      >
        <span className="shimmer-text">AI Profile Analysis</span>
      </motion.h1>
      <p style={{ color: 'var(--text3)', fontFamily: "'DM Mono',monospace", fontSize: 12, marginBottom: 32 }}>
        Generated on {new Date(analysis.created_at).toLocaleDateString()}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Full analysis */}
        <Section icon={<BarChart3 size={18} />} title="Full Profile Analysis" color="var(--accent2)">
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{analysis.full_analysis}</p>
        </Section>

        {/* Rewrites */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {analysis.rewritten_headline && (
            <Section icon={<Sparkles size={18} />} title="Rewritten Headline" color="var(--teal)">
              <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 18, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.5 }}>
                {analysis.rewritten_headline}
              </p>
            </Section>
          )}
          {skills.length > 0 && (
            <Section icon={<Zap size={18} />} title="Suggested Skills" color="#f59e0b">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skills.map(sk => (
                  <span key={sk} style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    color: '#fbbf24', fontSize: 12,
                    fontFamily: "'DM Mono',monospace",
                  }}>{sk}</span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Rewritten summary */}
        {analysis.rewritten_summary && (
          <Section icon={<BookOpen size={18} />} title="Rewritten About Section" color="var(--accent)">
            <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{analysis.rewritten_summary}</p>
          </Section>
        )}

        {/* Hooks */}
        {hooks.length > 0 && (
          <Section icon={<Zap size={18} />} title="Post Hooks (Scroll-Stoppers)" color="#f43f5e">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hooks.map((h, i) => (
                <div key={i} style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(244,63,94,0.06)',
                  border: '1px solid rgba(244,63,94,0.15)',
                  fontFamily: "'Instrument Serif',serif", fontStyle: 'italic',
                  fontSize: 15, lineHeight: 1.6, color: 'var(--text)',
                }}>
                  {h}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <Section icon={<Hash size={18} />} title="Hashtag Sets" color="var(--teal)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hashtags.map((set, i) => (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {set.map(tag => (
                    <span key={tag} style={{
                      padding: '4px 12px', borderRadius: 20,
                      background: 'rgba(45,212,191,0.08)',
                      border: '1px solid rgba(45,212,191,0.2)',
                      color: 'var(--teal)', fontSize: 12,
                      fontFamily: "'DM Mono',monospace",
                    }}>{tag}</span>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Improvement guide */}
        {analysis.improvement_guide && (
          <Section icon={<BookOpen size={18} />} title="Improvement Guide" color="var(--accent2)">
            <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{analysis.improvement_guide}</p>
          </Section>
        )}
      </div>
    </div>
  )
}

function tryParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}
