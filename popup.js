const namespaceList = document.getElementById('namespaceList');

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const debugStr = localStorage.getItem('debug') || '';
      if (debugStr.trim() === '*') {
        return '*';
      }
      return debugStr.split(',').map(s => s.trim().replace(/\*$/, ''));
    }
  }, ([debugResult]) => {
    const activeNamespaces = debugResult?.result || [];

    chrome.runtime.sendMessage({ type: 'GET_NAMESPACE_COUNTS' }, (counts = {}) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return JSON.parse(localStorage.getItem('debug-known-namespaces') || '[]');
          }
        }, ([result]) => {
          const namespaces = result?.result || [];

          if (namespaces.length === 0) {
            namespaceList.textContent = 'No namespaces yet...';
            return;
          }

          namespaceList.innerHTML = '';

          // Group and sort namespaces
          const groups = namespaces.reduce((acc, ns) => {
            const safeNs = ns.replace(/,/g, '_');
            const group = safeNs.split(':')[0];
            if (!acc[group]) acc[group] = [];
            acc[group].push({ original: ns, safe: safeNs });
            return acc;
          }, {});

          // Sort group keys
          const sortedGroups = Object.keys(groups).sort();

          sortedGroups.forEach(group => {
            const groupHeader = document.createElement('div');
            groupHeader.style.fontWeight = 'bold';
            groupHeader.style.marginTop = '10px';
            groupHeader.textContent = group;
            namespaceList.appendChild(groupHeader);

            const groupToggle = document.createElement('input');
            groupToggle.type = 'checkbox';
            groupToggle.style.marginLeft = '10px';
            groupToggle.title = 'Toggle entire group';

            groupHeader.appendChild(groupToggle);

            groups[group]
              .sort((a, b) => a.safe.localeCompare(b.safe))
              .forEach(({ original, safe }) => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = activeNamespaces === '*' || activeNamespaces.includes(safe);

                checkbox.addEventListener('change', () => {
                  const allSelected = [];
                  document.querySelectorAll('#namespaceList input[type="checkbox"]:checked').forEach(cb => {
                    const container = cb.closest('label');
                    if (container?.dataset.ns) {
                      allSelected.push(container.dataset.ns);
                    }
                  });

                  // Determine if we are coming from wildcard state
                  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                    chrome.scripting.executeScript({
                      target: { tabId: tab.id },
                      func: () => localStorage.getItem('debug'),
                    }, ([result]) => {
                      const wasWildcard = result?.result?.trim() === '*';

                      chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (ns, enabled, allSelected, wasWildcard) => {
                          window.postMessage({ type: 'DEBUG_TOGGLE', namespace: ns, enabled, allSelected, wasWildcard }, '*');
                        },
                        args: [safe, checkbox.checked, allSelected, wasWildcard],
                      });
                    });
                  });
                });

                label.setAttribute('data-ns', safe);
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(`${safe} (`));
                const span = document.createElement('span');
                span.className = 'count';
                span.textContent = (counts[safe] ?? 0).toString();
                label.appendChild(span);
                label.appendChild(document.createTextNode(`)`));
                namespaceList.appendChild(label);
              });

            const groupNamespaces = groups[group].map(({ safe }) => safe);
            const allGroupEnabled = activeNamespaces === '*' || groupNamespaces.every(ns => activeNamespaces.includes(ns));
            groupToggle.checked = allGroupEnabled;

            groupToggle.addEventListener('change', () => {
              const enable = groupToggle.checked;
              const allSelected = [];

              // Update all in group
              groupNamespaces.forEach(ns => {
                const label = document.querySelector(`label[data-ns="${ns}"]`);
                const checkbox = label?.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  checkbox.checked = enable;
                  if (enable) allSelected.push(ns);
                }

                chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (ns, enabled, allSelected) => {
                      window.postMessage({ type: 'DEBUG_TOGGLE', namespace: ns, enabled, allSelected }, '*');
                    },
                    args: [ns, enable, allSelected]
                  });
                });
              });

              chrome.storage.local.get('activeNamespaces', (stored) => {
                const active = stored.activeNamespaces || {};
                groupNamespaces.forEach(ns => {
                  active[ns] = enable;
                });
                chrome.storage.local.set({ activeNamespaces: active });
              });
            });
          });
        });
      });
    });
  });
});

// Connect the popup to the background using a persistent port
const port = chrome.runtime.connect({ name: 'popup' });

port.onMessage.addListener((msg) => {
  if (msg.type === 'LIVE_UPDATE' && msg.counts) {
    document.querySelectorAll('label').forEach(label => {
      const safeNs = label.getAttribute('data-ns');
      const countSpan = label.querySelector('.count');
      if (safeNs && countSpan && msg.counts[safeNs] !== undefined) {
        countSpan.textContent = msg.counts[safeNs].toString();
      }
    });
  }
});

document.getElementById('resetAll').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.postMessage({ type: 'DEBUG_RESET_ALL' }, '*');
      }
    });
  });

  // Set all checkboxes to checked
  document.querySelectorAll('#namespaceList input[type="checkbox"]').forEach(cb => cb.checked = true);
});

document.getElementById('toggleOff').addEventListener('click', () => {
  const active = {};
  document.querySelectorAll('#namespaceList label').forEach(label => {
    const ns = label.getAttribute('data-ns');
    const cb = label.querySelector('input[type="checkbox"]');
    cb.checked = false;
    active[ns.replace(/,/g, '_')] = false;

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (ns, allSelected) => {
          window.postMessage({ type: 'DEBUG_TOGGLE', namespace: ns, enabled: false, allSelected }, '*');
        },
        args: [ns.replace(/,/g, '_'), []]
      });
    });
  });

  chrome.storage.local.set({ activeNamespaces: active });
});
