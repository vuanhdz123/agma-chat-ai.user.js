// ==UserScript==
// @name         Agma.io AI Assistant V7 - Groq
// @namespace    agma.game.ai.v7
// @version      7.0.0
// @description  Agma AI + Knowledge Base + Live Game State + Multi-turn Chat
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

    const CONFIG = {
        API_URL:
            "https://api.groq.com/openai/v1/chat/completions",

        // Có thể đổi model nếu Groq của bạn không hỗ trợ model này.
        MODEL:
            "openai/gpt-oss-120b",

        MAX_HISTORY:
            12,

        MAX_TOKENS:
            1200,

        TIMEOUT:
            60000,

        STATE_INTERVAL:
            1000
    };


    /* =========================================================
       STORAGE
    ========================================================= */

    const STORAGE = {
        API_KEY:
            "agma_ai_v7_groq_key",

        CHATS:
            "agma_ai_v7_chats",

        CURRENT:
            "agma_ai_v7_current"
    };


    let apiKey =
        localStorage.getItem(
            STORAGE.API_KEY
        ) || "";


    let chats =
        loadChats();


    let currentChat =
        localStorage.getItem(
            STORAGE.CURRENT
        );


    let requestBusy =
        false;


    /* =========================================================
       AGMA KNOWLEDGE BASE
    ========================================================= */

    const AGMA_KNOWLEDGE = `

Bạn là AI Assistant chuyên hỗ trợ người chơi Agma.io.

Bạn phải hiểu kiến thức nền của Agma.io và trả lời
người chơi bằng tiếng Việt.

==============================
CÁCH CHƠI CƠ BẢN
==============================

Agma.io là game multiplayer dạng cell/eat-and-grow.

Các khái niệm thường gặp:

- Player
- Cell
- Mass
- Score
- Leaderboard
- Server
- Room
- Map
- Spawn
- Power
- Virus
- Pellet
- Portal
- Party
- Team
- Split
- Feed
- Eject
- Respawn

Player điều khiển cell trên bản đồ và tương tác
với những người chơi/vật thể khác.

==============================
PLAYER
==============================

Mass là một chỉ số quan trọng thể hiện kích thước
của cell.

Score và leaderboard có thể được dùng để đánh giá
thứ hạng của người chơi.

Nếu Live Game State có dữ liệu player thì hãy dùng
dữ liệu đó.

Nếu không có dữ liệu thì không được tự bịa.

==============================
LEADERBOARD
==============================

Leaderboard hiển thị các player đang được xếp hạng.

Nếu Live Game State đọc được leaderboard:

- Có thể nói ai đang top.
- Có thể nói thứ hạng.
- Có thể so sánh các player được đọc.

Nếu không đọc được leaderboard:

"Hiện tại mình chưa đọc được leaderboard."

Không tự bịa tên người chơi.

==============================
POWER
==============================

Các tên power mà người dùng thường sử dụng:

VR
Pellet
Anti
Portal
FRV / Frozen Virus

VR:
Tên gọi power VR theo cách người dùng sử dụng.

Pellet:
Tên gọi pellet.

Anti:
Có thể được gọi là anti hoặc anti recombie.

Portal:
Power/cơ chế portal.

FRV:
Có thể được gọi là FRV hoặc Frozen Virus.

Không tự bịa tác dụng chính xác nếu chưa có dữ liệu
xác nhận từ game.

==============================
POWER SPAWN
==============================

Người dùng cung cấp các chu kỳ tham khảo:

VR:
10 phút

Pellet:
10 phút

Anti:
10 phút

Portal:
12 phút 40 giây

FRV:
7 phút 30 giây

Các giá trị trên là kiến thức tham khảo,
không phải timer realtime.

Nếu người dùng hỏi "bao lâu spawn",
có thể giải thích bằng các chu kỳ trên.

Nếu người dùng hỏi "còn bao lâu",
chỉ đưa countdown chính xác nếu Live Game State
hoặc dữ liệu spawn thực tế cung cấp được.

Không tự bịa countdown.

==============================
VIRUS
==============================

Virus là một cơ chế/vật thể quan trọng trong game.

FRV/Frozen Virus được coi là thuật ngữ riêng
khi người dùng sử dụng.

Không tự đồng nhất mọi loại virus với FRV.

==============================
SPLIT / FEED / EJECT
==============================

Split:
Chia cell theo cơ chế game.

Feed:
Cho vật chất/mass cho player hoặc cell khác
theo cơ chế game.

Eject:
Đẩy vật chất theo cơ chế game.

==============================
PARTY / TEAM
==============================

Party/team được dùng để phối hợp.

Có thể bao gồm:

- Di chuyển cùng nhau
- Hỗ trợ
- Feed
- Bảo vệ
- Tấn công
- Né đối thủ

Không tự khẳng định luật party nếu server hiện tại
có cơ chế khác.

==============================
SERVER / ROOM
==============================

AI có thể hoạt động trên mọi server.

Không mặc định người chơi đang ở R3.

R3, Room 3 hoặc Secret Server có thể là cách
người chơi gọi một server/room đặc biệt.

Nếu Live Game State xác định được server/room,
hãy dùng dữ liệu đó.

Nếu không xác định được thì nói chưa đọc được.

==============================
LIVE GAME STATE
==============================

Live Game State có thể chứa:

- Server
- Room
- Player
- Mass
- Score
- X
- Y
- Leaderboard
- Visible Powers
- Visible Text

Phân biệt rõ:

KNOWLEDGE BASE:
Kiến thức nền về game.

LIVE GAME STATE:
Dữ liệu hiện tại đọc được từ client.

Không được giả vờ biết dữ liệu mà client chưa cung cấp.

==============================
CÁCH TRẢ LỜI
==============================

Người dùng hỏi:

"Ai đang top?"

=> dùng leaderboard hiện tại nếu có.

"Server nào?"

=> dùng server hiện tại nếu đọc được.

"FRV là gì?"

=> dùng Knowledge Base.

"Power bao lâu spawn?"

=> dùng chu kỳ tham khảo.

"Power còn bao lâu?"

=> chỉ tính chính xác khi có dữ liệu spawn thực tế.

Nếu thiếu dữ liệu:

"Mình chưa đọc được dữ liệu đó từ game."

AI chỉ trả lời khi người dùng hỏi.
Không tự gửi thông báo.
`;


    /* =========================================================
       LIVE GAME STATE
    ========================================================= */

    const GAME_STATE = {

        updated:
            0,

        server:
            null,

        room:
            null,

        player: {

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

        confidence: {

            server:
                false,

            room:
                false,

            player:
                false,

            leaderboard:
                false,

            powers:
                false

        }

    };


    /* =========================================================
       STORAGE FUNCTIONS
    ========================================================= */

    function loadChats() {

        try {

            const data =
                JSON.parse(

                    localStorage.getItem(
                        STORAGE.CHATS
                    ) || "[]"

                );


            if (
                !Array.isArray(data)
            ) {

                return [];

            }


            return data;

        } catch {

            return [];

        }

    }


    function saveChats() {

        localStorage.setItem(

            STORAGE.CHATS,

            JSON.stringify(
                chats
            )

        );

    }


    function createChat() {

        const chat = {

            id:
                Date.now()
                    .toString(36) +

                Math.random()
                    .toString(36)
                    .slice(2),

            title:
                "Agma AI",

            messages: [],

            created:
                Date.now()

        };


        chats.unshift(
            chat
        );


        currentChat =
            chat.id;


        localStorage.setItem(

            STORAGE.CURRENT,

            currentChat

        );


        saveChats();


        return chat;

    }


    function getCurrentChat() {

        let chat =
            chats.find(
                item =>
                    item.id ===
                    currentChat
            );


        if (!chat) {

            chat =
                createChat();

        }


        return chat;

    }


    /* =========================================================
       TEXT UTILITIES
    ========================================================= */

    function cleanText(
        value
    ) {

        return String(
            value || ""
        )

        .replace(
            /\u00a0/g,
            " "
        )

        .replace(
            /[ \t]+/g,
            " "
        )

        .replace(
            /\n{3,}/g,
            "\n"
        )

        .trim();

    }


    function numberFrom(
        value
    ) {

        const number =
            Number(

                String(
                    value
                )
                .replace(
                    /,/g,
                    ""
                )

            );


        return Number.isFinite(
            number
        )
            ? number
            : null;

    }


    /* =========================================================
       LIVE SERVER / ROOM
    ========================================================= */

    function readServerRoom(
        text
    ) {

        let server =
            null;

        let room =
            null;


        const serverPatterns = [

            /server\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /server\s+([A-Za-z0-9_-]+)/i

        ];


        const roomPatterns = [

            /room\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /room\s+([A-Za-z0-9_-]+)/i

        ];


        for (
            const regex of
            serverPatterns
        ) {

            const match =
                text.match(
                    regex
                );


            if (match) {

                server =
                    match[1];

                break;

            }

        }


        for (
            const regex of
            roomPatterns
        ) {

            const match =
                text.match(
                    regex
                );


            if (match) {

                room =
                    match[1];

                break;

            }

        }


        return {
            server,
            room
        };

    }


    /* =========================================================
       LIVE PLAYER
    ========================================================= */

    function readPlayer(
        text
    ) {

        const player = {

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

        };


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


        for (
            const key of
            Object.keys(patterns)
        ) {

            const match =
                text.match(
                    patterns[key]
                );


            if (match) {

                player[key] =
                    numberFrom(
                        match[1]
                    );

            }

        }


        return player;

    }


    /* =========================================================
       LEADERBOARD
    ========================================================= */

    function readLeaderboard() {

        const selectors = [

            '[id*="leaderboard" i]',

            '[class*="leaderboard" i]',

            '[id*="ranking" i]',

            '[class*="ranking" i]'

        ];


        const elements =
            [];


        selectors.forEach(
            selector => {

                try {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            element => {

                                if (
                                    !elements.includes(
                                        element
                                    )
                                ) {

                                    elements.push(
                                        element
                                    );

                                }

                            }
                        );

                } catch {}

            }
        );


        const result =
            [];


        elements
            .slice(
                0,
                10
            )
            .forEach(
                element => {

                    const text =
                        cleanText(
                            element.innerText
                        );


                    if (!text)
                        return;


                    text
                        .split("\n")
                        .map(
                            line =>
                                line.trim()
                        )
                        .filter(
                            Boolean
                        )
                        .forEach(
                            line => {

                                const match =
                                    line.match(

                                        /^(\d{1,2})[\s.)-]+(.+)$/

                                    );


                                if (match) {

                                    result.push({

                                        rank:
                                            Number(
                                                match[1]
                                            ),

                                        name:
                                            match[2]

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
                    !seen.has(key)
                ) {

                    seen.add(key);

                    unique.push(
                        item
                    );

                }

            }
        );


        return unique.slice(
            0,
            20
        );

    }


    /* =========================================================
       POWER DETECTION
    ========================================================= */

    function readPowers(
        text
    ) {

        const lower =
            text.toLowerCase();


        const result =
            [];


        const powers = [

            {
                name:
                    "VR",

                keywords:
                    [
                        "virus",
                        " vr "
                    ]

            },

            {
                name:
                    "PELLET",

                keywords:
                    [
                        "pellet"
                    ]

            },

            {
                name:
                    "ANTI",

                keywords:
                    [
                        "anti",
                        "anti recombie"
                    ]

            },

            {
                name:
                    "PORTAL",

                keywords:
                    [
                        "portal"
                    ]

            },

            {
                name:
                    "FRV",

                keywords:
                    [
                        "frv",
                        "frozen virus"
                    ]

            }

        ];


        powers.forEach(
            power => {

                if (
                    power.keywords.some(
                        keyword =>
                            lower.includes(
                                keyword
                            )
                    )
                ) {

                    result.push(
                        power.name
                    );

                }

            }
        );


        return result;

    }


    /* =========================================================
       UPDATE LIVE STATE
    ========================================================= */

    function updateGameState() {

        if (
            !document.body
        )
            return;


        try {

            const text =
                cleanText(
                    document.body.innerText
                );


            const serverRoom =
                readServerRoom(
                    text
                );


            if (
                serverRoom.server
            ) {

                GAME_STATE.server =
                    serverRoom.server;

                GAME_STATE.confidence.server =
                    true;

            }


            if (
                serverRoom.room
            ) {

                GAME_STATE.room =
                    serverRoom.room;

                GAME_STATE.confidence.room =
                    true;

            }


            const player =
                readPlayer(
                    text
                );


            let foundPlayer =
                false;


            Object.keys(
                player
            ).forEach(
                key => {

                    if (
                        player[key] !==
                        null
                    ) {

                        GAME_STATE.player[key] =
                            player[key];

                        foundPlayer =
                            true;

                    }

                }
            );


            if (
                foundPlayer
            ) {

                GAME_STATE.confidence.player =
                    true;

            }


            const leaderboard =
                readLeaderboard();


            if (
                leaderboard.length
            ) {

                GAME_STATE.leaderboard =
                    leaderboard;

                GAME_STATE.confidence.leaderboard =
                    true;

            }


            const powers =
                readPowers(
                    text
                );


            if (
                powers.length
            ) {

                GAME_STATE.visiblePowers =
                    powers;

                GAME_STATE.confidence.powers =
                    true;

            }


            GAME_STATE.updated =
                Date.now();

        } catch (
            error
        ) {

            console.warn(
                "[Agma AI State]",
                error
            );

        }

    }


    function getGameSnapshot() {

        updateGameState();


        return {

            server:
                GAME_STATE.server,

            room:
                GAME_STATE.room,

            player:
                GAME_STATE.player,

            leaderboard:
                GAME_STATE.leaderboard,

            visiblePowers:
                GAME_STATE.visiblePowers,

            confidence:
                GAME_STATE.confidence,

            updated:
                GAME_STATE.updated

        };

    }


    window.AGMA_AI_STATE =
        getGameSnapshot;


    /* =========================================================
       API REQUEST - REWRITTEN
    ========================================================= */

    function requestGroq(
        messages
    ) {

        return new Promise(
            resolve => {

                if (
                    !apiKey
                ) {

                    resolve({

                        ok:
                            false,

                        status:
                            0,

                        error:
                            "Chưa nhập Groq API Key."

                    });

                    return;

                }


                GM_xmlhttpRequest({

                    method:
                        "POST",

                    url:
                        CONFIG.API_URL,

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
                                CONFIG.MODEL,

                            messages:
                                messages,

                            temperature:
                                0.2,

                            max_tokens:
                                CONFIG.MAX_TOKENS

                        }),

                    timeout:
                        CONFIG.TIMEOUT,


                    onload:
                        response => {

                            let data =
                                null;


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

                                resolve({

                                    ok:
                                        false,

                                    status:
                                        response.status,

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
                                typeof answer !==
                                    "string" ||
                                !answer.trim()
                            ) {

                                resolve({

                                    ok:
                                        false,

                                    status:
                                        response.status,

                                    error:
                                        "Groq không trả về nội dung."

                                });

                                return;

                            }


                            resolve({

                                ok:
                                    true,

                                status:
                                    response.status,

                                answer:
                                    answer.trim()

                            });

                        },


                    onerror:
                        () => {

                            resolve({

                                ok:
                                    false,

                                status:
                                    0,

                                error:
                                    "Không thể kết nối Groq."

                            });

                        },


                    ontimeout:
                        () => {

                            resolve({

                                ok:
                                    false,

                                status:
                                    0,

                                error:
                                    "Groq timeout."

                            });

                        }

                });

            }
        );

    }


    /* =========================================================
       BUILD MESSAGES
    ========================================================= */

    function buildMessages(
        question,
        chat,
        state
    ) {

        const messages = [];


        messages.push({

            role:
                "system",

            content:

                AGMA_KNOWLEDGE +

                `

==============================
LIVE GAME STATE
==============================

${JSON.stringify(
    state,
    null,
    2
)}

==============================
QUY TẮC LIVE DATA
==============================

Chỉ sử dụng Live Game State khi nó có dữ liệu.

Nếu một trường là null, [] hoặc confidence=false,
hãy coi như chưa đọc được.

Không được tự bịa tên player,
server, room, mass, score hoặc countdown.

`

        });


        const history =
            Array.isArray(
                chat.messages
            )

                ? chat.messages
                    .filter(
                        message =>

                            message &&

                            (
                                message.role ===
                                    "user" ||

                                message.role ===
                                    "assistant"
                            ) &&

                            typeof message.content ===
                                "string" &&

                            message.content.trim()

                    )
                    .slice(
                        -CONFIG.MAX_HISTORY
                    )

                : [];


        history.forEach(
            message => {

                messages.push({

                    role:
                        message.role,

                    content:
                        message.content

                });

            }
        );


        return messages;

    }


    /* =========================================================
       MAIN CHAT FUNCTION
    ========================================================= */

    async function sendToAI(
        question
    ) {

        if (
            requestBusy
        ) {

            return {

                ok:
                    false,

                error:
                    "AI đang xử lý câu trước."

            };

        }


        if (
            !apiKey
        ) {

            return {

                ok:
                    false,

                error:
                    "Chưa nhập Groq API Key."

            };

        }


        const chat =
            getCurrentChat();


        const cleanQuestion =
            String(
                question
            ).trim();


        if (
            !cleanQuestion
        ) {

            return {

                ok:
                    false,

                error:
                    "Câu hỏi trống."

            };

        }


        requestBusy =
            true;


        try {

            const state =
                getGameSnapshot();


            /*
             * Thêm user message MỘT LẦN.
             */

            chat.messages.push({

                role:
                    "user",

                content:
                    cleanQuestion

            });


            /*
             * Giữ lịch sử nhỏ để request
             * nhanh hơn.
             */

            if (
                chat.messages.length >
                    CONFIG.MAX_HISTORY * 2
            ) {

                chat.messages =
                    chat.messages.slice(
                        -CONFIG.MAX_HISTORY * 2
                    );

            }


            saveChats();


            const messages =
                buildMessages(
                    cleanQuestion,
                    chat,
                    state
                );


            const result =
                await requestGroq(
                    messages
                );


            if (
                !result.ok
            ) {

                /*
                 * Xóa user message vừa thêm
                 * nếu request thất bại,
                 * tránh lịch sử bị lỗi.
                 */

                chat.messages.pop();

                saveChats();


                return result;

            }


            /*
             * Chỉ thêm assistant message
             * khi Groq thực sự trả lời.
             */

            chat.messages.push({

                role:
                    "assistant",

                content:
                    result.answer

            });


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

            return {

                ok:
                    false,

                error:
                    error?.message ||
                    "Lỗi không xác định."

            };

        } finally {

            requestBusy =
                false;

        }

    }


    /* =========================================================
       UI
    ========================================================= */

    const style =
        document.createElement(
            "style"
        );


    style.textContent = `

#agma-v7-root,
#agma-v7-root * {

    box-sizing:border-box;

    font-family:
        Arial,
        sans-serif;

}

#agma-v7-bubble {

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

#agma-v7-panel {

    position:fixed;

    right:18px;
    bottom:88px;

    width:450px;
    height:600px;

    max-width:
        calc(100vw - 20px);

    max-height:
        calc(100vh - 100px);

    background:#171717;

    color:white;

    border:
        1px solid #333;

    border-radius:14px;

    display:none;

    flex-direction:column;

    overflow:hidden;

    z-index:2147483646;

    box-shadow:
        0 15px 60px
        rgba(0,0,0,.6);

}

#agma-v7-panel.open {

    display:flex;

}

#agma-v7-header {

    min-height:52px;

    display:flex;

    align-items:center;

    justify-content:space-between;

    padding:0 12px;

    border-bottom:
        1px solid #333;

}

#agma-v7-status {

    font-size:10px;

    color:#7ee787;

    margin-top:2px;

}

#agma-v7-close {

    border:0;

    background:#292929;

    color:white;

    width:34px;

    height:34px;

    border-radius:7px;

}

#agma-v7-messages {

    flex:1;

    overflow-y:auto;

    padding:12px;

}

.agma-v7-message {

    margin-bottom:10px;

    padding:10px;

    border-radius:9px;

    white-space:pre-wrap;

    word-break:break-word;

    line-height:1.5;

    font-size:14px;

}

.agma-v7-user {

    background:#343541;

    margin-left:35px;

}

.agma-v7-assistant {

    background:#252525;

    margin-right:20px;

}

#agma-v7-input-area {

    padding:9px;

    border-top:
        1px solid #333;

}

#agma-v7-input-box {

    display:flex;

    gap:7px;

    background:#242424;

    border:
        1px solid #444;

    border-radius:9px;

    padding:6px;

}

#agma-v7-input {

    flex:1;

    min-width:0;

    height:45px;

    resize:none;

    border:0;

    outline:0;

    background:transparent;

    color:white;

    padding:8px;

}

#agma-v7-send {

    width:46px;

    border:0;

    border-radius:7px;

    background:#5865f2;

    color:white;

}

#agma-v7-send:disabled {

    opacity:.5;

}

#agma-v7-tools {

    display:flex;

    gap:5px;

    margin-top:6px;

}

.agma-v7-tool {

    flex:1;

    padding:7px;

    border:0;

    border-radius:6px;

    background:#292929;

    color:#ddd;

    font-size:11px;

}

#agma-v7-settings {

    position:absolute;

    inset:0;

    background:
        rgba(0,0,0,.82);

    display:none;

    align-items:center;

    justify-content:center;

}

#agma-v7-settings.open {

    display:flex;

}

#agma-v7-settings-box {

    width:330px;

    background:#202020;

    border:
        1px solid #444;

    border-radius:10px;

    padding:15px;

}

#agma-v7-key {

    width:100%;

    margin-top:10px;

    padding:9px;

    background:#111;

    color:white;

    border:
        1px solid #444;

    border-radius:7px;

}

@media(max-width:430px) {

    #agma-v7-panel {

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
       CREATE UI
    ========================================================= */

    function createUI() {

        if (
            document.getElementById(
                "agma-v7-root"
            )
        )
            return;


        const root =
            document.createElement(
                "div"
            );


        root.id =
            "agma-v7-root";


        root.innerHTML = `

<div id="agma-v7-bubble">
    🤖
</div>


<div id="agma-v7-panel">

    <div id="agma-v7-header">

        <div>

            <b>
                Agma AI
            </b>

            <div id="agma-v7-status">
                ● Knowledge + Live State
            </div>

        </div>


        <button
            id="agma-v7-close">

            ×

        </button>

    </div>


    <div id="agma-v7-messages">

        <div class="
            agma-v7-message
            agma-v7-assistant
        ">

            🤖 Agma AI đã sẵn sàng.

            Bạn hỏi thì mình mới trả lời.

        </div>

    </div>


    <div id="agma-v7-input-area">

        <div id="agma-v7-input-box">

            <textarea
                id="agma-v7-input"
                placeholder="Hỏi AI về Agma..."
            ></textarea>


            <button id="agma-v7-send">
                ➤
            </button>

        </div>


        <div id="agma-v7-tools">

            <button
                class="agma-v7-tool"
                id="agma-v7-state">

                📡 State

            </button>


            <button
                class="agma-v7-tool"
                id="agma-v7-top">

                🏆 Top

            </button>


            <button
                class="agma-v7-tool"
                id="agma-v7-api">

                ⚙️ API

            </button>

        </div>

    </div>


    <div id="agma-v7-settings">

        <div id="agma-v7-settings-box">

            <b>
                Groq API Key
            </b>


            <input
                id="agma-v7-key"
                type="password"
                placeholder="gsk_..."
            >


            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    gap:8px;
                "
            >

                <button
                    id="agma-v7-cancel"
                    class="agma-v7-tool">

                    Hủy

                </button>


                <button
                    id="agma-v7-save"
                    class="agma-v7-tool">

                    Lưu

                </button>

            </div>

        </div>

    </div>

</div>

`;


        document.body.appendChild(
            root
        );


        setupEvents();

    }


    /* =========================================================
       DISPLAY MESSAGE
    ========================================================= */

    function displayMessage(
        text,
        role
    ) {

        const box =
            document.getElementById(
                "agma-v7-messages"
            );


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "agma-v7-message " +

            (
                role === "user"
                    ? "agma-v7-user"
                    : "agma-v7-assistant"
            );


        element.textContent =
            text;


        box.appendChild(
            element
        );


        box.scrollTop =
            box.scrollHeight;


        return element;

    }


    /* =========================================================
       EVENTS
    ========================================================= */

    function setupEvents() {

        const bubble =
            document.getElementById(
                "agma-v7-bubble"
            );


        const panel =
            document.getElementById(
                "agma-v7-panel"
            );


        const input =
            document.getElementById(
                "agma-v7-input"
            );


        const send =
            document.getElementById(
                "agma-v7-send"
            );


        bubble.onclick = () => {

            panel.classList.toggle(
                "open"
            );


            if (
                panel.classList.contains(
                    "open"
                )
            ) {

                input.focus();

            }

        };


        document.getElementById(
            "agma-v7-close"
        ).onclick = () => {

            panel.classList.remove(
                "open"
            );

        };


        async function handleSend() {

            const question =
                input.value.trim();


            if (!question)
                return;


            if (
                requestBusy
            )
                return;


            displayMessage(
                question,
                "user"
            );


            input.value = "";


            send.disabled =
                true;


            send.textContent =
                "…";


            const loading =
                displayMessage(
                    "⏳ Đang suy nghĩ...",
                    "assistant"
                );


            const result =
                await sendToAI(
                    question
                );


            loading.remove();


            if (
                result.ok
            ) {

                displayMessage(
                    result.answer,
                    "assistant"
                );

            } else {

                displayMessage(

                    "❌ " +
                    result.error,

                    "assistant"

                );

            }


            send.disabled =
                false;


            send.textContent =
                "➤";


            input.focus();

        }


        send.onclick =
            handleSend;


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    handleSend();

                }

            }
        );


        /* STATE */

        document.getElementById(
            "agma-v7-state"
        ).onclick = () => {

            displayMessage(

                JSON.stringify(
                    getGameSnapshot(),
                    null,
                    2
                ),

                "assistant"

            );

        };


        /* LEADERBOARD */

        document.getElementById(
            "agma-v7-top"
        ).onclick = () => {

            const state =
                getGameSnapshot();


            if (
                !state.leaderboard.length
            ) {

                displayMessage(
                    "⚠️ Chưa đọc được leaderboard từ client.",
                    "assistant"
                );

                return;

            }


            displayMessage(

                state.leaderboard
                    .map(
                        player =>
                            `${player.rank}. ${player.name}`
                    )
                    .join("\n"),

                "assistant"

            );

        };


        /* API SETTINGS */

        const settings =
            document.getElementById(
                "agma-v7-settings"
            );


        document.getElementById(
            "agma-v7-api"
        ).onclick = () => {

            document.getElementById(
                "agma-v7-key"
            ).value =
                apiKey;


            settings.classList.add(
                "open"
            );

        };


        document.getElementById(
            "agma-v7-cancel"
        ).onclick = () => {

            settings.classList.remove(
                "open"
            );

        };


        document.getElementById(
            "agma-v7-save"
        ).onclick = () => {

            apiKey =
                document.getElementById(
                    "agma-v7-key"
                ).value.trim();


            localStorage.setItem(

                STORAGE.API_KEY,

                apiKey

            );


            settings.classList.remove(
                "open"
            );


            displayMessage(
                "✅ Đã lưu Groq API Key.",
                "assistant"
            );

        };

    }


    /* =========================================================
       INIT
    ========================================================= */

    function init() {

        if (
            !document.body
        ) {

            setTimeout(
                init,
                100
            );

            return;

        }


        getCurrentChat();


        createUI();


        updateGameState();


        setInterval(

            updateGameState,

            CONFIG.STATE_INTERVAL

        );


        console.log(
            "[Agma AI V7] Loaded"
        );

    }


    init();

})();
