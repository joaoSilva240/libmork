-- Migration 0021: Add theme column to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "theme" varchar(50) NOT NULL DEFAULT 'default-dark';
