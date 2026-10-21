import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/dm-sans/latin-ext-400.css';
import '@fontsource/bricolage-grotesque/latin-ext-700.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
