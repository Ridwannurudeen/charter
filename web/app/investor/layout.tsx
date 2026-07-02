import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Portal - Charter",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
