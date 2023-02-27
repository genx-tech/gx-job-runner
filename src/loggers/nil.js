module.exports = {
    tag: (keyword) => {
        return keyword;
    },

    log: (level, message, meta) => {
        if (level === 'error') {
            throw new Error(message);
        }
    }
};