"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";

type Theme = "light" | "dark";
const KEY = "vimbre-theme";

/** Applies a user-selected theme across marketing pages and the application. */
export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>("light");
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const current=document.documentElement.dataset.theme==="dark"?"dark":"light";
    setTheme(current);
    setReady(true);
  },[]);

  const toggle=()=>{
    const next:Theme=theme==="dark"?"light":"dark";
    document.documentElement.dataset.theme=next;
    document.documentElement.style.colorScheme=next;
    try{localStorage.setItem(KEY,next)}catch{}
    setTheme(next);
  };

  const dark=theme==="dark";
  return <button
    type="button"
    onClick={toggle}
    aria-label={dark?"Switch to light mode":"Switch to dark mode"}
    aria-pressed={dark}
    title={dark?"Switch to light mode":"Switch to dark mode"}
    className="theme-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white/80 text-vimbre-navy shadow-sm transition hover:-translate-y-0.5 hover:border-vimbre-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vimbre-blue"
  >
    {ready&&dark?<Sun size={20} aria-hidden="true"/>:<Moon size={20} aria-hidden="true"/>}
  </button>;
}
