const Apify = require('apify');
const { utils: { log } } = Apify;

const { validateInput, prepareOutput, loadAndProcessResults,
        iterationFunction, getEvaluatedCheckFncOrThrow,
        getDatasetItemCountOrThrow, loadDataFromStoreOrThrow } = require('./utils.js');

Apify.main(async () => {
    const input = await Apify.getInput();
    log.info('input:');
    console.dir(input);

    const {
        datasetId,
        checkOnlyCleanItems = false,
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

    // input validation
   await validateInput(input);

   let pareCheckFunctionEvaluated;
    if (preCheckFunction) {
        pareCheckFunctionEvaluated = await getEvaluatedCheckFncOrThrow(preCheckFunction);
    }

    const state = await Apify.getValue('STATE');
    const duplicatesState = state ? state.duplicatesState : {};

    if (datasetId) {
        const totalItemCount = await getDatasetItemCountOrThrow(datasetId);
        const actualOffset = state ? state.offset : offset;
        const outputOffset = state ? state.outputOffset : 0;

        const processOptions = {
            preCheckFunction: pareCheckFunctionEvaluated,
            datasetId,
            batchSize,
            limit: limit || totalItemCount,
            duplicatesState,
            field,
            showOptions,
            checkOnlyCleanItems
        };

        await loadAndProcessResults(processOptions, actualOffset, outputOffset);
    } else {
        // KV store or rawData path
        let data;
        if (keyValueStoreRecord) {
            data = await loadDataFromStoreOrThrow(keyValueStoreRecord);
        } else if (rawData) {
            data = rawData;
        }

        if (!Array.isArray(data)) {
            throw new Error('Data loaded from key value store must be an array!');
        }
        log.info(`Total items loaded: ${data.length}`);

        const iterationFunctionOptions = {
            items: data,
            preCheckFunction: pareCheckFunctionEvaluated,
            duplicatesState,
            field,
            showOptions,
        };
        const duplicateItems = iterationFunction(iterationFunctionOptions);

        if (showItems) {
            await Apify.pushData(duplicateItems);
        }
    }

    await Apify.setValue('OUTPUT', prepareOutput(duplicatesState, minDuplications));
});
