// TODO(#1): Setting to allow keybinding to toggle chat overlay
// TODO(#2): Setting to control opacity value
// TODO(#3): Save the position of the chat after each move

const OVERLAY_ID = 'tco-ext-element';
const timers = [];
const cleanupFns = [];

function buildTitleBar(parent) {
  const element = document.createElement('div');
  element.id = `${OVERLAY_ID}-titlebar`;

  // TODO(#4): Build the close button

  // Implement dragging of the chat window
  let isDragging = false;
  let startX, startY, transformX, transformY;

  // RAF function for updating the transform style
  function dragUpdate() {
    if (isDragging) {
      requestAnimationFrame(dragUpdate);
    }
    parent.setAttribute(
      'style',
      `transform: translate(${transformX}px, ${transformY}px)`
    );
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

// Load up the current Twitch chat as an overlay on the stream
function createChatOverlay(target) {
  const parent = document.createElement('div');
  parent.id = OVERLAY_ID;

  // TODO(#5): Get the current stream dynamically
  const child = document.createElement('iframe');
  child.src = 'https://www.twitch.tv/popout/shroud/chat';

  function updateFrameElement(selector, prop, value) {
    const element = child.contentDocument.querySelector(selector);
    if (element) {
      element[prop] = value;
    }
  }

  function onEnter() {
    updateFrameElement('.chat-input', style, 'display: block !important;');
  }

  function onLeave() {
    updateFrameElement('.chat-input', style, 'display: none !important;');
  }

  child.addEventListener('load', onLeave);
  child.addEventListener('mouseenter', onEnter);
  child.addEventListener('mouseleave', onLeave);

  parent.appendChild(buildTitleBar(parent));
  parent.appendChild(child);
  target.appendChild(parent);
}

// ...
function destroyChatOverlay() {
  const element = document.getElementById(OVERLAY_ID);
  if (element) {
    element.remove();
  }

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
function searchForPlayer() {
  const timer = setInterval(function() {
    // There may be multiple video players on a single page.
    const elements = document.getElementsByClassName('video-player');
    if (elements.length > 0) {
      for (const element of elements) {
        observer.observe(element, { attributes: true });
      }
      clearInterval(timer);
    }
  }, 1000);
  timers.push(timer);
}

// Find the React instance on Twitch and look for route changes
function searchForReact() {
  function reactNavigationHook(node) {
    const history = node.stateNode.props.history;
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

  const timer = setInterval(function() {
    // @Firefox - Does this work in Chrome?
    const reactRoot = document.getElementById('root').wrappedJSObject;
    if (
      reactRoot &&
      reactRoot._reactRootContainer &&
      reactRoot._reactRootContainer._internalRoot &&
      reactRoot._reactRootContainer._internalRoot.current
    ) {
      const reactInstance = reactRoot._reactRootContainer._internalRoot.current;
      // Search the children of `reactInstance` to find a node that has
      // the `history` prop available.
      function searchForRouter(node) {
        if (
          node.stateNode &&
          node.stateNode.props &&
          node.stateNode.props.history
        ) {
          reactNavigationHook(node);
        } else if (node.child) {
          searchForRouter(node.child);
        }
      }
      searchForRouter(reactInstance);
      searchForPlayer();
      clearInterval(timer);
    }
  }, 500);
  timers.push(timer);
}

function start() {
  window.addEventListener('beforeunload', cleanup);
  searchForReact();
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
