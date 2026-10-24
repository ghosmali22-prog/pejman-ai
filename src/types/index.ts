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
