// ==UserScript==
// @name         Agma.io AI V9 - Live Game + Web + Power Tracker
// @namespace    agma.ai.v9
// @version      9.0.0
// @description  Agma AI assistant with Live State, Web Search, Power Tracker, Chat Memory and Stop
// @match        *://agma.io/*
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    /* =========================================================
       CONFIG
    ========================================================= */

    const CFG = {

        API:
            "https://api.groq.com/openai/v1/chat/completions",

        NORMAL_MODEL:
            "llama-3.1-8b-instant",

        WEB_MODEL:
            "groq/compound",

        MAX_HISTORY:
            14,

        MAX_OUTPUT:
            900,

        REQUEST_TIMEOUT:
            60000,

        STATE_INTERVAL:
            1000,

        POWER_INTERVAL:
            500

    };


    /* =========================================================
       STORAGE
    ========================================================= */

    const STORE = {

        KEY:
            "agma_v9_groq_key",

        MODEL:
            "agma_v9_model",

        CHATS:
            "agma_v9_chats",

        CURRENT:
            "agma_v9_current",

        POWER:
            "agma_v9_power_tracker"

    };


    let apiKey =
        localStorage.getItem(
            STORE.KEY
        ) || "";


    let model =
        localStorage.getItem(
            STORE.MODEL
        ) ||
        CFG.NORMAL_MODEL;


    let chats =
        loadJSON(
            STORE.CHATS,
            []
        );


    let currentChat =
        localStorage.getItem(
            STORE.CURRENT
        );


    let busy =
        false;


    let stopRequested =
        false;


    let activeRequest =
        null;


    let requestID =
        0;


    /* =========================================================
       UTIL
    ========================================================= */

    function loadJSON(
        key,
        fallback
    ) {

        try {

            const x =
                JSON.parse(
                    localStorage.getItem(
                        key
                    ) || "null"
                );

            return x ?? fallback;

        } catch {

            return fallback;

        }

    }


    function saveJSON(
        key,
        value
    ) {

        localStorage.setItem(
            key,
            JSON.stringify(
                value
            )
        );

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
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


    function uid() {

        return (
            Date.now()
                .toString(36) +

            Math.random()
                .toString(36)
                .slice(2)
        );

    }


    /* =========================================================
       CHAT
    ========================================================= */

    function newChat() {

        const chat = {

            id:
                uid(),

            title:
                "Cuộc trò chuyện mới",

            messages:
                [],

            created:
                Date.now()

        };


        chats.unshift(
            chat
        );


        currentChat =
            chat.id;


        localStorage.setItem(
            STORE.CURRENT,
            currentChat
        );


        saveJSON(
            STORE.CHATS,
            chats
        );


        renderChats();

        renderMessages();

    }


    function getChat() {

        let chat =
            chats.find(
                x =>
                    x.id ===
                    currentChat
            );


        if (!chat) {

            newChat();

            chat =
                chats.find(
                    x =>
                        x.id ===
                        currentChat
                );

        }


        return chat;

    }


    function saveChats() {

        saveJSON(
            STORE.CHATS,
            chats
        );

    }


    /* =========================================================
       GAME STATE
    ========================================================= */

    const STATE = {

        updated:
            0,

        url:
            location.href,

        server:
            null,

        room:
            null,

        player:
            {

                name:
                    null,

                mass:
                    null,

                score:
                    null,

                x:
                    null,

                y:
                    null

            },

        leaderboard:
            [],

        visiblePowers:
            [],

        websocket:
            {

                detected:
                    false,

                messages:
                    0,

                lastMessage:
                    0,

                lastText:
                    ""

            }

    };


    /* =========================================================
       POWER TRACKER
    ========================================================= */

    const POWER_INFO = {

        VR: {

            duration:
                10 * 60,

            label:
                "VR"

        },

        PELLET: {

            duration:
                10 * 60,

            label:
                "Pellet"

        },

        ANTI: {

            duration:
                10 * 60,

            label:
                "Anti"

        },

        PORTAL: {

            duration:
                12 * 60 + 40,

            label:
                "Portal"

        },

        FRV: {

            duration:
                7 * 60 + 30,

            label:
                "FRV"

        }

    };


    const POWER_LOCATIONS = [

        "A1",
        "A5",
        "C1",
        "C5",
        "E1",
        "E5"

    ];


    let powerTracker =
        loadJSON(
            STORE.POWER,
            {}
        );


    /*
     * Structure:
     *
     * powerTracker.A1.VR = {
     *    lastEvent: timestamp,
     *    source: "..."
     * }
     */


    function savePowerTracker() {

        saveJSON(
            STORE.POWER,
            powerTracker
        );

    }


    function ensurePower(
        location,
        type
    ) {

        if (
            !powerTracker[
                location
            ]
        ) {

            powerTracker[
                location
            ] = {};

        }


        if (
            !powerTracker[
                location
            ][type]
        ) {

            powerTracker[
                location
            ][type] = {

                lastEvent:
                    null,

                source:
                    null

            };

        }


        return powerTracker[
            location
        ][type];

    }


    function formatTime(
        seconds
    ) {

        seconds =
            Math.max(
                0,
                Math.floor(
                    seconds
                )
            );


        const m =
            Math.floor(
                seconds / 60
            );


        const s =
            seconds % 60;


        return (
            String(m)
                .padStart(2, "0") +

            ":" +

            String(s)
                .padStart(2, "0")
        );

    }


    function powerCountdown(
        location,
        type
    ) {

        const info =
            POWER_INFO[type];


        const data =
            powerTracker
                ?.[location]
                ?.[type];


        if (
            !info ||
            !data ||
            !data.lastEvent
        ) {

            return {

                known:
                    false,

                seconds:
                    null,

                text:
                    "chưa có timestamp"

            };

        }


        const elapsed =
            (
                Date.now() -
                data.lastEvent
            ) / 1000;


        let remaining =
            info.duration -
            elapsed;


        /*
         * Nếu đã vượt chu kỳ,
         * có thể đã sang spawn kế tiếp.
         *
         * Không tự reset vô điều kiện vì
         * như vậy dễ tạo countdown giả.
         */

        if (
            remaining < 0
        ) {

            return {

                known:
                    false,

                seconds:
                    0,

                text:
                    "đã vượt chu kỳ - cần sự kiện mới"

            };

        }


        return {

            known:
                true,

            seconds:
                remaining,

            text:
                formatTime(
                    remaining
                )

        };

    }


    function buildPowerState() {

        const result = {};


        POWER_LOCATIONS.forEach(
            location => {

                result[
                    location
                ] = {};


                Object.keys(
                    POWER_INFO
                ).forEach(
                    type => {

                        result[
                            location
                        ][type] =
                            powerCountdown(
                                location,
                                type
                            );

                    }
                );

            }
        );


        return result;

    }


    /* =========================================================
       POWER EVENT DETECTION
    ========================================================= */

    function detectPowerEvent(
        text
    ) {

        if (!text)
            return;


        const lower =
            text.toLowerCase();


        let type =
            null;


        if (
            /\bfrv\b/.test(
                lower
            ) ||
            lower.includes(
                "frozen virus"
            )
        ) {

            type =
                "FRV";

        } else if (
            lower.includes(
                "portal"
            )
        ) {

            type =
                "PORTAL";

        } else if (
            lower.includes(
                "anti"
            )
        ) {

            type =
                "ANTI";

        } else if (
            lower.includes(
                "pellet"
            )
        ) {

            type =
                "PELLET";

        } else if (
            lower.includes(
                "virus"
            )
        ) {

            type =
                "VR";

        }


        if (!type)
            return;


        let location =
            null;


        POWER_LOCATIONS.some(
            item => {

                if (
                    lower.includes(
                        item.toLowerCase()
                    )
                ) {

                    location =
                        item;

                    return true;

                }

                return false;

            }
        );


        if (!location)
            return;


        /*
         * Chỉ cập nhật nếu text có dấu hiệu
         * sự kiện spawn/ăn/biến mất.
         */

        const eventWords = [

            "spawn",
            "spawned",
            "appear",
            "appeared",
            "eat",
            "eaten",
            "consume",
            "collected",
            "collect",
            "pickup",
            "picked",
            "destroy",
            "destroyed",
            "gone",
            "removed"

        ];


        const eventDetected =
            eventWords.some(
                word =>
                    lower.includes(
                        word
                    )
            );


        if (
            !eventDetected
        )
            return;


        const data =
            ensurePower(
                location,
                type
            );


        data.lastEvent =
            Date.now();


        data.source =
            "game-text";


        savePowerTracker();

    }


    /* =========================================================
       DOM SCANNER
    ========================================================= */

    function scanGameText() {

        if (
            !document.body
        )
            return;


        let text =
            "";


        try {

            text =
                String(
                    document.body.innerText ||
                    ""
                );

        } catch {

            return;

        }


        detectServerRoom(
            text
        );


        detectPlayer(
            text
        );


        detectPowerEvent(
            text
        );


        detectLeaderboard();

    }


    function detectServerRoom(
        text
    ) {

        const serverRegex = [

            /\bserver\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /\bserver\s+([A-Za-z0-9_-]+)/i

        ];


        const roomRegex = [

            /\broom\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /\broom\s+([A-Za-z0-9_-]+)/i

        ];


        for (
            const regex of
            serverRegex
        ) {

            const m =
                text.match(
                    regex
                );


            if (m) {

                STATE.server =
                    m[1];

                break;

            }

        }


        for (
            const regex of
            roomRegex
        ) {

            const m =
                text.match(
                    regex
                );


            if (m) {

                STATE.room =
                    m[1];

                break;

            }

        }

    }


    function detectPlayer(
        text
    ) {

        const patterns = {

            mass:
                /\bmass\s*[:=]\s*([\d,.]+)/i,

            score:
                /\bscore\s*[:=]\s*([\d,.]+)/i,

            x:
                /\bx\s*[:=]\s*(-?[\d,.]+)/i,

            y:
                /\by\s*[:=]\s*(-?[\d,.]+)/i

        };


        Object.keys(
            patterns
        ).forEach(
            key => {

                const m =
                    text.match(
                        patterns[key]
                    );


                if (m) {

                    const n =
                        Number(
                            String(
                                m[1]
                            )
                                .replace(
                                    /,/g,
                                    ""
                                )
                        );


                    if (
                        Number.isFinite(
                            n
                        )
                    ) {

                        STATE.player[
                            key
                        ] = n;

                    }

                }

            }
        );

    }


    function detectLeaderboard() {

        const selectors = [

            '[id*="leaderboard" i]',

            '[class*="leaderboard" i]',

            '[id*="ranking" i]',

            '[class*="ranking" i]'

        ];


        const found =
            [];


        selectors.forEach(
            selector => {

                try {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            el => {

                                if (
                                    !found.includes(
                                        el
                                    )
                                ) {

                                    found.push(
                                        el
                                    );

                                }

                            }
                        );

                } catch {}

            }
        );


        const result =
            [];


        found.forEach(
            el => {

                const lines =
                    String(
                        el.innerText ||
                        ""
                    )
                        .split(
                            "\n"
                        )
                        .map(
                            x =>
                                x.trim()
                        )
                        .filter(
                            Boolean
                        );


                lines.forEach(
                    line => {

                        const m =
                            line.match(
                                /^(\d{1,2})[\s.)-]+(.+)$/
                            );


                        if (m) {

                            result.push({

                                rank:
                                    Number(
                                        m[1]
                                    ),

                                name:
                                    m[2]

                            });

                        }

                    }
                );

            }
        );


        const unique =
            [];


        const seen =
            new Set();


        result.forEach(
            item => {

                const key =
                    item.rank +
                    "|" +
                    item.name;


                if (
                    seen.has(key)
                )
                    return;


                seen.add(
                    key
                );


                unique.push(
                    item
                );

            }
        );


        if (
            unique.length
        ) {

            STATE.leaderboard =
                unique.slice(
                    0,
                    20
                );

        }

    }


    /* =========================================================
       WEBSOCKET OBSERVER
    ========================================================= */

    function installWebSocketObserver() {

        if (
            window.__AGMA_AI_WS_HOOKED__
        )
            return;


        window.__AGMA_AI_WS_HOOKED__ =
            true;


        const OriginalWS =
            window.WebSocket;


        if (
            !OriginalWS
        )
            return;


        function WrappedWebSocket(
            ...args
        ) {

            const ws =
                new OriginalWS(
                    ...args
                );


            STATE.websocket.detected =
                true;


            try {

                ws.addEventListener(
                    "message",
                    event => {

                        STATE.websocket.messages++;

                        STATE.websocket.lastMessage =
                            Date.now();


                        let text =
                            "";


                        if (
                            typeof event.data ===
                            "string"
                        ) {

                            text =
                                event.data;

                        } else {

                            try {

                                text =
                                    new TextDecoder()
                                        .decode(
                                            event.data
                                        );

                            } catch {}

                        }


                        STATE.websocket.lastText =
                            String(
                                text
                            ).slice(
                                0,
                                500
                            );


                        /*
                         * Chỉ dùng dữ liệu có thể
                         * quan sát được.
                         */

                        detectPowerEvent(
                            String(
                                text
                            )
                        );

                    }
                );

            } catch {}



            return ws;

        }


        WrappedWebSocket.prototype =
            OriginalWS.prototype;


        Object.keys(
            OriginalWS
        ).forEach(
            key => {

                try {

                    WrappedWebSocket[
                        key
                    ] =
                        OriginalWS[
                            key
                        ];

                } catch {}

            }
        );


        window.WebSocket =
            WrappedWebSocket;

    }


    /* =========================================================
       SNAPSHOT
    ========================================================= */

    function getSnapshot() {

        scanGameText();


        STATE.updated =
            Date.now();


        return {

            url:
                STATE.url,

            server:
                STATE.server,

            room:
                STATE.room,

            player:
                {
                    ...STATE.player
                },

            leaderboard:
                STATE.leaderboard
                    .slice(
                        0,
                        20
                    ),

            visiblePowers:
                STATE.visiblePowers,

            websocket:
                {
                    ...STATE.websocket,

                    lastText:
                        STATE.websocket
                            .lastText
                            ?.slice(
                                0,
                                300
                            )
                },

            powerTimers:
                buildPowerState(),

            updated:
                STATE.updated

        };

    }


    window.AGMA_AI_STATE =
        getSnapshot;


    /* =========================================================
       KNOWLEDGE BASE
    ========================================================= */

    const KNOWLEDGE = `

Bạn là Agma AI Assistant.

Bạn hỗ trợ người chơi Agma.io.

Nhiệm vụ:

1. Hiểu câu hỏi tự nhiên.
2. Hiểu ngữ cảnh hội thoại.
3. Dùng dữ liệu Live Game State nếu có.
4. Dùng Power Tracker nếu có timestamp.
5. Khi câu hỏi cần thông tin mới, dùng model có web-search.
6. Không bịa dữ liệu realtime.

========================
AGMA
========================

Agma.io là game multiplayer
dạng cell/eat-and-grow.

Các khái niệm:

cell
player
mass
score
leaderboard
server
room
map
party
team
virus
pellet
portal
power
feed
split
eject
respawn

========================
POWER
========================

VR:
10:00

Pellet:
10:00

Anti:
10:00

Portal:
12:40

FRV:
07:30

Các khu vực người dùng quan tâm:

A1
A5
C1
C5
E1
E5

========================
POWER TIMER
========================

Chu kỳ trên chỉ là duration.

Muốn biết countdown thực tế phải có
timestamp event.

Nếu timer chưa có timestamp:

KHÔNG được tự đoán.

Phải nói:

"Chưa có timestamp spawn/ăn thực tế để tính chính xác."

========================
LIVE STATE
========================

Có thể chứa:

server
room
player
mass
score
x
y
leaderboard
websocket
power timers

Dữ liệu null nghĩa là chưa đọc được.

========================
WEB
========================

Nếu câu hỏi cần:

tin tức
thông tin mới
sự kiện hôm nay
thời tiết
giá
thông tin website
thông tin mới trên Internet

hãy sử dụng khả năng web-search của model nếu model hiện tại hỗ trợ.

Không được giả vờ đã tìm web nếu không có kết quả.

========================
TRẢ LỜI
========================

Tiếng Việt.

Câu hỏi đơn giản:
trả lời ngắn.

Câu hỏi realtime:
ưu tiên Live State.

Câu hỏi power:
ưu tiên Power Tracker.

Không tự gửi thông báo.

Chỉ trả lời khi user hỏi.

`;


    /* =========================================================
       ROUTER
    ========================================================= */

    function needsWeb(
        question
    ) {

        const q =
            question
                .toLowerCase();


        const words = [

            "tin mới",
            "tin tức",
            "hôm nay",
            "mới nhất",
            "latest",
            "news",
            "thời tiết",
            "weather",
            "giá",
            "price",
            "hiện tại",
            "2026",
            "website",
            "internet",
            "online",
            "mới xảy ra"

        ];


        return words.some(
            word =>
                q.includes(
                    word
                )
        );

    }


    function chooseModel(
        question
    ) {

        return needsWeb(
            question
        )
            ? CFG.WEB_MODEL
            : model;

    }


    /* =========================================================
       REQUEST
    ========================================================= */

    function requestGroq(
        messages,
        selectedModel,
        id
    ) {

        return new Promise(
            resolve => {

                let done =
                    false;


                function finish(
                    result
                ) {

                    if (
                        done
                    )
                        return;


                    done =
                        true;


                    resolve(
                        result
                    );

                }


                const xhr =
                    GM_xmlhttpRequest({

                        method:
                            "POST",

                        url:
                            CFG.API,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " +
                                apiKey

                        },

                        data:
                            JSON.stringify({

                                model:
                                    selectedModel,

                                messages:
                                    messages,

                                temperature:
                                    0.2,

                                max_tokens:
                                    CFG.MAX_OUTPUT

                            }),

                        timeout:
                            CFG.REQUEST_TIMEOUT,


                        onload:
                            response => {

                                if (
                                    id !==
                                    requestID ||
                                    stopRequested
                                ) {

                                    finish({

                                        ok:
                                            false,

                                        stopped:
                                            true

                                    });

                                    return;

                                }


                                let data;


                                try {

                                    data =
                                        JSON.parse(
                                            response.responseText
                                        );

                                } catch {

                                    finish({

                                        ok:
                                            false,

                                        error:
                                            "Groq trả về dữ liệu không hợp lệ."

                                    });

                                    return;

                                }


                                if (
                                    response.status <
                                        200 ||
                                    response.status >=
                                        300
                                ) {

                                    finish({

                                        ok:
                                            false,

                                        error:

                                            data
                                                ?.error
                                                ?.message ||

                                            `HTTP ${response.status}`

                                    });

                                    return;

                                }


                                const answer =
                                    data
                                        ?.choices
                                        ?.[0]
                                        ?.message
                                        ?.content;


                                if (
                                    !answer
                                ) {

                                    finish({

                                        ok:
                                            false,

                                        error:
                                            "AI không trả về nội dung."

                                    });

                                    return;

                                }


                                finish({

                                    ok:
                                        true,

                                    answer:
                                        String(
                                            answer
                                        ).trim()

                                });

                            },


                        onerror:
                            () => {

                                finish({

                                    ok:
                                        false,

                                    stopped:
                                        stopRequested,

                                    error:
                                        stopRequested
                                            ? "Đã dừng."
                                            : "Không kết nối được Groq."

                                });

                            },


                        ontimeout:
                            () => {

                                finish({

                                    ok:
                                        false,

                                    error:
                                        "Request timeout."

                                });

                            }

                    });


                activeRequest =
                    xhr;

            }
        );

    }


    /* =========================================================
       BUILD MESSAGES
    ========================================================= */

    function buildMessages(
        chat,
        snapshot
    ) {

        const messages = [

            {

                role:
                    "system",

                content:

                    KNOWLEDGE +

                    `

========================
LIVE GAME STATE
========================

${JSON.stringify(
    snapshot,
    null,
    2
)}

========================
IMPORTANT
========================

Nếu dữ liệu realtime không có:
nói rõ chưa đọc được.

Không bịa.

`

            }

        ];


        chat.messages
            .slice(
                -CFG.MAX_HISTORY
            )
            .forEach(
                item => {

                    if (
                        item.role ===
                            "user" ||

                        item.role ===
                            "assistant"
                    ) {

                        messages.push({

                            role:
                                item.role,

                            content:
                                item.content

                        });

                    }

                }
            );


        return messages;

    }


    /* =========================================================
       SEND
    ========================================================= */

    async function askAI(
        question
    ) {

        if (
            busy
        ) {

            return {

                ok:
                    false,

                error:
                    "AI đang xử lý."

            };

        }


        if (
            !apiKey
        ) {

            return {

                ok:
                    false,

                error:
                    "Bạn chưa nhập Groq API Key."

            };

        }


        const chat =
            getChat();


        const oldLength =
            chat.messages.length;


        chat.messages.push({

            role:
                "user",

            content:
                question

        });


        saveChats();


        busy =
            true;


        stopRequested =
            false;


        requestID++;


        const id =
            requestID;


        try {

            const snapshot =
                getSnapshot();


            const messages =
                buildMessages(
                    chat,
                    snapshot
                );


            const selectedModel =
                chooseModel(
                    question
                );


            const result =
                await requestGroq(
                    messages,
                    selectedModel,
                    id
                );


            if (
                result.stopped ||
                stopRequested
            ) {

                chat.messages =
                    chat.messages.slice(
                        0,
                        oldLength
                    );


                saveChats();


                return {

                    ok:
                        false,

                    stopped:
                        true

                };

            }


            if (
                !result.ok
            ) {

                chat.messages =
                    chat.messages.slice(
                        0,
                        oldLength
                    );


                saveChats();


                return result;

            }


            chat.messages.push({

                role:
                    "assistant",

                content:
                    result.answer

            });


            if (
                chat.title ===
                "Cuộc trò chuyện mới"
            ) {

                chat.title =
                    question.slice(
                        0,
                        35
                    );

            }


            saveChats();


            return {

                ok:
                    true,

                answer:
                    result.answer

            };

        } catch (
            error
        ) {

            chat.messages =
                chat.messages.slice(
                    0,
                    oldLength
                );


            saveChats();


            return {

                ok:
                    false,

                error:
                    error?.message ||
                    "Lỗi không xác định."

            };

        } finally {

            if (
                id ===
                requestID
            ) {

                busy =
                    false;

                activeRequest =
                    null;

            }

        }

    }


    /* =========================================================
       UI
    ========================================================= */

    function createUI() {

        if (
            document.getElementById(
                "agma-v9-root"
            )
        )
            return;


        const root =
            document.createElement(
                "div"
            );


        root.id =
            "agma-v9-root";


        root.innerHTML = `

<div id="agma-v9-bubble">
    🤖
</div>


<div id="agma-v9-panel">

    <div id="agma-v9-head">

        <div>

            <b>
                Agma AI V9
            </b>

            <small
                id="agma-v9-state">

                ● Live State

            </small>

        </div>


        <button
            id="agma-v9-close">

            ×

        </button>

    </div>


    <div id="agma-v9-messages">
    </div>


    <div id="agma-v9-input-area">

        <div id="agma-v9-input-box">

            <textarea
                id="agma-v9-input"
                placeholder="Hỏi AI..."
            ></textarea>


            <button
                id="agma-v9-send">

                ➤

            </button>

        </div>


        <div id="agma-v9-tools">

            <button
                id="agma-v9-new">

                ＋ Chat

            </button>


            <button
                id="agma-v9-settings">

                ⚙️

            </button>


            <button
                id="agma-v9-state-btn">

                📡 State

            </button>


            <button
                id="agma-v9-clear">

                🗑️

            </button>

        </div>

    </div>


    <div id="agma-v9-settings-box">

        <div class="agma-v9-modal">

            <b>
                ⚙️ Cài đặt
            </b>


            <input
                id="agma-v9-key"
                type="password"
                placeholder="gsk_..."
            >


            <select
                id="agma-v9-model">

                <option
                    value="llama-3.1-8b-instant">

                    Llama 3.1 8B
                    - nhanh

                </option>


                <option
                    value="llama-3.3-70b-versatile">

                    Llama 3.3 70B
                    - mạnh

                </option>


                <option
                    value="openai/gpt-oss-20b">

                    GPT-OSS 20B

                </option>


                <option
                    value="openai/gpt-oss-120b">

                    GPT-OSS 120B

                </option>

            </select>


            <button
                id="agma-v9-save">

                Lưu

            </button>

        </div>

    </div>

</div>

`;


        document.body.appendChild(
            root
        );


        bindUI();

    }


    /* =========================================================
       UI CSS
    ========================================================= */

    const style =
        document.createElement(
            "style"
        );


    style.textContent = `

#agma-v9-root,
#agma-v9-root * {

    box-sizing:border-box;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

#agma-v9-bubble {

    position:fixed;

    right:18px;
    bottom:18px;

    width:58px;
    height:58px;

    border-radius:50%;

    background:
        linear-gradient(
            135deg,
            #5865f2,
            #7c4dff
        );

    display:flex;

    align-items:center;
    justify-content:center;

    color:#fff;

    font-size:27px;

    cursor:pointer;

    z-index:2147483647;

    box-shadow:
        0 8px 30px
        rgba(0,0,0,.5);

}

#agma-v9-panel {

    position:fixed;

    right:18px;
    bottom:88px;

    width:480px;
    height:640px;

    max-width:
        calc(100vw - 20px);

    max-height:
        calc(100vh - 100px);

    background:#171717;

    color:white;

    border:
        1px solid #343434;

    border-radius:14px;

    display:none;

    flex-direction:column;

    overflow:hidden;

    z-index:2147483646;

    box-shadow:
        0 15px 60px
        rgba(0,0,0,.6);

}

#agma-v9-panel.open {

    display:flex;

}

#agma-v9-head {

    height:54px;

    display:flex;

    align-items:center;

    justify-content:space-between;

    padding:
        0 12px;

    background:#191919;

    border-bottom:
        1px solid #333;

}

#agma-v9-state {

    display:block;

    margin-top:3px;

    color:#72e06a;

    font-size:10px;

}

#agma-v9-close {

    width:34px;
    height:34px;

    border:0;

    border-radius:7px;

    background:#292929;

    color:#fff;

    font-size:20px;

}

#agma-v9-messages {

    flex:1;

    overflow-y:auto;

    padding:12px;

}

.agma-v9-msg {

    padding:
        9px 11px;

    margin-bottom:10px;

    border-radius:9px;

    white-space:pre-wrap;

    word-break:break-word;

    line-height:1.5;

    font-size:14px;

}

.agma-v9-user {

    background:#343541;

    margin-left:35px;

}

.agma-v9-ai {

    background:#252525;

    margin-right:20px;

}

#agma-v9-input-area {

    padding:9px;

    background:#191919;

    border-top:
        1px solid #333;

}

#agma-v9-input-box {

    display:flex;

    gap:7px;

    padding:6px;

    border:
        1px solid #444;

    border-radius:9px;

    background:#242424;

}

#agma-v9-input {

    flex:1;

    min-width:0;

    height:46px;

    resize:none;

    outline:none;

    border:0;

    background:transparent;

    color:#fff;

    padding:8px;

}

#agma-v9-send {

    width:50px;

    border:0;

    border-radius:7px;

    background:#5865f2;

    color:#fff;

    cursor:pointer;

    font-size:18px;

}

#agma-v9-send.stop {

    background:#b42318;

}

#agma-v9-tools {

    display:flex;

    gap:5px;

    margin-top:6px;

}

#agma-v9-tools button {

    flex:1;

    border:0;

    border-radius:6px;

    padding:7px;

    background:#292929;

    color:#ddd;

}

#agma-v9-settings-box {

    position:absolute;

    inset:0;

    display:none;

    align-items:center;

    justify-content:center;

    background:
        rgba(0,0,0,.8);

}

#agma-v9-settings-box.open {

    display:flex;

}

.agma-v9-modal {

    width:340px;

    max-width:
        calc(100% - 25px);

    padding:16px;

    border-radius:10px;

    background:#202020;

    border:
        1px solid #444;

}

#agma-v9-key,
#agma-v9-model {

    width:100%;

    margin-top:10px;

    padding:9px;

    border:
        1px solid #444;

    border-radius:7px;

    background:#111;

    color:#fff;

}

#agma-v9-save {

    width:100%;

    margin-top:10px;

    padding:9px;

    border:0;

    border-radius:7px;

    background:#5865f2;

    color:#fff;

}

@media(max-width:430px) {

    #agma-v9-panel {

        right:5px;

        bottom:72px;

        width:
            calc(100vw - 10px);

        height:
            calc(100vh - 85px);

    }

}

`;


    document.documentElement
        .appendChild(
            style
        );


    /* =========================================================
       UI BIND
    ========================================================= */

    function bindUI() {

        const bubble =
            document.getElementById(
                "agma-v9-bubble"
            );


        const panel =
            document.getElementById(
                "agma-v9-panel"
            );


        const close =
            document.getElementById(
                "agma-v9-close"
            );


        const input =
            document.getElementById(
                "agma-v9-input"
            );


        const send =
            document.getElementById(
                "agma-v9-send"
            );


        const settingsBox =
            document.getElementById(
                "agma-v9-settings-box"
            );


        bubble.onclick =
            () => {

                panel.classList.toggle(
                    "open"
                );


                if (
                    panel.classList.contains(
                        "open"
                    )
                ) {

                    renderMessages();

                    input.focus();

                }

            };


        close.onclick =
            () => {

                panel.classList.remove(
                    "open"
                );

            };


        document.getElementById(
            "agma-v9-new"
        ).onclick =
            () => {

                newChat();

            };


        document.getElementById(
            "agma-v9-clear"
        ).onclick =
            () => {

                if (
                    !confirm(
                        "Xóa toàn bộ lịch sử chat?"
                    )
                )
                    return;


                chats =
                    [];


                currentChat =
                    null;


                localStorage.removeItem(
                    STORE.CHATS
                );


                localStorage.removeItem(
                    STORE.CURRENT
                );


                newChat();

            };


        document.getElementById(
            "agma-v9-settings"
        ).onclick =
            () => {

                document.getElementById(
                    "agma-v9-key"
                ).value =
                    apiKey;


                document.getElementById(
                    "agma-v9-model"
                ).value =
                    model;


                settingsBox.classList.add(
                    "open"
                );

            };


        document.getElementById(
            "agma-v9-save"
        ).onclick =
            () => {

                apiKey =
                    document.getElementById(
                        "agma-v9-key"
                    ).value.trim();


                model =
                    document.getElementById(
                        "agma-v9-model"
                    ).value;


                localStorage.setItem(
                    STORE.KEY,
                    apiKey
                );


                localStorage.setItem(
                    STORE.MODEL,
                    model
                );


                settingsBox.classList.remove(
                    "open"
                );

            };


        document.getElementById(
            "agma-v9-state-btn"
        ).onclick =
            () => {

                const state =
                    getSnapshot();


                addMessage(
                    JSON.stringify(
                        state,
                        null,
                        2
                    ),
                    "ai"
                );

            };


        send.onclick =
            async () => {

                /*
                 * Nếu đang request:
                 * nút này là STOP.
                 */

                if (
                    busy
                ) {

                    stopAI();

                    return;

                }


                const question =
                    input.value.trim();


                if (
                    !question
                )
                    return;


                input.value =
                    "";


                addMessage(
                    question,
                    "user"
                );


                setSending(
                    true
                );


                const loading =
                    addMessage(
                        "⏳ Đang suy nghĩ...",
                        "ai"
                    );


                const result =
                    await askAI(
                        question
                    );


                loading.remove();


                if (
                    result.stopped
                ) {

                    addMessage(
                        "⏹ Đã dừng.",
                        "ai"
                    );

                } else if (
                    result.ok
                ) {

                    addMessage(
                        result.answer,
                        "ai"
                    );

                } else {

                    addMessage(
                        "❌ " +
                        (
                            result.error ||
                            "Có lỗi xảy ra."
                        ),
                        "ai"
                    );

                }


                setSending(
                    false
                );


                renderMessages();

                input.focus();

            };


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    send.click();

                }

            }
        );

    }


    /* =========================================================
       STOP
    ========================================================= */

    function stopAI() {

        if (
            !busy
        )
            return;


        stopRequested =
            true;


        requestID++;


        if (
            activeRequest
        ) {

            try {

                activeRequest.abort();

            } catch {}

        }


        activeRequest =
            null;


        busy =
            false;


        setSending(
            false
        );

    }


    function setSending(
        value
    ) {

        const send =
            document.getElementById(
                "agma-v9-send"
            );


        if (!send)
            return;


        if (
            value
        ) {

            send.textContent =
                "⏹";

            send.classList.add(
                "stop"
            );

        } else {

            send.textContent =
                "➤";

            send.classList.remove(
                "stop"
            );

        }

    }


    /* =========================================================
       MESSAGE UI
    ========================================================= */

    function addMessage(
        text,
        role
    ) {

        const messages =
            document.getElementById(
                "agma-v9-messages"
            );


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "agma-v9-msg " +
            (
                role === "user"
                    ? "agma-v9-user"
                    : "agma-v9-ai"
            );


        div.innerHTML =
            escapeHTML(
                text
            );


        messages.appendChild(
            div
        );


        messages.scrollTop =
            messages.scrollHeight;


        return div;

    }


    function renderMessages() {

        const messages =
            document.getElementById(
                "agma-v9-messages"
            );


        if (!messages)
            return;


        messages.innerHTML =
            "";


        const chat =
            getChat();


        if (
            !chat.messages.length
        ) {

            addMessage(
                "🤖 Agma AI V9 đã sẵn sàng.\n\nBạn hỏi gì thì mình mới xử lý.",
                "ai"
            );


            return;

        }


        chat.messages.forEach(
            message => {

                addMessage(
                    message.content,
                    message.role ===
                        "user"
                        ? "user"
                        : "ai"
                );

            }
        );

    }


    function renderChats() {

        /*
         * V9 hiện dùng chat memory của
         * cuộc trò chuyện hiện tại.
         */

    }


    /* =========================================================
       STATE INDICATOR
    ========================================================= */

    function updateStateIndicator() {

        const el =
            document.getElementById(
                "agma-v9-state"
            );


        if (!el)
            return;


        const state =
            getSnapshot();


        let text =
            "● Live State";


        if (
            state.server
        ) {

            text +=
                " • " +
                state.server;

        }


        if (
            state.room
        ) {

            text +=
                " • " +
                state.room;

        }


        el.textContent =
            text;

    }


    /* =========================================================
       INIT
    ========================================================= */

    function init() {

        if (
            !chats.length
        ) {

            newChat();

        } else {

            getChat();

        }


        installWebSocketObserver();


        createUI();


        renderMessages();


        setInterval(
            () => {

                scanGameText();

                updateStateIndicator();

            },
            CFG.STATE_INTERVAL
        );


        setInterval(
            () => {

                /*
                 * Không gửi AI.
                 * Chỉ cập nhật tracker/state.
                 */

                scanGameText();

            },
            CFG.POWER_INTERVAL
        );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();

    }

})()
