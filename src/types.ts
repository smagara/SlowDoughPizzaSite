export interface MenuItem {
  id: string;
  name: string;
  italianName?: string;
  description: string;
  price: number;
  tags?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
}

export interface MenuCategory {
  id: string;
  title: string;
  subtitle: string;
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
  publishedDate: string;
  excerpt: string;
  artType: 'dough' | 'oven';
  /** Raw Markdown body, sanitized with DOMPurify before render. */
  bodyMarkdown: string;
  keyTakeaways: string[];
}

export interface StoreHours {
  day: string;
  hours: string;
  statusNote?: string;
  isClosed?: boolean;
}

export interface DoughAnnouncement {
  isActive: boolean;
  badgeText: string;
  detailText: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroBody: string;
}

export interface DailyMenuContent {
  sectionLabel: string;
  sectionTitle: string;
  sectionIntro: string;
  orderingNote: string;
  categories: MenuCategory[];
}

export interface StoreHoursContent {
  sectionNote: string;
  batchCapacityNote: string;
  days: StoreHours[];
}
