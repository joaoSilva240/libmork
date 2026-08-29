CREATE TABLE IF NOT EXISTS "rpg_races" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "speed" integer DEFAULT 30 NOT NULL,
  "size" varchar(50) DEFAULT 'Médio' NOT NULL,
  "hit_points_bonus" integer DEFAULT 0 NOT NULL,
  "attribute_bonuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "heritages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "image_url" varchar(500),
  "source_system" varchar(50) DEFAULT 'custom',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
