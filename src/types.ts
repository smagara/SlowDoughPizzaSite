/**
 * Shared content types. The shapes mirror what tools/content-loader.mjs
 * produces from the CMS-editable files under content/.
 */

export interface MenuItem {
  id: string;
  name: string;
  italianName?: string;
  description: string;
  price: number;
  /** false = shown as "Sold out today" (useful for the daily menu). */
  available: boolean;
  tags: string[];
  isVegetarian: boolean;
  isVegan: boolean;
}

export interface MenuCategory {
  id: string;
  title: string;
  subtitle: string;
  order: number;
  items: MenuItem[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  authorRole: string;
  readTime: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Human readable, e.g. "September 14, 2026" */
  publishedDate: string;
  excerpt: string;
  artType: 'dough' | 'oven';
  keyTakeaways: string[];
  /** Markdown (restricted subset) – rendered by <SafeMarkdown>. */
  body: string;
}

export interface StoreHours {
  day: string;
  hours: string;
  statusNote?: string;
  isClosed?: boolean;
}

export interface HoursSettings {
  /** Short summary shown in the header badge, e.g. "Wed–Sun • 4:30 PM" */
  summary: string;
  days: StoreHours[];
}

export interface Announcement {
  enabled: boolean;
  headline: string;
  detail: string;
  style: 'standard' | 'alert';
}

export interface SiteContent {
  announcement: Announcement;
  hours: HoursSettings;
  menu: MenuCategory[];
  posts: BlogPost[];
}
