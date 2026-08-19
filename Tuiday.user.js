// ==UserScript==
// @name         AFK XP & Auto Farm xp - Auto Split 10s - by colopkid
// @namespace    http://tampermonkey.net/
// @version      6.2.2
// @description  Tự động Split 10 giây / 1 lần + Auto Respawn + UI colopkid.
// @author       by: -colopkid-
// @match        *://agma.io/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    const myWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    let running = false;
    let orientation = "right";
    let currentStep = 0;

    let map = { width: 0, height: 0 };
    let movementTimeout = null;
    let spamInterval = null;
    let respawnInterval = null;
    let activeSocket = null;
    let isMinimized = false;

    const avatarUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 500'><defs><radialGradient id='bg' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%231a233a'/><stop offset='100%' stop-color='%23080911'/></radialGradient><linearGradient id='glow' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2300e5ff'/><stop offset='100%' stop-color='%23ff0055'/></linearGradient><linearGradient id='bolt' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23ffff00'/><stop offset='50%' stop-color='%2300e5ff'/><stop offset='100%' stop-color='%2300ff66'/></linearGradient><filter id='f'><feGaussianBlur stdDeviation='8' result='blur'/><feMerge><feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/></feMerge></filter></defs><circle cx='250' cy='250' r='240' fill='url(%23bg)' stroke='url(%23glow)' stroke-width='8'/><circle cx='250' cy='250' r='210' fill='none' stroke='%2300e5ff' stroke-width='2' stroke-dasharray='10, 15' opacity='0.5'/><path d='M 270,60 L 160,240 L 250,240 L 210,440 L 340,220 L 250,220 Z' fill='url(%23bolt)' filter='url(%23f)' stroke='%23ffffff' stroke-width='3'/><text x='250' y='410' font-family='Arial, sans-serif' font-weight='900' font-size='42' fill='%23ffffff' text-anchor='middle' letter-spacing='3' filter='url(%23f)'>COLOPKID</text></svg>";

    // --- TÍNH NĂNG TỰ ĐỘNG RESPAWN ---
    function checkAndRespawn() {
        if (!running) return;

        const advert = document.getElementById('advert');
        const playBtn = document.getElementById('playBtn');
        const isDead = (advert && advert.style.display === 'block') || (playBtn && playBtn.offsetHeight > 0);

        if (isDead) {
            if (typeof myWin.closeAdvert === 'function') {
                try { myWin.closeAdvert(); } catch (e) { }
            }

            const nickInput = document.getElementById('nick');
            const nickName = nickInput ? nickInput.value : '';

            if (typeof myWin.setNick === 'function') {
                myWin.setNick(nickName);
            } else if (typeof myWin.rspwn === 'function') {
                myWin.rspwn(nickName);
            } else if (playBtn) {
                playBtn.click();
            }
        }
    }

    // --- BẮT VÀ LƯU KẾT NỐI WEBSOCKET CỦA GAME ---
    const WebSocketProto = (typeof myWin.WebSocket !== 'undefined') ? myWin.WebSocket.prototype : WebSocket.prototype;
    const sendMethod = WebSocketProto.send;

    WebSocketProto.send = function () {
        activeSocket = this;
        let data = arguments[0];
        let moveX = orientation === "right" ? 1e7 : orientation === "left" ? -1e7 : 0;
        let moveY = orientation === "bottom" ? 1e7 : orientation === "top" ? -1e7 : 0;

        if (running && data instanceof DataView && data.getUint8(0) === 0) {
            data.setUint32(1, moveX, true);
            data.setUint32(5, moveY, true);
        }
        return sendMethod.apply(this, arguments);
    };

    // --- HÀM GỬI PACKET SPLIT ---
    function sendSplitPacket() {
        if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
            const splitBuffer = new ArrayBuffer(1);
            const view = new DataView(splitBuffer);
            view.setUint8(0, 17);
            sendMethod.call(activeSocket, splitBuffer);
        } else {
            const eventOptions = { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true, view: myWin };
            myWin.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
            myWin.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
        }
    }

    const startFn = () => {
        if (document.getElementById('colopkid-xp-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'colopkid-xp-panel';
        panel.style.position = 'fixed';
        panel.style.width = '365px';
        panel.style.background = 'rgba(10, 11, 18, 0.96)';
        panel.style.color = 'white';
        panel.style.padding = '0px';
        panel.style.borderRadius = '16px';
        panel.style.fontSize = '13px';
        panel.style.zIndex = '10005';
        panel.style.border = '3px solid #ff0055';
        panel.style.userSelect = 'none';
        panel.style.webkitUserSelect = 'none';
        panel.style.fontFamily = '"Segoe UI", sans-serif';
        panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';

        panel.innerHTML = `
        <div id="menu-drag-zone" style="background: linear-gradient(90deg, #16192b, #0b0d19); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: move; border-top-left-radius: 13px; border-top-right-radius: 13px;">
            <span style="font-weight: 800; letter-spacing: 1px; color: #00e5ff; text-transform: uppercase;">by: -colopkid-</span>
            <span style="font-size: 11px; color: #666e8a;">Tap Avatar để Ẩn/Hiện</span>
        </div>

        <div id="menu-content-wrapper" style="display: block;">
            <div style="padding: 18px; position: relative; min-height: 145px;">

                <div style="display: flex; gap: 10px; margin-bottom: 15px; width: 220px;">
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #ff0055; font-size: 12px; margin-bottom: 5px; font-weight: bold;">▶</div>
                        <input type="number" id="time-r" value="10" min="1" style="width: 100%; background: #121424; color: #fff; border: 1px solid #2c3154; text-align: center; border-radius: 6px; padding: 4px 0; font-weight: bold;">
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #00e5ff; font-size: 12px; margin-bottom: 5px; font-weight: bold;">▼</div>
                        <input type="number" id="time-d" value="10" min="1" style="width: 100%; background: #121424; color: #fff; border: 1px solid #2c3154; text-align: center; border-radius: 6px; padding: 4px 0; font-weight: bold;">
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #00e5ff; font-size: 12px; margin-bottom: 5px; font-weight: bold;">◀</div>
                        <input type="number" id="time-l" value="10" min="1" style="width: 100%; background: #121424; color: #fff; border: 1px solid #2c3154; text-align: center; border-radius: 4px; padding: 4px 0; font-weight: bold;">
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #00e5ff; font-size: 12px; margin-bottom: 5px; font-weight: bold;">▲</div>
                        <input type="number" id="time-u" value="10" min="1" style="width: 100%; background: #121424; color: #fff; border: 1px solid #2c3154; text-align: center; border-radius: 6px; padding: 4px 0; font-weight: bold;">
                    </div>
                </div>

                <!-- TÁCH CELL 10 GIÂY / 1 LẦN -->
                <div style="margin-bottom: 10px; display: flex; align-items: center; background: #121424; padding: 8px 12px; border-radius: 8px; width: 220px; border: 1px solid #1f233d; justify-content: space-between;">
                    <span style="font-size: 12px; font-weight: bold; color: #a5adc6;">Auto Split (10s/lần)</span>
                    <input type="checkbox" id="autoSpamCheck" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: #00e5ff;">
                </div>

                <!-- TÍNH NĂNG AUTO RESPAWN -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; background: #121424; padding: 8px 12px; border-radius: 8px; width: 220px; border: 1px solid #1f233d; justify-content: space-between;">
                    <span style="font-size: 12px; font-weight: bold; color: #a5adc6;">Tự Động Hồi Sinh</span>
                    <input type="checkbox" id="autoRespawnCheck" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: #00ff66;">
                </div>

                <div style="font-size: 13px; color: #00ff66; font-weight: bold; margin-bottom: 15px; text-shadow: 0 0 5px rgba(0,255,102,0.4);">thầy -colopkid- đẹp zai không😎</div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button id="toggle" style="background: linear-gradient(135deg, #ff0055, #bd003f); color: white; padding: 8px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; letter-spacing: 0.5px; text-transform: uppercase; transition: transform 0.1s; box-shadow: 0 3px 10px rgba(255,0,85,0.3);">khởi động</button>
                    <span id="bot-status" style="font-size: 12px; color: #525875; font-weight: bold;">Đang tắt...</span>
                </div>
            </div>
        </div>

        <div id="avatar-click-zone" style="position: absolute; right: 15px; bottom: 15px; width: 100px; height: 100px; border-radius: 50%; border: 3px solid #00e5ff; box-shadow: 0 0 15px rgba(0, 229, 255, 0.5); background-image: url(&quot;${avatarUrl}&quot;); background-size: cover; background-position: center; background-repeat: no-repeat; cursor: pointer; transition: all 0.2s ease; z-index: 10006;">
           <div style="position: absolute; top: -5px; right: -5px; background: #ffff00; color: #000; border-radius: 50%; width: 22px; height: 22px; font-size: 11px; font-weight: 900; text-align: center; line-height: 22px; box-shadow: 0 0 8px #ffff00;">C⚡</div>
        </div>
    `;
        document.body.appendChild(panel);

        panel.style.left = `${myWin.innerWidth - 390}px`;
        panel.style.top = `180px`;

        // --- XOAY VÒNG DI CHUYỂN ---
        function runMovementLoop() {
            if (!running) return;

            const tR = parseFloat(document.getElementById('time-r').value) * 1000;
            const tD = parseFloat(document.getElementById('time-d').value) * 1000;
            const tL = parseFloat(document.getElementById('time-l').value) * 1000;
            const tU = parseFloat(document.getElementById('time-u').value) * 1000;

            const statusLbl = document.getElementById('bot-status');
            let currentDuration = 1000;

            if (currentStep === 0) {
                orientation = "right";
                statusLbl.innerHTML = `<span style="color:#ff0055;">Đi Phải ▶ (${tR / 1000}s)</span>`;
                currentDuration = tR;
            } else if (currentStep === 1) {
                orientation = "bottom";
                statusLbl.innerHTML = `<span style="color:#00e5ff;">Đi Xuống ▼ (${tD / 1000}s)</span>`;
                currentDuration = tD;
            } else if (currentStep === 2) {
                orientation = "left";
                statusLbl.innerHTML = `<span style="color:#00ff66;">Đi Trái ◀ (${tL / 1000}s)</span>`;
                currentDuration = tL;
            } else if (currentStep === 3) {
                orientation = "top";
                statusLbl.innerHTML = `<span style="color:#ffff00;">Đi Lên ▲ (${tU / 1000}s)</span>`;
                currentDuration = tU;
            }

            movementTimeout = setTimeout(() => {
                currentStep = (currentStep + 1) % 4;
                runMovementLoop();
            }, currentDuration);
        }

        // --- CHU KỲ TÁCH CELL 10 GIÂY / 1 LẦN ---
        const spamCheckbox = document.getElementById('autoSpamCheck');

        function tenSecSplitLoop() {
            if (!running || !spamCheckbox.checked) return;

            sendSplitPacket();

            // Đặt thời gian lặp lại đúng 10000ms (10 giây)
            spamTimeout = setTimeout(tenSecSplitLoop, 10000);
        }

        let spamTimeout = null;

        function updateSpamState() {
            if (spamTimeout) clearTimeout(spamTimeout);
            if (running && spamCheckbox.checked) {
                tenSecSplitLoop();
            }
        }

        spamCheckbox.addEventListener('change', updateSpamState);

        // --- BẬT / TẮT BOT ---
        function startStop() {
            const button = document.getElementById('toggle');
            const statusLbl = document.getElementById('bot-status');

            if (running) {
                clearTimeout(movementTimeout);
                if (spamTimeout) clearTimeout(spamTimeout);
                clearInterval(respawnInterval);
                running = false;

                updateSpamState();
                button.textContent = 'khởi động';
                button.style.background = 'gradient(135deg, #ff0055, #bd003f)';
                button.style.boxShadow = '0 3px 10px rgba(255,0,85,0.3)';
                statusLbl.innerText = 'Đang tắt...';
                statusLbl.style.color = '#525875';
            } else {
                running = true;
                currentStep = 0;
                button.textContent = 'ĐANG CHẠY';
                button.style.background = 'linear-gradient(135deg, #00ff66, #00993d)';
                button.style.boxShadow = '0 3px 10px rgba(0,255,102,0.3)';

                runMovementLoop();
                updateSpamState();

                respawnInterval = setInterval(() => {
                    const respawnCheck = document.getElementById('autoRespawnCheck');
                    if (respawnCheck && respawnCheck.checked) {
                        checkAndRespawn();
                    }
                }, 1500);
            }
        }

        // --- UI TOGGLE & DRAG ---
        const avatarBtn = document.getElementById('avatar-click-zone');
        const dragZone = document.getElementById('menu-drag-zone');
        const contentWrapper = document.getElementById('menu-content-wrapper');

        function toggleMinimize(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            isMinimized = !isMinimized;
            if (isMinimized) {
                dragZone.style.display = 'none';
                contentWrapper.style.display = 'none';
                panel.style.width = '106px';
                panel.style.height = '106px';
                panel.style.borderRadius = '50%';
                avatarBtn.style.right = '0px';
                avatarBtn.style.bottom = '0px';
            } else {
                dragZone.style.display = 'flex';
                contentWrapper.style.display = 'block';
                panel.style.width = '365px';
                panel.style.height = 'auto';
                panel.style.borderRadius = '16px';
                avatarBtn.style.right = '15px';
                avatarBtn.style.bottom = '15px';
            }
        }

        avatarBtn.onclick = toggleMinimize;

        let isDragging = false, offsetX, offsetY;
        function dragStart(clientX, clientY) {
            isDragging = true;
            offsetX = clientX - panel.getBoundingClientRect().left;
            offsetY = clientY - panel.getBoundingClientRect().top;
        }
        function dragMove(clientX, clientY) {
            if (isDragging) {
                panel.style.left = `${clientX - offsetX}px`;
                panel.style.top = `${clientY - offsetY}px`;
            }
        }

        dragZone.addEventListener('mousedown', (e) => dragStart(e.clientX, e.clientY));
        avatarBtn.addEventListener('mousedown', (e) => { if (isMinimized) dragStart(e.clientX, e.clientY); });
        document.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', () => { isDragging = false; });

        dragZone.addEventListener('touchstart', (e) => { if (e.touches.length === 1) dragStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        avatarBtn.addEventListener('touchstart', (e) => { if (isMinimized && e.touches.length === 1) dragStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        document.addEventListener('touchmove', (e) => { if (isDragging && e.touches.length === 1) dragMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        document.addEventListener('touchend', () => { isDragging = false; });

        document.getElementById('toggle').addEventListener('click', startStop);
    };

    function checkAndStart() {
        if (document.body && document.head) {
            setTimeout(startFn, 2000);
        } else {
            setTimeout(checkAndStart, 200);
        }
    }
    checkAndStart();

    const DataViewProto = (typeof myWin.DataView !== 'undefined') ? myWin.DataView.prototype : DataView.prototype;
    const originalGetUint8 = DataViewProto.getUint8;
    DataViewProto.getUint8 = function (pos) {
        const res = originalGetUint8.apply(this, arguments);
        if (pos === 0 && res === 64) {
            map.width = this.getUint32(9, true);
            map.height = this.getUint32(13, true);
        }
        return res;
    };
})();
