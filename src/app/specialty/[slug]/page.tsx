import { notFound, permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function DeprecatedSpecialtyPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "urology") permanentRedirect("/clinical-research");
  notFound();
}
