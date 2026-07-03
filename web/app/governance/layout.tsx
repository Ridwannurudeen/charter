import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Shareholder Resolutions | Charter",
};

export default function GovernanceLayout({ children }: { children: ReactNode }) {
  return children;
}
