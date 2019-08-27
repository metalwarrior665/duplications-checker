const trimFields = (item, identificationFields) => {
    if (identificationFields.length === 0) {
        return item;
    }
    return identificationFields.reduce((newItem, field) => {
        newItem[field] = item[field];
        return newItem;
    }, {});
};

module.exports.prepareOutput = (duplicatesState) => {
    const output = {};
    Object.keys(duplicatesState).forEach((field) => {
        output[field] = {};
        Object.entries(duplicatesState[field])
            .filter(([key, value]) => value.count > 1)
            .forEach(([key, value]) => {
                output[field][key] = value;
            });
    });
    return output;
};
