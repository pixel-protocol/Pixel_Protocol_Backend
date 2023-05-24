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

const N = 3000000

const arrayBuffer = new ArrayBuffer(N); // 3 MB
const arrayView = new Uint8Array(arrayBuffer);

for (let i = 0; i < N; i++) {
    arrayView[i] = 255;
}

const DecToRGB = (dec) => {
    const r = Math.floor(dec / (256 * 256));
    const g = Math.floor(dec / 256) % 256;
    const b = dec % 256;
    return [r, g, b]
}


const mumbaiAPIKey = process.env.ALCHEMY_API_KEY_MUMBAI;
const mumbaiProvider = new ethers.providers.AlchemyProvider("maticmum", mumbaiAPIKey);

const contract = new ethers.Contract(contractAddress, contractABI, mumbaiProvider);


contract.on("ColorChange", (_, pixelIds, pixelColors) => {
    const ids = pixelIds.map(id=>id.toNumber())
    const colors = pixelColors.map(color => DecToRGB(color))
    for(let i=0;i<ids.length;i++){
        const id = ids[i]
        const color = colors[i]
        const [r,g,b] = color
        const startIndex = id * 3
        arrayView[startIndex] = r
        arrayView[startIndex+1] = g
        arrayView[startIndex+2] = b
    }

    console.log("Color change!")


    io.emit('colorChange',{
        ids: ids,
        colors: colors
    })
})


io.on('connection', (socket) => {
    socket.emit('canvas', arrayView)
    socket.on('requestCanvas', () => {
        socket.emit('canvas', arrayView)
    })
});



server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);

});

const STEP = 100;
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
        for (let row=startIndex; row < 1000; row += STEP) {

            /*console.log("row start")
            console.log(values[Math.floor(col / STEP)])
            console.log("row end")*/

            const rgbRow = values[Math.floor(row / STEP)].flatMap(color => DecToRGB(color));
            if (rgbRow.length !== 3000) {
                throw Error("Invalid length of row returned.")
            }

            const s = row * 1000 * 3

            for(let j=0;j<3000;j++){
                arrayView[s+j] = rgbRow[j]
            }
        }
        console.log(arrayView)
        io.emit('canvas', arrayView);

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
