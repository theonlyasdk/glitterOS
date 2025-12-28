/**
 * Common utility functions for sorting, document querying, etc
 */

const urlParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

const fromId = (id) => document.getElementById(id);
const query = (qs) => document.querySelector(qs);
const queryAll = (qs) => document.querySelectorAll(qs);

const shuffle = (array) => {
    // See: https://javascript.info/task/shuffle
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

/**
 * Replaces `\n` with `<br>`, `\t` with `&nbsp;&nbsp;`,
 * `@!element` with `<element>` and `@/element` with `</element>`
 * @returns string with replaced values
 */
String.prototype.htmlStr = function (tabs = 2) {
    let formattedString = this;
    let spaces = [];

    for (let i = 0; i < tabs; i++) {
        spaces.push("&nbsp;");
    }

    const replacements = {
        "@!(\\w+)": "<$1>",
        "@/(\\w+)": "</$1>",
        "\t": spaces.join(""),
        "\n": "<br>",
    };

    for (const pattern in replacements) {
        const regex = new RegExp(pattern, "g");
        formattedString = formattedString.replace(regex, replacements[pattern]);
    }

    return formattedString;
};


class Logger {
    constructor(prefix, options = {}) {
        this.prefix = prefix;
        this.enabled = options.enabled ?? true;
        this.timeStamp = options.timeStamp ?? true;
        this.logLevel = options.logLevel ?? "info";
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
    }

    build = (string) => {
        if (!this.enabled) return "";
        const time = this.timeStamp ? `[${new Date().toISOString()}] ` : "";
        return `${time}${this.prefix}: ${string}`;
    };

    error = (string) => {
        if (this.levels[this.logLevel] <= this.levels.error) {
            console.error(this.build(string));
        }
    };

    log = (string) => {
        if (this.levels[this.logLevel] <= this.levels.info) {
            console.log(this.build(string));
        }
    };

    warn = (string) => {
        if (this.levels[this.logLevel] <= this.levels.warn) {
            console.warn(this.build(string));
        }
    };

    debug = (string) => {
        if (this.levels[this.logLevel] <= this.levels.debug) {
            console.debug(this.build(string));
        }
    };

    setLogLevel = (level) => {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = level;
        }
    };

    enable = () => {
        this.enabled = true;
    };
    disable = () => {
        this.enabled = false;
    };
}
