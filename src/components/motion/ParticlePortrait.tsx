import { useEffect, useRef, type RefObject } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three'
import { gsap, ScrollTrigger } from '../../lib/motion'

const IDLE_SEED = 0.972

const vertexShader = /* glsl */ `
  uniform vec2 uRes;
  uniform vec4 uRect;
  uniform float uProgress;
  uniform float uIntro;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform vec2 uTilt;
  uniform float uSize;

  attribute vec2 aUv;
  attribute float aLum;
  attribute float aSeed;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vLoose;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Divergence-free flow from a noise field, so the dust swirls instead of clumping.
  vec2 curl(vec2 p) {
    float e = 0.1;
    float dx = noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0));
    float dy = noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e));
    return vec2(dy, -dx) / (2.0 * e);
  }

  void main() {
    vec2 home = uRect.xy + aUv * uRect.zw;
    vec2 center = uRect.xy + uRect.zw * 0.5;

    // Scroll scatter: the right side and the hair go first, like wind peeling the image away.
    float start = (1.0 - aUv.x) * 0.42 + aUv.y * 0.16 + aSeed * 0.3;
    float s = smoothstep(start, start + 0.3, uProgress * 1.25);

    // Entrance: dust gathers into the portrait in a random order.
    float gather = 1.0 - smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.45, uIntro);

    // A few particles keep shedding even at rest, so the portrait never looks frozen.
    float idleMask = step(${IDLE_SEED}, aSeed) * smoothstep(0.25, 0.75, aUv.x);
    float phase = fract(uTime * 0.11 + aSeed * 37.0);
    float idle = idleMask * phase;

    float k = max(max(s, gather), idle * 0.55);

    // Relief: bright skin comes forward, the dark jacket sinks back.
    vec3 p = vec3(home - center, (aLum - 0.35) * uRect.z * 0.12);
    float ry = uTilt.x * 0.2 + uProgress * 0.35;
    float rx = -uTilt.y * 0.14;
    p.xz = mat2(cos(ry), -sin(ry), sin(ry), cos(ry)) * p.xz;
    p.yz = mat2(cos(rx), -sin(rx), sin(rx), cos(rx)) * p.yz;
    float f = uRect.z * 2.2;
    float persp = f / (f - p.z);
    vec2 pos = center + p.xy * persp;

    vec2 wind = normalize(vec2(1.0, -0.38)) * (0.25 + aSeed) * uRect.z * 0.95;
    vec2 swirl = curl(home * 0.0035 + vec2(-uTime * 0.07, uTime * 0.03)) * (60.0 + 90.0 * aSeed);
    pos += wind * k * k + swirl * k;

    // Cursor pushes the dust aside.
    vec2 d = pos - uMouse;
    float dist = length(d) + 0.0001;
    float push = (1.0 - smoothstep(0.0, 110.0, dist)) * 28.0 * uMouseOn;
    pos += (d / dist) * push + vec2(-d.y, d.x) / dist * push * 0.35;

    vec3 base = vec3(pow(aLum, 0.92) + 0.025);
    vec3 lit = mix(vec3(0.86), vec3(0.776, 0.957, 0.196), step(0.55, aSeed));
    vColor = mix(base, lit, smoothstep(0.04, 0.45, k) * 0.9);
    vAlpha = (1.0 - smoothstep(0.55, 1.0, k) * 0.88) * (1.0 - idle);
    // The photo melts into the page at the bottom; its dust should too.
    vAlpha *= 1.0 - smoothstep(0.7, 0.95, aUv.y) * smoothstep(0.0, 0.15, k);
    vAlpha *= 1.0 - smoothstep(0.86, 0.99, aUv.y);
    vLoose = k;

    gl_PointSize = uSize * persp * (1.0 - k * 0.35);
    gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLoose;

  void main() {
    // Square while in place so the portrait reads solid; round dust once it lets go.
    float d = length(gl_PointCoord - 0.5);
    if (vLoose > 0.15 && d > 0.5) discard;
    float edge = mix(1.0, 1.0 - smoothstep(0.32, 0.5, d), step(0.15, vLoose));
    gl_FragColor = vec4(vColor, vAlpha * edge);
  }
`

/** Reads the photo's pixels into one particle per visible pixel of a downscaled copy. */
function sample(img: HTMLImageElement, width: number) {
  const height = Math.round((width * img.naturalHeight) / img.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  const uv: number[] = []
  const lum: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 128) continue
      // Small jitter hides the sampling grid.
      uv.push((x + Math.random()) / width, (y + Math.random()) / height)
      lum.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255)
    }
  }
  // Seeds above IDLE_SEED drift off at rest; they are extra copies so the portrait keeps no holes.
  const base = lum.length
  const seed: number[] = []
  for (let i = 0; i < base; i++) seed.push(Math.random() * IDLE_SEED)
  for (let i = 0; i < base; i++) {
    if (Math.random() > 0.035) continue
    uv.push(uv[i * 2], uv[i * 2 + 1])
    lum.push(lum[i])
    seed.push(IDLE_SEED + Math.random() * (1 - IDLE_SEED))
  }
  return { count: lum.length, width, uv: new Float32Array(uv), lum: new Float32Array(lum), seed: new Float32Array(seed) }
}

export interface HudHandle {
  /** Called every few frames with the live scatter progress and tilt. */
  update: (progress: number, tilt: { x: number; y: number }, count: number, intro: number) => void
}

/**
 * The hero photo rebuilt as a point cloud (WebGL). Scrolling the hero away blows the
 * particles off like dust; the cursor pushes them aside and tilts the relief.
 * The canvas is drawn over `img`'s layout box, so the real <img> keeps sizing the hero.
 */
export function ParticlePortrait({
  src,
  img,
  trigger,
  play,
  hud,
  onReady,
}: {
  src: string
  img: RefObject<HTMLImageElement | null>
  trigger: RefObject<HTMLElement | null>
  play: boolean
  hud?: RefObject<HudHandle | null>
  onReady: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playRef = useRef(play)
  const onReadyRef = useRef(onReady)
  const introRef = useRef<gsap.core.Tween | null>(null)
  const uniformsRef = useRef<{ uIntro: { value: number } } | null>(null)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    playRef.current = play
    const u = uniformsRef.current
    if (play && u && !introRef.current) {
      introRef.current = gsap.to(u.uIntro, { value: 1, duration: 2.4, ease: 'power3.out', delay: 0.15 })
    }
  }, [play])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let cleanup = () => {}

    const photo = new Image()
    photo.decoding = 'async'
    photo.src = src
    photo
      .decode()
      .then(() => {
        if (disposed) return
        cleanup = start(canvas, photo)
      })
      .catch(() => {})

    const start = (canvas: HTMLCanvasElement, photo: HTMLImageElement) => {
      let renderer: WebGLRenderer
      try {
        renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
      } catch {
        return () => {}
      }
      renderer.setClearColor(0x000000, 0)

      const phone = window.matchMedia('(max-width: 767px)').matches
      const points = sample(photo, phone ? 400 : 640)
      if (!points) {
        renderer.dispose()
        return () => {}
      }

      const geometry = new BufferGeometry()
      // `position` is unused by the shader but three.js needs it to know the vertex count.
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.count * 3), 3))
      geometry.setAttribute('aUv', new BufferAttribute(points.uv, 2))
      geometry.setAttribute('aLum', new BufferAttribute(points.lum, 1))
      geometry.setAttribute('aSeed', new BufferAttribute(points.seed, 1))

      const uniforms = {
        uRes: { value: new Vector2(1, 1) },
        uRect: { value: new Vector4(0, 0, 1, 1) },
        uProgress: { value: 0 },
        uIntro: { value: 0 },
        uTime: { value: 0 },
        uMouse: { value: new Vector2(-9999, -9999) },
        uMouseOn: { value: 0 },
        uTilt: { value: new Vector2(0, 0) },
        uSize: { value: 2 },
      }
      uniformsRef.current = uniforms
      if (playRef.current && !introRef.current) {
        introRef.current = gsap.to(uniforms.uIntro, { value: 1, duration: 2.4, ease: 'power3.out', delay: 0.15 })
      }

      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: NormalBlending,
      })
      const cloud = new Points(geometry, material)
      cloud.frustumCulled = false
      const scene = new Scene()
      scene.add(cloud)
      const camera = new OrthographicCamera()

      // Size the drawing buffer and find where the <img> sits inside the canvas.
      const layout = () => {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        renderer.setPixelRatio(dpr)
        renderer.setSize(w, h, false)
        uniforms.uRes.value.set(w, h)
        const el = img.current
        if (!el) return
        // Layout offsets, not getBoundingClientRect: the entrance tween moves the <img> with transforms.
        const root = canvas.offsetParent
        let x = 0
        let y = 0
        for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
          x += n.offsetLeft
          y += n.offsetTop
        }
        const iw = el.offsetWidth
        uniforms.uRect.value.set(x - canvas.offsetLeft, y - canvas.offsetTop, iw, el.offsetHeight)
        uniforms.uSize.value = (iw / points.width) * dpr * 1.6
      }
      layout()
      const ro = new ResizeObserver(layout)
      ro.observe(canvas)
      if (img.current) ro.observe(img.current)

      let target = 0
      const st = trigger.current
        ? ScrollTrigger.create({
            trigger: trigger.current,
            start: 'top top',
            end: 'bottom top',
            onUpdate: (self) => (target = self.progress),
          })
        : null
      target = st?.progress ?? 0
      uniforms.uProgress.value = target

      const mouse = { x: -9999, y: -9999, on: 0 }
      const tilt = { x: 0, y: 0 }
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const c = canvas.getBoundingClientRect()
        mouse.x = e.clientX - c.left
        mouse.y = e.clientY - c.top
        mouse.on = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= c.width && mouse.y <= c.height ? 1 : 0
      }
      const onLeave = () => (mouse.on = 0)
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)

      // Only draw while the hero is on screen.
      let visible = true
      const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
      io.observe(canvas)

      let frame = 0
      const tick = (time: number) => {
        if (!visible || document.hidden) return
        const u = uniforms
        u.uTime.value = time
        u.uProgress.value += (target - u.uProgress.value) * 0.12
        const m = u.uMouse.value
        if (mouse.on) {
          m.x = m.x < -999 ? mouse.x : m.x + (mouse.x - m.x) * 0.14
          m.y = m.y < -999 ? mouse.y : m.y + (mouse.y - m.y) * 0.14
        }
        u.uMouseOn.value += (mouse.on - u.uMouseOn.value) * 0.08
        const rect = u.uRect.value
        const tx = mouse.on ? gsap.utils.clamp(-1, 1, (mouse.x - (rect.x + rect.z / 2)) / (rect.z / 2)) : 0
        const ty = mouse.on ? gsap.utils.clamp(-1, 1, (mouse.y - (rect.y + rect.w / 2)) / (rect.w / 2)) : 0
        tilt.x += (tx - tilt.x) * 0.05
        tilt.y += (ty - tilt.y) * 0.05
        u.uTilt.value.set(tilt.x, tilt.y)
        renderer.render(scene, camera)
        if (frame++ % 4 === 0) hud?.current?.update(u.uProgress.value, tilt, points.count, u.uIntro.value)
      }
      gsap.ticker.add(tick)

      // Show the first fully drawn frame before hiding the photo underneath.
      renderer.render(scene, camera)
      requestAnimationFrame(() => {
        if (!disposed) onReadyRef.current()
      })

      return () => {
        gsap.ticker.remove(tick)
        st?.kill()
        ro.disconnect()
        io.disconnect()
        window.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerleave', onLeave)
        introRef.current?.kill()
        introRef.current = null
        uniformsRef.current = null
        geometry.dispose()
        material.dispose()
        renderer.dispose()
      }
    }

    return () => {
      disposed = true
      cleanup()
    }
  }, [src, img, trigger, hud])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-[-22%] h-[144%] w-full" />
}
