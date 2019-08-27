## Duplications Checker

- [Overview](#overview)
- [How it works](#how-it-works)
- [Input](#input)
- [preCheckFunction](#preCheckFunction)
- [Report](#report)
- [Epilogue](#epilogue)

<!-- - [Usage](#usage) -->

### Overview
Duplications Checker is an [Apify actor](https://apify.com/actors) that helps you find duplicates in your datasets or JSON array.

- Loads data from Apify [Dataset](https://apify.com/docs/storage#dataset), [Key Value store](https://apify.com/docs/storage#key-value-store) or an arbitrary JSON and checks each item with all others for duplicates.
- The check takes seconds to a maximum of a few minutes for larger datasets.
- Produces a report so you know exactly how many problems are there and which items contained them.
- It is very useful to append this actor as a [webhook](https://apify.com/docs/webhooks) and you can easily chain another actor after that to [send an email](https://apify.com/apify/send-mail) or [add a report to your Google Sheets](https://apify.com/lukaskrivka/google-sheets) to name just a few examples. Check [Apify Store](https://apify.com/store) for more.

### How it works

- Loads data in batches into memory (Key Value store or raw data are loaded all at once).
- Each item in the batch is scanned for the provided field. Actor keeps track of previous occurences and count duplicates.
- A [report](#reports) is created after the whole run and saved as `OUTPUT` to the default Key Value store.
- Between each batch, the state of the actor is saved so it doesn't have to repeat itself on restart(migration).

<!--
### Usage
- For smaller datasets you can use 128 MB memory but if it fails with an 137 error code (out of memory), you will need to increase it. Add more memory for increased speed. Maximum effective memory is usually about 4 GB since the checker can use just one CPU core.
- If the report would be too big to be saved or opened, just run a few smaller runs of this actor using `limit` and `offset` parameters.

#### Compute units (CU) consumption examples (complex check & large items)
- 10,000 items - 0.005 CU (few seconds)
- 100,000 items - 0.05 (one minute, computation is instant but loading items take time)
- 1,000,000 items - 2 CU (requires up to 16 GB memory to hold data, better to split into smaller runs - this may get fixed in future version)
-->

### Input
This actor expects a JSON object as an input. You can also set it up in a visual UI on Apify. You can find examples in the Input and Example Run tabs of the actor page in Apify Store.

- `apifyStorageId` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Apify ID of the storage where the data are located. Can be ID of a dataset or key-value store or crawler execution. Key-value-store requires to set also a `inputRecordKey` **You have specify this or `rawData` but not both**
- `inputRecordKey` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Record key from where it loads data in key value store. **Only allowed when `apifyStorageId` points to a key value store**
- `rawData` <[array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)> Array of objects to be checked. **You have specify this or `apifyStorageId` but not both**.
- `preCheckFunction` <[stringified function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)> Stringified javascipt function takes the data and can apply arbitrary transformation before return updated data. [preCheckFunction](#preCheckFunction) section. **Optional**
- `field` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Field in each item that will be checked for duplicates. The field must not be nested and it should contain sonly simple value (string or number). You can prepare your data with [preCheckFunction](#preCheckFunction). **Required**
`limit`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> How many items will be checked. **Default: all**
`offset`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> From which item the checking will start. Use with `limit` to check specific items. **Default: 0**
`batchSize`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can change number of loaded and processed items in each batch. This is only needed to be changed if you have really huge items. **Default: 1000**
`showIndexes`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Indexes of the duplicate items will be shown in the OUTPUT report. Set to false if you don't need them. **Default: true**
`showItems`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Duplicate items will be pushed to a dataset. Set to false if you don't need them. **Default: true**
`showMissing`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Items where the values for the `field` is missing or is `null` or `''` will be included in the report **Default: true**

### preCheckFunction
`preCheckFunction` is useful to transform the input data before the analysis. Its main usefulness is to ensure that the field you are checking is top level fields (not nested) and that the value of that field will be a simple value like number or string (*The decision to not allow deep equality check for nested structures was made for simplicity and performance reasons*).

So for example, let's say you have an item with such a nested field:
```
[{
  "url": "https://www.bloomingdales.com/shop/product/lauren-ralph-lauren-ruffled-georgette-dress?ID=3493626&CategoryID=1005206",
  "images": [
    {
      "src": "https://images.bloomingdalesassets.com/is/image/BLM/products/9/optimized/10317399_fpx.tif",
      "cloudPath": ""
    }
  ],
  ... // more fields that you are not interested in
}]
```

If you want to check the first image URL for duplications and keep the item `url` for a reference, you can easily transform the whole data with simple `preCheckFunction`:
```
(data) => data.map((item) => ({ url: item.url, imageUrl: item.images[0].src }))
```

Now, set `field` in input to `imageUrl` and all will work nicely.

### Report
At the end of the actor run, the report is saved to the default Key Value store as an `OUTPUT`. Also, if `showItems` is `true`, it will push duplicate items to the dataset.

 By default, the report will include all information but you can opt-out if you set any of `showIndexes`, `showItems`, `showMissing` to `false`.

 Report is an object where every `field` value that appeared at least twice (which means it was duplicate) is inluced as a key. For each of them, report contains `count` (minimum is 2), `originalIndexes` (which are indexes of items in your original dataset or after `preCheckFunction`) and `outputIndexes` (only present when `showItems` is enabled). The indexes should help you navigate the duplicates in your data.

#### OUTPUT example
```
{
  "https://images.bloomingdalesassets.com/is/image/BLM/products/4/optimized/9153524_fpx.tif": {
    "count": 2,
    "originalIndexes": [
      166,
      202
    ],
    "outputIndexes": [
      0,
      1
    ]
  },
  "https://images.bloomingdalesassets.com/is/image/BLM/products/9/optimized/9832349_fpx.tif": {
    "count": 2,
    "originalIndexes": [
      1001,
      1002
    ],
    "outputIndexes": [
      2,
      3
    ]
  }
}
```

The items are intentionally not included in the OUTPUT report to reduce its size. If you need to connect the OUTPUT with the dataset for deeper analysis, you can find the items with the help of indexes.

### Checking more fields
The first version of the actor had the option to check more fields at once but it produced very complicated output and the implementation was too convoluted so I decided to abandon it for simplicity. In case you want to check more fields, simply run it multiple times. Since the actor consumption is pretty low, it is not a big deal.

**More info coming soon!**

### Epilogue
If you find any problem or would like to add a new feature, please create an issue on the [Github repo](https://github.com/metalwarrior665/duplications-checker).

Thanks everybody for using it and giving any feedback!
