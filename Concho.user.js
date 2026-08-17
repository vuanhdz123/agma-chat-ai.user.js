// ==UserScript==
// @name         Agma.io - AI Game Assistant V6
// @namespace    agma.game.ai.v6
// @version      6.0.0
// @description  Agma AI Knowledge Base + Live Game State + Any Server
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

        MODEL:
            "openai/gpt-oss-120b",

        MAX_TOKENS:
            1200,

        HISTORY:
            12,

        STATE_INTERVAL:
            1000,

        MAX_VISIBLE_TEXT:
            12000

    };


    const STORAGE = {

        KEY:
            "agma_ai_v6_groq_key",

        CHATS:
            "agma_ai_v6_chats",

        CURRENT:
            "agma_ai_v6_current",

        ENABLED:
            "agma_ai_v6_enabled"

    };


    let apiKey =
        localStorage.getItem(
            STORAGE.KEY
        ) || "";


    let enabled =
        localStorage.getItem(
            STORAGE.ENABLED
        ) !== "false";


    let chats =
        loadChats();


    let currentChat =
        localStorage.getItem(
            STORAGE.CURRENT
        );


    /* =========================================================
       AGMA KNOWLEDGE BASE
    ========================================================= */

    const AGMA_KNOWLEDGE = `

Bạn là trợ lý AI chuyên hỗ trợ người chơi Agma.io.

MỤC TIÊU:
Hiểu các khái niệm, thuật ngữ và cách chơi Agma.io
để có thể giải thích cho người chơi bằng tiếng Việt.

--------------------------------------------------
1. KHÁI NIỆM CƠ BẢN
--------------------------------------------------

Agma.io là game browser multiplayer dạng cell/eat-and-grow.

Người chơi điều khiển cell trên bản đồ,
thu thập vật thể và tương tác với những người chơi khác.

Các khái niệm thường gặp:

- cell/player
- mass
- score
- leaderboard
- map
- server
- room
- spawn
- power
- virus
- pellet
- portal
- party
- team
- split
- feed
- eject
- respawn

Khi giải thích, phải ưu tiên cách hiểu theo Agma.io
và ngữ cảnh người chơi đang nói.

--------------------------------------------------
2. PLAYER / CELL
--------------------------------------------------

Player điều khiển cell của mình.

Mass là một trong những chỉ số quan trọng
để đánh giá kích thước/sức mạnh của cell.

Khi player lớn hơn hoặc nhỏ hơn đối thủ,
cách tương tác có thể khác nhau tùy cơ chế
của server/game mode.

Không được tự bịa chính xác một cơ chế
nếu không có dữ liệu xác nhận.

--------------------------------------------------
3. LEADERBOARD
--------------------------------------------------

Leaderboard hiển thị những người chơi đang
được xếp hạng trong trận/server hiện tại.

Nếu Live Game State đọc được leaderboard,
AI có thể trả lời:

- ai đang top
- thứ hạng của player
- danh sách người chơi được đọc
- thay đổi thứ hạng nếu có dữ liệu

Nếu không đọc được leaderboard,
AI phải nói rõ:

"Hiện tại mình chưa đọc được leaderboard."

Không được tự bịa tên người chơi.

--------------------------------------------------
4. POWER
--------------------------------------------------

Power là các vật thể/cơ chế đặc biệt xuất hiện
trong game.

Trong ngữ cảnh của người dùng, các power thường
được gọi bằng:

VR
Pellet
Anti
Portal
FRV / Frozen Virus

Các tên này có thể xuất hiện dưới nhiều dạng
viết tắt hoặc tên gọi khác.

VR:
Người dùng gọi power này là VR.

Pellet:
Power/vật thể được người dùng gọi là pellet.

Anti:
Người dùng gọi là anti hoặc anti recombie.

Portal:
Power/cơ chế portal.

FRV:
Người dùng gọi FRV hoặc frozen virus.

Nếu không chắc tác dụng chính xác của một power
trong phiên bản/server hiện tại, không được tự
khẳng định chi tiết chưa được xác minh.

--------------------------------------------------
5. POWER SPAWN
--------------------------------------------------

Người dùng đã cung cấp các chu kỳ tham khảo:

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

Đây là thông tin do người dùng cung cấp,
không được coi là dữ liệu server realtime.

Nếu người dùng hỏi:

"Bao lâu spawn?"

có thể dùng các mốc trên để giải thích.

Nếu người dùng hỏi:

"Power tiếp theo còn bao lâu?"

phải kiểm tra Live Game State hoặc timer thực tế
nếu có dữ liệu.

Không được lấy thời điểm hiện tại rồi tự suy ra
một timer chính xác nếu chưa biết lần spawn/eat
trước đó.

--------------------------------------------------
6. VIRUS
--------------------------------------------------

Virus là một cơ chế/vật thể quan trọng trong
game cell.

Người chơi có thể tương tác với virus tùy
cơ chế game/server.

FRV/Frozen Virus là thuật ngữ riêng được người dùng
sử dụng và không được tự đồng nhất với virus thường
nếu chưa có dữ liệu.

--------------------------------------------------
7. SPLIT / FEED / EJECT
--------------------------------------------------

Split:
Chia cell theo cơ chế của game.

Feed:
Cho mass/vật thể cho player hoặc cell khác
theo cơ chế tương ứng.

Eject:
Đẩy/eject một lượng vật chất hoặc vật thể
theo cơ chế game.

Các thao tác này thường được dùng trong chiến thuật,
di chuyển, party/team hoặc tương tác giữa người chơi.

--------------------------------------------------
8. PARTY / TEAM
--------------------------------------------------

Party/team cho phép người chơi phối hợp.

Trong party, chiến thuật có thể bao gồm:

- hỗ trợ nhau
- feed
- di chuyển cùng nhau
- bảo vệ player
- phối hợp khi săn hoặc né đối thủ

AI phải phân biệt:
"party" là khái niệm nhóm,
không tự giả định chính xác luật party
của server nếu chưa có dữ liệu.

--------------------------------------------------
9. SERVER / ROOM
--------------------------------------------------

Agma có thể có nhiều server/room/mode.

Người dùng muốn AI hoạt động ở:

ANY SERVER

Không được mặc định người chơi đang ở R3.

Nếu Live Game State phát hiện server/room,
hãy sử dụng dữ liệu đó.

Nếu không phát hiện được,
nói rõ rằng server/room chưa được đọc.

"R3", "Room 3", "Secret Server" có thể là
các cách người dùng gọi một khu vực/server đặc biệt.

Không được tự khẳng định tên nội bộ của server
nếu client không cung cấp.

--------------------------------------------------
10. GAME STATE
--------------------------------------------------

AI có thể sử dụng:

- server
- room
- player
- mass
- score
- tọa độ nếu đọc được
- leaderboard
- visible powers
- visible text

Nhưng phải phân biệt:

DỮ LIỆU THỰC TẾ
và
KIẾN THỨC GAME.

Kiến thức game:
Thông tin cố định trong Knowledge Base.

Live Game State:
Thông tin được đọc từ client tại thời điểm hỏi.

--------------------------------------------------
11. NGUYÊN TẮC AI
--------------------------------------------------

Khi người chơi hỏi:

"AI đang thấy gì?"

=> trả về Game State hiện tại.

Khi hỏi:

"Ai đang top?"

=> dùng leaderboard hiện tại.

Khi hỏi:

"Tôi đang ở server nào?"

=> dùng server hiện tại nếu đọc được.

Khi hỏi:

"FRV là gì?"

=> dùng Knowledge Base.

Khi hỏi:

"Power tiếp theo bao lâu?"

=> chỉ trả timer chính xác nếu có dữ liệu
spawn/eat/timer thực tế.

Khi không có dữ liệu:

Nói:
"Mình chưa đọc được dữ liệu đó từ game."

Không bịa.

AI chỉ trả lời khi người chơi hỏi.
Không tự gửi thông báo.

`;


    /* =========================================================
       LIVE GAME STATE
    ========================================================= */

    const GAME = {

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

        visibleText:
            "",

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
       STORAGE
    ========================================================= */

    function loadChats() {

        try {

            return JSON.parse(

                localStorage.getItem(
                    STORAGE.CHATS
                ) || "[]"

            );

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


    function uid() {

        return (

            Date.now()
                .toString(36)

            +

            Math.random()
                .toString(36)
                .slice(2)

        );

    }


    function getChat() {

        return chats.find(
            x =>
                x.id ===
                currentChat
        );

    }


    function ensureChat() {

        if (
            !currentChat ||
            !getChat()
        ) {

            const chat = {

                id:
                    uid(),

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

        }

    }


    /* =========================================================
       UTILITIES
    ========================================================= */

    function clean(
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


    function toNumber(
        value
    ) {

        const n =
            Number(

                String(value)
                    .replace(
                        /,/g,
                        ""
                    )

            );


        return Number.isFinite(n)
            ? n
            : null;

    }


    /* =========================================================
       SERVER / ROOM DETECTION
    ========================================================= */

    function detectServerRoom(
        text
    ) {

        let server =
            null;

        let room =
            null;


        const serverRegexes = [

            /server\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /server\s+([A-Za-z0-9_-]+)/i

        ];


        const roomRegexes = [

            /room\s*[:=#-]\s*([A-Za-z0-9_-]+)/i,

            /room\s+([A-Za-z0-9_-]+)/i

        ];


        for (
            const regex of
            serverRegexes
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
            roomRegexes
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
       PLAYER DETECTION
    ========================================================= */

    function detectPlayer(
        text
    ) {

        const result = {

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
            const key in
            patterns
        ) {

            const match =
                text.match(
                    patterns[key]
                );


            if (match) {

                result[key] =
                    toNumber(
                        match[1]
                    );

            }

        }


        return result;

    }


    /* =========================================================
       LEADERBOARD
    ========================================================= */

    function detectLeaderboard() {

        const output =
            [];


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


        found
            .slice(
                0,
                10
            )
            .forEach(
                el => {

                    const text =
                        clean(
                            el.innerText
                        );


                    if (!text)
                        return;


                    const lines =
                        text
                            .split("\n")
                            .map(
                                x =>
                                    x.trim()
                            )
                            .filter(
                                Boolean
                            );


                    lines.forEach(
                        line => {

                            const match =
                                line.match(

                                    /^(\d{1,2})[\s.)-]+(.+)$/

                                );


                            if (
                                match
                            ) {

                                output.push({

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


        output.forEach(
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

    function detectPowers(
        text
    ) {

        const lower =
            text.toLowerCase();


        const result =
            [];


        const checks = [

            [
                "VR",
                [
                    "virus",
                    " vr "
                ]
            ],

            [
                "PELLET",
                [
                    "pellet"
                ]
            ],

            [
                "ANTI",
                [
                    "anti",
                    "anti recombie"
                ]
            ],

            [
                "PORTAL",
                [
                    "portal"
                ]
            ],

            [
                "FRV",
                [
                    "frv",
                    "frozen virus"
                ]
            ]

        ];


        checks.forEach(
            ([type, words]) => {

                if (
                    words.some(
                        word =>
                            lower.includes(
                                word
                            )
                    )
                ) {

                    result.push(
                        type
                    );

                }

            }
        );


        return result;

    }


    /* =========================================================
       UPDATE GAME STATE
    ========================================================= */

    function updateGameState() {

        if (!document.body)
            return;


        try {

            const text =
                clean(
                    document.body.innerText
                );


            GAME.visibleText =
                text.slice(
                    0,
                    CONFIG.MAX_VISIBLE_TEXT
                );


            const sr =
                detectServerRoom(
                    text
                );


            if (sr.server) {

                GAME.server =
                    sr.server;

                GAME.confidence.server =
                    true;

            }


            if (sr.room) {

                GAME.room =
                    sr.room;

                GAME.confidence.room =
                    true;

            }


            const player =
                detectPlayer(
                    text
                );


            let playerFound =
                false;


            Object.keys(
                player
            ).forEach(
                key => {

                    if (
                        player[key] !== null
                    ) {

                        GAME.player[key] =
                            player[key];

                        playerFound =
                            true;

                    }

                }
            );


            if (
                playerFound
            ) {

                GAME.confidence.player =
                    true;

            }


            const leaderboard =
                detectLeaderboard();


            if (
                leaderboard.length
            ) {

                GAME.leaderboard =
                    leaderboard;

                GAME.confidence.leaderboard =
                    true;

            }


            const powers =
                detectPowers(
                    text
                );


            if (
                powers.length
            ) {

                GAME.visiblePowers =
                    powers;

                GAME.confidence.powers =
                    true;

            }


            GAME.updated =
                Date.now();

        } catch (
            error
        ) {

            console.warn(
                "[Agma AI]",
                error
            );

        }

    }


    /* =========================================================
       SNAPSHOT
    ========================================================= */

    function getSnapshot() {

        updateGameState();


        return {

            server:
                GAME.server,

            room:
                GAME.room,

            player:
                GAME.player,

            leaderboard:
                GAME.leaderboard,

            visiblePowers:
                GAME.visiblePowers,

            confidence:
                GAME.confidence,

            lastUpdate:
                new Date(
                    GAME.updated
                ).toLocaleTimeString(
                    "vi-VN"
                )

        };

    }


    window.AGMA_AI_STATE =
        getSnapshot;


    /* =========================================================
       CSS
    ========================================================= */

    const style =
        document.createElement(
            "style"
        );


    style.textContent = `

#agma-v6-root,
#agma-v6-root * {

    box-sizing:border-box;

    font-family:
        Arial,
        sans-serif;

}

#agma-v6-bubble {

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

    color:white;

    font-size:27px;

    cursor:pointer;

    z-index:2147483647;

    box-shadow:
        0 8px 30px
        rgba(0,0,0,.5);

}

#agma-v6-panel {

    position:fixed;

    right:18px;
    bottom:88px;

    width:440px;
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

#agma-v6-panel.open {

    display:flex;

}

#agma-v6-header {

    height:52px;

    padding:0 12px;

    display:flex;

    align-items:center;

    justify-content:space-between;

    border-bottom:
        1px solid #333;

}

#agma-v6-status {

    font-size:10px;

    color:#7ee787;

}

#agma-v6-messages {

    flex:1;

    overflow-y:auto;

    padding:12px;

}

.agma-v6-msg {

    padding:10px;

    margin-bottom:9px;

    border-radius:9px;

    white-space:pre-wrap;

    word-break:break-word;

    line-height:1.45;

    font-size:14px;

}

.agma-v6-user {

    background:#343541;

    margin-left:30px;

}

.agma-v6-ai {

    background:#252525;

    margin-right:20px;

}

#agma-v6-input-area {

    padding:9px;

    border-top:
        1px solid #333;

}

#agma-v6-input-box {

    display:flex;

    gap:6px;

    background:#242424;

    border:
        1px solid #444;

    border-radius:9px;

    padding:6px;

}

#agma-v6-input {

    flex:1;

    height:45px;

    resize:none;

    border:0;

    outline:0;

    background:transparent;

    color:white;

    padding:8px;

}

#agma-v6-send {

    width:46px;

    border:0;

    border-radius:7px;

    background:#5865f2;

    color:white;

}

#agma-v6-tools {

    display:flex;

    gap:5px;

    margin-top:6px;

}

.agma-v6-tool {

    flex:1;

    padding:7px;

    border:0;

    border-radius:6px;

    background:#292929;

    color:#ddd;

    font-size:11px;

}

#agma-v6-settings {

    position:absolute;

    inset:0;

    background:
        rgba(0,0,0,.8);

    display:none;

    align-items:center;

    justify-content:center;

}

#agma-v6-settings.open {

    display:flex;

}

#agma-v6-settings-box {

    width:330px;

    background:#202020;

    border:
        1px solid #444;

    border-radius:10px;

    padding:15px;

}

#agma-v6-key {

    width:100%;

    padding:9px;

    margin-top:10px;

    border:
        1px solid #444;

    border-radius:7px;

    background:#111;

    color:white;

}

.agma-v6-btn {

    width:48%;

    margin-top:9px;

    padding:8px;

    border:0;

    border-radius:7px;

    background:#333;

    color:white;

}

@media(max-width:430px) {

    #agma-v6-panel {

        right:5px;

        bottom:73px;

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
       UI
    ========================================================= */

    function createUI() {

        if (
            document.getElementById(
                "agma-v6-root"
            )
        )
            return;


        const root =
            document.createElement(
                "div"
            );


        root.id =
            "agma-v6-root";


        root.innerHTML = `

<div id="agma-v6-bubble">
    🤖
</div>


<div id="agma-v6-panel">

    <div id="agma-v6-header">

        <div>

            <b>
                Agma AI
            </b>

            <div id="agma-v6-status">
                ● Game Knowledge + Live State
            </div>

        </div>


        <button
            id="agma-v6-close"
            class="agma-v6-tool">

            ×

        </button>

    </div>


    <div id="agma-v6-messages">

        <div class="
            agma-v6-msg
            agma-v6-ai
        ">

            🤖 Agma AI đã sẵn sàng.

            Mình đã có kiến thức nền về
            cách chơi và các khái niệm Agma.

            Bạn hỏi gì thì mình mới trả lời.

        </div>

    </div>


    <div id="agma-v6-input-area">

        <div id="agma-v6-input-box">

            <textarea
                id="agma-v6-input"
                placeholder="Hỏi AI về Agma..."
            ></textarea>


            <button id="agma-v6-send">
                ➤
            </button>

        </div>


        <div id="agma-v6-tools">

            <button
                id="agma-v6-state"
                class="agma-v6-tool">

                📡 State

            </button>


            <button
                id="agma-v6-leader"
                class="agma-v6-tool">

                🏆 Top

            </button>


            <button
                id="agma-v6-api"
                class="agma-v6-tool">

                ⚙️ API

            </button>

        </div>

    </div>


    <div id="agma-v6-settings">

        <div id="agma-v6-settings-box">

            <b>
                Groq API Key
            </b>


            <input
                id="agma-v6-key"
                type="password"
                placeholder="gsk_..."
            >


            <div
                style="
                    display:flex;
                    justify-content:space-between;
                "
            >

                <button
                    id="agma-v6-cancel"
                    class="agma-v6-btn">

                    Hủy

                </button>


                <button
                    id="agma-v6-save"
                    class="agma-v6-btn">

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


        setupUI();

    }


    function addMessage(
        text,
        type
    ) {

        const box =
            document.getElementById(
                "agma-v6-messages"
            );


        const message =
            document.createElement(
                "div"
            );


        message.className =
            "agma-v6-msg " +
            (
                type === "user"
                    ? "agma-v6-user"
                    : "agma-v6-ai"
            );


        message.textContent =
            text;


        box.appendChild(
            message
        );


        box.scrollTop =
            box.scrollHeight;

    }


    /* =========================================================
       CHAT
    ========================================================= */

    function setupUI() {

        const panel =
            document.getElementById(
                "agma-v6-panel"
            );


        document.getElementById(
            "agma-v6-bubble"
        ).onclick = () => {

            panel.classList.toggle(
                "open"
            );

        };


        document.getElementById(
            "agma-v6-close"
        ).onclick = () => {

            panel.classList.remove(
                "open"
            );

        };


        const input =
            document.getElementById(
                "agma-v6-input"
            );


        const send =
            document.getElementById(
                "agma-v6-send"
            );


        async function sendMessage() {

            const question =
                input.value.trim();


            if (!question)
                return;


            input.value = "";


            addMessage(
                question,
                "user"
            );


            if (!apiKey) {

                addMessage(

                    "⚠️ Chưa có Groq API Key.\n\n" +
                    "Bấm ⚙️ API để nhập key.",

                    "ai"

                );

                return;

            }


            send.disabled =
                true;


            send.textContent =
                "…";


            try {

                const result =
                    await askAI(
                        question
                    );


                addMessage(

                    result.ok
                        ? result.answer
                        : "❌ " +
                          result.error,

                    "ai"

                );

            } finally {

                send.disabled =
                    false;

                send.textContent =
                    "➤";

            }

        }


        send.onclick =
            sendMessage;


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );


        document.getElementById(
            "agma-v6-state"
        ).onclick = () => {

            addMessage(

                JSON.stringify(
                    getSnapshot(),
                    null,
                    2
                ),

                "ai"

            );

        };


        document.getElementById(
            "agma-v6-leader"
        ).onclick = () => {

            const state =
                getSnapshot();


            if (
                !state.leaderboard.length
            ) {

                addMessage(
                    "Chưa đọc được leaderboard.",
                    "ai"
                );

                return;

            }


            addMessage(

                state.leaderboard
                    .map(
                        x =>
                            `${x.rank}. ${x.name}`
                    )
                    .join("\n"),

                "ai"

            );

        };


        const settings =
            document.getElementById(
                "agma-v6-settings"
            );


        document.getElementById(
            "agma-v6-api"
        ).onclick = () => {

            document.getElementById(
                "agma-v6-key"
            ).value =
                apiKey;


            settings.classList.add(
                "open"
            );

        };


        document.getElementById(
            "agma-v6-cancel"
        ).onclick = () => {

            settings.classList.remove(
                "open"
            );

        };


        document.getElementById(
            "agma-v6-save"
        ).onclick = () => {

            apiKey =
                document.getElementById(
                    "agma-v6-key"
                ).value.trim();


            localStorage.setItem(

                STORAGE.KEY,

                apiKey

            );


            settings.classList.remove(
                "open"
            );


            addMessage(
                "✅ Đã lưu Groq API Key.",
                "ai"
            );

        };

    }


    /* =========================================================
       ASK AI
    ========================================================= */

    function askAI(
        question
    ) {

        ensureChat();


        const chat =
            getChat();


        const state =
            getSnapshot();


        chat.messages.push({

            role:
                "user",

            content:
                question

        });


        const messages = [

            {

                role:
                    "system",

                content:

                    AGMA_KNOWLEDGE +

                    `

=============================
LIVE GAME STATE
=============================

${JSON.stringify(
    state,
    null,
    2
)}

Khi trả lời câu hỏi hiện tại,
hãy kết hợp Knowledge Base với
Live Game State nếu phù hợp.

Nếu Live Game State không có thông tin,
không được bịa.

`

            }

        ];


        chat.messages
            .slice(
                -CONFIG.HISTORY
            )
            .forEach(
                msg => {

                    messages.push({

                        role:
                            msg.role,

                        content:
                            msg.content

                    });

                }
            );


        saveChats();


        return new Promise(
            resolve => {

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
                        60000,


                    onload:
                        response => {

                            try {

                                const data =
                                    JSON.parse(
                                        response.responseText
                                    );


                                if (
                                    response.status <
                                        200 ||
                                    response.status >=
                                        300
                                ) {

                                    resolve({

                                        ok:
                                            false,

                                        error:
                                            data?.error?.message ||
                                            (
                                                "HTTP " +
                                                response.status
                                            )

                                    });

                                    return;

                                }


                                const answer =
                                    data
                                        ?.choices
                                        ?.[0]
                                        ?.message
                                        ?.content;


                                if (!answer) {

                                    resolve({

                                        ok:
                                            false,

                                        error:
                                            "AI không trả về nội dung."

                                    });

                                    return;

                                }


                                chat.messages.push({

                                    role:
                                        "assistant",

                                    content:
                                        answer

                                });


                                saveChats();


                                resolve({

                                    ok:
                                        true,

                                    answer:
                                        answer

                                });

                            } catch {

                                resolve({

                                    ok:
                                        false,

                                    error:
                                        "Không đọc được phản hồi Groq."

                                });

                            }

                        },


                    onerror:
                        () => {

                            resolve({

                                ok:
                                    false,

                                error:
                                    "Không kết nối được Groq."

                            });

                        },


                    ontimeout:
                        () => {

                            resolve({

                                ok:
                                    false,

                                error:
                                    "Groq timeout."

                            });

                        }

                });

            }
        );

    }


    /* =========================================================
       INIT
    ========================================================= */

    function init() {

        if (!document.body) {

            setTimeout(
                init,
                100
            );

            return;

        }


        ensureChat();

        createUI();

        updateGameState();


        setInterval(

            updateGameState,

            CONFIG.STATE_INTERVAL

        );


        console.log(
            "[Agma AI V6] Ready"
        );

    }


    init();

})();
