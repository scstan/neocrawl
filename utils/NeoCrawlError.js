'use strict'

class NeoCrawlError extends Error {

    constructor(data) {
        super();
        const keys = Object.getOwnPropertyNames(data);

        keys.forEach((key) => {
            this[key] = data[key];
        });
    }
}

module.exports = NeoCrawlError;