-- Índices compostos para otimizar queries N+1
CREATE INDEX IF NOT EXISTS idx_char_spells_composite ON character_spells(character_id, spell_id);
CREATE INDEX IF NOT EXISTS idx_char_items_composite ON character_items(character_id, item_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_composite ON character_campaigns(character_id, campaign_id);
