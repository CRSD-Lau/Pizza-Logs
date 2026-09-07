import type { Metadata } from "next";

export const SOCIAL_IMAGE = {
  url: "/social-preview.jpg?v=molten-1",
  width: 1280,
  height: 640,
  type: "image/jpeg",
  alt: "Pizza Logs: WotLK raid analytics with the Pizza Warriors guild crest",
} as const;

export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  absoluteTitle?: boolean;
}): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | Pizza Logs`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "en_CA",
      url: path,
      siteName: "Pizza Logs",
      title: socialTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
