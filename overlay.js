(function() {
  const OVERLAY_ID = 'tco-ext-element';
  const OVERLAY_TITLEBAR_ID = 'tco-ext-element-titlebar';
  const OVERLAY_BUTTON_ID = 'tco-ext-element-button';

  const STORAGE_KEY = 'tco-ext:settings';

  const intervalIds = [];
  let currentChannel = null;

  // Create a mutation observer so we can watch target elements
  // for attribute changes and detect when the user has gone into
  // fullscreen mode
  const observer = new MutationObserver(mutationCallback);
  function mutationCallback(mutationsList) {
    for (const mutation of mutationsList) {
      const element = mutation.target;
      if (element.id === OVERLAY_ID) {
        const style = element.getAttribute('style');
        if (style !== null && style.length > 0) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ style }));
        }
      } else {
        if (element.classList.contains('video-player--fullscreen')) {
          const fsElement = element.querySelector('.video-player__container');
          createChatOverlay(fsElement);
        } else {
          destroyChatOverlay();
        }
      }
    }
  }

  let cleanupWindowEvents = null;
  function buildTitleBar(parent) {
    const element = document.createElement('div');
    element.id = OVERLAY_TITLEBAR_ID;

    // Implement dragging of the chat window
    let isDragging = false;
    let startX, startY, transformX, transformY;

    // RAF function for updating the transform style
    function dragUpdate() {
      if (isDragging) {
        requestAnimationFrame(dragUpdate);
      }
      parent.style.transform = `translate(${transformX}px, ${transformY}px)`;
    }

    function onMouseDown(event) {
      isDragging = true;

      // Set initial transform values based on the position
      if (transformX === undefined && transformY === undefined) {
        const matches = parent.style.transform.match(/(\d+)px, (\d+)px/);
        transformX = matches ? parseFloat(matches[1]) : 0;
        transformY = matches ? parseFloat(matches[2]) : 0;
      }

      startX = event.pageX - transformX;
      startY = event.pageY - transformY;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      requestAnimationFrame(dragUpdate);
    }

    function onMouseUp() {
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(event) {
      transformX = event.pageX - startX;
      transformY = event.pageY - startY;
    }
    element.addEventListener('mousedown', onMouseDown);

    // Cleanup these events when we destroy the parent element
    cleanupWindowEvents = function() {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };

    return element;
  }

  // Add button to the player controls that can be used to toggle
  // the overlayed chat window
  function buildToggleControl(player, parent) {
    const element = document.createElement('button');
    element.classList.add('player-button');
    element.id = OVERLAY_BUTTON_ID;
    element.type = 'button';

    // Toggle code
    function onClick() {
      // Will only be undefined on first run, where settings aren't saved
      const state = parent.style.visibility || 'visible';
      if (state === 'visible') {
        parent.style.visibility = 'hidden';
      } else {
        parent.style.visibility = 'visible';
      }
    }
    element.addEventListener('click', onClick);

    // Icon
    const icon = document.createElement('span');
    icon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 22"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    // Tooltip
    const tooltip = document.createElement('span');
    tooltip.classList.add('player-tip');
    tooltip.dataset.tip = 'Toggle Chat Overlay';

    const target = player.querySelector('.player-buttons-right');
    if (target) {
      element.appendChild(icon);
      element.appendChild(tooltip);
      target.prepend(element);
    }
  }

  function createSettingsMenu(iframe) {
    const overlayElement = document.getElementById(OVERLAY_ID);

    const settingsButton = document.createElement('span');
    settingsButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 22" style="width: auto;height: 78%;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    settingsButton.title = 'Overlay Chat Settings'
    settingsButton.className = 'player-tip tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-core-button tw-core-button--border tw-core-button--text tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative undefined';
    settingsButton.style = 'fill: #dad8de;'
    settingsButton.addEventListener('click', function () {
      toggleSettingsPanel();
    });

    function toggleSettingsPanel() {
      if (settingsPanel.classList.contains('tw-block')) {
        settingsPanel.classList.remove('tw-block');
        settingsPanel.classList.add('tw-hide');
      }else {
        settingsPanel.classList.add('tw-block');
        settingsPanel.classList.remove('tw-hide');
      }
    }

    function createMenuPanel() {
          const settingsHeader = document.createElement('div')
          settingsHeader.className = 'tw-c-background-base tw-c-text-base tw-flex-column tw-full-width tw-inline-flex tw-mg-b-1 tw-c-text-alt-2 tw-upcase'
          settingsHeader.innerText = 'Overlay Chat Settings';
      
          const menuPanel = document.createElement('div')
          menuPanel.id = 'tco-ext-element-settings';
          menuPanel.className = 'tw-absolute tw-balloon tw-balloon--up tw-pd-2 tw-root--theme-dark tw-c-background-base tw-block'
          menuPanel.style = 'border: 1px solid #6441a4; min-width: 200px'

          menuPanel.appendChild(settingsHeader);
          menuPanel.appendChild(createAlphaControl(menuPanel));

          return menuPanel;
    }

    function createAlphaControl() {
      const btnAddAlpha = document.createElement('button');
      btnAddAlpha.innerText = '+';
      btnAddAlpha.style = 'padding: 2px 8px;background-color: #6441a4;margin: 1px;'
      btnAddAlpha.onclick = function (e) { 
        e.stopPropagation();
        overlayElement.style.opacity = Math.min(1, Number.parseFloat(getComputedStyle(overlayElement).opacity) + 0.1);
        updateAlphaValue();
      };
  
      const btnMinusAlpha = document.createElement('button');
      btnMinusAlpha.innerText = '-';
      btnMinusAlpha.style = 'padding: 2px 8px;background-color: #6441a4;margin: 1px;'
      btnMinusAlpha.onclick = function (e) { 
        e.stopPropagation();
        overlayElement.style.opacity = Math.max(0.1, Number.parseFloat(getComputedStyle(overlayElement).opacity) - 0.1);
        updateAlphaValue();
      };
      
      const alphaValue = document.createElement('span');
      alphaValue.style = 'flex-grow: 1';
      function updateAlphaValue() {
        alphaValue.innerText = `Opacity: ${getComputedStyle(overlayElement).opacity * 100}%`
      }
    
      updateAlphaValue();
  
      const alphaSettingsRow = document.createElement('div');
      alphaSettingsRow.style = 'display: flex';
      alphaSettingsRow.appendChild(alphaValue)
      alphaSettingsRow.appendChild(btnAddAlpha)
      alphaSettingsRow.appendChild(btnMinusAlpha)

      return alphaSettingsRow;
    }


    const settingsPanel = createMenuPanel();
    toggleSettingsPanel();
        
    iframe.contentDocument.querySelector('.tw-flex.tw-flex-row > .tw-relative').appendChild(settingsPanel); 
    iframe.contentDocument.querySelector('.tw-flex.tw-flex-row').appendChild(settingsButton); 
  }

  // Load up the current Twitch chat as an overlay on the stream
  function createChatOverlay(target) {
    const parent = document.createElement('div');
    parent.id = OVERLAY_ID;

    // Set the initial style to the last session
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (json !== null) {
      const item = JSON.parse(json);
      parent.setAttribute('style', item.style);
    }

    // Toggle control
    buildToggleControl(target, parent);

    // Is this a squad stream? If so, then we need to update the current channel
    // Twitch provides this information via a data attribute so we don't need to hook into
    // react at this time.
    // NOTE: This could change.
    const squadElement = target.parentNode && target.parentNode.parentNode && target.parentNode.parentNode.parentNode;
    if (
      squadElement &&
      (squadElement.classList.contains('multi-stream-player-layout__player') ||
        squadElement.classList.contains('multi-stream-player-layout__player-primary'))
    ) {
      currentChannel = squadElement.dataset['aChannel'];
    }

    // Build the embedded element
    const child = document.createElement('iframe');
    child.src = `https://www.twitch.tv/popout/${currentChannel}/chat?darkpopout`;

    function onLoad() {
      createSettingsMenu(child);
      onLeave();
    }

    function onEnter() {
      child.contentDocument.querySelector('.chat-input').style = 'display: block !important';
    }

    function onLeave() {
      child.contentDocument.querySelector('.chat-input').style = 'display: none !important';
    }
    child.addEventListener('load', onLoad);
    parent.addEventListener('mouseenter', onEnter);
    parent.addEventListener('mouseleave', onLeave);

    // Observe the element for attribute changes, as the `resize` event doesn't fire
    // when using CSS resize ???
    observer.observe(parent, { attributes: true });

    parent.appendChild(buildTitleBar(parent));
    parent.appendChild(child);
    target.appendChild(parent);
  }

  function destroyChatOverlay() {
    // Cleanup associated events on the window object
    if (cleanupWindowEvents !== null) {
      cleanupWindowEvents();
    }

    // Remove the chat overlay element
    const element = document.getElementById(OVERLAY_ID);
    if (element) {
      element.remove();
    }

    // Remove the player controls button
    const button = document.getElementById(OVERLAY_BUTTON_ID);
    if (button) {
      button.remove();
    }
  }

  // Look for the Twitch video player on the page. If it exists
  // then we observe it for changes.
  function findVideoPlayer() {
    const timer = setInterval(function() {
      // There may be multiple video players on a single page.
      const elements = document.getElementsByClassName('video-player');
      if (elements.length > 0) {
        for (const element of elements) {
          observer.observe(element, { attributes: true });
        }
        clearInterval(timer);
      }
    }, 500);
    intervalIds.push(timer);
  }

  // Get access to the React instance on Twitch
  let cleanupHistoryListener = null;
  function hookIntoReact() {
    // Watch for navigation changes within the React app
    function reactNavigationHook(history) {
      let lastPathName = history.location.pathname;
      cleanupHistoryListener = history.listen(function(location) {
        if (location.pathname !== lastPathName) {
          lastPathName = location.pathname;
          cleanup();
          start();
        }
      });
    }

    // Find a property within the React component tree
    function findReactProp(node, prop, func) {
      if (node.stateNode && node.stateNode.props && node.stateNode.props[prop]) {
        func(node.stateNode.props[prop]);
      } else if (node.child) {
        let child = node.child;
        while (child) {
          findReactProp(child, prop, func);
          child = child.sibling;
        }
      }
    }

    // Find the react instance of a element
    function findReactInstance(element, target, func) {
      const timer = setInterval(function() {
        const reactRoot = document.getElementById(element);
        if (reactRoot) {
          let reactInstance = null;
          for (const key of Object.keys(reactRoot)) {
            if (key.startsWith(target)) {
              reactInstance = reactRoot[key];
              break;
            }
          }
          if (reactInstance) {
            func(reactInstance);
            clearInterval(timer);
          }
        }
      }, 500);
      intervalIds.push(timer);
    }

    // Find the root instance and hook into the router history
    findReactInstance('root', '_reactRootContainer', function(instance) {
      if (instance._internalRoot && instance._internalRoot.current) {
        findReactProp(instance._internalRoot.current, 'history', reactNavigationHook);
      }
    });

    // Find the instance related to the video player to find the current stream
    findReactInstance('default-player', '__reactInternalInstance$', function(instance) {
      findReactProp(instance, 'player', function(player) {
        if (player.channel) {
          currentChannel = player.channel;
          findVideoPlayer();
        }
      });
    });
  }

  function start() {
    window.addEventListener('beforeunload', cleanup);
    hookIntoReact();
  }

  function cleanup() {
    destroyChatOverlay();
    observer.disconnect();
    for (const id of intervalIds) {
      clearInterval(id);
    }
    if (cleanupHistoryListener !== null) {
      cleanupHistoryListener();
    }
  }

  // Hello, World!
  start();
  console.log('Twitch Chat Overlay Extension Loaded');
})();
