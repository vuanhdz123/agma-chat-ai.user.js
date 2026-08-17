// ==UserScript==
// @name         Agma.io - AI V10 Live Game State
// @namespace    agma.ai.v10
// @version      10.0.0
// @description  Agma AI - Chat + Knowledge Base + Live Game State + Any Server
// @match        *://agma.io/*
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    /* =========================================================
       CONFIG
    ========================================================= */

    const DEFAULT_URL =
        "https://api.groq.com/openai/v1/chat/completions";

    /*
     * Có thể đổi model trong Cài đặt.
     *
     * Ví dụ:
     * openai/gpt-oss-20b
     * openai/gpt-oss-120b
     * llama-3.3-70b-versatile
     *
     * Model nào tài khoản Groq hỗ trợ thì dùng model đó.
     */
    const DEFAULT_MODEL =
        "openai/gpt-oss-20b";

    const STORE = {
        key: "agma_v10_groq_key",
        url: "agma_v10_groq_url",
        model: "agma_v10_groq_model",
        chats: "agma_v10_chats",
        current: "agma_v10_current",
        enabled: "agma_v10_enabled"
    };

    let apiKey =
        localStorage.getItem(STORE.key) || "";

    let apiURL =
        localStorage.getItem(STORE.url) ||
        DEFAULT_URL;

    let model =
        localStorage.getItem(STORE.model) ||
        DEFAULT_MODEL;

    let enabled =
        localStorage.getItem(STORE.enabled) !== "false";

    let chats = loadChats();

    let currentChat =
        localStorage.getItem(STORE.current) || null;

    let activeController = null;
    let requestRunning = false;

    /* =========================================================
       STORAGE
    ========================================================= */

    function loadChats() {
        try {
            return JSON.parse(
                localStorage.getItem(STORE.chats) || "[]"
            );
        } catch {
            return [];
        }
    }

    function saveChats() {
        localStorage.setItem(
            STORE.chats,
            JSON.stringify(chats)
        );
    }

    function uid() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2)
        );
    }

    function getChat() {
        return chats.find(
            x => x.id === currentChat
        );
    }

    function newChat() {

        const chat = {
            id: uid(),
            title: "Cuộc trò chuyện mới",
            messages: [],
            created: Date.now()
        };

        chats.unshift(chat);

        currentChat = chat.id;

        localStorage.setItem(
            STORE.current,
            currentChat
        );

        saveChats();

        renderChatList();
        renderMessages();
    }

    function ensureChat() {

        if (!currentChat || !getChat()) {
            newChat();
        }
    }

    /* =========================================================
       ESCAPE
    ========================================================= */

    function esc(text) {

        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* =========================================================
       KNOWLEDGE BASE
    ========================================================= */

    const KNOWLEDGE_BASE = `
Bạn là AI trợ lý đang chạy bên trong Agma.io.

NHIỆM VỤ:
- Giúp người chơi hiểu và phân tích tình huống trong Agma.io.
- Khi có LIVE GAME STATE thì ưu tiên dữ liệu hiện tại.
- Không tự bịa dữ liệu game.
- Nếu dữ liệu không có trong client, nói rõ là chưa đọc được.
- Không được khẳng định timer spawn nếu chưa có timestamp hoặc dữ liệu đủ tin cậy.

KIẾN THỨC CƠ BẢN:
- Agma.io là game .io nhiều người chơi.
- Người chơi điều khiển cell.
- Có mass, leaderboard, player khác và nhiều vật thể/power.
- Có các khu vực/server khác nhau.
- Một số power có timer/cooldown/spawn riêng.
- Các tên người dùng có thể viết tắt như:
  VR = Virus
  FRV/FVS có thể được người chơi dùng để chỉ Frozen Virus tùy ngữ cảnh.
  Portal = Portal.
  Anti = Anti-Recombine/Anti-related power tùy dữ liệu client.
- Không được coi các viết tắt này là chính xác tuyệt đối nếu game state không xác nhận.

POWER TIMER:
Người dùng từng cung cấp các mốc tham khảo:
- VR: 10 phút
- Pellet: 10 phút
- Anti: 10 phút
- Portal: 12 phút 40 giây
- FRV: 7 phút 30 giây

Các mốc trên CHỈ là kiến thức tham khảo.
Nếu Live Game State có timestamp thực tế thì phải ưu tiên timestamp thực tế.

ROOM/SERVER:
- Không giả định server là Room 3.
- Có thể người dùng gọi secret server, room 3 hoặc tên khác.
- Hãy lấy server/room từ live state nếu client expose được.

LEADERBOARD:
- Nếu client có leaderboard DOM hoặc dữ liệu public player list,
  hãy sử dụng dữ liệu đó.
- Nếu không đọc được leaderboard thì nói không có dữ liệu.

POWER SPAWN:
- Không tự tạo timer giả.
- Nếu tìm thấy timestamp/event/state liên quan power thì tính thời gian còn lại.
- Nếu chỉ có tên power mà không có timestamp thì không thể xác định chính xác.

PHONG CÁCH:
- Trả lời tiếng Việt.
- Ngắn gọn khi câu hỏi đơn giản.
- Nếu người dùng hỏi timer thì ưu tiên:
  Power
  Server
  thời gian còn lại
  nguồn dữ liệu
- Không tự nhắn khi người dùng chưa hỏi.
`;

    /* =========================================================
       LIVE GAME STATE
    ========================================================= */

    function now() {
        return Date.now();
    }

    function safeJSON(text) {

        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    function cleanText(text) {

        return String(text || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getVisibleText(selector) {

        const el =
            document.querySelector(selector);

        if (!el) return "";

        return cleanText(
            el.innerText ||
            el.textContent ||
            ""
        );
    }

    function collectDOMState() {

        const state = {
            url: location.href,
            host: location.host,
            path: location.pathname,
            title: document.title,
            time: new Date().toISOString(),
            player: {},
            leaderboard: [],
            visibleText: []
        };

        /*
         * Tìm một số text có khả năng liên quan tới
         * server / room / mass / player.
         */

        const bodyText =
            cleanText(
                document.body?.innerText || ""
            );

        if (bodyText) {

            const lines =
                bodyText
                    .split("\n")
                    .map(cleanText)
                    .filter(Boolean)
                    .slice(0, 250);

            state.visibleText =
                lines;
        }

        /*
         * Các selector phổ biến.
         * Không giả định chúng chắc chắn tồn tại.
         */

        const possiblePlayerSelectors = [
            "#leaderboard",
            ".leaderboard",
            "#leaderboard-container",
            ".leaderboard-container",
            "[class*='leaderboard']"
        ];

        for (
            const selector
            of possiblePlayerSelectors
        ) {

            const els =
                document.querySelectorAll(
                    selector
                );

            if (!els.length) continue;

            els.forEach(el => {

                const txt =
                    cleanText(
                        el.innerText ||
                        el.textContent ||
                        ""
                    );

                if (txt) {
                    state.leaderboard.push(
                        txt.slice(0, 3000)
                    );
                }

            });

            if (state.leaderboard.length)
                break;
        }

        /*
         * Tìm text có khả năng là server/room.
         */

        const serverRegex =
            /(?:server|room|realm|region)\s*[:#-]?\s*([A-Za-z0-9_-]+)/i;

        const match =
            bodyText.match(serverRegex);

        if (match) {
            state.server =
                match[1];
        }

        return state;
    }

    /* =========================================================
       GLOBAL STATE SCAN
    ========================================================= */

    function getGlobalObjects() {

        const result = {};

        const names = [
            "game",
            "Game",
            "agma",
            "Agma",
            "client",
            "Client",
            "world",
            "World",
            "player",
            "Player",
            "socket",
            "Socket",
            "ws",
            "WS",
            "server",
            "Server",
            "room",
            "Room",
            "gameState",
            "GameState"
        ];

        for (const name of names) {

            try {

                if (
                    typeof window[name] !==
                    "undefined"
                ) {

                    const value =
                        window[name];

                    if (
                        value &&
                        (
                            typeof value ===
                            "object" ||
                            typeof value ===
                            "function"
                        )
                    ) {

                        result[name] =
                            summarizeObject(
                                value,
                                0,
                                2
                            );

                    }

                }

            } catch {}

        }

        return result;
    }

    function summarizeObject(
        obj,
        depth,
        maxDepth
    ) {

        if (
            obj === null ||
            obj === undefined
        ) {
            return obj;
        }

        if (
            typeof obj ===
            "string"
        ) {
            return obj.slice(0, 500);
        }

        if (
            typeof obj ===
            "number" ||
            typeof obj ===
            "boolean"
        ) {
            return obj;
        }

        if (depth > maxDepth) {
            return "[depth limit]";
        }

        if (Array.isArray(obj)) {

            return obj
                .slice(0, 40)
                .map(
                    x =>
                        summarizeObject(
                            x,
                            depth + 1,
                            maxDepth
                        )
                );

        }

        if (
            typeof obj !==
            "object"
        ) {
            return String(obj);
        }

        const out = {};

        let keys = [];

        try {
            keys =
                Object.keys(obj)
                    .slice(0, 100);
        } catch {
            return "[unreadable object]";
        }

        for (const key of keys) {

            if (
                key.startsWith("_") &&
                key.length > 1
            ) {
                continue;
            }

            try {

                const value =
                    obj[key];

                if (
                    typeof value ===
                    "function"
                ) {
                    continue;
                }

                out[key] =
                    summarizeObject(
                        value,
                        depth + 1,
                        maxDepth
                    );

            } catch {
                out[key] =
                    "[unreadable]";
            }

        }

        return out;
    }

    /* =========================================================
       POWER SCANNER
    ========================================================= */

    const POWER_NAMES = [
        "virus",
        "vr",
        "pellet",
        "anti",
        "portal",
        "frv",
        "fvs",
        "frozen",
        "power",
        "powerup"
    ];

    function scanPowerHints() {

        const result = [];

        const html =
            document.documentElement
                ?.innerHTML || "";

        const lower =
            html.toLowerCase();

        for (
            const power
            of POWER_NAMES
        ) {

            if (
                lower.includes(power)
            ) {

                result.push(power);

            }

        }

        return [...new Set(result)];
    }

    /* =========================================================
       LIVE STATE
    ========================================================= */

    function collectLiveState() {

        const state = {

            capturedAt:
                new Date().toISOString(),

            location: {
                href:
                    location.href,
                host:
                    location.host,
                path:
                    location.pathname
            },

            dom:
                collectDOMState(),

            possiblePowers:
                scanPowerHints(),

            globals:
                getGlobalObjects()

        };

        return state;
    }

    function stateToText(state) {

        let text =
            JSON.stringify(
                state,
                null,
                2
            );

        /*
         * Không gửi quá nhiều dữ liệu lên API.
         */

        const MAX =
            30000;

        if (
            text.length >
            MAX
        ) {

            text =
                text.slice(
                    0,
                    MAX
                ) +
                "\n...[state truncated]";

        }

        return text;
    }

    /* =========================================================
       CSS
    ========================================================= */

    const style =
        document.createElement("style");

    style.textContent = `

#agma-v10-root,
#agma-v10-root * {
    box-sizing:border-box;
    font-family:Arial,Helvetica,sans-serif;
}

#agma-v10-bubble {
    position:fixed;
    right:18px;
    bottom:18px;
    width:58px;
    height:58px;
    border-radius:50%;
    background:linear-gradient(135deg,#5865f2,#7c4dff);
    color:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:26px;
    cursor:pointer;
    z-index:2147483647;
    box-shadow:0 8px 30px rgba(0,0,0,.5);
    user-select:none;
}

#agma-v10-bubble.off {
    opacity:.45;
}

#agma-v10-window {
    position:fixed;
    right:18px;
    bottom:88px;
    width:760px;
    height:650px;
    max-width:calc(100vw - 20px);
    max-height:calc(100vh - 100px);
    background:#171717;
    color:#fff;
    border:1px solid #3a3a3a;
    border-radius:14px;
    overflow:hidden;
    display:none;
    z-index:2147483646;
    box-shadow:0 20px 70px rgba(0,0,0,.65);
}

#agma-v10-window.open {
    display:flex;
}

#agma-v10-sidebar {
    width:190px;
    background:#101010;
    border-right:1px solid #303030;
    display:flex;
    flex-direction:column;
}

#agma-v10-main {
    min-width:0;
    flex:1;
    display:flex;
    flex-direction:column;
}

.v10-btn {
    border:0;
    border-radius:7px;
    background:#242424;
    color:#fff;
    padding:9px;
    cursor:pointer;
}

.v10-btn:hover {
    background:#303030;
}

#agma-v10-new {
    margin:10px;
}

#agma-v10-chat-list {
    flex:1;
    overflow-y:auto;
    padding:5px;
}

.v10-chat {
    padding:9px;
    border-radius:7px;
    margin-bottom:3px;
    cursor:pointer;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    font-size:13px;
}

.v10-chat:hover,
.v10-chat.active {
    background:#303030;
}

#agma-v10-side-buttons {
    padding:8px;
}

#agma-v10-side-buttons button {
    width:100%;
    margin-top:5px;
}

#agma-v10-header {
    height:52px;
    flex-shrink:0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 13px;
    border-bottom:1px solid #303030;
    background:#191919;
}

#agma-v10-header-right {
    display:flex;
    gap:6px;
}

.v10-header-btn {
    width:38px;
    height:34px;
}

#agma-v10-messages {
    flex:1;
    overflow-y:auto;
    padding:18px;
}

.v10-msg {
    display:flex;
    gap:9px;
    margin-bottom:17px;
}

.v10-msg.user {
    justify-content:flex-end;
}

.v10-avatar {
    width:30px;
    height:30px;
    min-width:30px;
    border-radius:7px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#5865f2;
}

.v10-msg.user .v10-avatar {
    order:2;
    background:#444;
}

.v10-msg-wrap {
    max-width:88%;
}

.v10-content {
    background:#242424;
    padding:10px 13px;
    border-radius:10px;
    line-height:1.5;
    white-space:pre-wrap;
    word-break:break-word;
    font-size:14px;
}

.v10-msg.user .v10-content {
    background:#343541;
}

.v10-actions {
    display:flex;
    gap:5px;
    margin-top:5px;
}

.v10-action {
    border:0;
    border-radius:5px;
    padding:4px 7px;
    background:#303030;
    color:#aaa;
    cursor:pointer;
    font-size:11px;
}

#agma-v10-input-area {
    border-top:1px solid #303030;
    padding:10px;
    background:#191919;
}

#agma-v10-input-box {
    display:flex;
    gap:7px;
    background:#242424;
    border:1px solid #444;
    border-radius:10px;
    padding:6px;
}

#agma-v10-input {
    flex:1;
    height:44px;
    max-height:130px;
    resize:none;
    outline:0;
    border:0;
    background:transparent;
    color:#fff;
    padding:8px;
}

#agma-v10-send {
    width:46px;
    border:0;
    border-radius:8px;
    background:#5865f2;
    color:#fff;
    cursor:pointer;
}

#agma-v10-stop {
    width:46px;
    border:0;
    border-radius:8px;
    background:#8b3030;
    color:#fff;
    cursor:pointer;
    display:none;
}

#agma-v10-status {
    font-size:11px;
    color:#888;
    padding:3px 5px;
}

#agma-v10-settings {
    position:absolute;
    inset:0;
    background:rgba(0,0,0,.75);
    display:none;
    align-items:center;
    justify-content:center;
    z-index:30;
}

#agma-v10-settings.show {
    display:flex;
}

#agma-v10-settings-box {
    width:430px;
    max-width:calc(100vw - 25px);
    background:#202020;
    border:1px solid #444;
    border-radius:12px;
    padding:17px;
}

.v10-label {
    display:block;
    color:#aaa;
    font-size:12px;
    margin:11px 0 5px;
}

.v10-input {
    width:100%;
    padding:9px;
    border:1px solid #444;
    border-radius:7px;
    background:#111;
    color:#fff;
    outline:0;
}

#agma-v10-settings-buttons {
    display:flex;
    gap:8px;
    margin-top:15px;
}

#agma-v10-settings-buttons button {
    flex:1;
}

@media(max-width:600px) {

    #agma-v10-window {
        right:5px;
        bottom:72px;
        width:calc(100vw - 10px);
        height:calc(100vh - 85px);
    }

    #agma-v10-sidebar {
        display:none;
    }

    #agma-v10-messages {
        padding:11px;
    }

    #agma-v10-bubble {
        right:12px;
        bottom:12px;
    }
}

`;

    document.head.appendChild(style);

    /* =========================================================
       HTML
    ========================================================= */

    const root =
        document.createElement("div");

    root.id =
        "agma-v10-root";

    root.innerHTML = `

<div id="agma-v10-bubble">🤖</div>

<div id="agma-v10-window">

    <aside id="agma-v10-sidebar">

        <button
            class="v10-btn"
            id="agma-v10-new">
            ＋ Chat mới
        </button>

        <div id="agma-v10-chat-list"></div>

        <div id="agma-v10-side-buttons">

            <button
                class="v10-btn"
                id="agma-v10-settings-btn">
                ⚙️ Cài đặt
            </button>

            <button
                class="v10-btn"
                id="agma-v10-state-btn">
                🎮 Live State
            </button>

            <button
                class="v10-btn"
                id="agma-v10-clear">
                🗑️ Xóa chat
            </button>

        </div>

    </aside>

    <main id="agma-v10-main">

        <header id="agma-v10-header">

            <b>Agma AI V10</b>

            <div id="agma-v10-header-right">

                <button
                    class="v10-btn v10-header-btn"
                    id="agma-v10-toggle">
                    ${enabled ? "ON" : "OFF"}
                </button>

                <button
                    class="v10-btn v10-header-btn"
                    id="agma-v10-close">
                    ×
                </button>

            </div>

        </header>

        <div id="agma-v10-messages"></div>

        <div id="agma-v10-input-area">

            <div id="agma-v10-status">
                Ready
            </div>

            <div id="agma-v10-input-box">

                <textarea
                    id="agma-v10-input"
                    placeholder="Hỏi AI về tình huống trong game..."
                ></textarea>

                <button id="agma-v10-stop">
                    ■
                </button>

                <button id="agma-v10-send">
                    ➤
                </button>

            </div>

        </div>

    </main>

    <div id="agma-v10-settings">

        <div id="agma-v10-settings-box">

            <h3>⚙️ Cài đặt Groq</h3>

            <label class="v10-label">
                API URL
            </label>

            <input
                id="v10-url"
                class="v10-input"
            >

            <label class="v10-label">
                Groq API Key
            </label>

            <input
                id="v10-key"
                class="v10-input"
                type="password"
                placeholder="gsk_..."
            >

            <label class="v10-label">
                Model
            </label>

            <input
                id="v10-model"
                class="v10-input"
            >

            <div id="agma-v10-settings-buttons">

                <button
                    class="v10-btn"
                    id="v10-cancel">
                    Hủy
                </button>

                <button
                    class="v10-btn"
                    id="v10-save">
                    Lưu
                </button>

            </div>

        </div>

    </div>

</div>
`;

    document.body.appendChild(root);

    /* =========================================================
       ELEMENTS
    ========================================================= */

    const bubble =
        document.getElementById(
            "agma-v10-bubble"
        );

    const win =
        document.getElementById(
            "agma-v10-window"
        );

    const messagesEl =
        document.getElementById(
            "agma-v10-messages"
        );

    const input =
        document.getElementById(
            "agma-v10-input"
        );

    const sendBtn =
        document.getElementById(
            "agma-v10-send"
        );

    const stopBtn =
        document.getElementById(
            "agma-v10-stop"
        );

    const statusEl =
        document.getElementById(
            "agma-v10-status"
        );

    /* =========================================================
       RENDER
    ========================================================= */

    function formatText(text) {

        let html =
            esc(text);

        html =
            html.replace(
                /```([\s\S]*?)```/g,
                `<pre style="
                    background:#111;
                    padding:10px;
                    border-radius:7px;
                    overflow:auto;
                    white-space:pre-wrap;
                ">$1</pre>`
            );

        html =
            html.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );

        return html;
    }

    function scrollBottom() {
        messagesEl.scrollTop =
            messagesEl.scrollHeight;
    }

    function renderChatList() {

        const list =
            document.getElementById(
                "agma-v10-chat-list"
            );

        list.innerHTML = "";

        chats.forEach(chat => {

            const el =
                document.createElement("div");

            el.className =
                "v10-chat" +
                (
                    chat.id === currentChat
                        ? " active"
                        : ""
                );

            el.textContent =
                chat.title ||
                "Cuộc trò chuyện";

            el.onclick = () => {

                currentChat =
                    chat.id;

                localStorage.setItem(
                    STORE.current,
                    currentChat
                );

                renderChatList();
                renderMessages();
            };

            list.appendChild(el);
        });
    }

    function renderMessages() {

        ensureChat();

        const chat =
            getChat();

        messagesEl.innerHTML = "";

        if (!chat.messages.length) {

            addVisualMessage(
                "assistant",
                "Xin chào 👋\n\n" +
                "Mình là Agma AI V10.\n\n" +
                "Mình có thể phân tích Live Game State mà client hiện đang có. " +
                "Bạn có thể hỏi ví dụ:\n\n" +
                "• VR A1 còn bao lâu?\n" +
                "• Ai đang đứng đầu leaderboard?\n" +
                "• Server hiện tại là gì?\n" +
                "• Game đang có power nào?\n" +
                "• Tình trạng game hiện tại thế nào?"
            );

            return;
        }

        chat.messages.forEach(
            (msg, index) => {

                renderMessage(
                    msg,
                    index
                );

            }
        );

        scrollBottom();
    }

    function addVisualMessage(
        role,
        content
    ) {

        const row =
            document.createElement("div");

        row.className =
            "v10-msg " +
            role;

        row.innerHTML = `

            <div class="v10-avatar">
                ${role === "user" ? "👤" : "🤖"}
            </div>

            <div class="v10-msg-wrap">

                <div class="v10-content">
                    ${formatText(content)}
                </div>

            </div>
        `;

        messagesEl.appendChild(row);

        scrollBottom();

        return row;
    }

    function renderMessage(
        msg,
        index
    ) {

        const row =
            document.createElement("div");

        row.className =
            "v10-msg " +
            msg.role;

        row.innerHTML = `

            <div class="v10-avatar">
                ${msg.role === "user" ? "👤" : "🤖"}
            </div>

            <div class="v10-msg-wrap">

                <div class="v10-content">
                    ${formatText(msg.content)}
                </div>

                <div class="v10-actions">

                    <button
                        class="v10-action copy">
                        📋 Copy
                    </button>

                    ${
                        msg.role === "assistant"
                        ? `
                        <button
                            class="v10-action regen">
                            🔄 Tạo lại
                        </button>
                        `
                        : ""
                    }

                </div>

            </div>
        `;

        row.querySelector(
            ".copy"
        ).onclick = () => {

            navigator.clipboard?.writeText(
                msg.content
            );

        };

        const regen =
            row.querySelector(".regen");

        if (regen) {

            regen.onclick = () => {

                regenerate(index);

            };

        }

        messagesEl.appendChild(row);
    }

    /* =========================================================
       STATUS
    ========================================================= */

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function setLoading(value) {

        requestRunning = value;

        sendBtn.style.display =
            value ? "none" : "block";

        stopBtn.style.display =
            value ? "block" : "none";

        input.disabled =
            value;

    }

    /* =========================================================
       REQUEST
    ========================================================= */

    function requestGroq(
        body
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!apiKey) {

                    reject(
                        new Error(
                            "Chưa có Groq API Key."
                        )
                    );

                    return;
                }

                const controller =
                    new AbortController();

                activeController =
                    controller;

                let finished =
                    false;

                /*
                 * GM_xmlhttpRequest không hỗ trợ
                 * AbortController trực tiếp trên mọi
                 * phiên bản, nên lưu request object.
                 */

                let req;

                try {

                    req =
                        GM_xmlhttpRequest({

                            method: "POST",

                            url: apiURL,

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    "Bearer " +
                                    apiKey

                            },

                            data:
                                JSON.stringify(body),

                            timeout:
                                120000,

                            onload:
                                response => {

                                    if (finished)
                                        return;

                                    finished =
                                        true;

                                    let data;

                                    try {

                                        data =
                                            JSON.parse(
                                                response.responseText
                                            );

                                    } catch {

                                        reject(
                                            new Error(
                                                "API không trả về JSON hợp lệ."
                                            )
                                        );

                                        return;
                                    }

                                    if (
                                        response.status <
                                        200 ||
                                        response.status >=
                                        300
                                    ) {

                                        reject(
                                            new Error(
                                                "HTTP " +
                                                response.status +
                                                ": " +
                                                (
                                                    data?.error?.message ||
                                                    "API error"
                                                )
                                            )
                                        );

                                        return;
                                    }

                                    resolve(data);
                                },

                            onerror:
                                () => {

                                    if (finished)
                                        return;

                                    finished = true;

                                    reject(
                                        new Error(
                                            "Không thể kết nối Groq."
                                        )
                                    );
                                },

                            ontimeout:
                                () => {

                                    if (finished)
                                        return;

                                    finished = true;

                                    reject(
                                        new Error(
                                            "Request timeout."
                                        )
                                    );
                                },

                            onabort:
                                () => {

                                    if (finished)
                                        return;

                                    finished = true;

                                    const e =
                                        new Error(
                                            "Đã dừng yêu cầu."
                                        );

                                    e.name =
                                        "AbortError";

                                    reject(e);
                                }

                        });

                } catch (error) {

                    reject(error);
                    return;
                }

                activeController =
                    {
                        abort: () => {

                            try {

                                req?.abort?.();

                            } catch {}

                            try {

                                controller.abort();

                            } catch {}

                        }
                    };

            }
        );
    }

    /* =========================================================
       BUILD AI REQUEST
    ========================================================= */

    function buildMessages(
        userText,
        liveState
    ) {

        const chat =
            getChat();

        const history =
            chat
                ? chat.messages
                    .slice(-20)
                    .map(msg => ({
                        role:
                            msg.role,
                        content:
                            msg.content
                    }))
                : [];

        const liveText =
            stateToText(
                liveState
            );

        const system = `

${KNOWLEDGE_BASE}

LIVE GAME STATE:
Dữ liệu được thu trực tiếp từ client ở thời điểm người dùng hỏi:

${liveText}

QUY TẮC LIVE DATA:

1. Không được nói rằng bạn nhìn thấy dữ liệu nếu state không có dữ liệu đó.

2. Nếu người dùng hỏi:
   "VR A1 bao lâu nữa?"
   hãy tìm timestamp/counter tương ứng trong state trước.

3. Nếu không có timestamp:
   nói rõ:
   "Hiện client chưa cung cấp timestamp spawn nên mình chưa thể tính chính xác."

4. Không được lấy mốc 10 phút rồi tự khẳng định
   rằng power chắc chắn còn X phút nếu không có
   thời điểm reset/ăn power.

5. Nếu leaderboard được đọc:
   hãy trả lời theo dữ liệu leaderboard hiện tại.

6. Nếu người dùng hỏi thông tin bên ngoài game:
   có thể trả lời theo kiến thức của model.
   Nhưng phải phân biệt rõ với Live Game State.

7. Chỉ trả lời khi có câu hỏi.

8. Trả lời tiếng Việt.

`;

        return [
            {
                role: "system",
                content: system
            },
            ...history,
            {
                role: "user",
                content: userText
            }
        ];
    }

    /* =========================================================
       SEND
    ========================================================= */

    async function sendMessage() {

        if (requestRunning)
            return;

        const text =
            input.value.trim();

        if (!text)
            return;

        if (!enabled)
            return;

        ensureChat();

        const chat =
            getChat();

        chat.messages.push({
            role: "user",
            content: text
        });

        if (
            chat.title ===
            "Cuộc trò chuyện mới"
        ) {

            chat.title =
                text.slice(0, 35);

        }

        input.value = "";

        saveChats();

        renderChatList();
        renderMessages();

        await askAI(text);
    }

    async function askAI(
        userText
    ) {

        if (!apiKey) {

            addAssistantStored(
                "⚠️ Chưa có Groq API Key.\n\n" +
                "Bấm ⚙️ Cài đặt để nhập key."
            );

            return;
        }

        const chat =
            getChat();

        if (!chat)
            return;

        setLoading(true);

        setStatus(
            "🎮 Đang đọc Live Game State..."
        );

        /*
         * Chụp state đúng thời điểm hỏi.
         */

        const liveState =
            collectLiveState();

        /*
         * Loading message không lưu vào chat.
         */

        const loading =
            addVisualMessage(
                "assistant",
                "⏳ Đang suy nghĩ..."
            );

        try {

            setStatus(
                "🤖 Đang hỏi Groq..."
            );

            const body = {

                model:
                    model,

                messages:
                    buildMessages(
                        userText,
                        liveState
                    ),

                temperature:
                    0.2,

                max_completion_tokens:
                    1200

            };

            const data =
                await requestGroq(
                    body
                );

            loading.remove();

            const answer =
                data
                    ?.choices?.[0]
                    ?.message
                    ?.content;

            if (!answer) {

                throw new Error(
                    "Groq không trả về nội dung."
                );
            }

            chat.messages.push({

                role:
                    "assistant",

                content:
                    answer

            });

            saveChats();

            renderMessages();

            setStatus(
                "Ready"
            );

        } catch (error) {

            loading.remove();

            if (
                error?.name ===
                "AbortError" ||
                /dừng/i.test(
                    error?.message || ""
                )
            ) {

                setStatus(
                    "⏹️ Đã dừng."
                );

            } else {

                addAssistantStored(
                    "❌ Lỗi:\n\n" +
                    error.message
                );

                setStatus(
                    "❌ Request lỗi"
                );
            }

        } finally {

            activeController =
                null;

            setLoading(false);

        }
    }

    function addAssistantStored(
        text
    ) {

        ensureChat();

        const chat =
            getChat();

        chat.messages.push({

            role:
                "assistant",

            content:
                text

        });

        saveChats();

        renderMessages();
    }

    /* =========================================================
       STOP
    ========================================================= */

    stopBtn.onclick = () => {

        if (!requestRunning)
            return;

        setStatus(
            "⏹️ Đang dừng..."
        );

        try {

            activeController?.abort?.();

        } catch {}

    };

    /* =========================================================
       REGENERATE
    ========================================================= */

    async function regenerate(
        index
    ) {

        if (requestRunning)
            return;

        const chat =
            getChat();

        if (!chat)
            return;

        if (
            chat.messages[index]
                ?.role !==
            "assistant"
        ) {
            return;
        }

        /*
         * Xóa câu trả lời cũ.
         */

        chat.messages.splice(
            index,
            1
        );

        /*
         * Tìm user message ngay trước nó.
         */

        let userMessage = null;

        for (
            let i = index - 1;
            i >= 0;
            i--
        ) {

            if (
                chat.messages[i]
                    ?.role ===
                "user"
            ) {

                userMessage =
                    chat.messages[i];

                break;
            }
        }

        if (!userMessage) {

            saveChats();
            renderMessages();
            return;
        }

        saveChats();
        renderMessages();

        await askAI(
            userMessage.content
        );
    }

    /* =========================================================
       BUTTONS
    ========================================================= */

    bubble.onclick = () => {

        if (!enabled)
            return;

        win.classList.toggle(
            "open"
        );

        if (
            win.classList.contains("open")
        ) {

            ensureChat();
            renderChatList();
            renderMessages();
            input.focus();

        }
    };

    document.getElementById(
        "agma-v10-close"
    ).onclick = () => {

        win.classList.remove(
            "open"
        );

    };

    document.getElementById(
        "agma-v10-toggle"
    ).onclick = () => {

        enabled =
            !enabled;

        localStorage.setItem(
            STORE.enabled,
            enabled
        );

        document.getElementById(
            "agma-v10-toggle"
        ).textContent =
            enabled
                ? "ON"
                : "OFF";

        bubble.classList.toggle(
            "off",
            !enabled
        );

        if (!enabled) {

            win.classList.remove(
                "open"
            );

            if (requestRunning) {

                try {

                    activeController
                        ?.abort?.();

                } catch {}

            }
        }
    };

    document.getElementById(
        "agma-v10-new"
    ).onclick = () => {

        newChat();

    };

    document.getElementById(
        "agma-v10-clear"
    ).onclick = () => {

        if (
            !confirm(
                "Xóa toàn bộ lịch sử chat?"
            )
        ) {
            return;
        }

        chats = [];

        currentChat = null;

        localStorage.removeItem(
            STORE.chats
        );

        localStorage.removeItem(
            STORE.current
        );

        newChat();
    };

    /* =========================================================
       LIVE STATE BUTTON
    ========================================================= */

    document.getElementById(
        "agma-v10-state-btn"
    ).onclick = () => {

        const state =
            collectLiveState();

        const text =
            JSON.stringify(
                state,
                null,
                2
            );

        addAssistantStored(
            "🎮 LIVE GAME STATE\n\n" +
            text
        );
    };

    /* =========================================================
       SETTINGS
    ========================================================= */

    const settings =
        document.getElementById(
            "agma-v10-settings"
        );

    document.getElementById(
        "agma-v10-settings-btn"
    ).onclick = () => {

        document.getElementById(
            "v10-url"
        ).value =
            apiURL;

        document.getElementById(
            "v10-key"
        ).value =
            apiKey;

        document.getElementById(
            "v10-model"
        ).value =
            model;

        settings.classList.add(
            "show"
        );
    };

    document.getElementById(
        "v10-cancel"
    ).onclick = () => {

        settings.classList.remove(
            "show"
        );

    };

    document.getElementById(
        "v10-save"
    ).onclick = () => {

        apiURL =
            document.getElementById(
                "v10-url"
            ).value.trim();

        apiKey =
            document.getElementById(
                "v10-key"
            ).value.trim();

        model =
            document.getElementById(
                "v10-model"
            ).value.trim();

        if (!apiURL) {

            apiURL =
                DEFAULT_URL;

        }

        if (!model) {

            model =
                DEFAULT_MODEL;

        }

        localStorage.setItem(
            STORE.url,
            apiURL
        );

        localStorage.setItem(
            STORE.key,
            apiKey
        );

        localStorage.setItem(
            STORE.model,
            model
        );

        settings.classList.remove(
            "show"
        );

        alert(
            "Đã lưu cấu hình Groq."
        );
    };

    /* =========================================================
       KEYBOARD
    ========================================================= */

    input.addEventListener(
        "keydown",
        e => {

            /*
             * Enter gửi.
             * Shift + Enter xuống dòng.
             */

            if (
                e.key === "Enter" &&
                !e.shiftKey
            ) {

                e.preventDefault();

                sendMessage();

            }

        }
    );

    /* =========================================================
       DRAG BUBBLE - PC
    ========================================================= */

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    bubble.addEventListener(
        "mousedown",
        e => {

            dragging = true;
            moved = false;

            startX =
                e.clientX;

            startY =
                e.clientY;

            const rect =
                bubble.getBoundingClientRect();

            offsetX =
                e.clientX -
                rect.left;

            offsetY =
                e.clientY -
                rect.top;

            e.preventDefault();
        }
    );

    document.addEventListener(
        "mousemove",
        e => {

            if (!dragging)
                return;

            if (
                Math.abs(
                    e.clientX -
                    startX
                ) > 5 ||
                Math.abs(
                    e.clientY -
                    startY
                ) > 5
            ) {

                moved = true;

            }

            if (!moved)
                return;

            bubble.style.left =
                (
                    e.clientX -
                    offsetX
                ) + "px";

            bubble.style.top =
                (
                    e.clientY -
                    offsetY
                ) + "px";

            bubble.style.right =
                "auto";

            bubble.style.bottom =
                "auto";

        }
    );

    document.addEventListener(
        "mouseup",
        () => {

            dragging = false;

        }
    );

    /* =========================================================
       TOUCH DRAG
    ========================================================= */

    bubble.addEventListener(
        "touchstart",
        e => {

            const t =
                e.touches[0];

            if (!t)
                return;

            const rect =
                bubble.getBoundingClientRect();

            offsetX =
                t.clientX -
                rect.left;

            offsetY =
                t.clientY -
                rect.top;

        },
        { passive: true }
    );

    /* =========================================================
       INIT
    ========================================================= */

    if (!chats.length) {

        newChat();

    } else {

        ensureChat();

    }

    bubble.classList.toggle(
        "off",
        !enabled
    );

    renderChatList();
    renderMessages();

    setStatus(
        "🎮 Live Game State sẵn sàng"
    );

})();
