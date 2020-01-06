// TODO(#1): Setting to allow keybinding to toggle chat overlay
// TODO(#6): Handle embedding VOD chat when watching VODs

// Inject the actual code into the page as this allows us to
// access the React instance on Twitch
var element = document.createElement("script");
element.src = chrome.runtime.getURL("overlay.js");
document.body.appendChild(element);
