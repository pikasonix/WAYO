import { ExtendedRecordMap, Block } from "notion-types";
import { NotionAPI as NotionInit } from "notion-client";
import { getExtractionTools } from "react-notion-x-utils";

export const NotionAPI = new NotionInit();

// Notion Database ID
export const BLOG_DB_PAGE_ID = "1dbba13a1ee380b5b64fc79e113525e1";

export interface SimpleDbDataInterface {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  is_news: boolean;
  created_time: number;
  slug?: string;
  cover_img_url?: string;
  date_published?: string;
  tags?: string[];
}

// Helper: map Notion block -> SimpleDbDataInterface
const mapBlockToPost = (b: Block, t: ReturnType<typeof getExtractionTools>): SimpleDbDataInterface => ({
  id: t.getId(b),
  title: t.getTitle(b),
  created_time: t.getCreatedTime(b),
  description: t.getValue(b, "description") || "",
  slug: t.getValue(b, "slug") || "",
  cover_img_url: t.getValue(b, "cover_img_url") || "",
  is_published: t.getValue(b, "is_published") === "Yes",
  is_news: t.getValue(b, "is_news") === "No",
  date_published: t.getDate(b, "date_published"),
 tags: t.getValue(b, "tags")?.split(",").map((tag: string) => tag.trim()) || []

});

// Generic fetch from Notion
const fetchNotionPosts = async (pageId: string): Promise<SimpleDbDataInterface[]> => {
  try {
    const recordMap: ExtendedRecordMap = await NotionAPI.getPage(pageId);
    const t = getExtractionTools(recordMap);
    return t.blockArray.map(b => mapBlockToPost(b, t));
  } catch (error) {
    console.error("Error fetching Notion posts:", error);
    return [];
  }
};

// Fetch all published posts
export const fetchNotionDb = async (pageId: string): Promise<SimpleDbDataInterface[]> => {
  const posts = await fetchNotionPosts(pageId);
  return posts.filter(p => p.is_published);
};

// Fetch blogs (is_news = false)
export const fetchNotionDbBlog = async (pageId: string): Promise<SimpleDbDataInterface[]> => {
  const posts = await fetchNotionPosts(pageId);
  return posts
    .filter(p => p.is_published && !p.is_news)
    .sort((a, b) => new Date(b.date_published || 0).getTime() - new Date(a.date_published || 0).getTime());
};

// Fetch news (is_news = true)
export const fetchNotionDbnew = async (pageId: string): Promise<SimpleDbDataInterface[]> => {
  const posts = await fetchNotionPosts(pageId);
  return posts
    .filter(p => p.is_published && p.is_news)
    .sort((a, b) => new Date(b.date_published || 0).getTime() - new Date(a.date_published || 0).getTime());
};

// Fetch other posts for pagination
export const fetchOtherPosts = async (pageId: string, page = 1, limit = 9) => {
  const allPosts = await fetchNotionDbnew(pageId);
  const otherPosts = allPosts.slice(1); // skip latest post
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    posts: otherPosts.slice(start, end),
    total: otherPosts.length,
  };
};

// Fetch latest post
export const fetchLatestPost = async (pageId: string) => {
  const posts = await fetchNotionDbnew(pageId);
  return posts[0] || null;
};
