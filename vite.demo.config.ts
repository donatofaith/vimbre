import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({plugins:[{name:'isolated-demo-client',enforce:'pre',resolveId(source,importer){if((source==='./supabase'&&importer?.includes('/src/lib/'))||/(?:^|\/)lib\/supabase$/.test(source))return path.resolve('demo/client.ts')}},react()],build:{outDir:'dist',emptyOutDir:false,rolldownOptions:{input:path.resolve('demo/index.html')}}})
