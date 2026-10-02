import TemplateFormPage from "./template-form";

type TemplateEditPageProps = {
  templateId: string;
};

export default function TemplateEditPage({ templateId }: TemplateEditPageProps) {
  return <TemplateFormPage mode="edit" templateId={templateId} />;
}
