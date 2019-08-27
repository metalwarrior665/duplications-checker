module.exports.prepareOutput = (duplicatesState) => {
    const output = {};
    Object.entries(duplicatesState)
        .filter(([key, value]) => value.count > 1)
        .forEach(([key, value]) => {
            output[key] = value;
        });
    return output;
};
