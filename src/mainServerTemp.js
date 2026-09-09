const express = require("express");
const cors = require("cors");
const app = express();
const { Mend } = require("./mend");
const { startNgrok } = require("./tunneling");

app.use(cors({
    origin: '*',
    allowedHeaders: [
        "Content-Type",
        "Bypass-Tunnel-Reminder",
        "Ngrok-Skip-Browser-Warning"
    ]
}));
app.use(express.json());

app.set('trust proxy', true);

const PORT = 8081;

const mend = new Mend("https://81b3-2607-fea8-605b-db00-f83b-e40e-3212-6509.ngrok-free.app", "password");

const GLOBAL_AUTHTOKEN = crypto.randomUUID();

async function sendOTTtoFider (ott, user_id) {
    console.log("[sendOTTtoFider] Sending OTT to FiderFDB - " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
            const fdbResponse = await fetch((await mend.get("fiderfdb")) + "/file/OTT", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
                body: JSON.stringify({ authtoken: GLOBAL_AUTHTOKEN, token: ott, userID: user_id })
            });

            if (fdbResponse.status != 200)
                throw new Error("[sendOTTtoFider] Invalid");

            console.log("[sendOTTtoFider] OTT Sent to FiderFDB");

            return true;
        }
        catch (err) {
            if (i === 0) {
                console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                await mend.get("fiderfdb", { reget: true });
            }
            else {
                console.log("Cannot connect to FiderFDB.");
                console.log(err);
                return false;
            }
        }
    }
}

function generateToken (len = 64) {
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let final = "";

    for (let i = 0; i < len; i++) {
        final += chars[Math.floor(Math.random() * chars.length)];
    }

    return final;
}

app.get("/", (req, res) => {
    res.type("text/plain");
    res.send("Main Server\n");
});

app.post("/file/fileOTT", async (req, res) => {
    console.log("User Requesting for OTT");

    // Verify User (Not needed in this demo)
    const user_id = 3;

    // Generate OTT
    const ott = generateToken(64);
    console.log("OTT: " + ott);
    console.log("User ID: " + user_id);

    // Send OTT to FiderFDB
    if (!(await sendOTTtoFider(ott, user_id))) {
        res.status(500).json({
            error: true,
        });
        return;
    }

    // Send OTT to Client
    res.json({
        token: ott,
    });
});

(async () => {
    console.log("Global Authtoken: " + GLOBAL_AUTHTOKEN);
    await mend.set("global-authtoken", GLOBAL_AUTHTOKEN, true);

    app.listen(PORT, async () => {
        console.log(`\x1b[32m[Main Server FiderFDB Demo] Listening on port ${PORT}\x1b[0m`);
    });

    const tunnelURL = await startNgrok(PORT, process.env.NGROK_AUTHTOKEN);
    console.log("Generated URL:", tunnelURL);
    await mend.set("mainserver", tunnelURL);

    await mend.get("fiderfdb");
})();


