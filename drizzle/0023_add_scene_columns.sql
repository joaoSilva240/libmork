-- Migration 0023: Colunas de cena nas campanhas e trilhas da jukebox (Issue #86 — Fase 1)

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "active_scene" varchar(20);

ALTER TABLE "campaign_audio_tracks" ADD COLUMN IF NOT EXISTS "scene" varchar(20);
