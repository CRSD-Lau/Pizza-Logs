import type { Metadata } from "next";

const SOCIAL_IMAGE = {
  url: "/social-preview.jpg",
  width: 1280,
  height: 640,
  alt: "Pizza Logs: WotLK raid analytics",
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
      images: [SOCIAL_IMAGE.url],
    },
  };
}
