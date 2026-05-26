import PageClient from "./page-client";

export async function generateStaticParams() {
  return [];
}

export default function Page() {
  return <PageClient />;
}
