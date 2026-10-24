import type { SiteSettings } from '../types'

export const SITE_URL = 'https://ghosmali22-prog.github.io/pejman-ai'

/**
 * Default text for the whole site. Every value here can be overridden
 * from the admin panel (stored in the Supabase `site_settings` table).
 */
export const defaultSettings: SiteSettings = {
  hero: {
    headline: 'AI images, motion, websites & automations. Free prompts to start.',
    subline:
      'I create AI photos, motion videos, websites and automations for brands and creators — and share the prompts behind my work for free.',
    availability: 'Available 7 days a week',
    location: 'On-site in Bangkok · Remote worldwide',
    tools: ['Midjourney', 'Nano Banana', 'GPT Image', 'Kling', 'Veo', 'Flux', 'n8n'],
  },
  about: {
    label: 'About Pejman',
    text: "I'm Pejman Ansaribarz, an AI creator based in Bangkok. I make AI photos and videos, motion videos that stop the scroll, modern websites and automations that quietly save hours every week — and I share the prompts behind my work for free. Brands, founders and creators bring me a goal; I bring the tools and the taste to make it real. I work seven days a week, remotely with clients worldwide or on-site here in Bangkok. Start with my free prompts, and when you're ready for something custom, let's build it together.",
  },
  services: {
    heading: 'What I can build for you',
    intro:
      'Custom AI work for brands, creators and small teams — remote worldwide or on-site in Bangkok. Tell me your goal and I will send you a clear quote.',
    items: [
      {
        title: 'AI Photos',
        description: 'Product shots, campaigns and portraits — without a studio, a crew or a reshoot.',
        features: [
          'Product & lifestyle visuals',
          'Brand-consistent image sets',
          'Social media & ad creatives',
          'High-resolution delivery',
        ],
      },
      {
        title: 'Motion & Video',
        description: 'AI videos and motion graphics built to stop the scroll on Reels, TikTok and Shorts.',
        features: [
          'Video ads & brand films',
          'Motion graphics & animated logos',
          'Voice-over, music & captions',
          'Vertical & square formats',
        ],
        highlighted: true,
      },
      {
        title: 'Websites',
        description: 'Fast, modern websites with smooth animation — like the one you are on right now.',
        features: [
          'Landing pages & portfolios',
          'Mobile-first, animated design',
          'Forms, admin panel & database',
          'Hosting & launch included',
        ],
      },
      {
        title: 'AI Automation',
        description: 'Workflows that answer, sort, post and report for you — around the clock.',
        features: [
          'Content & posting pipelines',
          'Lead capture & auto-replies',
          'AI assistants for your team',
          'Setup, training & support',
        ],
      },
    ],
  },
  contact: {
    heading: "Let's make something with AI.",
    intro:
      "Tell me about your project. I'm available 7 days a week — remotely worldwide or in person in Bangkok — and usually reply within a few hours.",
    email: 'ghosmali22@gmail.com',
    whatsapp: '+66918157214',
    telegram: 'Pejmanansarii',
    instagram: 'peji_org',
  },
  footer: {
    newsletter: 'Get new free prompts every week',
  },
}

export const PROJECT_TYPES = ['AI Photos', 'Motion & Video', 'Websites', 'AI Automation', 'Something else'] as const
export const WORK_MODES = ['Remote', 'On-site in Bangkok'] as const
export const BUDGET_RANGES = ['Under $300', '$300 – $1,000', '$1,000 – $3,000', '$3,000+', 'Not sure yet'] as const

export const contactLinks = (c: SiteSettings['contact']) => ({
  email: `mailto:${c.email}`,
  whatsapp: `https://wa.me/${c.whatsapp.replace(/[^\d]/g, '')}`,
  telegram: `https://t.me/${c.telegram.replace(/^@/, '')}`,
  instagram: `https://instagram.com/${c.instagram.replace(/^@/, '')}`,
})
