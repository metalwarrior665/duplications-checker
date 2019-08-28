const Apify = require('apify');

const iterationFn = require('./iteration-fn.js');
const loadAndProcessResults = require('./load-and-process.js');
const { prepareOutput } = require('./utils.js');

Apify.main(async () => {
    const input = await Apify.getInput();
    console.log('input');
    console.dir(input);

    const {
        datasetId,
        preCheckFunction,
        field,
        minDuplications = 2,
        showIndexes = true,
        showItems = true,
        showMissing = true,
        limit,
        offset = 0,
        batchSize = 1000,
        keyValueStoreRecord,
        rawData,
    } = input;

    const showOptions = {
        showIndexes,
        showItems,
        showMissing,
        minDuplications,
    };

    if (!field) {
        throw new Error('Input should contain: "field"!');
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
    let preCheckFunctionEvaled;
    if (preCheckFunction) {
        try {
            preCheckFunctionEvaled = eval(preCheckFunction);
        } catch (e) {
            throw new Error('Evaluating "preCheckFunction" failed, please inlcude valid javascript! Error:', e);
        }
        if (typeof preCheckFunctionEvaled !== 'function') {
            throw new Error(`"preCheckFunction" should be a function! Instead it is ${typeof preCheckFunctionEvaled}`);
        }
    }

    const state = await Apify.getValue('STATE');
    const duplicatesState = state
        ? state.duplicatesState
        : {};

    if (datasetId) {
        const datasetInfo = await Apify.client.datasets.getDataset({ datasetId })
            .catch(() => { throw new Error(`Dataset with "datasetId": "${datasetId}" was not found!`); });
        const totalItemCount = datasetInfo.itemCount;
        console.log('Total items in dataset:', totalItemCount);
        await loadAndProcessResults({
            iterationFn,
            preCheckFunction: preCheckFunctionEvaled,
            datasetId,
            batchSize,
            limit: limit || totalItemCount,
            duplicatesState,
            field,
            showOptions,
        },
        state ? state.offset : offset, state ? state.outputOffset : 0);
    } else {
        // KV store or rawData path
        let data;
        if (keyValueStoreRecord) {
            const [storeId, key] = keyValueStoreRecord.split('+');
            data = await Apify.client.keyValueStores.getRecord({ storeId, key })
                .then((res) => res.body)
                .catch(() => { throw new Error(`Key-value store record with "ID": "${storeId}" and "recordKey": "${key}" was not found! Please input correct storage.`); });
        } else if (rawData) {
            data = rawData;
        }

        if (!Array.isArray(data)) {
            throw new Error('Data loaded from key value store must be an array!');
        }
        console.log(`Total items loaded: ${data.length}`);
        const duplicateItems = iterationFn({
            items: data,
            preCheckFunction: preCheckFunctionEvaled,
            duplicatesState,
            field,
            showOptions,
        });
        if (showItems) {
            await Apify.pushData(duplicateItems);
        }
    }

    await Apify.setValue('OUTPUT', prepareOutput(duplicatesState, minDuplications));
});
