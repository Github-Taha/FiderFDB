class Mend {
    constructor (host, code) {
        this.host = host;
        this.code = code || null;
        this.cache = new Map();
    }

    async set (key, value, pswdprtd = false) {
        if (!this.code) {
            throw new Error("[MendKV API] Not authenticated to set values.");
        }

        let urlEnd = pswdprtd ? "&pswdprtd" : "";
        
        return fetch(`${this.host}/?key=${key}&value=${value}${urlEnd}`, {
            "headers": {
                "x-auth-passcode": this.code,
                "bypass-tunnel-reminder": "true",
                "ngrok-skip-browser-warning": "true",
            },
            "method": "POST"
        });
    }

    async get (key, options = {}) {
        const reget = Object.keys(options).includes("reget") ? options.reget : false;
        const save = Object.keys(options).includes("save") ? options.save : true;
        
        if (this.cache.has(key) && !reget)
            return this.cache.get(key);

        let headers = {
            "bypass-tunnel-reminder": "true",
            "ngrok-skip-browser-warning": "true",
        };

        if (this.code)
            headers["x-auth-passcode"] = this.code;
        
        const response = await fetch(`${this.host}/?key=${key}`, {
            "headers": headers,
            "method": "GET"
        });

        const value = await response.text();

        if (save) {
            this.cache.set(key, value);
        }

        return value;
    }
}

module.exports = { Mend };
