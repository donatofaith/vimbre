import Link from "next/link";
import {Brand} from "./brand";
import {ArrowUpRight, Menu} from "lucide-react";
import {ThemeToggle} from "./theme-toggle";
export function SiteHeader(){
 return <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 lg:px-8">
  <Brand/>
  <nav aria-label="Main navigation" className="hidden items-center gap-9 text-sm font-semibold text-slate-600 md:flex">
   <a className="transition hover:text-vimbre-blue" href="/#features">Features</a>
   <a className="transition hover:text-vimbre-blue" href="/#how-it-works">How it works</a>
   <Link className="transition hover:text-vimbre-blue" href="/pricing">Pricing</Link>
   <a className="transition hover:text-vimbre-blue" href="/#why-vimbre">Why Vimbre</a>
  </nav>
  <div className="flex items-center gap-2 sm:gap-3">
   <ThemeToggle/>
   <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-slate-700 sm:block">Log in</Link>
   <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-vimbre-blue px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-[#246fe2] sm:px-5">Get Started<ArrowUpRight size={16}/></Link>
   <Link className="p-2 text-slate-600 md:hidden" href="/demo" aria-label="Preview the application"><Menu size={23}/></Link>
  </div>
 </header>;
}
