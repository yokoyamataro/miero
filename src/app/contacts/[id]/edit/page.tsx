import { notFound } from "next/navigation";
import { getIndividualContactById } from "../../actions";
import { ContactForm } from "../../contact-form";

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContactPage({ params }: EditContactPageProps) {
  const { id } = await params;
  const contact = await getIndividualContactById(id);

  if (!contact) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <ContactForm contact={contact} isEdit />
    </main>
  );
}
