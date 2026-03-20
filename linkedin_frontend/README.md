# LinkedAI — Frontend

Fully animated React frontend for the LinkedIn AI Profile Analyzer backend.

## Tech Stack

| Library | What it does |
|---------|-------------|
| **React 18** | UI framework |
| **Vite** | Dev server + build tool (replaces CRA) |
| **React Router v6** | Client-side routing |
| **Three.js + @react-three/fiber** | 3D floating geometry background |
| **@react-three/drei** | Three.js helpers (Float, MeshDistortMaterial) |
| **Framer Motion** | Page transitions, chat message animations, panel reveals |
| **GSAP** | Preloader — progress bar, letter-by-letter text reveal |
| **react-dropzone** | Drag-and-drop PDF upload |
| **react-markdown** | Renders AI responses with formatting |
| **react-hot-toast** | Toast notifications |
| **lucide-react** | Icon library |
| **axios** | HTTP client for backend API |

---

## Setup

### 1. Install dependencies
```bash
cd linkedin_frontend
npm install
```

### 2. Make sure the backend is running
```bash
# In the backend folder:
uvicorn main:app --reload
# Runs on http://localhost:8000
```

### 3. Start the frontend
```bash
npm run dev
# Runs on http://localhost:3000
# Vite automatically proxies /api/* → http://localhost:8000
```

---

## How the proxy works

In `vite.config.js`:
```js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

So `axios.get('/api/auth/me')` → `GET http://localhost:8000/auth/me`.
No CORS issues in development.

---

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `AuthPage` | Login + Register with animated form toggle |
| `/dashboard` | `DashboardPage` | Overview, stats, quick nav |
| `/upload` | `UploadPage` | Drag-drop PDF upload with progress steps |
| `/chat` | `ChatPage` | Full chat interface with session sidebar |
| `/analysis` | `AnalysisPage` | AI analysis results, hooks, hashtags |

---

## Animation Architecture

### 1. Preloader (GSAP)
- GSAP `timeline` runs on mount
- `gsap.to(barRef)` animates progress bar `scaleX` 0 → 1 over 2.2s
- `gsap.to(countRef)` counts 0% → 100% in sync
- `stagger` animates each letter of "LinkedAI" individually
- On complete, `gsap.to(root)` fades out and calls `onComplete()`

### 2. 3D Background (Three.js + R3F)
- `<Canvas>` from `@react-three/fiber` renders WebGL scene
- `<Float>` component from `drei` makes each shape bob up and down
- `CameraRig` reads `mousemove` events and lerps camera position
- `useFrame` rotates each mesh on every animation frame
- `MeshDistortMaterial` creates organic blob shapes
- Canvas is `position: fixed` with `z-index: 0`, always behind UI

### 3. Page Transitions (Framer Motion)
- `<AnimatePresence mode="wait">` in App.jsx wraps `<Routes>`
- Each page is wrapped in a `<Page>` component with `motion.div`
- On route change: exit animation runs, then new page enters
- Spring physics (`type: 'spring'`) for chat message entrances

### 4. Chat Interface
- Optimistic updates: user message appears instantly before API response
- `<AnimatePresence initial={false}>` for chat messages so only new ones animate
- Typing indicator: 3 dots with staggered CSS `animation-delay`
- Auto-scroll using `ref.scrollIntoView({ behavior: 'smooth' })`
- Textarea auto-resizes using `scrollHeight` measurement

---

## Build for production

```bash
npm run build
# Output in ./dist — deploy to Vercel, Netlify, or serve with nginx
```

For production, change the API base URL in `src/services/api.js`:
```js
const api = axios.create({ baseURL: 'https://your-backend.com' })
```
