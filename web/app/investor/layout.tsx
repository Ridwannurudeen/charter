import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Investor Portal | Charter",
};

export default function InvestorLayout({ children }: { children: ReactNode }) {
  return children;
}
