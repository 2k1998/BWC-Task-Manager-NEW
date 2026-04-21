import PageClient from "./page-client";

export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PageClient params={params} />;
}
