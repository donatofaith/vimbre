import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, FileText, ShieldCheck, Sparkles, Users, CalendarDays, Play } from "lucide-react";
const features = [
  { icon: FileText, title: "Structured handovers", description: "Capture responsibilities, tasks, deadlines and key contacts." },
  { icon: Sparkles, title: "AI-assisted drafting", description: "Turn rough notes into suggestions that employees review." },
  { icon: ClipboardCheck, title: "Manager approval", description: "Review, approve or request changes before a handover is finalized." },
  { icon: Users, title: "Cover-person workflow", description: "Give the right person access to important work and questions." },
  { icon: CalendarDays, title: "Deadline visibility", description: "Keep important dates easy to find and act upon." },
  { icon: ShieldCheck, title: "Company workspaces", description: "Keep each company's information in its own secure workspace." },
];
const stages = ["HR creates", "Employee prepares", "Manager reviews", "Cover person continues"];
export default function Home() { return (
 <main className="overflow-hidden">
  <div className="relative bg-gradient-to-br from-white via-[#f4f9ff] to-[#e6f3ff]">
   <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5">
    <Link href="/" className="text-2xl font-extrabold tracking-tight text-vimbre-navy"><span className="text-vimbre-blue">◆</span> Vimbre</Link>
    <nav aria-label="Main navigation" className="hidden gap-8 text-sm font-medium text-slate-600 md:flex"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></nav>
    <Link href="/login" className="rounded-xl bg-vimbre-blue px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600">Sign in</Link>
   </header>
   <section className="mx-auto grid min-h-[600px] max-w-7xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-2">
    <div><span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-vimbre-blue">SMOOTH TRANSITIONS. STRONGER TEAMS.</span>
    <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight text-vimbre-navy md:text-6xl">Employee handovers made <span className="text-vimbre-blue">simple.</span></h1>
    <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">Vimbre helps companies manage handovers during leave and resignation, ensuring work continues smoothly with clear responsibilities and no knowledge loss.</p>
    <div className="mt-9 flex flex-wrap gap-4"><Link href="/login" className="inline-flex items-center gap-3 rounded-xl bg-vimbre-blue px-6 py-4 font-semibold text-white shadow-lg shadow-blue-200">Get Started <ArrowRight size={18}/></Link><a href="#how-it-works" className="inline-flex items-center gap-3 rounded-xl border border-blue-200 bg-white px-6 py-4 font-semibold text-vimbre-navy"><Play size={17}/> See how it works</a></div></div>
    <div className="relative min-h-[460px] rounded-[40px] bg-gradient-to-br from-[#dbedff] via-[#eaf3ff] to-[#c5e3ff] p-5 shadow-[0_25px_85px_rgba(47,128,237,0.16)]" aria-label="Handover dashboard preview">
     <div className="glass absolute left-2 top-16 z-10 w-60 rounded-2xl p-5 sm:left-[-20px]"><span className="text-xs font-bold text-vimbre-navy">Handover in progress</span><p className="mt-2 text-sm text-slate-600">Marketing team</p><div className="mt-4 h-2 rounded-full bg-blue-100"><div className="h-2 w-4/5 rounded-full bg-vimbre-blue"/></div><p className="mt-2 text-xs text-vimbre-blue">80% ready for review</p></div>
     <div className="absolute inset-x-14 bottom-16 top-20 rounded-[36px] border border-white/80 bg-gradient-to-br from-[#85baff]/40 to-white/70"/>
     <div className="glass absolute bottom-12 right-5 rounded-2xl p-5"><CheckCircle2 className="mb-2 text-vimbre-green"/><p className="font-bold text-vimbre-navy">Manager approved</p><p className="text-sm text-slate-600">Ready for the cover person</p></div>
     <div className="glass absolute bottom-36 left-3 rounded-2xl p-4"><Sparkles className="mb-2 text-vimbre-blue"/><p className="text-sm font-bold text-vimbre-navy">AI assistance</p><p className="text-xs text-slate-600">Organized, editable notes</p></div>
     <span className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-500">Hero photography will be added after asset approval</span>
    </div>
   </section>
  </div>
  <section id="features" className="mx-auto max-w-7xl px-6 py-24"><p className="text-center text-sm font-bold uppercase tracking-widest text-vimbre-blue">Built for continuity</p><h2 className="mt-4 text-center text-4xl font-extrabold text-vimbre-navy">Everything you need for seamless handovers</h2><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{features.map(({icon:Icon,title,description})=><article className="glass rounded-3xl p-7" key={title}><Icon className="text-vimbre-blue" size={30}/><h3 className="mt-5 text-xl font-bold text-vimbre-navy">{title}</h3><p className="mt-3 leading-relaxed text-slate-600">{description}</p></article>)}</div></section>
  <section id="how-it-works" className="bg-white py-24"><div className="mx-auto max-w-7xl px-6"><p className="text-center text-sm font-bold uppercase tracking-widest text-vimbre-blue">How it works</p><h2 className="mt-4 text-center text-4xl font-extrabold text-vimbre-navy">Four clear steps. One smooth transition.</h2><div className="mt-12 grid gap-5 md:grid-cols-4">{stages.map((s,i)=><div key={s} className="glass rounded-3xl p-7"><span className="text-3xl font-bold text-vimbre-blue">0{i+1}</span><h3 className="mt-6 text-lg font-bold text-vimbre-navy">{s}</h3></div>)}</div></div></section>
  <section id="pricing" className="mx-auto max-w-7xl px-6 py-24"><p className="text-center text-sm font-bold uppercase tracking-widest text-vimbre-blue">Pricing</p><h2 className="mt-4 text-center text-4xl font-extrabold text-vimbre-navy">Plans for growing teams</h2><p className="mt-4 text-center text-slate-600">Proposed pricing. Final plan features and billing are subject to confirmation.</p><div className="mt-12 grid gap-6 md:grid-cols-4">{[["Starter","£29","Up to 10 employees"],["Growth","£99","Up to 50 employees"],["Business","£249","Up to 250 employees"],["Enterprise","Custom","250+ employees"]].map(([name,price,description])=><article key={name} className="glass rounded-3xl p-7"><h3 className="text-xl font-bold text-vimbre-navy">{name}</h3><p className="mt-6 text-3xl font-extrabold text-vimbre-navy">{price}</p><p className="mt-4 text-sm text-slate-600">{description}</p><Link href="/login" className="mt-10 block rounded-xl border border-blue-300 p-3 text-center font-semibold text-vimbre-blue">Get started</Link></article>)}</div></section>
  <footer className="bg-vimbre-navy px-6 py-10 text-center text-sm text-white">© {new Date().getFullYear()} Vimbre · Employee handovers made simple</footer>
 </main>
);}
