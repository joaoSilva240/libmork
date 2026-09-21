CREATE TABLE "library_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cover_url" varchar(1000),
	"external_url" varchar(1000) NOT NULL,
	"provider" varchar(50) DEFAULT 'external' NOT NULL,
	"category" varchar(50) DEFAULT 'livro-base' NOT NULL,
	"tags" text[],
	"is_official" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_library_doc_campaign" ON "library_documents" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_library_doc_category" ON "library_documents" USING btree ("category");