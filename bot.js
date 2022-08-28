let io = require("socket.io-client");
let config = require("./config");

let cookie = config.cookie;

let myColor = -1;
let size = 20;
let gm = [];
let hasmap = false;

let s = io("https://kana.byha.top:444/", {
    path: "/ws/checkmate",
    extraHeaders: { "cookie": cookie }
});

s.on("connect", () => {
    console.log("WS connected Successfully");
    join_room();
});

s.on("error", () => console.error("WS Error!"));

s.on("disconnect", () => console.warn("WS disconnected!"));

s.on("reconnect", () => console.warn("WS reconnect!"));

function join_room() {
    s.emit("joinRoom", config.gameRoom);
    console.log("join room", config.gameRoom);
    voteStart(1);
}

function voteStart(i) {
    s.emit("VoteStart", i);
}

s.on("UpdateGM", (dat) => {
    hasmap = true;
    size = dat[0].length - 1;
    gm = dat;
});

s.on("UpdateColor", (dat) => myColor = dat);

s.on("UpdateSize", (dat) => size = dat);

s.on("Map_Update", (dat) => {
    if (!hasmap) {
        s.emit("Ask_GM");
        hasmap = true;
        return;
    }

    for (let e of dat[1]) {
        gm[Number(e[0])][Number(e[1])] = JSON.parse(e[2]);
    }

    botMove();
});

s.on("WinAnction", () => {
    hasmap = false;
    target = [];
    voteStart(1);
    voteMap(1);
});

function setSpeed(speed) {
    s.emit("changeSettings", { speed: speed });
}

function setPrivate(private) {
    s.emit("changeSettings", { private: private });
}

function voteMap(map) {
    s.emit("changeSettings", { map: map });
}

s.on("UpdateSettings", (dat) => {
    if (dat.private != config.private)
        setPrivate(config.private);

    if (dat.speed != config.speed)
        setSpeed(config.speed);
});

let dir = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1]
];
let target = [];
let from = [];

function dist(p1, p2) {
    return Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]);
}

function getNeighbours(a) {
    let tmp = [];

    for (let i of dir) {
        let px = a[0] + i[0];
        let py = a[1] + i[1];
        if (px >= 1 && px <= size && py >= 1 && py <= size && gm[px][py].type != 4 && gm[px][py].type != 6)
            tmp.push([px, py]);
    }

    return tmp;
}

function visible(p) {
    for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
            let px = p[0] + i;
            let py = p[1] + j;

            if (px >= 1 && px <= size && py >= 1 && py <= size && gm[px][py].color == myColor)
                return true;
        }

    return false;
}

function move_to(sp, ep) {
    let s = gm[sp[0]][sp[1]];
    let e = gm[ep[0]][ep[1]];
    let halfTag = 0;

    if (e.type != 0 && e.type != 5 && e.color != myColor && Math.floor((s.amount - 1) / 2) > e.amount) {
        let flag = false;

        for (let nxt of getNeighbours(sp)) {
            let node = gm[nxt[0]][nxt[1]];
            if (node.color != myColor && (node.type == 2 || node.type == 3) && (nxt[0] != ep[0] || nxt[1] != ep[1])) {
                flag = true;
                break;
            }
        }

        if (flag) {
            halfTag = 1;
        }
    }

    return [sp, ep, halfTag];
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(x) {
    return x[randInt(0, x.length - 1)];
}

function shuffle(a) {
    let len = a.length;

    for (let i = 0; i < len; i++) {
        let end = len - 1;
        let index = (Math.random() * (end + 1)) >> 0;
        let t = a[end];
        a[end] = a[index];
        a[index] = t;
    }
}

function updateMovement(tmp) {
    if (tmp.length == 0) {
        return;
    }

    s.emit("UploadMovement", [tmp[0][0], tmp[0][1], tmp[1][0], tmp[1][1], tmp[2]]);
}

function changeTarget() {
    let score = { 1: 1, 3: 1, 2: 1, 5: 2, 0: 2 };
    let tmp = [];

    for (let i = 1; i <= size; i++) {
        for (let j = 1; j <= size; j++) {
            let node = gm[i][j];

            if (node.type != 4 && node.type != 6 && node.color != myColor && visible([i, j])) {
                tmp.push([i, j]);
            }
        }
    }

    if (tmp.length == 0) {
        return;
    }

    shuffle(tmp);

    tmp.sort((a, b) => {
        let nodeA = gm[a[0]][a[1]], nodeB = gm[b[0]][b[1]];
        return score[nodeA.type] - score[nodeB.type];
    });

    target = tmp[0];
}

function nextMove() {
    if (target.length == 0 || gm[target[0]][target[1]].color == myColor) {
        changeTarget();
        from = [];

        if (target.length == 0) {
            return [];
        }
    }

    function getScore(node) {
        if (node.color == myColor) {
            return node.amount - 1;
        } else {
            return -node.amount - 1;
        }
    }

    let maxAns = [], maxScore = -999999, newFrom = [];

    function bfs(i, j) {
        let q = [], vis = {};
        q.push([[i, j], gm[i][j].amount, 0, []]);
        vis[[i, j]] = true;

        while (q.length != 0) {
            let first = q.splice(0, 1)[0];
            let cur = first[0], amount = first[1], length = first[2], ans = first[3];

            if (cur[0] == target[0] && cur[1] == target[1]) {
                let score = amount / Math.sqrt(length);

                if (score > maxScore) {
                    maxScore = score;
                    maxAns = ans;

                    if (from.length == 0) {
                        newFrom = [i, j];
                    }
                    continue;
                }
            }

            for (nxt of getNeighbours(cur)) {
                if (!vis[nxt]) {
                    if (cur[0] == i && cur[1] == j) {
                        q.push([nxt, amount + getScore(gm[nxt[0]][nxt[1]]), length + 1, nxt]);
                    }
                    else {
                        q.push([nxt, amount + getScore(gm[nxt[0]][nxt[1]]), length + 1, ans]);
                    }
                    vis[nxt] = true;
                }
            }
        }
    }

    if (from.length == 0) {
        for (let i = 1; i <= size; i++) {
            for (let j = 1; j <= size; j++) {
                if (gm[i][j].color == myColor && gm[i][j].amount > 1) {
                    bfs(i, j);
                }
            }
        }
    } else {
        bfs(from[0], from[1]);
    }

    if (maxAns.length == 0) {
        target = [];
        return [];
    }

    if (maxAns[0] == target[0] && maxAns[1] == target[1]) {
        target = [];
    }

    if (from.length == 0) {
        from = newFrom;
    }

    let ans = move_to(from, maxAns);
    from = maxAns;
    return ans;
}

function expand() {
    let score = { 1: 1, 3: 2, 2: 3, 5: 4, 0: 5 };
    let tmp = [];

    for (let i = 1; i <= size; i++) {
        for (let j = 1; j <= size; j++) {
            if (gm[i][j].color == myColor) {
                let start = [i, j], startNode = gm[i][j];

                for (let end of getNeighbours(start)) {
                    let endNode = gm[end[0]][end[1]];

                    if (endNode.color != myColor && startNode.amount > endNode.amount + 1) {
                        tmp.push([start, end]);
                    }
                }
            }
        }
    }

    if (tmp.length == 0) {
        return nextMove();
    }

    shuffle(tmp);

    tmp.sort((a, b) => {
        let nodeA = gm[a[1][0]][a[1][1]], nodeB = gm[b[1][0]][b[1][1]];
        return score[nodeA.type] - score[nodeB.type];
    });

    return move_to(tmp[0][0], tmp[0][1]);
}

function botMove() {
    try {
        updateMovement(randInt(1, 100) >= 70 ? nextMove() : expand());
    } catch (error) {
        console.error(error);
    }
}