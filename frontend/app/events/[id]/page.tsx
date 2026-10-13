import DetailPage from "../detail/page";

// Static export requires at least one param; empty [] fails the build (Next.js #71862).
export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <DetailPage />;
}
