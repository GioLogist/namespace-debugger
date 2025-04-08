(function () {
    console.log('injected.js loaded');
    const originalDebug = console.debug.bind(console);
    const namespaceCounts = {};
    const knownNamespaces = new Set(JSON.parse(localStorage.getItem('debug-known-namespaces') || '[]'));
  
    function extractNamespace(text, args = []) {
      if (typeof text !== 'string') return null;

      const formatMatches = [...text.matchAll(/%c/g)];

      for (let i = 0; i < formatMatches.length; i++) {
        const style = args[i + 1]; // style follows format token
        const sliceStart = formatMatches[i].index;
        const sliceEnd = text.indexOf('%c', sliceStart + 2); // next token
        const slice = text.slice(sliceStart + 2, sliceEnd !== -1 ? sliceEnd : undefined).trim();

        if (style && typeof style === 'string' && style.includes('color') && slice) {
          return slice;
        }
      }

      return null;
    }
  
    console.debug = (...args) => {
      // console.log('console.debug called with args:', args);
      const ns = extractNamespace(args[0], args);
      if (ns) {
        if (!namespaceCounts[ns]) {
          namespaceCounts[ns] = 0;
          if (!knownNamespaces.has(ns)) {
            knownNamespaces.add(ns);
            localStorage.setItem('debug-known-namespaces', JSON.stringify([...knownNamespaces]));
            window.postMessage({ type: 'DEBUG_NEW_NAMESPACE', namespace: ns }, '*');
          }
        }
  
        namespaceCounts[ns]++;
        window.postMessage({ type: 'DEBUG_LOG', namespace: ns, count: namespaceCounts[ns] }, '*');
      }
  
      // Always forward the log
      originalDebug(...args);
    };
  
    console.log('[debug-extension] console.debug patched and namespace tracker running.');

    window.addEventListener('message', (event) => {
      // console.log('[injected.js] received message:', event.data);
      if (event.data?.type === 'DEBUG_TOGGLE') {
        const { namespace, enabled, allSelected = [] } = event.data;
        const current = (localStorage.getItem('debug') || '').split(',').map(s => s.trim()).filter(Boolean);
        const debugVal = localStorage.getItem('debug') || '';
        const hasGlobalWildcard = debugVal.trim() === '*';
        const newSet = new Set(current);

        if (hasGlobalWildcard) {
          // Replace wildcard with actual selected items if user toggles from '*'
          allSelected.forEach(ns => newSet.add(ns + '*'));
          newSet.delete('*');
        }

        if (enabled) {
          newSet.add(namespace + '*');
        } else {
          newSet.delete(namespace + '*');
        }

        localStorage.setItem('debug', [...newSet].join(','));
        console.log('[debug-extension] Toggled debug namespace:', namespace, '->', enabled);
      }

      if (event.data?.type === 'DEBUG_RESET_ALL') {
        localStorage.setItem('debug', '*');
        console.log('[debug-extension] Reset debug to "*".');
      }
    });
})();
