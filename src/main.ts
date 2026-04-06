import App from './App.svelte';
import { mount } from 'svelte';

try {
  const app = mount(App, {
    target: document.getElementById('app')!,
  });
  console.log('pdfiuh mounted successfully');
} catch (e) {
  console.error('Critical error mounting pdfiuh:', e);
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.innerHTML = `
      <div style="color: white; padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>Errore Critico</h1>
        <p>${e instanceof Error ? e.message : String(e)}</p>
        <p>Controlla la console del browser per maggiori dettagli.</p>
      </div>
    `;
  }
}

export default {};
