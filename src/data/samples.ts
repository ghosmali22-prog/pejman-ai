import type { Category, Prompt } from '../types'

/**
 * Demo content shown ONLY while Supabase is not connected yet.
 * As soon as VITE_SUPABASE_URL is set, the site reads real prompts from the database.
 */
const img = (name: string) => `${import.meta.env.BASE_URL}samples/${name}.webp`

export const sampleCategories: Category[] = [
  { id: 'c1', name: 'Portrait', slug: 'portrait', position: 1 },
  { id: 'c2', name: 'Product', slug: 'product', position: 2 },
  { id: 'c3', name: 'Interior', slug: 'interior', position: 3 },
  { id: 'c4', name: 'Fashion', slug: 'fashion', position: 4 },
  { id: 'c5', name: '3D', slug: '3d', position: 5 },
  { id: 'c6', name: 'Food', slug: 'food', position: 6 },
  { id: 'c7', name: 'Architecture', slug: 'architecture', position: 7 },
  { id: 'c8', name: 'Abstract', slug: 'abstract', position: 8 },
]

const base = {
  featured: false,
  published: true,
  copy_count: 0,
  negative_prompt: null,
  image_width: 800,
  image_height: 1000,
}

export const samplePrompts: Prompt[] = [
  {
    ...base,
    id: 's1',
    slug: 'chrome-shades-studio-portrait',
    title: 'Chrome Shades Studio Portrait',
    category: 'portrait',
    model: 'Midjourney v7',
    prompt:
      'black and white studio portrait of a young man in an oversized black puffer jacket, wraparound chrome sunglasses reflecting the softbox, curly dark hair, seamless white backdrop, symmetrical framing, high-fashion editorial, 85mm lens, crisp skin texture, deep blacks, minimal --ar 4:5 --style raw --s 250',
    settings: { 'Aspect ratio': '4:5', Stylize: '250', Style: 'raw' },
    tags: ['portrait', 'black and white', 'editorial', 'studio'],
    image_url: img('portrait'),
    featured: true,
    position: 1,
    copy_count: 128,
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    ...base,
    id: 's2',
    slug: 'floating-perfume-bottle',
    title: 'Floating Perfume Bottle',
    category: 'product',
    model: 'Nano Banana',
    prompt:
      'luxury perfume bottle floating above still black water, single drop falling, soft rim light, ultra clean product photography, reflections on the surface, lime green accent light from behind, minimal composition, 8k commercial look',
    settings: { 'Aspect ratio': '4:5' },
    tags: ['product', 'perfume', 'luxury', 'commercial'],
    image_url: img('product'),
    featured: true,
    position: 2,
    copy_count: 96,
    created_at: '2026-10-19T10:00:00Z',
  },
  {
    ...base,
    id: 's3',
    slug: 'brutalist-living-room',
    title: 'Brutalist Living Room',
    category: 'interior',
    model: 'GPT Image',
    prompt:
      'brutalist concrete living room at golden hour, low linen sofa, travertine coffee table, tall window with tropical plants outside, soft long shadows, architectural digest photography, wide angle, calm and minimal',
    settings: { 'Aspect ratio': '4:5', Quality: 'high' },
    tags: ['interior', 'brutalist', 'architecture', 'minimal'],
    image_url: img('interior'),
    position: 3,
    copy_count: 74,
    created_at: '2026-10-18T10:00:00Z',
  },
  {
    ...base,
    id: 's4',
    slug: 'bangkok-night-streetwear',
    title: 'Bangkok Night Streetwear',
    category: 'fashion',
    model: 'Midjourney v7',
    prompt:
      'streetwear fashion editorial on a rainy Bangkok street at night, model in a technical shell jacket, neon signs blurred in the background, wet asphalt reflections, cinematic 35mm film grain, low angle, motion blur on tuk-tuk passing --ar 4:5 --s 400',
    settings: { 'Aspect ratio': '4:5', Stylize: '400' },
    tags: ['fashion', 'street', 'night', 'bangkok'],
    image_url: img('fashion'),
    position: 4,
    copy_count: 61,
    created_at: '2026-10-17T10:00:00Z',
  },
  {
    ...base,
    id: 's5',
    slug: 'soft-clay-3d-character',
    title: 'Soft Clay 3D Character',
    category: '3d',
    model: 'Flux 1.1 Pro',
    prompt:
      'cute 3D clay character of a tiny robot holding a lime green leaf, soft matte materials, pastel studio background, subsurface scattering, octane render, isometric view, playful and minimal',
    negative_prompt: 'text, watermark, extra limbs, harsh shadows',
    settings: { 'Aspect ratio': '1:1', Steps: '28' },
    tags: ['3d', 'character', 'clay', 'cute'],
    image_url: img('3d'),
    position: 5,
    copy_count: 52,
    created_at: '2026-10-16T10:00:00Z',
  },
  {
    ...base,
    id: 's6',
    slug: 'dark-moody-coffee',
    title: 'Dark & Moody Coffee',
    category: 'food',
    model: 'Nano Banana',
    prompt:
      'dark and moody food photography of an iced latte in a ribbed glass, coffee swirling into milk, single beam of window light, black stone surface, droplets of condensation, shallow depth of field, editorial cookbook style',
    settings: { 'Aspect ratio': '4:5' },
    tags: ['food', 'coffee', 'moody'],
    image_url: img('food'),
    position: 6,
    copy_count: 47,
    created_at: '2026-10-15T10:00:00Z',
  },
  {
    ...base,
    id: 's7',
    slug: 'monolith-desert-villa',
    title: 'Monolith Desert Villa',
    category: 'architecture',
    model: 'Midjourney v7',
    prompt:
      'monolithic black villa in a white sand desert, sharp geometric volumes, infinity pool reflecting the sky, tiny human figure for scale, overcast diffused light, architectural photography, ultra wide --ar 4:5 --style raw',
    settings: { 'Aspect ratio': '4:5', Style: 'raw' },
    tags: ['architecture', 'desert', 'villa', 'minimal'],
    image_url: img('architecture'),
    position: 7,
    copy_count: 39,
    created_at: '2026-10-14T10:00:00Z',
  },
  {
    ...base,
    id: 's8',
    slug: 'liquid-chrome-waves',
    title: 'Liquid Chrome Waves',
    category: 'abstract',
    model: 'GPT Image',
    prompt:
      'abstract liquid chrome waves flowing in slow motion, iridescent highlights with a hint of acid lime, black background, macro photography, smooth glossy surface, high contrast, wallpaper composition',
    settings: { 'Aspect ratio': '4:5' },
    tags: ['abstract', 'chrome', 'wallpaper'],
    image_url: img('abstract'),
    position: 8,
    copy_count: 33,
    created_at: '2026-10-13T10:00:00Z',
  },
]
