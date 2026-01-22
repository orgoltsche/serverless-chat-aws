import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Buffer } from 'buffer';
import process from 'process';
import App from './App.vue';
import './assets/main.css';

(window as typeof window & { global?: typeof window }).global = window;
(window as typeof window & { Buffer?: typeof Buffer }).Buffer = Buffer;
(window as typeof window & { process?: typeof process }).process = process;

const app = createApp(App);

app.use(createPinia());
app.mount('#app');
