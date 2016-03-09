'use strict';

class NeoCrawlError extends Error {

    constructor(data) {
        super();
        for (key of data) {
            this[key] = data;
        }
    }
}

module.exports = NeoCrawlError;