/**
 * All editable site content, loaded at build time from the files in
 * `content/` (see tools/content-loader.mjs and tools/vite-plugin-site-content.mjs).
 *
 * The pizza shop owner edits these files through Decap CMS at /admin.
 */
import content from 'virtual:site-content';
import type { Announcement, BlogPost, HoursSettings, MenuCategory } from './types';

export const ANNOUNCEMENT: Announcement = content.announcement;
export const HOURS: HoursSettings = content.hours;
export const MENU_CATEGORIES: MenuCategory[] = content.menu;
export const BLOG_POSTS: BlogPost[] = content.posts;
