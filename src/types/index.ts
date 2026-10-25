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
  updated_at?: string
}

export interface DailyCopies {
  day: string
  copies: number
}

/** A published blog post as the public site reads it. */
export interface Post {
  id: string
  slug: string
  title: string
  /** Short summary for cards, Google and social previews. */
  excerpt: string
  /** Rendered HTML of the post body (rendered from Markdown in the admin panel). */
  content_html: string
  lang: 'en' | 'fa'
  cover_url: string
  cover_width?: number | null
  cover_height?: number | null
  cover_alt: string
  tags: string[]
  seo_title?: string | null
  seo_description?: string | null
  reading_minutes: number
  published: boolean
  published_at: string | null
  created_at: string
  updated_at?: string
}

/** Post row as stored in the database (includes the Markdown source and admin-only fields). */
export interface PostRow extends Post {
  content: string
  cover_path?: string | null
}
