import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "COFI · Centro Familiar",
    short_name: "COFI",
    description: "La agenda y las responsabilidades de tu familia, juntas.",
    lang: "es-PE",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF8F3",
    theme_color: "#FAF8F3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
