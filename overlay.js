(function() {
  const OVERLAY_ID = "tco-ext-element";
  const OVERLAY_TITLEBAR_ID = "tco-ext-element-titlebar";
  const OVERLAY_BUTTON_ID = "tco-ext-element-button";
  const STORAGE_KEY = "tco-ext:settings";
  const SVG_INNER =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 22"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  // Utilities
  const utils = {
    writeToStorage(key, value) {
      const data = window.localStorage.getItem(STORAGE_KEY);
      const json = JSON.parse(data);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...(json || {}), [key]: value })
      );
    },

    getFromStorage(key) {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data !== null) {
        const json = JSON.parse(data);
        return json[key] || null;
      }
      return null;
    },

    styleToObject(style) {
      const styles = style.split(/; ?/).filter(str => str.length > 0);
      const result = {};
      for (const style of styles) {
        const [key, value] = style.split(/: ?/);
        result[key] = value;
      }
      return result;
    },

    objectToStyle(object) {
      let style = "";
      for (const key in object) {
        style += `${key}: ${object[key]};`;
      }
      return style;
    }
  };

  const intervalIds = [];
  let currentChannel = null;
  let isFullscreen = false;

  // Create a mutation observer so we can watch target elements
  // for attribute changes and detect when the user has gone into
  // fullscreen mode
  const observer = new MutationObserver(mutationCallback);
  function mutationCallback(mutationsList) {
    for (const mutation of mutationsList) {
      const element = mutation.target;
      if (element.id === OVERLAY_ID) {
        const style = element.getAttribute("style");
        if (style !== null && style.length > 0) {
          const object = utils.styleToObject(style);
          utils.writeToStorage("style", object);
        }
      }
    }
  }

  let cleanupWindowEvents = null;
  function buildTitleBar(parent) {
    const element = document.createElement("div");
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

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      requestAnimationFrame(dragUpdate);
    }

    function onMouseUp() {
      isDragging = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(event) {
      transformX = event.pageX - startX;
      transformY = event.pageY - startY;
    }
    element.addEventListener("mousedown", onMouseDown);

    // Cleanup these events when we destroy the parent element
    cleanupWindowEvents = function() {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };

    return element;
  }

  // Add button to the player controls that can be used to toggle
  // the overlayed chat window
  function buildToggleControl(player, parent) {
    const element = document.createElement("button");
    element.classList.add(
      ...["tw-inline-flex", "tw-relative", "tw-tooltip-wrapper"]
    );
    element.id = OVERLAY_BUTTON_ID;
    element.type = "button";

    // Toggle code
    function onClick() {
      // Will only be undefined on first run, where settings aren't saved
      const state = parent.style.visibility || "visible";
      if (state === "visible") {
        parent.style.visibility = "hidden";
      } else {
        parent.style.visibility = "visible";
      }
    }
    element.addEventListener("click", onClick);

    // Icon
    const icon = document.createElement("span");
    icon.innerHTML = SVG_INNER;

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.classList.add(
      ...["tw-tooltip", "tw-tooltip--align-top", "tw-tooltip--up"]
    );
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = "Twitch Chat Overlay";

    const target = player.querySelector(
      ".player-controls__right-control-group"
    );
    if (target) {
      element.appendChild(icon);
      element.appendChild(tooltip);
      target.prepend(element);
    }
  }

  // Create button and popup menu for the user to modify various settings.
  function createSettingsMenu(parent, iframe) {
    function createButton(target, panel) {
      const dom = document.createElement("div");
      dom.className = "tw-inline-flex tw-relative tw-tooltip-wrapper";
      dom.innerHTML = `
        <div class="tw-z-above">
          <button class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-core-button tw-core-button--border tw-core-button--text tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative">
            <div class="tw-align-items-center tw-flex tw-flex-grow-0">
              <span class="tw-button-icon__icon"><div style="width: 2rem; height: 2rem;"><div class="tw-align-items-center tw-full-width tw-icon tw-icon--fill tw-inline-flex"><div class="tw-aspect tw-aspect--align-top"><div class="tw-aspect__spacer" style="padding-bottom: 100%;"></div>
              ${SVG_INNER}
              </div></div></div></span>
            </div>
          </button>
        </div>
        <div class="tw-tooltip tw-tooltip--align-left tw-tooltip--up" data-a-target="tw-tooltip-label" role="tooltip">Overlay Chat Settings</div>
      `;

      const svg = dom.querySelector("svg");
      svg.style = "fill: currentColor;";
      svg.setAttribute("viewBox", "0 0 22 22");

      function toggle() {
        if (panel.classList.contains("tw-block")) {
          panel.classList.remove("tw-block");
          panel.classList.add("tw-hide");
        } else {
          panel.classList.add("tw-block");
          panel.classList.remove("tw-hide");
        }
      }
      const button = dom.querySelector("button");
      button.addEventListener("click", toggle);

      target.appendChild(dom);
    }

    function createPanel(target) {
      const panel = document.createElement("div");
      panel.className =
        "tw-absolute tw-balloon tw-balloon--up tw-pd-2 tw-root--theme-dark tw-c-background-base tw-hide tw-elevation-1 tw-border-b tw-border-l tw-border-r tw-border-radius-medium tw-border-t";
      panel.style = "min-width: 200px";
      const header = document.createElement("div");
      header.className =
        "tw-c-background-base tw-c-text-base tw-flex-column tw-full-width tw-inline-flex tw-mg-b-1 tw-c-text-alt-2 tw-upcase";
      header.innerText = "Overlay Chat Settings";

      // Opacity setting
      // TODO: Conver to slider control
      function createOpacityControl() {
        let opacity = 70;
        const style = utils.getFromStorage("style");
        if (style !== null) {
          if (style.opacity) {
            opacity = Math.floor(Number.parseFloat(style.opacity) * 100);
          }
        }

        function onMouseLeave() {
          parent.style.opacity = opacity / 100;
        }
        parent.addEventListener("mouseleave", onMouseLeave);

        const btnAddAlpha = document.createElement("button");
        btnAddAlpha.innerText = "+";
        btnAddAlpha.style =
          "padding: 2px 8px;background-color: #6441a4;margin: 1px;";
        btnAddAlpha.onclick = function(e) {
          e.stopPropagation();
          opacity = Math.min(100, opacity + 10);
          updateAlphaValue();
        };

        const btnMinusAlpha = document.createElement("button");
        btnMinusAlpha.innerText = "-";
        btnMinusAlpha.style =
          "padding: 2px 8px;background-color: #6441a4;margin: 1px;";
        btnMinusAlpha.onclick = function(e) {
          e.stopPropagation();
          opacity = Math.max(10, opacity - 10);
          updateAlphaValue();
        };

        const alphaValue = document.createElement("span");
        alphaValue.style = "flex-grow: 1";

        function updateAlphaValue() {
          alphaValue.innerText = `Opacity: ${opacity}%`;
        }
        updateAlphaValue();

        const alphaSettingsRow = document.createElement("div");
        alphaSettingsRow.style = "display: flex";
        alphaSettingsRow.appendChild(alphaValue);
        alphaSettingsRow.appendChild(btnMinusAlpha);
        alphaSettingsRow.appendChild(btnAddAlpha);

        panel.appendChild(alphaSettingsRow);
      }

      panel.appendChild(header);
      createOpacityControl(panel);
      target.children[0].appendChild(panel);
      return panel;
    }

    // Add the new elements to the DOM
    const container = iframe.contentDocument.querySelector(
      ".chat-input__buttons-container"
    );
    const leftChild = container.children[0];
    const panel = createPanel(leftChild);
    createButton(leftChild, panel);
  }

  // Load up the current Twitch chat as an overlay on the stream
  function createChatOverlay(target) {
    const parent = document.createElement("div");
    parent.id = OVERLAY_ID;

    // Set the initial style to the last session
    const style = utils.getFromStorage("style");
    if (style !== null) {
      parent.setAttribute("style", utils.objectToStyle(style));
    }

    // Toggle control
    buildToggleControl(target, parent);

    // Is this a squad stream? If so, then we need to update the current channel.
    // Twitch provides this information via a data attribute so we don't need to hook into
    // react at this time.
    // NOTE: This could change.
    const squadElement =
      target.parentNode &&
      target.parentNode.parentNode &&
      target.parentNode.parentNode.parentNode;
    if (
      squadElement &&
      (squadElement.classList.contains("multi-stream-player-layout__player") ||
        squadElement.classList.contains(
          "multi-stream-player-layout__player-primary"
        ))
    ) {
      currentChannel = squadElement.dataset["aChannel"];
    }

    // Build the embedded element
    const child = document.createElement("iframe");
    child.src = `https://www.twitch.tv/popout/${currentChannel}/chat?darkpopout`;

    function onLoad() {
      createSettingsMenu(parent, child);
      onLeave();
    }

    function onEnter() {
      if (!child.contentDocument) {
        return;
      }
      child.contentDocument.querySelector(".chat-input").style =
        "display: block !important";
    }

    function onLeave() {
      if (!child.contentDocument) {
        return;
      }
      child.contentDocument.querySelector(".chat-input").style =
        "display: none !important";
    }

    child.addEventListener("load", onLoad);
    parent.addEventListener("mouseenter", onEnter);
    parent.addEventListener("mouseleave", onLeave);

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

  // Get access to the React instance on Twitch
  let cleanupHistoryListener = null;
  function hookIntoReact() {
    // Watch for navigation changes within the React app
    function reactNavigationHook({ history }) {
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
    function findReactProp(node, props, func) {
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (
          node.stateNode &&
          node.stateNode.props &&
          node.stateNode.props[prop]
        ) {
          return func(node.stateNode.props);
        } else if (node.child) {
          let child = node.child;
          while (child) {
            findReactProp(child, [prop], func);
            child = child.sibling;
          }
        }
      }
    }

    // Find the react instance of a element
    function findReactInstance(elements, target, func) {
      const timer = setInterval(function() {
        elements.forEach(element => {
          const reactRoot = document.querySelector(element);
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
        });
      }, 500);
      intervalIds.push(timer);
    }

    // Find the root instance and hook into the router history
    findReactInstance(["#root"], "_reactRootContainer", function(instance) {
      if (instance._internalRoot && instance._internalRoot.current) {
        findReactProp(
          instance._internalRoot.current,
          ["history"],
          reactNavigationHook
        );
      }
    });

    // Find the instance related to the video player to find the current stream
    const intervalId = setInterval(function() {
      findReactInstance(
        [".highwind-video-player"],
        "__reactInternalInstance$",
        function(instance) {
          findReactProp(instance, ["channelLogin"], function(object) {
            if (object.channelLogin && "isFullscreen" in object) {
              currentChannel = object.channelLogin;
              if (object.isFullscreen && !isFullscreen) {
                isFullscreen = true;
                const fsElement = document.querySelector(
                  ".highwind-video-player__overlay"
                );
                createChatOverlay(fsElement);
              } else if (!object.isFullscreen && isFullscreen) {
                isFullscreen = false;
                destroyChatOverlay();
              }
            }
          });
        }
      );
    }, 1000);
    intervalIds.push(intervalId);
  }

  function start() {
    window.addEventListener("beforeunload", cleanup);
    hookIntoReact();
  }

  function cleanup() {
    window.removeEventListener("beforeunload", cleanup);
    destroyChatOverlay();
    observer.disconnect();
    for (const id of intervalIds) {
      clearInterval(id);
    }
    if (cleanupHistoryListener !== null) {
      cleanupHistoryListener();
    }
  }

  // Convert the legacy storage format
  const version = utils.getFromStorage("version");
  if (version === null) {
    const style = utils.getFromStorage("style");
    if (style !== undefined && typeof style === "string") {
      const object = utils.styleToObject(style);
      utils.writeToStorage("style", object);
      utils.writeToStorage("version", 1);
    }
  }

  // Hello, World!
  start();
  console.log("Twitch Chat Overlay Extension Loaded");
})();
