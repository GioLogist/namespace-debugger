const state = {
  activeNamespaces: {},
  namespaceCounts: {}
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[background] Received message:', message);

  if (message.type === 'GET_ACTIVE_NAMESPACES') {
    chrome.storage.local.get('activeNamespaces', (data) => {
      state.activeNamespaces = data.activeNamespaces || state.activeNamespaces;
      sendResponse(state.activeNamespaces);
    });
    return true;
  }

  if (message.type === 'GET_NAMESPACE_COUNTS') {
    sendResponse(state.namespaceCounts || {});
    return true;
  }

  if (message.type === 'DEBUG_LOG') {
    state.namespaceCounts[message.namespace] = message.count;
    console.log('[background] Updating count:', message.namespace, message.count);
    
    // broadcast live count to popups
    if (state.port) {
      state.port.postMessage({ type: 'LIVE_UPDATE', counts: state.namespaceCounts });
    }
  }

  if (message.type === 'DEBUG_NEW_NAMESPACE') {
    state.activeNamespaces[message.namespace] ??= true;
    chrome.storage.local.set({ activeNamespaces: state.activeNamespaces });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    state.port = port;

    port.onDisconnect.addListener(() => {
      if (state.port === port) {
        delete state.port;
      }
    });
  }
});
