'use client'

import { motion, useScroll, useSpring, useTransform } from "framer-motion"
import {
  ArrowRight, BadgeCheck, BarChart3, Brain, Building2, CalendarDays,
  Check, ChevronRight, CircuitBoard, Globe, GraduationCap,
  Headphones, HeartPulse, LayoutDashboard, LineChart, Link2, Lock, LogIn,
  MessagesSquare, Mic, PhoneCall, PlugZap, Rocket, ShieldCheck, ShoppingBag,
  Sparkles, Star, Stethoscope, Timer, Users, Wallet, Workflow, Zap,
  Play, Square
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useOrg } from "@/contexts/OrgContext"

const WHATSAPP_DEMO = "wa.me/917015551637?text=Hi!%20I%20want%20to%20test%20Vox%20AI."
const VOICE_DEMO = "tel:+918071583309"
const CALENDLY = "https://wa.me/917015551637?text=Hello%20VoxAI%20Team!%20I%20would%20like%20to%20discuss%20custom%20pricing%20options%20for%20my%20business."

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, start: boolean, durationMs = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, start, durationMs])
  return value
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionHeading({ eyebrow, title, subtitle }: {
  eyebrow: string; title: string; subtitle: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="font-display mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
    </div>
  )
}

function GradientOrb({ className, color }: { className: string; color: "primary" | "accent" }) {
  const c = color === "primary" ? "hsl(var(--primary) / .22)" : "hsl(var(--accent) / .20)"
  return (
    <div className={"pointer-events-none absolute rounded-full blur-3xl " + className}
      style={{ background: `radial-gradient(circle at 30% 30%, ${c}, transparent 60%)` }} aria-hidden />
  )
}

function NeuralField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const points = Array.from({ length: 55 }).map(() => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00048,
      vy: (Math.random() - 0.5) * 0.00048,
    }))
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const { width, height } = parent.getBoundingClientRect()
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)
      for (const p of points) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > 1) p.vx *= -1
        if (p.y < 0 || p.y > 1) p.vy *= -1
      }
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j]
          const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h
          const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
          if (dist > 190) continue
          ctx.strokeStyle = `rgba(255,255,255,${(1 - dist / 190) * 0.22})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        }
      }
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, "rgba(160, 85, 255, 0.40)")
      grad.addColorStop(0.5, "rgba(45, 212, 255, 0.30)")
      grad.addColorStop(1, "rgba(160, 85, 255, 0.40)")
      for (const p of points) {
        ctx.fillStyle = grad; ctx.globalAlpha = 0.9
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60" aria-hidden />
}

// ─── Hero Demo ─────────────────────────────────────────────────────────────────

function HeroDemoPanel() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'voice' | 'automation'>('whatsapp')

  const whatsappMessages = useMemo(() => [
    { from: "lead", text: "Hi, I'm interested in your MBA program.", t: "10:14" },
    { from: "ai", text: "Great! I'm the VoxAI admission assistant. Are you looking at full-time or part-time MBA?", t: "10:14" },
    { from: "lead", text: "Full-time, starting this September.", t: "10:15" },
    { from: "ai", text: "Perfect. I can schedule a counselling call for you. What's your preferred date?", t: "10:15" },
  ], [])

  const voiceLogs = [
    { role: "AI", text: "Hello! You've reached VoxAI dental clinic. Are you calling to book an appointment?", time: "0:02" },
    { role: "User", text: "Yes, I need a cleaning this week.", time: "0:08" },
    { role: "AI", text: "We have Thursday at 3 PM or Friday at 11 AM available. Which works for you?", time: "0:12" },
    { role: "User", text: "Thursday at 3 works great.", time: "0:18" },
    { role: "AI", text: "Perfect. I've booked you for Thursday at 3 PM. You'll receive a confirmation SMS.", time: "0:24" },
  ]

  const automationSteps = [
    { label: "WhatsApp Lead Triggers", icon: <MessagesSquare className="h-4 w-4" />, color: "text-emerald-400", status: "running" },
    { label: "AI Qualification Logic", icon: <Brain className="h-4 w-4" />, color: "text-purple-400", status: "running" },
    { label: "CRM Data Sync (HubSpot)", icon: <Link2 className="h-4 w-4" />, color: "text-blue-400", status: "running" },
    { label: "Calendar Booking (Google)", icon: <CalendarDays className="h-4 w-4" />, color: "text-yellow-400", status: "running" },
    { label: "Confirmation + Follow-up", icon: <Zap className="h-4 w-4" />, color: "text-cyan-400", status: "done" },
  ]

  return (
    <div className="vox-glass vox-noise rounded-2xl p-5 vox-glow">
      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1 mb-4">
        {[
          { key: 'whatsapp', label: 'WhatsApp AI', icon: <MessagesSquare className="h-3.5 w-3.5" /> },
          { key: 'voice', label: 'Voice AI', icon: <Mic className="h-3.5 w-3.5" /> },
          { key: 'automation', label: 'Automation', icon: <Workflow className="h-3.5 w-3.5" /> },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 ${activeTab === tab.key
              ? 'bg-gradient-to-r from-[hsl(var(--primary)/.8)] to-[hsl(var(--accent)/.7)] text-white shadow'
              : 'text-muted-foreground hover:text-foreground'
              }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/55">
                <MessagesSquare className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold">Vox WhatsApp Agent</div>
              <div className="text-[10px] text-muted-foreground">24/7 • Multi-language • Context-aware</div>
            </div>
            <span className="ml-auto border border-white/10 bg-white/5 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full">Live</span>
          </div>
          {whatsappMessages.map((m, idx) => {
            const isAI = m.from === "ai"
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.07 }}
                className={"flex " + (isAI ? "justify-start" : "justify-end")}>
                <div className={"max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                  (isAI ? "bg-white/5 text-foreground border border-white/10"
                    : "bg-gradient-to-br from-[hsl(var(--primary)/.85)] to-[hsl(var(--accent)/.75)] text-white")}>
                  <div>{m.text}</div>
                  <div className={"mt-1 text-[11px] " + (isAI ? "text-muted-foreground" : "text-white/80")}>{m.t}</div>
                </div>
              </motion.div>
            )
          })}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_14px_hsl(var(--accent)/.8)]" />
            <div className="text-xs text-muted-foreground">AI is typing…</div>
          </div>
        </div>
      )}

      {/* Voice Tab */}
      {activeTab === 'voice' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/55">
                <Mic className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold">Vox Voice Agent</div>
              <div className="text-[10px] text-muted-foreground">Human-like • Real-time • Bookings</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">LIVE CALL</span>
            </div>
          </div>
          {/* Waveform visual */}
          <div className="mb-4 flex items-center justify-center gap-[3px] h-10">
            {Array.from({ length: 32 }).map((_, i) => (
              <motion.div key={i}
                className="w-[3px] rounded-full bg-gradient-to-t from-purple-600 to-blue-400"
                animate={{ height: [8, Math.random() * 32 + 8, 8] }}
                transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.03 }} />
            ))}
          </div>
          <div className="space-y-2">
            {voiceLogs.map((log, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: log.role === 'AI' ? -8 : 8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-xl px-3 py-2 text-xs ${log.role === 'AI' ? 'bg-white/5 border border-white/10' : 'bg-purple-600/15 border border-purple-500/20'}`}>
                <div className="flex justify-between mb-0.5">
                  <span className={`font-semibold ${log.role === 'AI' ? 'text-[hsl(var(--accent))]' : 'text-purple-400'}`}>{log.role}</span>
                  <span className="text-muted-foreground">{log.time}</span>
                </div>
                <div className="text-foreground/85">{log.text}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Automation Tab */}
      {activeTab === 'automation' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-500 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/55">
                <Workflow className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold">Vox Automation Pipeline</div>
              <div className="text-[10px] text-muted-foreground">End-to-end • Zero human touch</div>
            </div>
            <span className="ml-auto border border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400 px-2 py-0.5 rounded-full">Running</span>
          </div>
          <div className="space-y-2">
            {automationSteps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.09 }}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <div className={`${step.color}`}>{step.icon}</div>
                <div className="flex-1 text-xs text-foreground/90">{step.label}</div>
                <div className="flex items-center gap-1">
                  {step.status === 'done'
                    ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                    : <motion.div className="h-2 w-2 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }} />
                  }
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
            ✓ 147 leads processed today · 0 manual touchpoints
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────────

function Navbar({ brandName }: { brandName: string }) {
  const { user, loading } = useOrg()

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <a href="#" className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent))] text-white shadow-lg">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="font-display text-sm font-semibold tracking-tight">{brandName}</div>
              </div>
            </a>

            <div className="hidden items-center gap-6 md:flex">
              {[["Solutions", "#solutions"], ["How it works", "#process"], ["Industries", "#industries"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
                <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{label}</a>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(CALENDLY, "_blank")}
                className="hidden border border-white/10 bg-white/5 text-foreground hover:bg-white/10 md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors">
                Book a Call <ChevronRight className="h-4 w-4" />
              </button>
              {!loading && (
                user ? (
                  <Link href="/dashboard"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-95 transition-opacity">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                ) : (
                  <Link href="/login"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-95 transition-opacity">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 20 })

  const [privacyUrl, setPrivacyUrl] = useState('/privacy-policy.html')
  const [brandName, setBrandName] = useState('VOX AI')
  const [brandNameShort, setBrandNameShort] = useState('VoxAI')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('10xyourbusiness')) {
      setPrivacyUrl('https://app.10xyourbusiness.in/privacy-policy.html')
      setBrandName('10x Your Business')
      setBrandNameShort('10x Your Business')
    }
  }, [])
  const [statsInView, setStatsInView] = useState(false)
  const statsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setStatsInView(true)
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const s1 = useCountUp(60, statsInView)
  const s2 = useCountUp(40, statsInView)
  const s3 = useCountUp(80, statsInView)
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -40])

  return (
    <div className="dark min-h-screen bg-[#040711] text-foreground">

      {/* Progress bar */}
      <motion.div className="fixed left-0 top-0 h-1 w-full origin-left bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-[hsl(var(--primary))]"
        style={{ scaleX: progress }} aria-hidden />

      <Navbar brandName={brandName} />

      <main className="pt-28">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 vox-grid opacity-70" />
            <GradientOrb className="-top-24 left-[-10%] h-[580px] w-[580px]" color="primary" />
            <GradientOrb className="top-10 right-[-12%] h-[580px] w-[580px]" color="accent" />
            <div className="absolute inset-0 opacity-70"><NeuralField /></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/50 to-black" />
          </div>

          <div className="vox-container vox-noise relative">
            <div className="grid items-center gap-12 pb-20 pt-10 md:grid-cols-2 md:pb-28 md:pt-16">
              <motion.div style={{ y: heroY }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                  Agentic AI Studio · WhatsApp · Voice · Automation
                </div>
                <h1 className="font-display mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  We Build{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))]">End-to-End AI</span>{" "}
                  Systems for Your Business.
                </h1>
                <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {brandNameShort} is an agentic AI studio. We design and deploy intelligent WhatsApp agents, Voice AI agents, and custom automation workflows — so your business runs itself.
                </p>

                {/* Three Pillars inline */}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[
                    { icon: <MessagesSquare className="h-4 w-4" />, label: "WhatsApp AI", color: "text-emerald-400" },
                    { icon: <Mic className="h-4 w-4" />, label: "Voice AI", color: "text-purple-400" },
                    { icon: <Workflow className="h-4 w-4" />, label: "Automation", color: "text-cyan-400" },
                  ].map((p, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-3 text-center">
                      <span className={p.color}>{p.icon}</span>
                      <span className="text-xs text-foreground/80">{p.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a href={`https://${WHATSAPP_DEMO}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center h-11 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-6 rounded-xl font-medium text-sm hover:opacity-95 transition-opacity">
                    Test WhatsApp AI <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a href={VOICE_DEMO}
                    className="inline-flex items-center justify-center h-11 border border-white/10 bg-white/5 hover:bg-white/10 text-white px-6 rounded-xl font-medium text-sm transition-colors">
                    <PhoneCall className="mr-2 h-4 w-4 text-purple-400 animate-pulse" /> Test Voice AI
                  </a>
                  <a href={CALENDLY} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center h-11 border border-white/10 bg-white/5 text-foreground hover:bg-white/10 px-6 rounded-xl font-medium text-sm transition-colors">
                    Book Strategy Call
                  </a>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {[
                    { icon: <Timer className="h-4 w-4" />, label: "24/7 Autonomous" },
                    { icon: <Lock className="h-4 w-4" />, label: "Secure by design" },
                    { icon: <PlugZap className="h-4 w-4" />, label: "Full integration" },
                  ].map((b, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 text-foreground/90">
                        <span className="text-[hsl(var(--accent))]">{b.icon}</span>
                        <span>{b.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="relative"><HeroDemoPanel /></div>
            </div>
          </div>
        </section>

        {/* ── Three Pillars / Solutions ── */}
        <section id="solutions" className="relative py-20">
          <div className="vox-container">
            <SectionHeading
              eyebrow="Our Three Core Solutions"
              title="The Complete Agentic Stack"
              subtitle={`From the first inbound message to closed deals — ${brandNameShort} builds the full agentic stack for growth-focused businesses.`}
            />

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {/* WhatsApp AI */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45 }}
                className="group vox-glass vox-noise rounded-2xl p-6 border border-emerald-500/15 hover:border-emerald-500/30 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-500 p-[1px] mb-4">
                  <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-black/60">
                    <MessagesSquare className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-semibold mb-2">WhatsApp AI Agents</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  24/7 intelligent agents that qualify leads, book appointments, handle sales, answer FAQs, and send follow-ups — directly on WhatsApp.
                </p>
                <ul className="space-y-2">
                  {["Instant lead qualification", "Automated appointment booking", "Sales & upsell flows", "Multi-language support", "Official WhatsApp Business API"].map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 inline-flex items-center gap-1 text-xs text-emerald-400 font-medium group-hover:gap-2 transition-all">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </motion.div>

              {/* Voice AI */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.1 }}
                className="group vox-glass vox-noise rounded-2xl p-6 border border-purple-500/15 hover:border-purple-500/30 transition-colors relative">
                <div className="absolute top-4 right-4 border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] px-2 py-0.5 rounded-full">New</div>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 p-[1px] mb-4">
                  <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-black/60">
                    <Mic className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-semibold mb-2">Voice AI Agents</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Human-like voice agents that answer inbound calls, handle queries, book appointments, and qualify prospects — without hiring more staff.
                </p>
                <ul className="space-y-2">
                  {["Natural voice conversations", "Real-time call handling", "Appointment booking via call", "Intelligent call routing", "CRM sync after every call"].map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
                <a href={VOICE_DEMO} className="mt-5 inline-flex items-center gap-1.5 text-xs text-purple-400 font-medium group-hover:gap-2 transition-all">
                  Test Voice Agent <PhoneCall className="h-3.5 w-3.5 animate-pulse" />
                </a>
              </motion.div>

              {/* Automation */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.2 }}
                className="group vox-glass vox-noise rounded-2xl p-6 border border-cyan-500/15 hover:border-cyan-500/30 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-500 p-[1px] mb-4">
                  <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-black/60">
                    <Workflow className="h-5 w-5 text-cyan-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-semibold mb-2">Custom Automation</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Bespoke end-to-end automation workflows connecting your AI agents, CRM, databases, calendars, and internal tools — zero manual work.
                </p>
                <ul className="space-y-2">
                  {["n8n / Zapier / Make workflows", "CRM & API integrations", "Google Sheets & Calendars", "Multi-step agentic pipelines", "Custom dashboard & analytics"].map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 inline-flex items-center gap-1 text-xs text-cyan-400 font-medium group-hover:gap-2 transition-all">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── How We Work ── */}
        <section id="process" className="relative py-20">
          <div className="vox-container">
            <SectionHeading
              eyebrow="How VoxAI works"
              title="From strategy to live AI system in days"
              subtitle="We handle everything — from business analysis and AI architecture to deployment, monitoring, and optimization."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="vox-glass vox-noise rounded-2xl p-6">
                <div className="font-display text-lg font-semibold">Build Process</div>
                <div className="mt-4 space-y-3">
                  {[
                    "Business Deep-Dive & Strategy",
                    "AI Logic Architecture Design",
                    "Conversation / Voice Flow Engineering",
                    "API & Automation Integration",
                    "Testing, QA & Guardrails",
                    "Live Deployment & Monitoring",
                    "Ongoing Optimization & Support",
                  ].map((v, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.35, delay: i * 0.05 }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] p-[1px]">
                          <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/55 text-xs font-semibold">{i + 1}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                          <div className="text-sm font-medium">{v}</div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="vox-glass vox-noise rounded-2xl p-6">
                <div className="font-display text-lg font-semibold">What's included</div>
                <ul className="mt-4 space-y-2">
                  {[
                    "Custom AI agent design (WhatsApp + Voice)",
                    "Official WhatsApp Business API setup",
                    "Voice AI integration (real-time calls)",
                    "n8n / custom automation workflows",
                    "CRM & calendar integrations",
                    "Prompt engineering & brand tone control",
                    "Fallback handling & human handoff rules",
                    "Post-launch monitoring & optimization",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Star className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                      <span className="text-foreground/90">{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[hsl(var(--primary)/.18)] via-white/5 to-[hsl(var(--accent)/.12)] p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-[hsl(var(--accent))]" />
                    <div>
                      <div className="font-display font-semibold">Enterprise-Grade Security</div>
                      <div className="mt-1 text-sm text-muted-foreground">{brandNameShort} emphasizes safety, privacy, and compliance — every system we ship is production-grade.</div>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <a href={CALENDLY} target="_blank" rel="noreferrer"
                    className="inline-flex items-center bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-95 transition-opacity">
                    Book a Strategy Call <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="relative py-20" ref={statsRef}>
          <div className="vox-container">
            <SectionHeading
              eyebrow="Results"
              title="Automate Workflows. Reclaim Time."
              subtitle={`How ${brandNameShort} works`}
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Faster Lead Response", value: `${s1}%`, icon: <Timer className="h-5 w-5" /> },
                { label: "Increase in Conversions", value: `${s2}%`, icon: <LineChart className="h-5 w-5" /> },
                { label: "Reduced Admin Work", value: `${s3}%`, icon: <Users className="h-5 w-5" /> },
                { label: "Availability", value: "24/7", icon: <Globe className="h-5 w-5" /> },
              ].map((s, i) => (
                <div key={i} className="vox-glass vox-noise rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[hsl(var(--accent))]">{s.icon}</div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dashboard screenshots */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="vox-glass vox-noise rounded-2xl p-6">
                <div className="flex items-center gap-3 font-display font-semibold"><LayoutDashboard className="h-5 w-5 text-indigo-500" /> Command Center Dashboard</div>
                <div className="mt-2 text-sm text-muted-foreground">Monitor all agent conversations, manually step in for human handover, and track AI performance metrics from a unified UI.</div>
                <img src="/whatsapp-dashboard.png" alt={`${brandNameShort} Dashboard`} className="mt-4 aspect-video w-full rounded-xl border border-white/10 object-cover shadow-lg transition-transform duration-300 hover:scale-[1.02]" />
              </div>
              <div className="vox-glass vox-noise rounded-2xl p-6">
                <div className="flex items-center gap-3 font-display font-semibold"><CircuitBoard className="h-5 w-5 text-cyan-500" /> Automation Pipeline</div>
                <div className="mt-2 text-sm text-muted-foreground">Visualize your entire end-to-end automation logic, from incoming lead triggers to final CRM data sync.</div>
                <img src="/n8n-diagram.png" alt="n8n backend workflow" className="mt-4 aspect-video w-full rounded-xl border border-white/10 object-cover shadow-lg transition-transform duration-300 hover:scale-[1.02]" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Industries ── */}
        <section id="industries" className="relative py-20">
          <div className="vox-container">
            <SectionHeading
              eyebrow="Industries we serve"
              title="Engineered for High-Ticket Sales"
              subtitle={`${brandNameShort} agents are deployed across industries where speed, qualification, and trust close deals.`}
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: <Stethoscope className="h-5 w-5" />, title: "Healthcare & Clinics", body: "Automate patient booking, qualification, reminders, and follow-ups across WhatsApp and Voice." },
                { icon: <Building2 className="h-5 w-5" />, title: "Real Estate", body: "Qualify by budget and location, schedule viewings, and route hot leads instantly to your agents." },
                { icon: <ShoppingBag className="h-5 w-5" />, title: "E-commerce & Retail", body: "Handle order queries, payment links, cart recovery, upsells, and customer support 24/7." },
                { icon: <GraduationCap className="h-5 w-5" />, title: "Coaching & Education", body: "Qualify leads, share program info, book discovery calls, and onboard students automatically." },
                { icon: <HeartPulse className="h-5 w-5" />, title: "Wellness & Fitness", body: "Fill class schedules, manage appointments, and reduce no-shows with smart AI follow-ups." },
                { icon: <Headphones className="h-5 w-5" />, title: "Service Businesses", body: "Quote, book, and support clients at scale with conversational AI — without expanding your team." },
              ].map((it, i) => (
                <div key={i} className="vox-glass vox-noise rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[hsl(var(--accent))]">{it.icon}</div>
                    <div>
                      <div className="font-display text-lg font-semibold">{it.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{it.body}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="relative py-20">
          <div className="vox-container">
            <SectionHeading
              eyebrow="Pricing Packages"
              title="Tailored Plans for High-Growth Teams"
              subtitle="Choose the plan that matches your scale. From basic WhatsApp CRM workflows to automated outbound dialer voice AI agents."
            />
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              
              {/* Plan 1: CRM Lite */}
              <div className="vox-glass vox-noise relative flex flex-col justify-between rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-xl font-bold text-white">CRM Lite</div>
                    <span className="border border-white/10 bg-white/5 text-muted-foreground text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold">Zero Setup Fee</span>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-black tracking-tight text-white">Custom Pricing</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      An entry-level plan featuring full WhatsApp CRM capabilities with automated AI text agents and catalog routing.
                    </p>
                  </div>
                  <div className="mt-6 border-t border-white/5 pt-5">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 mb-3">What's Included:</div>
                    <ul className="space-y-3.5">
                      {[
                        "WhatsApp CRM & Analytics Dashboard",
                        "Catalog up to 100 products (auto-sends text, images, videos, & PDFs)",
                        "AI detects & replies to voice notes",
                        "AI / Human handover mode with toggle",
                        "Custom chatbot flows & triggers",
                        "Zero setup cost (use your Meta WhatsApp API & Gemini keys)",
                      ].map((it, i) => (
                        <li key={i} className="flex gap-2.5 text-xs">
                          <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                          <span className="text-foreground/90 leading-tight">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-4">
                  <a href={CALENDLY} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center w-full h-11 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold transition-all uppercase tracking-wider">
                    Get Started with Lite
                  </a>
                </div>
              </div>

              {/* Plan 2: Voice & WhatsApp Pro (RECOMMENDED / FEATURED) */}
              <div className="vox-glass vox-noise vox-glow relative flex flex-col justify-between rounded-2xl p-6 border-2 border-[hsl(var(--accent))] shadow-lg transform md:-translate-y-2 transition-all duration-300">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                  Most Popular
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-xl font-bold text-white">Voice & WhatsApp Pro</div>
                    <span className="border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold">100 Free Mins/Mo</span>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-black tracking-tight text-white">Custom Pricing</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Our flagship plan introducing human-like voice agents, outbound campaigns, and call recording transcripts.
                    </p>
                  </div>
                  <div className="mt-6 border-t border-white/5 pt-5">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[hsl(var(--accent))] mb-3">All CRM Lite Features Plus:</div>
                    <ul className="space-y-3.5">
                      {[
                        "Voice AI Agent (realtime bilingual English, Hindi, Marathi calls)",
                        "Automation AI Outbound Calls (Custom Workflows)",
                        "Campaign Auto-Dialer & Bulk Outbound Calling",
                        "Smart Live Call Transfer to Human Agent",
                        "Automatic Call Recordings & Transcripts logged",
                        "100 free calling minutes / mo included",
                        "Overage minutes billed at only ₹3.5 / min",
                        "Automated lead nurturing & follow-up sequences",
                        "Personal priority realtime support channels",
                        "We handle calling LLM (Gemini) & telephony costs",
                      ].map((it, i) => (
                        <li key={i} className="flex gap-2.5 text-xs">
                          <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-[hsl(var(--accent))]" />
                          <span className="text-foreground/90 leading-tight font-medium">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-4">
                  <a href={CALENDLY} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center w-full h-11 text-xs bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white rounded-xl font-bold hover:opacity-95 shadow-md transition-opacity uppercase tracking-wider">
                    Upgrade to Pro <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Plan 3: Enterprise Automation */}
              <div className="vox-glass vox-noise relative flex flex-col justify-between rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-xl font-bold text-white">Enterprise</div>
                    <span className="border border-white/10 bg-white/5 text-muted-foreground text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold">Custom Scope</span>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-black tracking-tight text-white">Custom Pricing</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Bespoke integrations, system engineering, and custom workflows configured for your organization structure.
                    </p>
                  </div>
                  <div className="mt-6 border-t border-white/5 pt-5">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 mb-3">Enterprise Inclusions:</div>
                    <ul className="space-y-3.5">
                      {[
                        "Includes all Pro package features",
                        "Bespoke n8n workflow integration & automation",
                        "Custom Database, ERP, CRM (Zoho, HubSpot) syncing",
                        "Custom Domain Name (e.g. crm.yourcompany.com)",
                        "Fully White-labeled Dashboard with your branding",
                        "Dedicated systems engineer & priority SLAs",
                        "Unlimited server capacity & custom calling scale",
                      ].map((it, i) => (
                        <li key={i} className="flex gap-2.5 text-xs">
                          <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                          <span className="text-foreground/90 leading-tight">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-4">
                  <a href={CALENDLY} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center w-full h-11 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold transition-all uppercase tracking-wider">
                    Request Custom Quote
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative py-20">
          <div className="vox-container">
            <SectionHeading
              eyebrow="FAQ"
              title="Frequently Asked Questions"
              subtitle={`Straightforward answers about how ${brandNameShort} builds, deploys, and supports your AI systems.`}
            />
            <div className="mx-auto mt-10 max-w-3xl vox-glass vox-noise rounded-2xl p-3 sm:p-4">
              {[
                { q: "What exactly does VoxAI build?", a: "We design and deploy end-to-end AI systems for your business — including WhatsApp AI agents, Voice AI agents, and custom automation workflows. We handle everything from architecture to deployment." },
                { q: "Do you use the official WhatsApp Business API?", a: "Yes. All WhatsApp agents are built on the official Meta WhatsApp Business API, ensuring reliability, scale, and compliance with Meta's policies." },
                { q: "What is a Voice AI Agent?", a: "A Voice AI agent is a human-like AI that can handle real inbound phone calls — answer questions, qualify leads, book appointments, and route callers — without a human on the other end." },
                { q: "Can you integrate with our existing CRM and tools?", a: "Yes. We commonly integrate with HubSpot, GoHighLevel, Zoho, Google Sheets, Google Calendar, n8n, Zapier, Make, and custom APIs for real-time data sync." },
                { q: "How long does it take to go live?", a: "Most projects are live within 7–14 business days depending on complexity, integrations, and the number of AI systems being deployed." },
                { q: "Is this GDPR compliant and secure?", a: "We design for privacy and compliance, including secure storage, controlled access, and data minimization principles in every system we ship." },
              ].map((f, i) => (
                <details key={i} className="border-b border-white/10 last:border-0">
                  <summary className="cursor-pointer py-4 text-sm font-medium text-foreground hover:text-[hsl(var(--accent))] transition-colors list-none flex items-center justify-between">
                    {f.q} <ChevronRight className="h-4 w-4 shrink-0" />
                  </summary>
                  <div className="pb-4 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA / Contact ── */}
        <section id="contact" className="relative py-20">
          <div className="vox-container">
            <div className="vox-glass vox-noise rounded-3xl p-7 sm:p-10">
              <div className="grid gap-10 md:grid-cols-2">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                    <Rocket className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> Ready to build?
                  </div>
                  <div className="font-display mt-4 text-3xl font-semibold tracking-tight">
                    Stop Hiring. Start Deploying AI.
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Tell us your business, your goals, and what you want automated. We'll design an AI system that ships fast and performs like your best team member — around the clock.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a href={CALENDLY} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center h-11 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-6 rounded-xl font-medium text-sm hover:opacity-95 transition-opacity">
                      Book Strategy Call <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a href={`https://${WHATSAPP_DEMO}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center h-11 border border-white/10 bg-white/5 text-foreground hover:bg-white/10 px-4 rounded-xl text-sm transition-colors">
                      Test AI on WhatsApp
                    </a>
                    <a href={VOICE_DEMO}
                      className="inline-flex items-center justify-center h-11 border border-white/10 bg-white/5 text-foreground hover:bg-white/10 px-4 rounded-xl text-sm transition-colors">
                      <PhoneCall className="mr-2 h-4 w-4 text-purple-400 animate-pulse" /> Test Voice AI
                    </a>
                  </div>
                </div>
                <div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center">
                    <div className="font-display text-lg font-semibold mb-3">Book a 30-Min Strategy Call</div>
                    <p className="text-sm text-muted-foreground mb-6">Let's discuss your use case and scope the right AI system for your business.</p>
                    <a href={CALENDLY} target="_blank" rel="noreferrer"
                      className="inline-flex items-center bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-95 transition-opacity">
                      Book Meeting <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: <Globe className="h-5 w-5" />, label: "Location", value: "Ludhiana, India" },
                      { icon: <MessagesSquare className="h-5 w-5" />, label: "WhatsApp", value: "Live Demo ↗" },
                      { icon: <BadgeCheck className="h-5 w-5" />, label: "Focus", value: "Agentic AI" },
                    ].map((c, i) => (
                      <div key={i} className="vox-glass vox-noise rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-[hsl(var(--accent))]">{c.icon}</span><span>{c.label}</span>
                        </div>
                        <div className="font-display mt-2 text-sm font-semibold">{c.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-10 flex items-center justify-between gap-6 border-t border-white/10 pt-6 text-xs text-muted-foreground">
                <div>© {new Date().getFullYear()} {brandName}. All rights reserved.</div>
                <div className="hidden items-center gap-4 sm:flex">
                  <Link href={privacyUrl} target="_blank" className="hover:text-foreground">Privacy Policy</Link>
                  <a href="#" className="hover:text-foreground">Terms</a>
                  <a href="#" className="hover:text-foreground">Security</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating CTA */}
      <a href={`https://${WHATSAPP_DEMO}`} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 z-50">
        <div className="group rounded-full border border-white/10 bg-black/35 p-1.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_70px_hsl(var(--primary)/.25)] transition-transform group-hover:scale-[1.02]">
            <MessagesSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Test WhatsApp AI</span>
          </div>
        </div>
      </a>
    </div>
  )
}