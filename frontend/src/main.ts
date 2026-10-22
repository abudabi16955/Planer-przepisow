import './styles/tokens.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerServiceWorker } from './lib/serviceWorker';

mount(App, { target: document.getElementById('app')! });
if (import.meta.env.PROD) registerServiceWorker();
