import { z } from 'zod';

export const adminCreateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['user', 'editor', 'operator', 'admin', 'super_admin']).default('user'),
  roleId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'suspended']).default('active'),
  emailVerified: z.boolean().optional().default(true),
});

export const sitePageSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  body: z.string().default(''),
  ctaLabel: z.string().optional().default(''),
  ctaUrl: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  sortOrder: z.number().int().default(1),
  isVisible: z.boolean().default(true),
});

export const sitePageSchema = z.object({
  pageKey: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().optional().default(''),
  metaTitle: z.string().optional().default(''),
  metaDescription: z.string().optional().default(''),
  heroHeading: z.string().optional().default(''),
  heroBody: z.string().optional().default(''),
  heroImageUrl: z.string().optional().default(''),
  sectionsJson: z.array(sitePageSectionSchema).optional().default([]),
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const navigationItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(80),
  url: z.string().trim().min(1, 'URL is required').max(255),
  location: z.enum(['header', 'footer', 'footer_membership']).default('header'),
  parentId: z.number().int().positive().nullable().optional(),
  badgeText: z.string().max(30).optional().default(''),
  openInNewTab: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
});
