import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auditor View - Charter",
};

export default function AuditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
