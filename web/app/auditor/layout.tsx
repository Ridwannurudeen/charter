import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Auditor View | Charter",
};

export default function AuditorLayout({ children }: { children: ReactNode }) {
  return children;
}
