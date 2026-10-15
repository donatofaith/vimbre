import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
export const metadata:Metadata={title:"Vimbre — Employee handovers made simple",description:"A clearer way to hand over work during leave and resignation."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>}
