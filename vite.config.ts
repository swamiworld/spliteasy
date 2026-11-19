import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works under https://swamiworld.github.io/<repo>/
export default defineConfig({ base: './', plugins: [react()] });
