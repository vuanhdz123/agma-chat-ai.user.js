// ==UserScript==
// @name         Agma.io - Chat AI V3 (Groq)
// @namespace    agma.chat.ai.v3.groq
// @version      3.0.0
// @description  Mini ChatGPT floating bubble for Agma.io - Groq
// @match        *://agma.io/*
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// ==/UserScript==

(function () {
    "use strict";

    /* =========================================================
       GROQ CONFIG
    ========================================================= */

    const DEFAULT_API_URL =
        "https://api.groq.com/openai/v1/chat/completions";

    const DEFAULT_MODEL =
        "openai/gpt-oss-120b";


    const STORAGE = {

        key: "agma_ai_groq_api_key",

        url: "agma_ai_groq_api_url",

        model: "agma_ai_groq_model",

        chats: "agma_ai_groq_chats",

        current: "agma_ai_groq_current",

        enabled: "agma_ai_groq_enabled"

    };


    let apiKey =
        localStorage.getItem(STORAGE.key) || "";


    let apiURL =
        localStorage.getItem(STORAGE.url) ||
        DEFAULT_API_URL;


    let model =
        localStorage.getItem(STORAGE.model) ||
        DEFAULT_MODEL;


    let chats =
        loadChats();


    let currentChat =
        localStorage.getItem(STORAGE.current);


    let enabled =
        localStorage.getItem(STORAGE.enabled) !==
        "false";


    /* =========================================================
       STORAGE
    ========================================================= */

    function loadChats() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    STORAGE.chats
                ) || "[]"
            );

        } catch {

            return [];

        }

    }


    function saveChats() {

        localStorage.setItem(
            STORAGE.chats,
            JSON.stringify(chats)
        );

    }


    function uid() {

        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .slice(2)
        );

    }


    function getChat() {

        return chats.find(
            chat =>
                chat.id === currentChat
        );

    }


    function newChat() {

        const chat = {

            id: uid(),

            title:
                "Cuộc trò chuyện mới",

            messages: [],

            created:
                Date.now()

        };


        chats.unshift(chat);


        currentChat =
            chat.id;


        localStorage.setItem(
            STORAGE.current,
            currentChat
        );


        saveChats();


        renderChatList();

        renderMessages();

    }


    function ensureChat() {

        if (
            !currentChat ||
            !getChat()
        ) {

            newChat();

        }

    }


    /* =========================================================
       ESCAPE
    ========================================================= */

    function esc(text) {

        return String(text)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            );

    }


    /* =========================================================
       CSS
    ========================================================= */

    const style =
        document.createElement(
            "style"
        );


    style.textContent = `

        #agma-ai-root,
        #agma-ai-root * {

            box-sizing: border-box;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

        }


        #agma-ai-bubble {

            position: fixed;

            right: 20px;
            bottom: 20px;

            width: 58px;
            height: 58px;

            border-radius: 50%;

            background:
                linear-gradient(
                    135deg,
                    #5865f2,
                    #7c4dff
                );

            color: white;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 27px;

            cursor: pointer;

            z-index: 2147483647;

            box-shadow:
                0 7px 30px
                rgba(0,0,0,.45);

            user-select: none;

            transition:
                transform .15s,
                opacity .15s;

        }


        #agma-ai-bubble:hover {

            transform:
                scale(1.07);

        }


        #agma-ai-bubble.off {

            opacity: .45;

        }


        #agma-ai-window {

            position: fixed;

            right: 20px;
            bottom: 90px;

            width: 720px;
            height: 620px;

            max-width:
                calc(100vw - 25px);

            max-height:
                calc(100vh - 110px);

            background:
                #171717;

            color: white;

            border:
                1px solid #343434;

            border-radius:
                14px;

            overflow: hidden;

            display: none;

            z-index: 2147483646;

            box-shadow:
                0 15px 60px
                rgba(0,0,0,.55);

        }


        #agma-ai-window.open {

            display: flex;

        }


        #agma-ai-sidebar {

            width: 190px;

            background:
                #101010;

            display: flex;

            flex-direction: column;

            border-right:
                1px solid #303030;

        }


        #agma-ai-new {

            margin: 10px;

            padding: 10px;

            border:
                1px solid #444;

            border-radius: 8px;

            background:
                #202020;

            color: white;

            cursor: pointer;

        }


        #agma-ai-new:hover {

            background:
                #292929;

        }


        #agma-ai-chat-list {

            flex: 1;

            overflow-y: auto;

            padding: 5px;

        }


        .agma-ai-chat-item {

            padding: 9px;

            margin-bottom: 3px;

            border-radius: 7px;

            cursor: pointer;

            white-space:
                nowrap;

            overflow: hidden;

            text-overflow:
                ellipsis;

            font-size: 13px;

        }


        .agma-ai-chat-item:hover {

            background:
                #242424;

        }


        .agma-ai-chat-item.active {

            background:
                #303030;

        }


        #agma-ai-side-buttons {

            padding: 8px;

        }


        .agma-side-btn {

            width: 100%;

            padding: 8px;

            margin-top: 5px;

            border: 0;

            border-radius: 7px;

            background:
                #202020;

            color: #ddd;

            cursor: pointer;

        }


        .agma-side-btn:hover {

            background:
                #303030;

        }


        #agma-ai-main {

            flex: 1;

            min-width: 0;

            display: flex;

            flex-direction: column;

        }


        #agma-ai-header {

            height: 52px;

            display: flex;

            align-items: center;

            justify-content:
                space-between;

            padding:
                0 14px;

            border-bottom:
                1px solid #303030;

            background:
                #191919;

        }


        #agma-ai-title {

            font-weight: 600;

        }


        #agma-ai-header-buttons {

            display: flex;

            gap: 6px;

        }


        .agma-header-btn {

            width: 34px;
            height: 34px;

            border: 0;

            border-radius: 7px;

            background:
                #272727;

            color: white;

            cursor: pointer;

        }


        #agma-ai-messages {

            flex: 1;

            overflow-y: auto;

            padding: 20px;

        }


        .agma-message {

            display: flex;

            margin-bottom: 18px;

            gap: 10px;

        }


        .agma-message.user {

            justify-content:
                flex-end;

        }


        .agma-avatar {

            width: 30px;
            height: 30px;

            min-width: 30px;

            border-radius: 7px;

            display: flex;

            align-items: center;

            justify-content: center;

            background:
                #5865f2;

        }


        .agma-message.user
        .agma-avatar {

            background:
                #444;

            order: 2;

        }


        .agma-content {

            max-width: 85%;

            padding:
                10px 13px;

            border-radius:
                10px;

            line-height:
                1.5;

            white-space:
                pre-wrap;

            word-break:
                break-word;

            background:
                #242424;

            font-size: 14px;

        }


        .agma-message.user
        .agma-content {

            background:
                #343541;

        }


        .agma-actions {

            display: flex;

            gap: 5px;

            margin-top: 5px;

        }


        .agma-action {

            border: 0;

            padding:
                4px 7px;

            border-radius: 5px;

            background:
                #303030;

            color: #aaa;

            cursor: pointer;

            font-size: 11px;

        }


        #agma-ai-input-area {

            padding: 12px;

            border-top:
                1px solid #303030;

            background:
                #191919;

        }


        #agma-ai-input-box {

            display: flex;

            gap: 8px;

            background:
                #242424;

            border:
                1px solid #444;

            border-radius:
                10px;

            padding: 7px;

        }


        #agma-ai-input {

            flex: 1;

            resize: none;

            height: 42px;

            max-height: 130px;

            border: 0;

            outline: 0;

            background:
                transparent;

            color: white;

            padding: 8px;

            font-size: 14px;

        }


        #agma-ai-send {

            width: 45px;

            border: 0;

            border-radius: 8px;

            background:
                #5865f2;

            color: white;

            cursor: pointer;

        }


        #agma-ai-send:disabled {

            opacity: .4;

        }


        #agma-ai-settings {

            position: absolute;

            inset: 0;

            background:
                rgba(0,0,0,.72);

            display: none;

            align-items: center;

            justify-content: center;

            z-index: 20;

        }


        #agma-ai-settings.show {

            display: flex;

        }


        #agma-ai-settings-box {

            width: 420px;

            max-width:
                calc(100vw - 30px);

            background:
                #202020;

            border:
                1px solid #444;

            border-radius:
                12px;

            padding: 18px;

        }


        .agma-setting-label {

            display: block;

            margin-top: 12px;

            margin-bottom: 5px;

            font-size: 12px;

            color: #aaa;

        }


        .agma-setting-input {

            width: 100%;

            padding: 9px;

            border:
                1px solid #444;

            border-radius: 7px;

            background:
                #111;

            color: white;

            outline: none;

        }


        #agma-ai-settings-buttons {

            display: flex;

            gap: 8px;

            margin-top: 15px;

        }


        .agma-settings-btn {

            flex: 1;

            padding: 9px;

            border: 0;

            border-radius: 7px;

            cursor: pointer;

        }


        #agma-ai-save-settings {

            background:
                #5865f2;

            color: white;

        }


        #agma-ai-cancel-settings {

            background:
                #333;

            color: white;

        }


        @media(max-width:600px) {

            #agma-ai-window {

                right: 8px;

                bottom: 75px;

                width:
                    calc(100vw - 16px);

                height:
                    calc(100vh - 90px);

            }


            #agma-ai-sidebar {

                width: 145px;

            }


            #agma-ai-messages {

                padding: 12px;

            }

        }


        @media(max-width:430px) {

            #agma-ai-sidebar {

                display: none;

            }


            #agma-ai-window {

                right: 5px;

                width:
                    calc(100vw - 10px);

            }

        }

    `;


    document.head.appendChild(style);


    /* =========================================================
       HTML
    ========================================================= */

    const root =
        document.createElement(
            "div"
        );


    root.id =
        "agma-ai-root";


    root.innerHTML = `

        <div id="agma-ai-bubble">
            🤖
        </div>


        <div id="agma-ai-window">

            <aside id="agma-ai-sidebar">

                <button id="agma-ai-new">
                    ＋ Chat mới
                </button>


                <div id="agma-ai-chat-list">
                </div>


                <div id="agma-ai-side-buttons">

                    <button
                        class="agma-side-btn"
                        id="agma-ai-settings-btn">

                        ⚙️ Cài đặt

                    </button>


                    <button
                        class="agma-side-btn"
                        id="agma-ai-clear-btn">

                        🗑️ Xóa lịch sử

                    </button>


                    <button
                        class="agma-side-btn"
                        id="agma-ai-export-btn">

                        📤 Xuất chat

                    </button>

                </div>

            </aside>


            <main id="agma-ai-main">

                <header id="agma-ai-header">

                    <span id="agma-ai-title">
                        Agma Chat AI
                    </span>


                    <div
                        id="agma-ai-header-buttons">

                        <button
                            class="agma-header-btn"
                            id="agma-ai-toggle">

                            ${enabled ? "ON" : "OFF"}

                        </button>


                        <button
                            class="agma-header-btn"
                            id="agma-ai-close">

                            ×

                        </button>

                    </div>

                </header>


                <div id="agma-ai-messages">
                </div>


                <div id="agma-ai-input-area">

                    <div id="agma-ai-input-box">

                        <textarea
                            id="agma-ai-input"
                            placeholder="Nhắn tin với AI..."
                        ></textarea>


                        <button
                            id="agma-ai-send">

                            ➤

                        </button>

                    </div>

                </div>

            </main>


            <div id="agma-ai-settings">

                <div id="agma-ai-settings-box">

                    <h3>
                        ⚙️ Cài đặt Groq AI
                    </h3>


                    <label
                        class="agma-setting-label">

                        API URL

                    </label>


                    <input
                        id="agma-setting-url"
                        class="agma-setting-input"
                    >


                    <label
                        class="agma-setting-label">

                        Groq API Key

                    </label>


                    <input
                        id="agma-setting-key"
                        type="password"
                        class="agma-setting-input"
                        placeholder="gsk_..."
                    >


                    <label
                        class="agma-setting-label">

                        Model

                    </label>


                    <input
                        id="agma-setting-model"
                        class="agma-setting-input"
                    >


                    <div
                        id="agma-ai-settings-buttons">

                        <button
                            id="agma-ai-cancel-settings"
                            class="agma-settings-btn">

                            Hủy

                        </button>


                        <button
                            id="agma-ai-save-settings"
                            class="agma-settings-btn">

                            Lưu

                        </button>

                    </div>

                </div>

            </div>

        </div>

    `;


    /* =========================================================
       WAIT FOR BODY
    ========================================================= */

    function mount() {

        if (!document.body) {

            setTimeout(
                mount,
                100
            );

            return;

        }


        if (
            document.getElementById(
                "agma-ai-root"
            )
        ) {

            return;

        }


        document.body.appendChild(root);

        init();

    }


    /* =========================================================
       ELEMENTS
    ========================================================= */

    let bubble;

    let windowEl;

    let messagesEl;

    let input;

    let sendBtn;


    function init() {

        bubble =
            document.getElementById(
                "agma-ai-bubble"
            );


        windowEl =
            document.getElementById(
                "agma-ai-window"
            );


        messagesEl =
            document.getElementById(
                "agma-ai-messages"
            );


        input =
            document.getElementById(
                "agma-ai-input"
            );


        sendBtn =
            document.getElementById(
                "agma-ai-send"
            );


        setupEvents();


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

    }


    /* =========================================================
       OPEN / CLOSE
    ========================================================= */

    function setupEvents() {

        bubble.onclick = () => {

            if (!enabled)
                return;


            windowEl.classList.toggle(
                "open"
            );


            if (
                windowEl.classList.contains(
                    "open"
                )
            ) {

                ensureChat();

                renderChatList();

                renderMessages();

                input.focus();

            }

        };


        document.getElementById(
            "agma-ai-close"
        ).onclick = () => {

            windowEl.classList.remove(
                "open"
            );

        };


        /* ON/OFF */

        document.getElementById(
            "agma-ai-toggle"
        ).onclick = () => {

            enabled =
                !enabled;


            localStorage.setItem(
                STORAGE.enabled,
                enabled
            );


            document.getElementById(
                "agma-ai-toggle"
            ).textContent =
                enabled
                    ? "ON"
                    : "OFF";


            bubble.classList.toggle(
                "off",
                !enabled
            );


            if (!enabled) {

                windowEl.classList.remove(
                    "open"
                );

            }

        };


        /* NEW CHAT */

        document.getElementById(
            "agma-ai-new"
        ).onclick =
            newChat;


        /* SEND */

        sendBtn.onclick =
            sendMessage;


        input.addEventListener(
            "keydown",
            e => {

                if (
                    e.key === "Enter" &&
                    !e.shiftKey
                ) {

                    e.preventDefault();

                    sendMessage();

                }

            }
        );


        /* SETTINGS */

        document.getElementById(
            "agma-ai-settings-btn"
        ).onclick =
            openSettings;


        document.getElementById(
            "agma-ai-cancel-settings"
        ).onclick = () => {

            document.getElementById(
                "agma-ai-settings"
            ).classList.remove(
                "show"
            );

        };


        document.getElementById(
            "agma-ai-save-settings"
        ).onclick =
            saveSettings;


        /* CLEAR */

        document.getElementById(
            "agma-ai-clear-btn"
        ).onclick =
            clearHistory;


        /* EXPORT */

        document.getElementById(
            "agma-ai-export-btn"
        ).onclick =
            exportChat;


        setupDrag();

    }


    /* =========================================================
       CHAT LIST
    ========================================================= */

    function renderChatList() {

        const list =
            document.getElementById(
                "agma-ai-chat-list"
            );


        list.innerHTML = "";


        chats.forEach(
            chat => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "agma-ai-chat-item" +
                    (
                        chat.id ===
                        currentChat
                            ? " active"
                            : ""
                    );


                item.textContent =
                    chat.title ||
                    "Cuộc trò chuyện";


                item.onclick = () => {

                    currentChat =
                        chat.id;


                    localStorage.setItem(
                        STORAGE.current,
                        currentChat
                    );


                    renderChatList();

                    renderMessages();

                };


                list.appendChild(
                    item
                );

            }
        );

    }


    /* =========================================================
       RENDER MESSAGES
    ========================================================= */

    function renderMessages() {

        ensureChat();


        const chat =
            getChat();


        messagesEl.innerHTML = "";


        if (
            !chat.messages.length
        ) {

            const welcome =
                document.createElement(
                    "div"
                );


            welcome.className =
                "agma-message";


            welcome.innerHTML = `

                <div
                    class="agma-avatar">

                    🤖

                </div>


                <div
                    class="agma-content">

                    Xin chào 👋
                    <br><br>

                    Mình là AI của bạn.
                    <br>
                    Đang sử dụng Groq.

                </div>

            `;


            messagesEl.appendChild(
                welcome
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


    function renderMessage(
        msg,
        index
    ) {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "agma-message " +
            msg.role;


        row.innerHTML = `

            <div
                class="agma-avatar">

                ${
                    msg.role === "user"
                        ? "👤"
                        : "🤖"
                }

            </div>


            <div>

                <div
                    class="agma-content">

                    ${formatText(
                        msg.content
                    )}

                </div>


                <div
                    class="agma-actions">

                    <button
                        class="agma-action copy-btn">

                        📋 Copy

                    </button>


                    ${
                        msg.role ===
                        "assistant"

                            ? `

                                <button
                                    class="agma-action regen-btn">

                                    🔄 Tạo lại

                                </button>

                              `

                            : ""

                    }

                </div>

            </div>

        `;


        row.querySelector(
            ".copy-btn"
        ).onclick = () => {

            if (
                navigator.clipboard
            ) {

                navigator.clipboard
                    .writeText(
                        msg.content
                    );

            }

        };


        const regen =
            row.querySelector(
                ".regen-btn"
            );


        if (regen) {

            regen.onclick = () => {

                regenerate(
                    index
                );

            };

        }


        messagesEl.appendChild(
            row
        );

    }


    function formatText(
        text
    ) {

        let html =
            esc(text);


        html =
            html.replace(
                /```([\s\S]*?)```/g,

                `<pre
                    style="
                        background:#111;
                        padding:10px;
                        border-radius:7px;
                        overflow:auto;
                    "
                >$1</pre>`

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


    /* =========================================================
       REGENERATE
    ========================================================= */

    async function regenerate(
        index
    ) {

        const chat =
            getChat();


        if (!chat)
            return;


        const msg =
            chat.messages[index];


        if (
            !msg ||
            msg.role !==
                "assistant"
        )
            return;


        chat.messages.splice(
            index,
            1
        );


        saveChats();


        renderMessages();


        await sendToAI();

    }


    /* =========================================================
       SEND MESSAGE
    ========================================================= */

    async function sendMessage() {

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

            role:
                "user",

            content:
                text

        });


        if (
            chat.title ===
            "Cuộc trò chuyện mới"
        ) {

            chat.title =
                text.slice(
                    0,
                    35
                );

        }


        input.value = "";


        saveChats();

        renderMessages();


        await sendToAI();

    }


    /* =========================================================
       GROQ API
    ========================================================= */

    async function sendToAI() {

        if (!apiKey) {

            addAssistantMessage(

                "⚠️ Bạn chưa nhập Groq API Key.\n\n" +

                "Bấm ⚙️ Cài đặt → nhập API Key Groq.\n\n" +

                "Key thường bắt đầu bằng gsk_..."

            );

            return;

        }


        const chat =
            getChat();


        if (!chat)
            return;


        sendBtn.disabled =
            true;


        const loading =
            addAssistantMessage(
                "⏳ AI đang suy nghĩ..."
            );


        const body = {

            model:
                model,

            messages:
                chat.messages,

            temperature:
                0.7,

            max_tokens:
                2048

        };


        try {

            const response =
                await requestAPI(
                    body
                );


            if (!response.ok) {

                let errorText =
                    response.text ||
                    "Groq API trả về lỗi.";


                throw new Error(

                    "HTTP " +
                    response.status +
                    ": " +
                    errorText

                );

            }


            const answer =
                extractResponseText(
                    response.data
                );


            if (!answer) {

                throw new Error(
                    "Groq không trả về nội dung."
                );

            }


            loading.remove();


            chat.messages.push({

                role:
                    "assistant",

                content:
                    answer

            });


            saveChats();


            renderMessages();


        } catch (error) {

            loading.remove();


            addAssistantMessage(

                "❌ Lỗi Groq API:\n\n" +
                error.message

            );


            console.error(
                "[Agma Chat AI V3]",
                error
            );

        } finally {

            sendBtn.disabled =
                false;

        }

    }


    /* =========================================================
       REQUEST
    ========================================================= */

    function requestAPI(
        body
    ) {

        return new Promise(
            resolve => {

                GM_xmlhttpRequest({

                    method:
                        "POST",

                    url:
                        apiURL,

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " +
                            apiKey

                    },

                    data:
                        JSON.stringify(
                            body
                        ),

                    timeout:
                        120000,


                    onload:
                        response => {

                            let data;


                            try {

                                data =
                                    JSON.parse(
                                        response.responseText
                                    );

                            } catch {

                                resolve({

                                    ok:
                                        false,

                                    status:
                                        response.status,

                                    text:
                                        response.responseText

                                });

                                return;

                            }


                            resolve({

                                ok:
                                    response.status >=
                                        200 &&
                                    response.status <
                                        300,

                                status:
                                    response.status,

                                data:
                                    data,

                                text:
                                    data?.error?.message ||
                                    ""

                            });

                        },


                    onerror:
                        () => {

                            resolve({

                                ok:
                                    false,

                                status:
                                    0,

                                text:
                                    "Không thể kết nối tới Groq."

                            });

                        },


                    ontimeout:
                        () => {

                            resolve({

                                ok:
                                    false,

                                status:
                                    0,

                                text:
                                    "Groq API timeout."

                            });

                        }

                });

            }
        );

    }


    /* =========================================================
       EXTRACT RESPONSE
    ========================================================= */

    function extractResponseText(
        data
    ) {

        if (
            data &&
            Array.isArray(
                data.choices
            )
        ) {

            const choice =
                data.choices[0];


            if (
                choice &&
                choice.message
            ) {

                return (
                    choice.message.content ||
                    ""
                );

            }

        }


        return "";

    }


    /* =========================================================
       TEMP ASSISTANT MESSAGE
    ========================================================= */

    function addAssistantMessage(
        text
    ) {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "agma-message assistant";


        row.innerHTML = `

            <div
                class="agma-avatar">

                🤖

            </div>


            <div
                class="agma-content">

                ${formatText(
                    text
                )}

            </div>

        `;


        messagesEl.appendChild(
            row
        );


        scrollBottom();


        return row;

    }


    /* =========================================================
       SETTINGS
    ========================================================= */

    function openSettings() {

        document.getElementById(
            "agma-setting-url"
        ).value =
            apiURL;


        document.getElementById(
            "agma-setting-key"
        ).value =
            apiKey;


        document.getElementById(
            "agma-setting-model"
        ).value =
            model;


        document.getElementById(
            "agma-ai-settings"
        ).classList.add(
            "show"
        );

    }


    function saveSettings() {

        apiURL =
            document.getElementById(
                "agma-setting-url"
            ).value.trim();


        apiKey =
            document.getElementById(
                "agma-setting-key"
            ).value.trim();


        model =
            document.getElementById(
                "agma-setting-model"
            ).value.trim();


        if (!apiURL) {

            apiURL =
                DEFAULT_API_URL;

        }


        if (!model) {

            model =
                DEFAULT_MODEL;

        }


        localStorage.setItem(
            STORAGE.key,
            apiKey
        );


        localStorage.setItem(
            STORAGE.url,
            apiURL
        );


        localStorage.setItem(
            STORAGE.model,
            model
        );


        document.getElementById(
            "agma-ai-settings"
        ).classList.remove(
            "show"
        );


        alert(
            "✅ Đã lưu cài đặt Groq."
        );

    }


    /* =========================================================
       CLEAR HISTORY
    ========================================================= */

    function clearHistory() {

        if (
            !confirm(
                "Xóa toàn bộ lịch sử chat?"
            )
        )
            return;


        chats = [];

        currentChat =
            null;


        localStorage.removeItem(
            STORAGE.chats
        );


        localStorage.removeItem(
            STORAGE.current
        );


        newChat();

    }


    /* =========================================================
       EXPORT
    ========================================================= */

    function exportChat() {

        const chat =
            getChat();


        if (!chat)
            return;


        let text =
            "AGMA CHAT AI V3\n\n";


        text +=
            chat.title +
            "\n\n";


        chat.messages.forEach(
            msg => {

                text +=

                    (
                        msg.role ===
                            "user"
                            ? "Bạn"
                            : "AI"
                    ) +

                    ":\n" +

                    msg.content +

                    "\n\n";

            }
        );


        const blob =
            new Blob(
                [text],
                {
                    type:
                        "text/plain;charset=utf-8"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                "a"
            );


        a.href =
            url;


        a.download =
            "agma-chat-ai-v3.txt";


        document.body.appendChild(a);


        a.click();


        a.remove();


        URL.revokeObjectURL(
            url
        );

    }


    /* =========================================================
       DRAG BUBBLE
    ========================================================= */

    function setupDrag() {

        let dragging =
            false;


        let offsetX =
            0;


        let offsetY =
            0;


        bubble.addEventListener(
            "mousedown",
            e => {

                dragging =
                    true;


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


                bubble.style.left =
                    (
                        e.clientX -
                        offsetX
                    ) +
                    "px";


                bubble.style.top =
                    (
                        e.clientY -
                        offsetY
                    ) +
                    "px";


                bubble.style.right =
                    "auto";


                bubble.style.bottom =
                    "auto";

            }
        );


        document.addEventListener(
            "mouseup",
            () => {

                dragging =
                    false;

            }
        );


        /* Mobile touch */

        bubble.addEventListener(
            "touchstart",
            e => {

                const touch =
                    e.touches[0];


                const rect =
                    bubble.getBoundingClientRect();


                offsetX =
                    touch.clientX -
                    rect.left;


                offsetY =
                    touch.clientY -
                    rect.top;

            },
            {
                passive: true
            }
        );


        bubble.addEventListener(
            "touchmove",
            e => {

                const touch =
                    e.touches[0];


                bubble.style.left =
                    (
                        touch.clientX -
                        offsetX
                    ) +
                    "px";


                bubble.style.top =
                    (
                        touch.clientY -
                        offsetY
                    ) +
                    "px";


                bubble.style.right =
                    "auto";


                bubble.style.bottom =
                    "auto";

            },
            {
                passive: true
            }
        );

    }


    /* =========================================================
       START
    ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            mount
        );

    } else {

        mount();

    }

})();
