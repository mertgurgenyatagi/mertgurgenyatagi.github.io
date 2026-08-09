import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, last-wins on conflicting utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolves a public asset path against Vite's base URL (e.g. for GitHub Pages subfolder hosting).
 */
export function assetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL ?? "./";
  return base.endsWith("/") ? `${base}${cleanPath}` : `${base}/${cleanPath}`;
}

