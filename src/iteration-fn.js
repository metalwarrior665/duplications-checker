// This function can have 3 types of output
// - [] - first occurence of item, no duplicates
// - [item, firstItem] - second occurence of a duplicate, we need to push the first occurence item too then
// - [item] - all other cases
const checkItemField = ({ field, item, duplicatesState, showOptions, originalIndex, outputIndex }) => {
    const { showIndexes, showItems, showMissing, minDuplications } = showOptions;
    let fieldValue = item[field];
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        if (showMissing) {
            fieldValue = 'MISSING!';
        } else {
            return [];
        }
    }

    // First occurence
    if (!duplicatesState[fieldValue]) {
        duplicatesState[fieldValue] = {
            count: 1,
        };
        if (showIndexes) {
            duplicatesState[fieldValue].originalIndexes = [originalIndex];
        }
        if (showItems) {
            duplicatesState[fieldValue].firstItems = [item];
        }
        return [];
    }

    duplicatesState[fieldValue].count++;
    if (showIndexes) {
        duplicatesState[fieldValue].originalIndexes.push(originalIndex);
    }

    // Occrrences less than minDuplications
    if (duplicatesState[fieldValue].count < minDuplications) {
        if (showItems) {
            duplicatesState[fieldValue].firstItems.push(item);
        }
        return [];
    }

    // Occurrences equal minDuplications - we have to flush firstItems and push them to dataset
    if (showItems && duplicatesState[fieldValue].count === minDuplications) {
        const itemsToFlush = [...duplicatesState[fieldValue].firstItems, item];
        duplicatesState[fieldValue].outputIndexes = itemsToFlush.map((_, i) => outputIndex + i);
        outputIndex += itemsToFlush.length;
        duplicatesState[fieldValue].firstItems = undefined; // Memory cleanup. Should have better performance than delete?
        return itemsToFlush;
    }

    // Third and more occurence
    if (showItems) {
        duplicatesState[fieldValue].outputIndexes.push(outputIndex);
        outputIndex++;
    }
    return [item];
};


module.exports = ({ preCheckFunction, items, field, duplicatesState, showOptions }, offset = 0, outputOffset = 0) => {
    let updatedItems;
    if (preCheckFunction) {
        updatedItems = preCheckFunction(items);
    } else {
        updatedItems = items;
    }

    const mainDuplicateItems = [];
    let outputIndex = outputOffset;
    updatedItems.forEach((item, index) => {
        const originalIndex = index + offset;
        // This function returns array of 0, 1 or 2 duplicate items. It also manipulates the state.
        const duplicateItems = checkItemField({ field, item, duplicatesState, showOptions, originalIndex, outputIndex });
        mainDuplicateItems.push(...duplicateItems);
        outputIndex += duplicateItems.length;
    });
    return mainDuplicateItems;
};
