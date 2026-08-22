import { ContentManager } from "@/components/content/ContentManager";

export default async function CampaignContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContentManager basePath={`/api/campaigns/${id}/content`} title="Conteúdo da Campanha" />;
}
