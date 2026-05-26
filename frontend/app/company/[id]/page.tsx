import PageClient from "./page-client";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PageClient params={params} />;
}
