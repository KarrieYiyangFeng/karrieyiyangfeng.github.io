const form = document.querySelector('#portfolio-unlock');
const password = document.querySelector('#password');
const status = document.querySelector('#password-status');
const button = form.querySelector('button');

function activateSession(worker, key) {
  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    const timeout = setTimeout(() => {
      port1.close();
      reject(new Error('Unlock timed out'));
    }, 15000);
    port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      port1.close();
      if (data === true) resolve();
      else reject(new Error('Could not store the session'));
    };
    worker.postMessage({ key }, [port2]);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = '';

  try {
    if (!globalThis.crypto?.subtle || !navigator.serviceWorker) {
      status.textContent = 'Open the portfolio in a browser that supports secure web apps.';
      return;
    }

    const response = await fetch('/portfolio-data/manifest.bin', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not load the portfolio');
    const manifest = new Uint8Array(await response.arrayBuffer());
    const passwordKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password.value), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: manifest.subarray(0, 16), iterations: 600000 },
      passwordKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );

    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: manifest.subarray(16, 28) }, key, manifest.subarray(28)
      );
    } catch (error) {
      if (error.name !== 'OperationError') throw error;
      status.textContent = 'Incorrect password. Try again.';
      password.focus();
      return;
    }

    await navigator.serviceWorker.register('/portfolio-worker.js', { updateViaCache: 'none' });
    const registration = await navigator.serviceWorker.ready;
    await activateSession(registration.active, key);

    const { files } = JSON.parse(new TextDecoder().decode(plaintext));
    const path = decodeURIComponent(location.pathname);
    password.value = '';
    if (path === '/' || Object.hasOwn(files, path)) location.reload();
    else location.replace('/');
  } catch {
    status.textContent = 'The portfolio could not open. Please try again.';
  } finally {
    button.disabled = false;
  }
});
