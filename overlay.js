const TARGET_CLASS = 'video-player--fullscreen';
const timers = [];

function createChatOverlay(target) {
  const parent = document.createElement('div');
  parent.id = 'toc-ext-element';
  const child = document.createElement('iframe');
  child.src = 'https://www.twitch.tv/popout/reckful/chat';
  parent.appendChild(child);
  target.appendChild(parent);
}

function destroyChatOverlay() {
  const element = document.getElementById('toc-ext-element');
  if (element) {
    element.remove();
  }
}

// Create a mutation observer so we can watch target elements
// for attribute changes and detect when the user has gone into
// fullscreen mode
const observer = new MutationObserver(mutationCallback);
function mutationCallback(mutationsList) {
  for (const mutation of mutationsList) {
    const element = mutation.target;
    if (element.classList.contains(TARGET_CLASS)) {
      const fsElement = element.querySelector('.video-player__container');
      createChatOverlay(fsElement);
    } else {
      destroyChatOverlay();
    }
  }
}

// ...
function searchForPlayer() {
  const timer = setInterval(function() {
    // There may be multiple video players on a single page.
    // For example with the new Squad feature.
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

// Find the React instance on Twitch and look for routing changes
function searchForReact() {
  function reactNavigationHook(node) {
    // TODO: `history.listen` wasn't working here on initial testing. Why not?
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
  window.removeEventListener('beforeunload', cleanup);
}

// Hello, World!
start();
console.log('Twitch Chat Overlay Extension Loaded');
