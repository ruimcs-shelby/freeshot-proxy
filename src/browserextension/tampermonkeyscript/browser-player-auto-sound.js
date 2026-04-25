// ==UserScript==
// @name         freeshot-playa
// @namespace    http://localhost:3000/player.html
// @version      2026-04-24
// @description  try to take over the world!
// @author       You
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=undefined.localhost
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const isIframe = (window.self !== window.top);

    const setVolumeToMax = () => {
        const videos = document.querySelectorAll("video");
        videos.forEach(v => {
            v.muted = false;
            v.volume = 1.0;

            if (v.getAttribute("muted") !== null) {
                v.removeAttribute("muted");
            }

            if (v.paused) {
                v.play();
            }

        });
    }

    setInterval(setVolumeToMax, 5000);

    //document.addEventListener("click", setVolumeToMax);
    //document.addEventListener("keydown", setVolumeToMax);
})();