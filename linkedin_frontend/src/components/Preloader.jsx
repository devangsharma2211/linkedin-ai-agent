import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export default function Preloader({ onComplete }) {
  const rootRef    = useRef()
  const barRef     = useRef()
  const textRef    = useRef()
  const subtextRef = useRef()
  const countRef   = useRef()

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(rootRef.current, {
          opacity: 0, duration: 0.6, ease: 'power2.inOut',
          onComplete
        })
      }
    })

    // Animate progress bar
    tl.to(barRef.current, {
      scaleX: 1, duration: 2.2, ease: 'power3.inOut'
    }, 0)

    // Count up 0 → 100
    tl.to(countRef.current, {
      innerText: 100,
      duration: 2.2,
      ease: 'power3.inOut',
      snap: { innerText: 1 },
      modifiers: { innerText: v => Math.round(v) + '%' }
    }, 0)

    // Brand text reveal character by character
    const letters = textRef.current.querySelectorAll('span')
    tl.fromTo(letters,
      { opacity: 0, y: 40, rotateX: -90 },
      { opacity: 1, y: 0, rotateX: 0, stagger: 0.05, duration: 0.5, ease: 'back.out(2)' },
      0.3
    )

    // Subtext fade
    tl.fromTo(subtextRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5 },
      1.0
    )

    return () => tl.kill()
  }, [onComplete])

  // Split brand name into individual letter spans
  const brand = 'LinkedAI'

  return (
    <div ref={rootRef} style={styles.root}>
      {/* Radial glow */}
      <div style={styles.glow} />

      {/* Brand */}
      <div style={styles.center}>
        <h1 ref={textRef} style={styles.brand}>
          {brand.split('').map((ch, i) => (
            <span key={i} style={{ display: 'inline-block', opacity: 0 }}>{ch}</span>
          ))}
        </h1>
        <p ref={subtextRef} style={{ ...styles.subtext, opacity: 0 }}>
          Profile Intelligence Engine
        </p>
      </div>

      {/* Progress */}
      <div style={styles.progressWrap}>
        <div style={styles.track}>
          <div ref={barRef} style={styles.bar} />
        </div>
        <span ref={countRef} style={styles.count}>0%</span>
      </div>

      {/* Corner decoration */}
      <div style={styles.cornerTL} />
      <div style={styles.cornerBR} />
    </div>
  )
}

const styles = {
  root: {
    position: 'fixed', inset: 0,
    background: '#050508',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  glow: {
    position: 'absolute',
    width: 600, height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  center: {
    textAlign: 'center',
    marginBottom: 60,
    perspective: 600,
  },
  brand: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(48px, 8vw, 96px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #a78bfa 0%, #6c63ff 40%, #2dd4bf 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
    marginBottom: 16,
  },
  subtext: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color: '#5c5880',
  },
  progressWrap: {
    position: 'absolute',
    bottom: 60,
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
  },
  track: {
    width: '100%', height: 1,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    background: 'linear-gradient(90deg, #6c63ff, #2dd4bf)',
    transformOrigin: 'left center',
    transform: 'scaleX(0)',
  },
  count: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: '#5c5880',
    letterSpacing: '0.1em',
  },
  cornerTL: {
    position: 'absolute', top: 24, left: 24,
    width: 40, height: 40,
    borderTop: '1px solid rgba(108,99,255,0.3)',
    borderLeft: '1px solid rgba(108,99,255,0.3)',
  },
  cornerBR: {
    position: 'absolute', bottom: 24, right: 24,
    width: 40, height: 40,
    borderBottom: '1px solid rgba(45,212,191,0.3)',
    borderRight: '1px solid rgba(45,212,191,0.3)',
  },
}
