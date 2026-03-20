import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadPDF } from '../services/api'

const steps = ['Upload PDF', 'Parsing profile', 'AI analysis running', 'Ready!']

export default function UploadPage() {
  const [file, setFile]     = useState(null)
  const [stage, setStage]   = useState(-1)   // -1 = idle, 0-3 = step index
  const navigate            = useNavigate()

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1
  })

  const handleUpload = async () => {
    if (!file) return
    setStage(0)
    try {
      setStage(1)
      await uploadPDF(file)
      setStage(2)
      // Give 2s for the bg analysis task to start
      await new Promise(r => setTimeout(r, 2000))
      setStage(3)
      toast.success('Profile uploaded! AI analysis running in background.')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
      setStage(-1)
    }
  }

  const busy = stage >= 0 && stage < 3

  return (
    <div className="page-root" style={S.root}>
      <motion.div
        style={S.card}
        className="glass2"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 style={S.title}>Upload your LinkedIn PDF</h2>
        <p style={S.subtitle}>
          Go to LinkedIn → Profile → More → <code style={S.code}>Save to PDF</code>
        </p>

        {/* Drop zone */}
        <motion.div
          {...getRootProps()}
          style={{ ...S.drop, ...(isDragActive ? S.dropActive : {}), ...(file ? S.dropFilled : {}) }}
          whileHover={{ borderColor: 'rgba(108,99,255,0.5)' }}
        >
          <input {...getInputProps()} />
          {file ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={S.filePill}>
              <FileText size={20} color="var(--accent)" />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{file.name}</span>
            </motion.div>
          ) : (
            <>
              <div style={S.uploadIcon}>
                <Upload size={28} color="var(--accent)" />
              </div>
              <p style={S.dropText}>
                {isDragActive ? 'Drop it here!' : 'Drag & drop your LinkedIn PDF'}
              </p>
              <p style={S.dropSub}>or click to browse</p>
            </>
          )}
        </motion.div>

        {/* Steps progress */}
        {stage >= 0 && (
          <motion.div style={S.steps} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {steps.map((s, i) => (
              <motion.div
                key={s}
                style={S.step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div style={{ ...S.stepDot, ...(i <= stage ? S.stepDotDone : {}) }}>
                  {i < stage ? <CheckCircle2 size={14} /> : i === stage && stage < 3 ? <Loader2 size={14} style={{ animation: 'spin-slow 1s linear infinite' }} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: i <= stage ? '#fff' : 'var(--text3)', display: 'block' }} />}
                </div>
                <span style={{ ...S.stepLabel, color: i <= stage ? 'var(--text)' : 'var(--text3)' }}>{s}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.button
          style={{ ...S.btn, opacity: (!file || busy) ? 0.5 : 1 }}
          onClick={handleUpload}
          disabled={!file || busy}
          whileHover={file && !busy ? { scale: 1.02 } : {}}
          whileTap={file && !busy ? { scale: 0.98 } : {}}
        >
          {busy
            ? <><Loader2 size={16} style={{ animation: 'spin-slow 1s linear infinite' }} /> Processing...</>
            : <>Analyze Profile <ArrowRight size={16} /></>
          }
        </motion.button>
      </motion.div>
    </div>
  )
}

const S = {
  root: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', padding: 24, position: 'relative', zIndex: 2,
  },
  card: {
    width: '100%', maxWidth: 520,
    borderRadius: 24, padding: 48,
    display: 'flex', flexDirection: 'column', gap: 24,
  },
  title: { fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' },
  subtitle: { color: 'var(--text2)', fontSize: 14, fontFamily: "'DM Mono',monospace" },
  code: {
    background: 'rgba(108,99,255,0.15)', color: 'var(--accent2)',
    padding: '2px 6px', borderRadius: 4, fontSize: 12,
  },
  drop: {
    border: '1.5px dashed var(--border2)',
    borderRadius: 16, padding: '40px 24px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    cursor: 'pointer', transition: 'all .2s', minHeight: 180,
  },
  dropActive: { borderColor: 'var(--accent)', background: 'rgba(108,99,255,0.05)' },
  dropFilled: { borderStyle: 'solid', borderColor: 'rgba(45,212,191,0.4)', background: 'rgba(45,212,191,0.04)' },
  uploadIcon: {
    width: 56, height: 56, borderRadius: 16,
    background: 'rgba(108,99,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dropText: { fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 15 },
  dropSub: { color: 'var(--text3)', fontSize: 13 },
  filePill: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(45,212,191,0.08)',
    border: '1px solid rgba(45,212,191,0.2)',
    borderRadius: 12, padding: '10px 16px',
  },
  steps: { display: 'flex', flexDirection: 'column', gap: 10 },
  step: { display: 'flex', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 24, height: 24, borderRadius: '50%',
    border: '1px solid var(--border2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', transition: 'all .3s',
  },
  stepDotDone: {
    background: 'rgba(108,99,255,0.2)',
    borderColor: 'var(--accent)',
    color: 'var(--accent2)',
  },
  stepLabel: { fontFamily: "'DM Mono',monospace", fontSize: 13, transition: 'color .3s' },
  btn: {
    padding: '14px',
    background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
    border: 'none', borderRadius: 12,
    color: '#fff', fontFamily: "'Syne',sans-serif",
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 8px 24px rgba(108,99,255,0.4)',
    transition: 'opacity .2s',
  },
}
