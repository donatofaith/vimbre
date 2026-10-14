import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Vimbre | Employee handovers made simple", description: "Manage leave and resignation handovers with clarity, AI assistance and approvals." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
