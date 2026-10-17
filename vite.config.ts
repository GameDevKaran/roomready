import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:3220','/mcp':'http://127.0.0.1:3220'}},build:{sourcemap:true}});
