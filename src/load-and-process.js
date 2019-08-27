const Apify = require('apify');

module.exports = async (options, offset) => {
    const { datasetId, batchSize, limit, preCheckFunction, duplicatesState, iterationFn, fields } = options;

    while (true) {
        console.log(`loading setup: batchSize: ${batchSize}, limit left: ${limit - offset} total limit: ${limit}, offset: ${offset}`);
        const currentLimit = limit < batchSize + offset ? limit - offset : batchSize;
        console.log(`Loading next batch of ${currentLimit} items`);
        const newItems = await Apify.client.datasets.getItems({
            datasetId,
            offset,
            limit: currentLimit,
        }).then((res) => res.items);

        console.log(`loaded ${newItems.length} items`);

        iterationFn({ items: newItems, duplicatesState, preCheckFunction, fields }, offset);

        if (offset + batchSize >= limit || newItems.length === 0) {
            console.log('All items loaded');
            return;
        }
        await Apify.setValue('STATE', { offset, duplicatesState });
        offset += batchSize;
    }
};
