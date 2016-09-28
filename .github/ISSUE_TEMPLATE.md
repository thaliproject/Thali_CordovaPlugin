The information below MUST be provided when filing a bug about a failing test:

### URL to the exact commit that you ran the test on. If you haven’t checked in the code that you are testing how is anyone else supposed to figure out what’s going on?
### The file where the test failed.
### The test that failed.
### networkType setting. Did the test fail on wifi, native, both?
### A link to a gist (or if CI, the GitHub log) with the failure log.
### Does the test always fail? This is critical. We need to know if the test always fails or sometimes passes. So if a test fails you MUST run it again a few times to be sure.
###  Does the test fail when run on its own? Sometimes we have found that tests fail when run with other tests but don’t fail on their own. So when a test fails you need to run it in isolation (use the .only functionality) to confirm if it behaves the same when run by itself.
