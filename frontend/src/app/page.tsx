import { BLOG_DB_PAGE_ID, fetchNotionDb } from "@/lib/notion";
import ShowcaseSection from "./_ShowcaseSection";


export const revalidate = 300; // Revalidate this page every 5 minutes

export default async function Home() {

  return (
    <main className="min-h-screen bg-[#F8F7FA] pt-16">
      <ShowcaseSection />
    </main>
  );
}