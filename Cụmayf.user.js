// ==UserScript==
// @name         Agma.io Auto Farm XP - Modern Blue UI
// @namespace    http://tampermonkey.net/
// @version      7.1.0
// @description  Auto Farm XP chạy ngầm bằng Worker, giao diện Xanh Dương, tự bỏ qua hướng 0 giây
// @author       Custom Blue Edition
// @match        *://agma.io/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    const myWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    let running = false;
    let orientation = "none";
    let currentStep = 0;
    let map = { width: 0, height: 0 };
    let activeSocket = null;
    let isMinimized = false;

    // Biến phục vụ bộ đếm ngược
    let stepStartTime = 0;
    let stepDuration = 0;

    // --- WEB WORKER: CHẠY NGẦM KHÔNG BỊ TRÌNH DUYỆT BÓP THỜI GIAN ---
    const workerScript = `
        let moveInterval = null;
        let stepTimer = null;
        let splitTimer = null;
        let respawnTimer = null;

        self.onmessage = function (e) {
            const data = e.data;

            if (data.action === 'start') {
                if (moveInterval) clearInterval(moveInterval);
                moveInterval = setInterval(() => self.postMessage('tick'), 80);

                if (splitTimer) clearInterval(splitTimer);
                const st = data.splitTime || 4000;
                splitTimer = setInterval(() => self.postMessage('triggerSplit'), st);

                if (respawnTimer) clearInterval(respawnTimer);
                respawnTimer = setInterval(() => self.postMessage('triggerRespawn'), 1500);

            } else if (data.action === 'updateSplit') {
                if (splitTimer) clearInterval(splitTimer);
                const st = data.splitTime || 4000;
                splitTimer = setInterval(() => self.postMessage('triggerSplit'), st);

            } else if (data.action === 'stop') {
                if (moveInterval) clearInterval(moveInterval);
                if (stepTimer) clearTimeout(stepTimer);
                if (splitTimer) clearInterval(splitTimer);
                if (respawnTimer) clearInterval(respawnTimer);

            } else if (data.action === 'nextStep') {
                if (stepTimer) clearTimeout(stepTimer);
                stepTimer = setTimeout(() => {
                    self.postMessage('changeDirection');
                }, data.duration);
            }
        };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = function (e) {
        if (!running) return;
        const msg = e.data;

        if (msg === 'tick') {
            if (document.hidden) {
                sendMovePacketDirect();
            } else {
                updateCountdownUI();
            }
        } else if (msg === 'changeDirection') {
            currentStep = (currentStep + 1) % 4;
            runMovementLoop();
        } else if (msg === 'triggerSplit') {
            const chk = document.getElementById('autoSpamCheck');
            if (chk && chk.checked) sendSplitPacket();
        } else if (msg === 'triggerRespawn') {
            const chk = document.getElementById('autoRespawnCheck');
            if (chk && chk.checked) checkAndRespawn();
        }
    };

    // --- BẮT VÀ LƯU WEBSOCKET ---
    const WebSocketProto = (typeof myWin.WebSocket !== 'undefined') ? myWin.WebSocket.prototype : WebSocket.prototype;
    const sendMethod = WebSocketProto.send;

    WebSocketProto.send = function () {
        activeSocket = this;
        let data = arguments[0];

        if (running && orientation !== "none" && data instanceof DataView && data.byteLength >= 9 && data.getUint8(0) === 0) {
            let moveX = orientation === "right" ? 1e7 : orientation === "left" ? -1e7 : 0;
            let moveY = orientation === "bottom" ? 1e7 : orientation === "top" ? -1e7 : 0;
            data.setUint32(1, moveX, true);
            data.setUint32(5, moveY, true);
        }
        return sendMethod.apply(this, arguments);
    };

    function sendMovePacketDirect() {
        if (activeSocket && activeSocket.readyState === WebSocket.OPEN && running && orientation !== "none") {
            let moveX = orientation === "right" ? 1e7 : orientation === "left" ? -1e7 : 0;
            let moveY = orientation === "bottom" ? 1e7 : orientation === "top" ? -1e7 : 0;

            const buf = new ArrayBuffer(9);
            const view = new DataView(buf);
            view.setUint8(0, 0);
            view.setUint32(1, moveX, true);
            view.setUint32(5, moveY, true);
            sendMethod.call(activeSocket, buf);
        }
    }

    // --- AUTO SPLIT ---
    function sendSplitPacket() {
        const evData = { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true };
        ['keydown', 'keyup'].forEach(type => {
            myWin.dispatchEvent(new KeyboardEvent(type, evData));
            document.dispatchEvent(new KeyboardEvent(type, evData));
        });

        if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
            const splitPacket = new Uint8Array([17]);
            sendMethod.call(activeSocket, splitPacket.buffer);
        }
    }

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

    // Đọc giá trị giây chuẩn xác (cho phép = 0)
    function getDirectionSeconds(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const val = parseFloat(el.value);
        return (isNaN(val) || val <= 0) ? 0 : val;
    }

    function updateSkippedVisuals() {
        const pairs = [
            { box: 'box-r', input: 'time-r' },
            { box: 'box-d', input: 'time-d' },
            { box: 'box-l', input: 'time-l' },
            { box: 'box-u', input: 'time-u' }
        ];
        pairs.forEach(p => {
            const boxEl = document.getElementById(p.box);
            if (!boxEl) return;
            const sec = getDirectionSeconds(p.input);
            if (sec <= 0) {
                boxEl.classList.add('dir-disabled');
            } else {
                boxEl.classList.remove('dir-disabled');
            }
        });
    }

    // --- CẬP NHẬT ĐẾM NGƯỢC & THANH TIẾN TRÌNH ---
    function updateCountdownUI() {
        if (!running) return;
        const timerEl = document.getElementById('bot-countdown');
        const barEl = document.getElementById('bot-progress-bar');

        if (orientation === "none" || stepDuration <= 0) {
            if (timerEl) timerEl.textContent = `0.0s`;
            if (barEl) barEl.style.width = `0%`;
            return;
        }

        const elapsed = Date.now() - stepStartTime;
        const remainingMs = Math.max(0, stepDuration - elapsed);
        const remainingSec = (remainingMs / 1000).toFixed(1);
        const percent = Math.max(0, Math.min(100, (remainingMs / stepDuration) * 100));

        if (timerEl) timerEl.textContent = `${remainingSec}s`;
        if (barEl) barEl.style.width = `${percent}%`;
    }

    function highlightActiveDirection(stepIdx) {
        const ids = ['box-r', 'box-d', 'box-l', 'box-u'];
        ids.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (idx === stepIdx && running) {
                el.classList.add('dir-active');
            } else {
                el.classList.remove('dir-active');
            }
        });
    }

    function runMovementLoop() {
        if (!running) return;

        const durations = [
            getDirectionSeconds('time-r') * 1000,
            getDirectionSeconds('time-d') * 1000,
            getDirectionSeconds('time-l') * 1000,
            getDirectionSeconds('time-u') * 1000
        ];

        const statusLbl = document.getElementById('bot-status');

        // Tìm hướng tiếp theo có thời gian > 0 giây (bỏ qua các hướng = 0)
        let foundStep = -1;
        for (let i = 0; i < 4; i++) {
            const checkIdx = (currentStep + i) % 4;
            if (durations[checkIdx] > 0) {
                foundStep = checkIdx;
                break;
            }
        }

        // Nếu cả 4 hướng đều đặt là 0 giây -> Đứng yên
        if (foundStep === -1) {
            orientation = "none";
            stepDuration = 0;
            if (statusLbl) statusLbl.innerHTML = `ĐỨNG YÊN (TẤT CẢ 0S)`;
            highlightActiveDirection(-1);
            updateCountdownUI();
            return;
        }

        currentStep = foundStep;
        const currentDuration = durations[currentStep];

        if (currentStep === 0) {
            orientation = "right";
            if (statusLbl) statusLbl.innerHTML = `ĐI PHẢI ▶`;
        } else if (currentStep === 1) {
            orientation = "bottom";
            if (statusLbl) statusLbl.innerHTML = `ĐI XUỐNG ▼`;
        } else if (currentStep === 2) {
            orientation = "left";
            if (statusLbl) statusLbl.innerHTML = `ĐI TRÁI ◀`;
        } else if (currentStep === 3) {
            orientation = "top";
            if (statusLbl) statusLbl.innerHTML = `ĐI LÊN ▲`;
        }

        stepDuration = currentDuration;
        stepStartTime = Date.now();
        highlightActiveDirection(currentStep);
        updateCountdownUI();

        worker.postMessage({ action: 'nextStep', duration: currentDuration });
    }

    const startFn = () => {
        if (document.getElementById('agma-blue-hud')) return;

        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            #agma-blue-hud {
                position: fixed;
                z-index: 10005;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                user-select: none;
                -webkit-user-select: none;
                color: #e2e8f0;
            }
            #hud-main-card {
                width: 285px;
                background: linear-gradient(160deg, rgba(11, 20, 40, 0.95), rgba(6, 12, 26, 0.98));
                border: 1.5px solid rgba(0, 174, 255, 0.45);
                border-radius: 14px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 140, 255, 0.2);
                backdrop-filter: blur(10px);
                overflow: hidden;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #hud-header {
                background: linear-gradient(90deg, rgba(16, 36, 74, 0.9), rgba(10, 22, 48, 0.9));
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(56, 189, 248, 0.18);
                cursor: move;
            }
            .hud-title {
                display: flex;
                align-items: center;
                gap: 7px;
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 0.8px;
                color: #38bdf8;
                text-shadow: 0 0 10px rgba(56, 189, 248, 0.45);
            }
            .hud-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #475569;
                transition: all 0.3s;
            }
            .hud-dot.active {
                background: #00e5ff;
                box-shadow: 0 0 10px #00e5ff;
            }
            #hud-min-btn {
                background: rgba(56, 189, 248, 0.12);
                color: #7dd3fc;
                border: 1px solid rgba(56, 189, 248, 0.25);
                border-radius: 6px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                line-height: 1;
                transition: all 0.15s;
            }
            #hud-min-btn:hover {
                background: rgba(56, 189, 248, 0.28);
                color: #fff;
            }
            .hud-body {
                padding: 14px;
            }
            .status-box {
                background: rgba(8, 17, 36, 0.9);
                border: 1px solid rgba(30, 64, 124, 0.6);
                border-radius: 10px;
                padding: 10px 12px;
                margin-bottom: 12px;
            }
            .status-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 7px;
            }
            #bot-status {
                font-size: 12px;
                font-weight: 800;
                color: #64748b;
                letter-spacing: 0.5px;
            }
            #bot-countdown {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 13px;
                font-weight: 800;
                color: #00e5ff;
                background: rgba(0, 229, 255, 0.1);
                padding: 2px 7px;
                border-radius: 5px;
                border: 1px solid rgba(0, 229, 255, 0.25);
            }
            .progress-track {
                width: 100%;
                height: 5px;
                background: #0f1d3a;
                border-radius: 99px;
                overflow: hidden;
            }
            #bot-progress-bar {
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #0072ff, #00e5ff);
                box-shadow: 0 0 8px rgba(0, 229, 255, 0.7);
                transition: width 0.08s linear;
            }
            .dir-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 12px;
            }
            .dir-card {
                background: #0b162e;
                border: 1px solid #1b325f;
                border-radius: 8px;
                padding: 6px 4px;
                text-align: center;
                transition: all 0.2s;
            }
            .dir-card.dir-disabled {
                opacity: 0.42;
                border-style: dashed;
                border-color: #1e293b;
            }
            .dir-card.dir-active {
                opacity: 1;
                border-style: solid;
                border-color: #00e5ff;
                background: rgba(0, 174, 255, 0.14);
                box-shadow: 0 0 12px rgba(0, 229, 255, 0.25);
            }
            .dir-icon {
                font-size: 11px;
                font-weight: 800;
                color: #38bdf8;
                margin-bottom: 4px;
            }
            .dir-card input {
                width: 90%;
                background: #071022;
                color: #f8fafc;
                border: 1px solid #1e3a6d;
                border-radius: 5px;
                text-align: center;
                padding: 4px 0;
                font-size: 12px;
                font-weight: 700;
                outline: none;
            }
            .dir-card input:focus {
                border-color: #00e5ff;
            }
            .setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #0b162e;
                border: 1px solid #172d56;
                border-radius: 9px;
                padding: 8px 11px;
                margin-bottom: 8px;
            }
            .setting-label {
                font-size: 12px;
                font-weight: 600;
                color: #cbd5e1;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .split-num-input {
                width: 44px;
                background: #071022;
                color: #38bdf8;
                border: 1px solid #254b8c;
                border-radius: 5px;
                text-align: center;
                font-size: 12px;
                font-weight: 700;
                padding: 2px 0;
                outline: none;
            }
            .blue-switch {
                position: relative;
                display: inline-block;
                width: 36px;
                height: 20px;
                margin: 0;
            }
            .blue-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .blue-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #1e293b;
                border: 1px solid #334155;
                transition: 0.25s;
                border-radius: 20px;
            }
            .blue-slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 2px;
                bottom: 2px;
                background-color: #94a3b8;
                transition: 0.25s;
                border-radius: 50%;
            }
            .blue-switch input:checked + .blue-slider {
                background: linear-gradient(135deg, #0284c7, #00c6ff);
                border-color: #38bdf8;
                box-shadow: 0 0 8px rgba(0, 198, 255, 0.4);
            }
            .blue-switch input:checked + .blue-slider:before {
                transform: translateX(16px);
                background-color: #ffffff;
            }
            #toggle {
                width: 100%;
                margin-top: 4px;
                padding: 10px 0;
                background: linear-gradient(135deg, #0284c7, #2563eb);
                color: #ffffff;
                border: 1px solid rgba(56, 189, 248, 0.4);
                border-radius: 9px;
                font-size: 12.5px;
                font-weight: 800;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
            }
            #toggle:hover {
                filter: brightness(1.12);
            }
            #toggle.running {
                background: linear-gradient(135deg, #00b4db, #0083b0);
                border-color: #00e5ff;
                box-shadow: 0 0 16px rgba(0, 229, 255, 0.5);
            }
            #hud-mini-bubble {
                display: none;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, #16366f, #091326);
                border: 2px solid #00c6ff;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 198, 255, 0.45);
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                transition: transform 0.15s ease, box-shadow 0.2s ease;
            }
            #hud-mini-bubble:hover {
                transform: scale(1.08);
                box-shadow: 0 0 18px rgba(0, 229, 255, 0.8);
            }
            #hud-mini-bubble.running {
                border-color: #00e5ff;
                box-shadow: 0 0 18px rgba(0, 229, 255, 0.85);
            }
        `;
        document.head.appendChild(styleEl);

        const panel = document.createElement('div');
        panel.id = 'agma-blue-hud';
        panel.style.left = `${Math.max(20, myWin.innerWidth - 315)}px`;
        panel.style.top = `160px`;

        panel.innerHTML = `
            <div id="hud-main-card">
                <div id="hud-header">
                    <div class="hud-title">
                        <span id="status-dot" class="hud-dot"></span>
                        <span>AUTO FARM XP</span>
                    </div>
                    <button id="hud-min-btn" title="Thu nhỏ menu">—</button>
                </div>

                <div class="hud-body">
                    <div class="status-box">
                        <div class="status-top">
                            <span id="bot-status">ĐANG TẮT</span>
                            <span id="bot-countdown">0.0s</span>
                        </div>
                        <div class="progress-track">
                            <div id="bot-progress-bar"></div>
                        </div>
                    </div>

                    <div class="dir-grid">
                        <div class="dir-card" id="box-r">
                            <div class="dir-icon">▶ PHẢI</div>
                            <input type="number" id="time-r" value="34" min="0" step="1">
                        </div>
                        <div class="dir-card" id="box-d">
                            <div class="dir-icon">▼ XUỐNG</div>
                            <input type="number" id="time-d" value="25" min="0" step="1">
                        </div>
                        <div class="dir-card" id="box-l">
                            <div class="dir-icon">◀ TRÁI</div>
                            <input type="number" id="time-l" value="34" min="0" step="1">
                        </div>
                        <div class="dir-card" id="box-u">
                            <div class="dir-icon">▲ LÊN</div>
                            <input type="number" id="time-u" value="25" min="0" step="1">
                        </div>
                    </div>

                    <div class="setting-row">
                        <div class="setting-label">
                            <span>Auto Split (s):</span>
                            <input type="number" id="split-time" class="split-num-input" value="4" min="1">
                        </div>
                        <label class="blue-switch">
                            <input type="checkbox" id="autoSpamCheck" checked>
                            <span class="blue-slider"></span>
                        </label>
                    </div>

                    <div class="setting-row">
                        <div class="setting-label">
                            <span>Tự Động Hồi Sinh</span>
                        </div>
                        <label class="blue-switch">
                            <input type="checkbox" id="autoRespawnCheck" checked>
                            <span class="blue-slider"></span>
                        </label>
                    </div>

                    <button id="toggle">KHỞI ĐỘNG</button>
                </div>
            </div>

            <div id="hud-mini-bubble" title="Chạm để mở rộng">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="#00e5ff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
            </div>
        `;
        document.body.appendChild(panel);

        const mainCard = document.getElementById('hud-main-card');
        const miniBubble = document.getElementById('hud-mini-bubble');
        const minBtn = document.getElementById('hud-min-btn');
        const dragZone = document.getElementById('hud-header');
        const toggleBtn = document.getElementById('toggle');
        const statusDot = document.getElementById('status-dot');
        const splitInput = document.getElementById('split-time');

        // Theo dõi khi người dùng chỉnh thời gian 4 hướng
        const dirInputs = ['time-r', 'time-d', 'time-l', 'time-u'];
        dirInputs.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                updateSkippedVisuals();
                // Nếu đang chạy mà chỉnh hướng hiện tại về 0 hoặc vừa bật lại 1 hướng khi đang đứng yên -> cập nhật ngay
                if (running && (currentStep === idx || orientation === "none")) {
                    runMovementLoop();
                }
            });
        });

        updateSkippedVisuals();

        function startStop() {
            const statusLbl = document.getElementById('bot-status');
            const timerEl = document.getElementById('bot-countdown');
            const barEl = document.getElementById('bot-progress-bar');

            if (running) {
                running = false;
                orientation = "none";
                worker.postMessage({ action: 'stop' });

                toggleBtn.textContent = 'KHỞI ĐỘNG';
                toggleBtn.classList.remove('running');
                statusDot.classList.remove('active');
                miniBubble.classList.remove('running');

                statusLbl.textContent = 'ĐANG TẮT';
                statusLbl.style.color = '#64748b';
                timerEl.textContent = '0.0s';
                barEl.style.width = '0%';
                highlightActiveDirection(-1);
            } else {
                running = true;
                currentStep = 0;

                const splitTimeMs = splitInput ? Math.max(1, parseFloat(splitInput.value) || 4) * 1000 : 4000;
                worker.postMessage({ action: 'start', splitTime: splitTimeMs });

                statusLbl.style.color = '#38bdf8';
                toggleBtn.textContent = 'ĐANG CHẠY (BẤM ĐỂ DỪNG)';
                toggleBtn.classList.add('running');
                statusDot.classList.add('active');
                miniBubble.classList.add('running');

                runMovementLoop();
            }
        }

        splitInput.addEventListener('change', () => {
            if (running) {
                const splitTimeMs = Math.max(1, parseFloat(splitInput.value) || 4) * 1000;
                worker.postMessage({ action: 'updateSplit', splitTime: splitTimeMs });
            }
        });

        function setMinimized(state) {
            isMinimized = state;
            if (isMinimized) {
                mainCard.style.display = 'none';
                miniBubble.style.display = 'flex';
            } else {
                miniBubble.style.display = 'none';
                mainCard.style.display = 'block';
            }
        }

        minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setMinimized(true);
        });

        let isDragging = false, startX = 0, startY = 0, offsetX = 0, offsetY = 0, movedDist = 0;

        function dragStart(clientX, clientY) {
            isDragging = true;
            movedDist = 0;
            startX = clientX;
            startY = clientY;
            const rect = panel.getBoundingClientRect();
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;
        }

        function dragMove(clientX, clientY) {
            if (!isDragging) return;
            movedDist = Math.hypot(clientX - startX, clientY - startY);
            if (movedDist > 3) {
                panel.style.left = `${clientX - offsetX}px`;
                panel.style.top = `${clientY - offsetY}px`;
            }
        }

        dragZone.addEventListener('mousedown', (e) => {
            if (e.target === minBtn) return;
            dragStart(e.clientX, e.clientY);
        });
        miniBubble.addEventListener('mousedown', (e) => dragStart(e.clientX, e.clientY));

        document.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', () => { isDragging = false; });

        miniBubble.addEventListener('click', (e) => {
            if (movedDist < 5) {
                e.stopPropagation();
                setMinimized(false);
            }
        });

        dragZone.addEventListener('touchstart', (e) => {
            if (e.target === minBtn) return;
            if (e.touches.length === 1) dragStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        miniBubble.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) dragStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) dragMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener('touchend', () => { isDragging = false; });

        toggleBtn.addEventListener('click', startStop);
    };

    function checkAndStart() {
        if (document.body && document.head) {
            setTimeout(startFn, 1500);
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
