import { Meteor } from 'meteor/meteor';
import { promisify } from 'util';
import { assert } from 'chai';

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz'

const promises = [];

Meteor.startup(async () => {
  const collection = new Mongo.Collection('dummy');
  collection.remove({});

  // Execute the fiber-supported version and the callback-version of a database operation
  const fiberOrCallback = (fn, args, check) => {
    check(fn.bind(collection)(...args));

    // Keep the promise open so the individual db-commands are not called twice, but the promise-version is first called when resolving this promise.
    let resolve;
    const openPromise = new Promise((res) => {
      resolve = res;
    });

    promises.push([
      resolve,
      Promise.resolve(openPromise).then(() =>
        (promisify(fn.bind(collection))(...args))
        .then((data) => { check(data); })
      )
    ]);
  };

  // An insert should return the id of the new document
  fiberOrCallback(
    collection.insert,
    [{ foo: 'bar' }],
    (data) => {
      assert.match(data, new RegExp(`^[${UNMISTAKABLE_CHARS}]{17}$`));
    },
  )

  // An update with an undefined selector should not update anything
  fiberOrCallback(
    collection.update,
    [undefined, { $set: { a: 'b' } }],
    (data) => {
      assert.equal(data, 0);
    },
  )

  // An upsert with an undefined selector should insert a document
  fiberOrCallback(
    collection.upsert,
    [undefined, { $set: { a: 'b' } }],
    (data) => {
      assert.match(data.insertedId, new RegExp(`^[${UNMISTAKABLE_CHARS}]{17}$`));
      assert.deepEqual(data, { numberAffected: 1, insertedId: data.insertedId });
    },
  )

  // An update should find the document and report one update
  fiberOrCallback(
    collection.update,
    [{ foo: 'bar' }, { $set: { foo: 'bar2' } }],
    (data) => {
      assert.equal(data, 1);
    },
  )

  // An upsert where no document is found should insert a document
  fiberOrCallback(
    collection.upsert,
    [{ foo2: 'bar2' }, { $set: { foo2: 'bar5' }, $setOnInsert: { foo: 'bar2' } }],
    (data) => {
      assert.match(data.insertedId, new RegExp(`^[${UNMISTAKABLE_CHARS}]{17}$`));
      assert.deepEqual(data, { numberAffected: 1, insertedId: data.insertedId });
    },
  )

  // An upsert where documents are found should (given that multi:true is set) update all the documents
  fiberOrCallback(
    collection.upsert,
    [{ foo: 'bar2' }, { $set: { foo2: 'bar3' }, $setOnInsert: { foo: 'bar' }  }, { multi: true }],
    (data) => {
      assert.deepEqual(data, { numberAffected: 2 });
    },
  )

  // A remove should report the number of removed documents
  fiberOrCallback(
    collection.remove,
    [{ foo: 'bar2' }],
    (data) => {
      assert.equal(data, 2);
    },
  )

  // A remove with an undefined selector should not remove any document
  fiberOrCallback(
    collection.remove,
    [undefined],
    (data) => {
      assert.equal(data, 0);
    },
  )

  // A remove with an empty object as selector should remove all documents and report the amount.
  fiberOrCallback(
    collection.remove,
    [undefined],
    (data) => {
      assert.equal(data, 0);
    },
  )

  Meteor.setTimeout(() => {
    console.error('The promise-based tests didn\'t come back within 2 seconds. Something went wrong.');
    process.exit(1);
  }, 2000);

  let i = 0;
  let hasError = false;
  while(promises[i]) {
    try {

      // To call the resolve if the promise holding this back
      promises[i][0]();

      // Awaiting the actual promise ...
      await promises[i][1];
    } catch (e) {
      console.error(e);
      hasError = true;
    }

    i++;
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log('All tests passed.');
    process.exit(0);
  }
});
