# neowatch
A lightweight ES6 and TypeScript compliant change-monitoring library.

## Installing

### Package manager

Using npm:

```bash
$ npm install neowatch
```

Using bower:

```bash
$ bower install neowatch
```

Using yarn:

```bash
$ yarn add neowatch
```

Using pnpm:

```bash
$ pnpm add neowatch
```

Using bun:

```bash
$ bun install neowatch
# or
$ bun add neowatch
```

## Usage

### Import the `watch` function

Once installed, you can import the `watch` function using ES6 import syntax:

```javascript
import { watch } from 'neowatch'
```

Then you can use it like:

```javascript
await watch(
    '* * * * *',                    // cron schedule
    () => fetchData(url),           // data fetching function
    (changes) => alert(changes),    // change callback
    neowatchOptions                 // [optional] options object
)
```

For more details on the API visit neowatch API

### neowatch API

#### `watch(schedule, fn, callback[, options])`
This is the main functionality of neowatch. It'll poll the passed in function `fn` based on 
the cron schedule `schedule`, and if any changes are detected in the return, 
it will call the `callback` function with those changes as the argument.

## Development
This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```