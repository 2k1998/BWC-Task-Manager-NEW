import PageClient from "./page-client";

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PageClient params={params} />;
}
