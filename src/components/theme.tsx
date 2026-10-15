"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";
type Theme="light"|"dark";
const Context=createContext<{theme:Theme;toggle:()=>void}>({theme:"light",toggle:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){const [theme,setTheme]=useState<Theme>("light");useEffect(()=>{let selected:Theme="light";try{const stored=localStorage.getItem("vimbre-theme");selected=stored==="dark"?"dark":stored==="light"?"light":matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch{}setTheme(selected)},[]);useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem("vimbre-theme",theme)}catch{}},[theme]);return <Context.Provider value={{theme,toggle:()=>setTheme(t=>t==="light"?"dark":"light")}}>{children}</Context.Provider>}
export function ThemeToggle(){const {theme,toggle}=useContext(Context);return <button className="theme-toggle" onClick={toggle} aria-label={theme==="light"?"Switch to dark mode":"Switch to light mode"} title="Change appearance">{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button>}
