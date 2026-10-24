import type { SiteSettings } from '../types'

export const SITE_URL = 'https://ghosmali22-prog.github.io/pejman-ai'

/**
 * Default text for the whole site. Every value here can be overridden
 * from the admin panel (stored in the Supabase `site_settings` table).
 */
export const defaultSettings: SiteSettings = {
  hero: {
    headline: 'AI images, videos & automations. Free prompts to start.',
    subline:
      'I create AI visuals and automations for brands and creators — and share the prompts behind my work for free.',
    location: 'Based in Bangkok · Working worldwide',
    tools: ['Midjourney', 'Nano Banana', 'GPT Image', 'Kling', 'Flux', 'Seedream'],
  },
  about: {
    label: 'About Pejman',
    text: "I'm Pejman Ansaribarz, an AI creator based in Bangkok. I turn ideas into striking AI images, scroll-stopping video ads and automations that quietly save hours every week. Brands, founders and creators bring me a goal — I bring the prompts, the tools and the taste to make it real. Start with my free prompts, and when you're ready for something custom, let's build it together.",
  },
  services: {
    heading: 'What I can build for you',
    intro: 'Custom AI work for brands, creators and small teams. Tell me your goal and I will send you a clear quote.',
    items: [
      {
        title: 'AI Images',
        description: 'Product shots, campaigns and portraits — without a studio, a crew or a reshoot.',
        features: [
          'Product & lifestyle visuals',
          'Brand-consistent image sets',
          'Social media & ad creatives',
          'High-resolution delivery',
        ],
      },
      {
        title: 'AI Video Ads',
        description: 'Short, cinematic video ads built for Reels, TikTok and Shorts.',
        features: [
          'Concept, script & storyboard',
          'AI-generated scenes & motion',
          'Voice-over, music & captions',
          'Vertical & square formats',
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
    intro: 'Tell me about your project. I usually reply within 24 hours.',
    email: 'ghosmali22@gmail.com',
    whatsapp: '+66918157214',
    telegram: 'Pejmanansarii',
    instagram: 'peji_org',
  },
  footer: {
    newsletter: 'Get new free prompts every week',
  },
}

export const PROJECT_TYPES = ['AI Images', 'AI Video Ads', 'AI Automation', 'Something else'] as const
export const BUDGET_RANGES = ['Under $300', '$300 – $1,000', '$1,000 – $3,000', '$3,000+', 'Not sure yet'] as const

export const contactLinks = (c: SiteSettings['contact']) => ({
  email: `mailto:${c.email}`,
  whatsapp: `https://wa.me/${c.whatsapp.replace(/[^\d]/g, '')}`,
  telegram: `https://t.me/${c.telegram.replace(/^@/, '')}`,
  instagram: `https://instagram.com/${c.instagram.replace(/^@/, '')}`,
})
