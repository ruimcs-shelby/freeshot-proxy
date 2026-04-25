// ==UserScript==
// @name         freeshot-player
// @namespace    http://server001:3000/
// @version      2026-04-23
// @description  try to take over the world!
// @author       You
// @match        http://server002:3000/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=undefined.server002
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const updateIntervalInMs = 2500;
    setInterval(() => {
        fetch("http://server002:3000/directplay/getcurrentchannel").then(result => {
            const text = result.text();
            text.then(parsedText => {
                const divUpdateChannelStatus = document.getElementById("pChannelUpdateStatus");
                divUpdateChannelStatus.className = "success";

                const channel = JSON.parse(parsedText);
                divUpdateChannelStatus.innerHTML = `O servidor mudou para o canal "${channel.name}".`;
            });
        });
    }, updateIntervalInMs);
})();