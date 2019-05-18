// TODO(#1): Setting to allow keybinding to toggle chat overlay
// TODO(#2): Setting to control opacity value
// TODO(#6): Handle embedding VOD chat when watching VODs
// TODO: Allow resizing the chat

const OVERLAY_ID = 'tco-ext-element';
const OVERLAY_TITLEBAR_ID = 'tco-ext-element-titlebar';
const OVERLAY_BUTTON_ID = 'tco-ext-element-button';

const timers = [];
const cleanupFns = [];

let currentChannel = null;

function buildTitleBar(parent) {
  const element = document.createElement('div');
  element.id = OVERLAY_TITLEBAR_ID;

  // Implement dragging of the chat window
  let isDragging = false;
  let startX, startY, transformX, transformY;

  // Attempt to get the saved positions from storage
  browser.storage.local
    .get(['transformX', 'transformY'])
    .then(function(items) {
      if (items.transformX && items.transformY) {
        transformX = items.transformX;
        transformY = items.transformY;
        parent.style.transform = `translate(${items.transformX}px, ${items.transformY}px)`;
      }
    })
    .catch(function() {});

  // RAF function for updating the transform style
  function dragUpdate() {
    if (isDragging) {
      requestAnimationFrame(dragUpdate);
    }
    parent.style.transform = `translate(${transformX}px, ${transformY}px)`;
  }

  function onMouseDown(event) {
    isDragging = true;
    startX = event.pageX - transformX || 0;
    startY = event.pageY - transformY || 0;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    requestAnimationFrame(dragUpdate);
  }

  function onMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    // Save position to storage
    browser.storage.local.set({ transformX, transformY }).catch(function() {});
  }

  function onMouseMove(event) {
    transformX = event.pageX - startX;
    transformY = event.pageY - startY;
  }
  element.addEventListener('mousedown', onMouseDown);

  // We want to cleanup window based events when we cleanup
  cleanupFns.push(function() {
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
  });

  return element;
}

// Add button to the player controls that can be used to toggle
// the overlayed chat window
function buildToggleControl(parent, initialState) {
  const element = document.createElement('button');
  element.classList.add('player-button');
  element.id = OVERLAY_BUTTON_ID;
  element.type = 'button';

  // Toggle code
  let state = initialState;
  function onClick() {
    if (state) {
      parent.style.visibility = 'hidden';
    } else {
      parent.style.visibility = 'visible';
    }
    state = !state;
    browser.storage.local.set({ visibility: state }).catch(function() {});
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

  const target = document.querySelector('#default-player .player-buttons-right');
  if (target) {
    element.appendChild(icon);
    element.appendChild(tooltip);
    target.prepend(element);
  }
}

// Load up the current Twitch chat as an overlay on the stream
function createChatOverlay(target) {
  const parent = document.createElement('div');
  parent.id = OVERLAY_ID;

  // Initial visibility state
  browser.storage.local
    .get('visibility')
    .then(function({ visibility }) {
      buildToggleControl(parent, visibility);
      if (visibility !== null && visibility !== undefined) {
        parent.style.visibility = visibility ? 'visible' : 'hidden';
      }
    })
    .catch(function() {});

  // Build the embedded element
  const child = document.createElement('iframe');
  child.src = `https://www.twitch.tv/popout/${currentChannel}/chat`;

  function updateFrameElement(selector, prop, value) {
    const element = child.contentDocument.querySelector(selector);
    if (element) {
      element[prop] = value;
    }
  }

  function onEnter() {
    updateFrameElement('.chat-input', 'style', 'display: block !important');
  }

  function onLeave() {
    updateFrameElement('.chat-input', 'style', 'display: none !important');
  }

  child.addEventListener('load', onLeave);
  parent.addEventListener('mouseenter', onEnter);
  parent.addEventListener('mouseleave', onLeave);

  parent.appendChild(buildTitleBar(parent));
  parent.appendChild(child);
  target.appendChild(parent);
}

function destroyChatOverlay() {
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

  // Cleanup anything that is left
  for (const func of cleanupFns) {
    func();
  }
}

// Create a mutation observer so we can watch target elements
// for attribute changes and detect when the user has gone into
// fullscreen mode
const observer = new MutationObserver(mutationCallback);
function mutationCallback(mutationsList) {
  for (const mutation of mutationsList) {
    const element = mutation.target;
    if (element.classList.contains('video-player--fullscreen')) {
      const fsElement = element.querySelector('.video-player__container');
      createChatOverlay(fsElement);
    } else {
      destroyChatOverlay();
    }
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
  timers.push(timer);
}

// Get access to the React instance on Twitch
function hookIntoReact() {
  // Watch for navigation changes within the React app
  function reactNavigationHook(history) {
    let lastPathName = history.location.pathname;
    const timer = setInterval(function() {
      const location = history.location;
      if (location.pathname !== lastPathName) {
        lastPathName = location.pathname;
        cleanup();
        start();
      }
    }, 500);
    timers.push(timer);
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
      // @Firefox - Does this work in Chrome?
      const reactRoot = document.getElementById(element).wrappedJSObject;
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
    timers.push(timer);
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
  for (const timer of timers) {
    clearInterval(timer);
  }
}

// Hello, World!
start();
console.log('Twitch Chat Overlay Extension Loaded');
