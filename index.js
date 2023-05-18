const http = require('http');
const ethers = require('ethers');
/*const fs = require('fs');*/
require('dotenv').config()


const { contractABI, contractAddress } = require('./constants/contract')

const hostname = 'localhost';
const port = 8000;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
});

const { Server } = require("socket.io");
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const N = 1000000

const arrayBuffer = new ArrayBuffer(N); // 1 MB
const arrayView = new Uint8Array(arrayBuffer);

for (let i = 0; i < N; i++) {
    arrayView[i] = 0;
}

const getOffset = (x, y) => {
    return y * 1000 + x
}


const mumbaiAPIKey = process.env.ALCHEMY_API_KEY_MUMBAI;
const mumbaiProvider = new ethers.providers.AlchemyProvider("maticmum", mumbaiAPIKey);

const contract = new ethers.Contract(contractAddress, contractABI, mumbaiProvider);


contract.on("ColorChange", (_, x, y, newCode) => {
    const C = Number(newCode);
    const X = x.toNumber()
    const Y = y.toNumber()
    const offset = getOffset(X, Y);
    console.log("Color change!")
    console.log(`(${x},${y}), ${C}`)
    if (C !== arrayView[offset]) {
        arrayView[offset] = C;

        io.emit('pixelData', {
            x: X,
            y: Y,
            code: C
        });
    }


})


io.on('connection', (socket) => {
    socket.emit('canvasData', arrayView)
    socket.on('requestCanvasData', () => {
        socket.emit('canvasData', arrayView)
    })
});



server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);

});

const STEP = 25;
var startIndex = 0;



setInterval(function () {
    const promises = []
    console.log("API KEY LENGTH" + mumbaiAPIKey.length)

    for (let i = startIndex; i < 1000; i += STEP) {
        promises.push(contract.getCanvasRow(i))
    }

    Promise.all(promises).then(values => {
        if (values.length === 0) {
            throw Error("No promises resolved.")
        }
        if (values.length !== promises.length) {
            throw Error("Not all promises resolved.")
        }
        for (let col = startIndex; col < 1000; col += STEP) {

            /*console.log("row start")
            console.log(values[Math.floor(col / STEP)])
            console.log("row end")*/
            const rgbRow = values[Math.floor(col / STEP)].flatMap((hex) => Number(hex));
            if (rgbRow.length !== 1000) {
                throw Error("Invalid length of row returned.")
            }
            for (let row = 0; row < 1000; row++) {
                const offset = getOffset(col, row);
                arrayView[offset] = rgbRow[row];
            }
        }
        io.emit('canvasData', arrayView);

        startIndex = (startIndex + 1) % STEP
        //console.log(startIndex)
    }).catch(err => console.log(err.message))
    console.log(`Rows ${startIndex}, ${startIndex + STEP}... updated`);
}, 10000);




//save canvas state on exit

/*

async function exitHandler() {
    try {
        const latestBlock = await mumbaiProvider.getBlockNumber()
        fs.writeFileSync(`log_${+ new Date()}`, JSON.stringify({ latestBlock: latestBlock }))
    } catch (e) {
        console.error('EXIT HANDLER ERROR', e);
    }
    process.exit()
}

[
    'beforeExit', 'uncaughtException', 'unhandledRejection',
    'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP',
    'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV',
    'SIGUSR2', 'SIGTERM',
].forEach((eventType) => {
    process.on(eventType, exitHandler);
})

*/


process.on("exit", () => {
    console.log(`APP stopped !`);
});
