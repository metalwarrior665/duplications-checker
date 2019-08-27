module.exports = ({ preCheckFunction, items, fields, duplicatesState }, offset = 0) => {
    let updatedItems;
    if (preCheckFunction) {
        updatedItems = preCheckFunction(items);
    } else {
        updatedItems = items;
    }
    updatedItems.forEach((item, index) => {
        const realIndex = index + offset;
        fields.forEach((field) => {
            const fieldData = item[field] || 'MISSING!';
            if (!duplicatesState[field][fieldData]) {
                duplicatesState[field][fieldData] = {
                    count: 1,
                    itemIndexes: [realIndex],
                    items: [item],
                };
            } else {
                duplicatesState[field][fieldData].count++;
                duplicatesState[field][fieldData].itemIndexes.push(realIndex);
                duplicatesState[field][fieldData].items.push(item);
            }
        });
    });
};
