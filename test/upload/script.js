const getFileBttn = document.querySelector("#get-file");

const mend = new Mend(MEND_URL);

getFileBttn.addEventListener("mousedown", () => {
    if (!getFileBttn.hasAttribute("down"))
        getFileBttn.setAttribute("down", "");
});

async function getOTT() {
    console.log("Mainserver: " + await mend.get("mainserver"));
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(await mend.get("mainserver") + "/file/fileOTT", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
                body: JSON.stringify({ token: "MyToken" })
            });

            const data = await response.json();

            if (response.status !== 200 || data.error) {
                throw new Error("Invalid");
            }

            console.log("OTT: " + data.token);

            return data.token;
        }
        catch (err) {
            if (i === 0) {
                console.log("Cannot connect to main server. Retrying with updated data...");

                await mend.get("mainserver", { reget: true });
            }
            else {
                throw new Error("Couldn't connect to main server.");
                return null;
            }
        }
    }
}

async function getUploadURL (ott, parent, name, mime) {
    console.log("FiderFDB: " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(await mend.get("fiderfdb") + "/file/upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
                body: JSON.stringify({
                    token: ott, 
                    parent: parent,
                    name: name,
                    mime: mime
                })
            });

            if (response.status == 404) {
                throw new Error("Getting Upload URL Failed");
            }

            const data = await response.json();
            
            if (response.status == 400) {
                console.error(data.error);
                return false;
            }

            return data.uploadURL;
        }
        catch (err) {
            if (i === 0) {
                console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                console.log(err);
                await mend.get("fiderfdb", { reget: true });
            }
            else {
                throw new Error("Couldn't connect to FiderFDB.");
                return null;
            }
        }
    }
}

async function uploadFile (uploadURL, text) {
    console.log("FiderFDB: " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(`${await mend.get("fiderfdb")}/file/upload/${uploadURL}`, {
                method: "POST",
                headers: {
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
                body: text
            });

            if (!response.ok)
                throw new Error("Upload Failed");

            return true;
        }
        catch (err) {
            if (i === 0) {
                console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                console.log(err);
                await mend.get("fiderfdb", { reget: true });
            }
            else {
                throw new Error("Couldn't connect to FiderFDB.");
                return null;
            }
        }
    }
}

async function getDataWrapper () {
    const MAINSERVER_URL = await mend.get("mainserver");
    const FDB_URL = await mend.get("fiderfdb");
    
    let ott = await getOTT();
    let uploadURL = await getUploadURL(ott, "/root", "helloworld.txt", "plain/text");
    if (uploadURL) await uploadFile(uploadURL, "This is some text in 'helloworld.txt'.");
}

getFileBttn.addEventListener("click", async () => {
    await getDataWrapper();
});

window.addEventListener("mouseup", () => {
    if (getFileBttn.hasAttribute("down"))
        getFileBttn.removeAttribute("down");
});

window.onload = async () => {
    await mend.get("mainserver");
    await mend.get("fiderfdb");
};