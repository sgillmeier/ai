'use strict';
const button = document.querySelector('#vote');
const status = document.querySelector('#status');
button.hidden = false;
const saved = 'mind-support.more-visuals.v1';
let sent = false;
try { sent = sessionStorage.getItem(saved) === 'sent'; } catch { /* The page also works with storage disabled. */ }
function accepted() { button.hidden = true; status.textContent = button.dataset.thanks; }
if (sent) accepted();
button.addEventListener('click', async () => {
  if (button.disabled || sent) return;
  button.disabled = true;
  status.textContent = button.dataset.sending;
  const query = new URLSearchParams({p:'mind-support-more-visuals',t:'Mind Support – more visual explanations',e:'true',ns:'true',r:''});
  try {
    const result = await fetch('https://sgillmeier.goatcounter.com/count?' + query, {
      mode:'cors', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', redirect:'error',
      signal:AbortSignal.timeout(10000)
    });
    if (result.status !== 200 || result.headers.get('X-Goatcounter')) throw new Error('Vote not accepted');
    sent = true;
    try { sessionStorage.setItem(saved,'sent'); } catch { /* Keep the in-memory guard. */ }
    accepted();
  } catch { status.textContent = button.dataset.error; button.disabled = false; }
});
