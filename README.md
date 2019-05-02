# redis-oplog-test

A small test environment that should help us keeping track of differences in using `Meteor.Collection.(insert|update|upsert|remove)`.

It currently consists of one test-case where no extra library is included to ensure Meteor still works as expected without `redis-oplog`.
The coming phases test different code-branches within `redis-oplog` and match them against the expectations which Meteor still is compliant to if the first phase passes.

Steps to use this repo:
* `npm install`
* `mpm test`

If you want to test against a specific version of `redis-oplog`, please use the `packages` folder. Further information can be found in the Meteor guide: https://guide.meteor.com/writing-atmosphere-packages.html#overriding-atmosphere-packages