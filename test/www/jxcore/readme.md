# Thali Cordova Plugin Replication Manager Tests #

## Overview

### Directory structure

```
|____bv_tests/          <- Build Verification tests. You should run these often.
|____lib/               <- Support files for running tests.
|____perf_tests/        <- Performance tests. Long running tests. For nightly builds etc.
|____meta_tests/        <- Tests non-production code like test frameworks and installation.
|____readme.md          <- This file.
|____runTests.js        <- The test runner to run tests stand-alone.
|____runCoordinatedTests.js <- The test runner to run tests with test coordination server.
|____server-address.js  <- Contains the IP address of the test coordination server.
|____PerfTest_app.js    <- Rename to app.js, build and deploy to run perf tests.
|____UnitTest_app.js    <- Rename to app.js, build and deploy to run bv tests.
```

## Running the tests

## Contributing

If you see a mistake, find a bug, or you think there is a better way to do something, feel free to contribute.
Please see our [contribution page](http://thaliproject.org/WaysToContribute) for ways to connect and start
contributing to Thali.

## License

Copyright (c) 2015 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
