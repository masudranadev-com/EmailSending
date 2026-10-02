import TemplateEditPage from "../../../../../views/pages/template-edit";

type TemplateEditRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TemplateEditRoute({ params }: TemplateEditRouteProps) {
  const { id } = await params;

  return <TemplateEditPage templateId={id} />;
}
