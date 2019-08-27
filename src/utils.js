module.exports.prepareOutput = (duplicatesState, minDuplications) => {
    const output = {};
    Object.entries(duplicatesState)
        .filter(([key, value]) => value.count >= minDuplications)
        .forEach(([key, value]) => {
            output[key] = value;
        });
    return output;
};
