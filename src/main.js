const Apify = require('apify');

const iterationFn = require('./iteration-fn.js');
const loadAndProcessResults = require('./load-and-process.js');
const { prepareOutput } = require('./utils.js');

Apify.main(async () => {
    const input = await Apify.getInput();
    console.log('input');
    console.dir(input);

    const {
        apifyStorageId,
        recordKey,
        rawData,
        preCheckFunction,
        field,
        limit,
        offset = 0,
        batchSize = 1000,
        showIndexes = true,
        showItems = true,
        showMissing = true,
    } = input;

    const showOptions = {
        showIndexes,
        showItems,
        showMissing,
    };

    if (!field) {
        throw new Error('Input should contain: "field"!');
    }
    if (!apifyStorageId && !rawData) {
        throw new Error('Input should contain at least one of: "apifyStorageId" or "rawData"!');
    }
    if (apifyStorageId && rawData) {
        throw new Error('Input cannot contain both of: "apifyStorageId" or "rawData"!');
    }
    let preCheckFunctionEvaled;
    try {
        preCheckFunctionEvaled = eval(preCheckFunction);
    } catch (e) {
        throw new Error('Evaluating "preCheckFunction" failed, please inlcude valid javascript! Error:', e);
    }
    if (preCheckFunction && typeof preCheckFunctionEvaled !== 'function') {
        throw new Error(`"preCheckFunction" should be a function! Instead it is ${typeof preCheckFunctionEvaled}`);
    }

    const state = await Apify.getValue('STATE');
    const duplicatesState = state
        ? state.duplicatesState
        : {};

    let datasetInfo;
    let kvStoreData;
    let totalItemCount;
    if (apifyStorageId) {
        datasetInfo = await Apify.client.datasets.getDataset({ datasetId: apifyStorageId })
            .catch(() => console.log('Dataset with "apifyStorageId" was not found, we will try kvStore'));
        if (datasetInfo) {
            totalItemCount = datasetInfo.itemCount;
            console.log('Total items in dataset:', totalItemCount);
        } else {
            console.log('dataset not found, will try KV store');
            if (!recordKey) {
                throw new Error('Cannot try to load from KV store without a "recordKey" input parameter');
            }
            kvStoreData = await Apify.client.keyValueStores.getRecord({ storeId: apifyStorageId, key: recordKey })
                .then((res) => res.body)
                .catch(() => { throw new Error(`Key-value store with "apifyStorageId": "${apifyStorageId}" and "recordKey": "${recordKey}" was not found, please input correct storage ids`); });
            if (!Array.isArray(kvStoreData)) {
                throw new Error('Data loaded from key value store must be an array!');
            }
            totalItemCount = kvStoreData.length;
        }
    }
    if (rawData) {
        if (!Array.isArray(rawData)) {
            throw new Error('Raw data must be an array!');
        }
        totalItemCount = rawData.length;
    }

    if (rawData || kvStoreData) {
        const duplicateItems = iterationFn({ items: preCheckFunctionEvaled(rawData || kvStoreData), duplicatesState, field, showOptions });
        if (showItems) {
            await Apify.pushData(duplicateItems);
        }
    } else if (datasetInfo) {
        await loadAndProcessResults({
            iterationFn,
            preCheckFunction: preCheckFunctionEvaled,
            datasetId: apifyStorageId,
            batchSize,
            limit: limit || totalItemCount,
            duplicatesState,
            field,
            showOptions,
        },
        state ? state.offset : offset, state ? state.outputOffset : 0);
    }

    await Apify.setValue('OUTPUT', prepareOutput(duplicatesState));
});
