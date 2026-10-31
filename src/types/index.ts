export interface Category {
  id: string
  name: string
  slug: string
  position: number
}

export interface Prompt {
  id: string
  slug: string
  title: string
  /** Category slug, e.g. "portrait". */
  category: string
  /** AI model used, e.g. "Midjourney v7". */
  model: string
  prompt: string
  negative_prompt?: string | null
  /** Free-form settings such as { "Aspect ratio": "4:5", "Stylize": "250" }. */
  settings?: Record<string, string> | null
  tags: string[]
  image_url: string
  image_width?: number | null
  image_height?: number | null
  /** Optional video; image_url is then its poster frame. */
  video_url?: string | null
  featured: boolean
  published: boolean
  position: number
  copy_count: number
  created_at: string
}

export interface ServiceItem {
  title: string
  description: string
  features: string[]
  /** The lime "most requested" card. */
  highlighted?: boolean
}

export interface SiteSettings {
  hero: {
    headline: string
    subline: string
    availability: string
    location: string
    tools: string[]
  }
  about: {
    label: string
    text: string
  }
  services: {
    heading: string
    intro: string
    items: ServiceItem[]
  }
  contact: {
    heading: string
    intro: string
    email: string
    whatsapp: string
    telegram: string
    instagram: string
  }
  footer: {
    newsletter: string
  }
}

export interface ContactMessageInput {
  name: string
  email: string
  project_type: string
  work_mode?: string
  budget?: string
  message: string
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  project_type: string | null
  work_mode: string | null
  budget: string | null
  message: string
  is_read: boolean
  created_at: string
}

export interface Subscriber {
  id: string
  email: string
  created_at: string
}

/** Prompt row as stored in the database (includes admin-only fields). */
export interface PromptRow extends Prompt {
  image_path?: string | null
  video_path?: string | null
  updated_at?: string
}

export interface DailyCopies {
  day: string
  copies: number
}

/** One file of a code item. Single-file items have exactly one. */
export interface CodeFile {
  name: string
  /** Short language id, e.g. "html", "css", "js", "tsx". */
  language: string
  content: string
}

/** Ready-made UI code shown in the Code section (as the public website receives it). */
export interface CodeItem {
  id: string
  slug: string
  title: string
  short_description: string
  /** Free text, e.g. "Dashboard", "Glass UI". */
  category: string
  /** Language of the main file. */
  language: string
  /** Main file. Empty for premium items. */
  code: string
  /** Every file of a multi-file item; empty for single-file items (and premium items). */
  files: CodeFile[]
  preview_image_url?: string | null
  live_preview_enabled: boolean
  is_featured: boolean
  /** Sold on request: the code is never sent to visitors. */
  is_premium: boolean
  sort_order: number
  copy_count: number
  created_at: string
}

/** code_items row as stored in the database (includes admin-only fields). */
export interface CodeItemRow extends CodeItem {
  is_published: boolean
  preview_image_path?: string | null
  updated_at?: string
}
