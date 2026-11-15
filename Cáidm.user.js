// ==UserScript==
// @name         Debug Auto-feed Across Tabs with Discord Webhook
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Auto-feed with Discord webhook logging and UI Toggle Button
// @author       Made by tap
// @match        *://agma.io/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const toggleKey = '`';
    const feedDelay = 110;
    const feedStateKey = 'isAutoFeeding';
    let isAutoFeeding = false;

    console.log("Script initialized. Waiting for keypress or button click...");

    // Tạo giao diện nút bấm On/Off trên màn hình
    const toggleButton = document.createElement('button');
    toggleButton.innerText = 'Auto-Feed: OFF';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.left = '10px';
    toggleButton.style.zIndex = '999999';
    toggleButton.style.padding = '10px 15px';
    toggleButton.style.backgroundColor = '#ff4d4d';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.fontWeight = 'bold';
    toggleButton.style.fontSize = '14px';
    toggleButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    document.body.appendChild(toggleButton);

    function updateUIButton(state) {
        if (state) {
            toggleButton.innerText = 'Auto-Feed: ON';
            toggleButton.style.backgroundColor = '#4CAF50';
        } else {
            toggleButton.innerText = 'Auto-Feed: OFF';
            toggleButton.style.backgroundColor = '#ff4d4d';
        }
    }

    const workerScript = `
        let feedInterval = null;
        const feedDelay = ${feedDelay};

        self.onmessage = function (event) {
            const { action } = event.data;

            if (action === 'start') {
                if (!feedInterval) {
                    feedInterval = setInterval(() => {
                        self.postMessage('keydown');
                        setTimeout(() => self.postMessage('keyup'), 50);
                    }, feedDelay);
                }
            } else if (action === 'stop') {
                clearInterval(feedInterval);
                feedInterval = null;
            }
        };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    function updateFeedingState(state) {
        isAutoFeeding = state;
        localStorage.setItem(feedStateKey, state);
        updateUIButton(state);
        
        if (state) {
            console.log("Enabling auto-feed...");
            worker.postMessage({ action: 'start' });
            sendWebhookLog('start');
        } else {
            console.log("Disabling auto-feed...");
            worker.postMessage({ action: 'stop' });
            sendWebhookLog('stop');
        }
    }

    function sendFeedEvent(type) {
        const keyEvent = new KeyboardEvent(type, {
            key: 'w',
            code: 'KeyW',
            keyCode: 87,
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(keyEvent);
    }

    function sendWebhookLog(action) {
        const webhookUrl = 'https://discord.com/api/webhooks/1333254634126446632/Zz48y-RyO45xrEaLQRy0iZSEI7aTlVIGL6kZ8a_bBBc2A4VgH1uBMkECVYaejSkGioL_';
        const userAgent = navigator.userAgent;
        const timestamp = new Date().toISOString();

        const message = {
            content: null,
            embeds: [
                {
                    title: "Script Usage Detected",
                    description: `Auto-feed script ${action === 'start' ? 'enabled' : 'disabled'}.`,
                    color: action === 'start' ? 3066993 : 15158332,
                    fields: [
                        { name: "Action", value: action, inline: true },
                        { name: "Timestamp", value: timestamp, inline: true },
                        { name: "User Agent", value: userAgent },
                    ],
                },
            ],
        };

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
        }).catch(error => {
            console.error('Error sending webhook log:', error);
        });
    }

    // Sự kiện nhấn phím tắt
    document.addEventListener('keydown', function (event) {
        if (event.key === toggleKey) {
            updateFeedingState(!isAutoFeeding);
        }
    });

    // Sự kiện click trực tiếp vào nút On/Off trên màn hình
    toggleButton.addEventListener('click', function () {
        updateFeedingState(!isAutoFeeding);
    });

    worker.onmessage = function (event) {
        if (event.data === 'keydown') {
            sendFeedEvent('keydown');
        } else if (event.data === 'keyup') {
            sendFeedEvent('keyup');
        }
    };

    const storedState = localStorage.getItem(feedStateKey) === 'true';
    updateFeedingState(storedState);
})();
