import CampaignEmailsPage from "../../../../../views/pages/campaign-emails";

type CampaignEmailsRouteProps = {
  params: Promise<{
    campaignId: string;
  }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
};

export default async function CampaignEmailsRoute({
  params,
  searchParams,
}: CampaignEmailsRouteProps) {
  const [{ campaignId }, search] = await Promise.all([params, searchParams]);

  return (
    <CampaignEmailsPage
      campaignId={campaignId}
      initialPage={search.page || "1"}
      initialSearch={search.search || ""}
    />
  );
}
