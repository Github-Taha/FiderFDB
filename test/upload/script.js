const getFileBttn = document.querySelector("#get-file");

const mend = new Mend(MEND_URL);

getFileBttn.addEventListener("mousedown", () => {
    if (!getFileBttn.hasAttribute("down"))
        getFileBttn.setAttribute("down", "");
});

async function getDataWrapper () {    
    let ott = await Fider.getOTT(mend);
    if (!ott) return;
    let uploadURL = await Fider.getUploadURL(mend, ott, "/root/Projects", "text.txt", "plain/text");
    if (!uploadURL) return;
    let uploaded = await Fider.uploadFile(mend, uploadURL, "This is just a file that contains some text.");
    if (uploaded) console.log("File uploaded");
    else console.error("File not uploaded.");
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
