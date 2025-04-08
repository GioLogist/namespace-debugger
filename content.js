// Inject the script into the actual page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for page → content-script messages
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  // console.log('[content.js] forwarding debug msg:', event.data);

  if (event.data?.type === 'DEBUG_NEW_NAMESPACE') {
    chrome.runtime.sendMessage({
      type: 'DEBUG_NEW_NAMESPACE',
      namespace: event.data.namespace
    });
  }

  if (event.data?.type === 'DEBUG_LOG') {
    chrome.runtime.sendMessage({
      type: 'DEBUG_LOG',
      namespace: event.data.namespace,
      count: event.data.count
    });
  }
});

