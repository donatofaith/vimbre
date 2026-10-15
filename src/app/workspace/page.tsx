import {Suspense} from "react";
import {Workspace} from "@/components/workspace";
export default function WorkspacePage(){return <Suspense fallback={<p>Loading workspace...</p>}><Workspace/></Suspense>}
