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

async function getFileURL (ott, path) {
    console.log("FiderFDB: " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(await mend.get("fiderfdb") + "/file/download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
                body: JSON.stringify({ token: ott, path: path })
            });

            if (!response.ok) {
                throw new Error("Getting Download URL Failed");
            }

            const { downloadURL } = await response.json();
            console.log(downloadURL);

            return downloadURL;
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

async function getFile (downloadURL) {
    console.log("FiderFDB: " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(`${await mend.get("fiderfdb")}/file/download/${downloadURL}`, {
                method: "GET",
                headers: {
                    "ngrok-skip-browser-warning": "true",
                    "bypass-tunnel-reminder": "true",
                },
            });

            if (!response.ok) {
                throw new Error("Download Failed");
            }

            const contentDisposition = response.headers.get("Content-Disposition");
            const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1];
            console.log("Saved as:", filename);

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = filename ? filename : "file.txt";
            a.click();

            alert(`File '${filename}' has been downloaded.`);

            URL.revokeObjectURL(url);

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
    let downloadURL = await getFileURL(ott, "/root/helloworld.txt");
    await getFile(downloadURL);
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