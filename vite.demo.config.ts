import { assertClientModule } from './scripts/public-env.ts'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({plugins:[{name:'isolated-demo-client',enforce:'pre',resolveId(source,importer){if((source==='./supabase'&&importer?.includes('/src/lib/'))||/(?:^|\/)lib\/supabase$/.test(source))return path.resolve('demo/client.ts')}},react(),{name:'vimbre-demo-secret-boundary',enforce:'pre',apply:'build',transform(_code,id){assertClientModule(id,process.cwd())}}],build:{sourcemap:false,outDir:'dist',emptyOutDir:false,rolldownOptions:{input:path.resolve('demo/index.html')}}})
