export type BlogPost = {
  slug: string
  title: string
  description: string
  published: string // ISO date: YYYY-MM-DD
  author: string
  sections: { heading: string; paragraphs: string[] }[]
}
// Add approved articles here. Each entry becomes a pre-rendered public page at /blog/{slug}.
// Keep drafts outside this array; nothing is published until the repository release.
export const blogPosts: BlogPost[] = []
