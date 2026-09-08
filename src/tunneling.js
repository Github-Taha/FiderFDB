const { spawn, exec } = require("child_process");
const ngrok = require("@ngrok/ngrok");

async function forceKillNgrok() {
    return new Promise((resolve) => {
        exec("pkill -f ngrok", (err) => {
            resolve();
        });
    });
}

async function startNgrok (port, ngrokAuthtoken) {
    await forceKillNgrok();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let listener;

    ngrokLoop: while (true) {
        try {
            listener = await ngrok.forward({
                addr: port,
                authtoken: ngrokAuthtoken
            });

            break ngrokLoop;
        } catch (err) {
            console.error("Failed to connect Ngrok. Retrying in 1s...");
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    return listener.url();
}

function startTunnel(port, subdomain = "") {
    return new Promise((resolve, reject) => {
        const ltProcess = spawn("npx", ["lt", "--port", port, "--subdomain", subdomain]);
    
        ltProcess.stdout.on("data", (data) => {
            const output = data.toString();
            const match = output.match(/https:\/\/[^\s]+/);
            
            if (match) {
                const tunnelURL = match[0];

                setInterval(() => {
                    fetch(tunnelURL).catch(() => {});
                }, 30000);

                resolve(tunnelURL);
            }
        });
    
        ltProcess.on("close", (code) => {
            console.log(`Tunnel closed (code ${code}), restarting in 500ms...`);
            ltProcess.kill("SIGINT");
            setTimeout(startTunnel, 500);
        });
    
        process.on("SIGINT", () => {
            console.log("\nClosing tunnel and shutting down...");
            ltProcess.kill("SIGINT");
            process.exit();
        });
    });
}

module.exports = { startNgrok, startTunnel };
