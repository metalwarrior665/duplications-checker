const Apify = require('apify');
const { utils: { log } } = Apify;

/**
 * Validates basic input options
 * @param {object} input
 * @return {Promise<void>}
 */
const validateInput = async (input) => {
    const {
        field, fields, datasetId, rawData,
        keyValueStoreRecord,
    } = input;

    if (!field && !fields) throw new Error('At least one of the "field" or "fields" options must be provided!');

    if (field && typeof field !== "string") {
        throw new Error('The input option "field" should contain string value!');
    }
    if (fields && !Array.isArray(fields)) {
        throw new Error('The input option "fields" should contain an array of string values!');
    }
    if (!datasetId && !keyValueStoreRecord && !rawData) {
        throw new Error('Input should contain at least one of: "apifyStorageId", "keyValueStoreRecord" or "rawData"!');
    }
    const providedDataInputs = [datasetId, rawData, keyValueStoreRecord].filter((dataInput) => !!dataInput);
    if (providedDataInputs.length > 1) {
        throw new Error('Input cannot contain more than one of: "apifyStorageId", "keyValueStoreRecord" or "rawData"! ');
    }
    if (keyValueStoreRecord && keyValueStoreRecord.split('+').length !== 2) {
        throw new Error('Could not parse key value store ID and record key from "keyValueStoreRecord"!')
    }
};

/**
 * Gets evaluated check function or throws
 * @param {function} preCheckFunction
 * @return {Promise<*>}
 */
const getEvaluatedCheckFncOrThrow = async (preCheckFunction) => {
    let pareCheckFunctionEvaluated;
    try {
        pareCheckFunctionEvaluated = eval(preCheckFunction);
    } catch (e) {
        throw new Error('Evaluating "preCheckFunction" failed, please inlcude valid javascript! Error:', e);
    }
    if (typeof pareCheckFunctionEvaluated !== 'function') {
        throw new Error(`"preCheckFunction" should be a function! Instead it is ${typeof pareCheckFunctionEvaluated}`);
    }

    return pareCheckFunctionEvaluated;
};


/**
 * Loads dataset info by the datasetId and gets it's item count
 * @param {string} datasetId
 * @return {Promise<number>}
 */
const getDatasetItemCountOrThrow = async (datasetId) => {
    const datasetInfo = await Apify.client.datasets.getDataset({ datasetId })
        .catch(() => { throw new Error(`Dataset with "datasetId": "${datasetId}" was not found!`); });
    const { itemCount } = datasetInfo;
    log.info('Total items in dataset:', itemCount);

    return itemCount;
};

/**
 * Loads data from key-value store for given store record or throws
 * @param keyValueStoreRecord
 * @return {Promise<T>}
 */
const loadDataFromStoreOrThrow = async (keyValueStoreRecord) => {
    let data;
    const [storeId, key] = keyValueStoreRecord.split('+');
    data = await Apify.client.keyValueStores.getRecord({ storeId, key })
        .then((res) => res.body)
        .catch(() => { throw new Error(`Key-value store record with "ID": "${storeId}" and "recordKey": "${key}" was not found! Please input correct storage.`); });

    return data;
};

/**
 * Loads all the dataset items and processes the duplication checks
 * @param {object} options
 * @param {number} offset
 * @param {number} outputOffset
 * @return {Promise<void>}
 */
const loadAndProcessResults = async (options, offset, outputOffset) => {
    const { datasetId, batchSize, limit, preCheckFunction, duplicatesState, fields, showOptions, checkOnlyCleanItems } = options;

    while (true) {
        log.info(`loading setup: batchSize: ${batchSize}, limit left: ${limit - offset} total limit: ${limit}, offset: ${offset}`);
        const currentLimit = limit < batchSize + offset ? limit - offset : batchSize;
        log.info(`Loading next batch of ${currentLimit} items`);
        const newItems = await Apify.client.datasets.getItems({
            datasetId,
            offset,
            limit: currentLimit,
            clean: checkOnlyCleanItems,
        }).then((res) => res.items);

        log.info(`loaded ${newItems.length} items`);

        const duplicateItems = iterationFunction({ items: newItems, duplicatesState, preCheckFunction, fields, showOptions }, offset, outputOffset);
        if (showOptions.showItems) {
            await Apify.pushData(duplicateItems);
        }

        if (offset + batchSize >= limit || newItems.length === 0) {
            log.info('All items loaded');
            return;
        }
        offset += batchSize;
        outputOffset += duplicateItems.length;
        await Apify.setValue('STATE', { offset, outputOffset, duplicatesState });
    }
};

/**
 * Prepares output object
 * @param {object} duplicatesState
 * @param {number} minDuplications
 * @return {{}}
 */
const prepareOutput = (duplicatesState, minDuplications) => {
    const output = {};
    Object.entries(duplicatesState)
        .filter(([key, value]) => value.count >= minDuplications)
        .forEach(([key, value]) => {
            output[key] = value;
        });
    return output;
};

/**
 *  Iterates through all the provided items and checks each of item for duplicates
 * @param {function} preCheckFunction
 * @param {object[]} items
 * @param {string[]} fields
 * @param {object} duplicatesState
 * @param {object} showOptions
 * @param {number} offset
 * @param {number} outputOffset
 * @return {[]}
 */
const iterationFunction = ({ preCheckFunction, items, fields, duplicatesState, showOptions }, offset = 0, outputOffset = 0) => {
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
        fields.forEach((field) => {
                const duplicateItems = checkItemField({ field, item, duplicatesState, showOptions, originalIndex, outputIndex });
                mainDuplicateItems.push(...duplicateItems);
                outputIndex += duplicateItems.length;
            })
    });

    return mainDuplicateItems;
};

/**
 * Checks given item for a field duplication
 * This function can have 3 types of output
 *  1) [] - first occurrence of item, no duplicates
 *  2) [item, firstItem] - second occurrence of a duplicate, we need to push the first occurrence item too then
 *  3) [item] - all other cases
 * @param {string} field
 * @param {object} item
 * @param {object} duplicatesState
 * @param {object} showOptions
 * @param {number} originalIndex
 * @param {number} outputIndex
 * @return {(*)[]|*[]}
 */
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

    // First occurrence
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

    // Occurrences less than minDuplications
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

    // Third and more occurrence
    if (showItems) {
        duplicatesState[fieldValue].outputIndexes.push(outputIndex);
        outputIndex++;
    }
    return [item];
};


module.exports = {
    validateInput,
    getEvaluatedCheckFncOrThrow,
    getDatasetItemCountOrThrow,
    loadDataFromStoreOrThrow,
    prepareOutput,
    loadAndProcessResults,
    iterationFunction,
};
