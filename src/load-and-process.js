const Apify = require('apify');

module.exports = async (options, offset, outputOffset) => {
    const { datasetId, batchSize, limit, preCheckFunction, duplicatesState, iterationFn, field, showOptions, checkOnlyCleanItems } = options;

    while (true) {
        console.log(`loading setup: batchSize: ${batchSize}, limit left: ${limit - offset} total limit: ${limit}, offset: ${offset}`);
        const currentLimit = limit < batchSize + offset ? limit - offset : batchSize;
        console.log(`Loading next batch of ${currentLimit} items`);
        const newItems = await Apify.client.datasets.getItems({
            datasetId,
            offset,
            limit: currentLimit,
            clean: checkOnlyCleanItems,
        }).then((res) => res.items);

        console.log(`loaded ${newItems.length} items`);

        const duplicateItems = iterationFn({ items: newItems, duplicatesState, preCheckFunction, field, showOptions }, offset, outputOffset);
        if (showOptions.showItems) {
            await Apify.pushData(duplicateItems);
        }

        if (offset + batchSize >= limit || newItems.length === 0) {
            console.log('All items loaded');
            return;
        }
        offset += batchSize;
        outputOffset += duplicateItems.length;
        await Apify.setValue('STATE', { offset, outputOffset, duplicatesState });
    }
};
