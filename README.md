


# revolver-webpack-plugin

> Webpack plugin for relative path resolving from a list of directories.

## Information

Webpack doesn't natively support changing the source directory of your files when including them using `require` or `import`. This plugin provides the ability to specify a list of directories that Webpack should read from before trying to resolve relative paths. Think of it as a fallback system.

This is useful when you need to resolve files across different directories if they exist, like when working with different themes or locales for a site and [resolve.alias](https://webpack.js.org/configuration/resolve/#resolve-alias) or [resolve.modules](https://webpack.js.org/configuration/resolve/#resolve-modules) won't work for your use case.

Let's say you have a containing file `a.js` that uses the following configuration on your source directory:
```js
import * from './foo';
import * from './bar';
    
//Write some logic using these files...
```

But then on a separate build, theme, locale, or overlaying directory you want to override `foo` while keeping `bar` intact within the same containing file. Ideally you wouldn't want to duplicate the containing file `a.js` just to change the behavior of `foo`.

Using this plugin you can achieve exactly that, and more! Set a list of directories in the `directoryList` property, and `revolve-webpack-plugin` will resolve those directories in the specified order.

## Install

Works with Webpack 2.x and up.

```sh
npm install revolver-webpack-plugin --save-dev
```

## Usage

```js
const path = require('path');
const revolverPlugin = require('revolver-webpack-plugin');

let customDir = path.resolve(__dirname, 'path/to/custom/directory'),
    srcDir = path.resolve(__dirname, 'path/to/src/directory');

let webpackConfig = {
    entry: '...',
    [...],
    resolve: {
        plugins: [
            new revolverPlugin({
                directoryList: [customDir, srcDir]
            })
        ],
    },
    [...]
}
```

## Importing/requiring files

This plugin uses the default ES6/CommonJS/Webpack syntax for resolving files (i.e. `./`, `../`), which means no syntactical changes for how you `require` or `import` files are strictly necessary.

Whenever a relative path is specified, it will attempt to match that against the `directoryList` paths.

### Examples

Assume your `directoryList` is set to: `['path/to/custom', 'path/to/src']`

Say you have the structure shown below. Where `src/a.js` is an entry point or is another file's dependency, and imports `src/foo.js` and `src/bar.js`:
```
├── app
│   ├── custom
│   │   └── foo.js
│   └── src
│       ├── a.js
│       ├── bar.js
│       └── foo.js
```
When `src/a.js` is built, since we specified that `custom` has higher priority than `src` on our `directoryList`, and because there is a `foo.js` file in `custom`, it will import `custom/foo.js` and `src/bar.js`.

Now let's say you want to extend the functionalities of `src/foo.js` through `custom/foo.js`, you could achieve that the normal way:
```js
//custom/foo.js
import * as foo from '../src/foo';
```
However that approach becomes cumbersome whenever you have multiple overlaying directories extending the same `foo.js` file, since you'd need to keep track of the order in which you're importing your files. To solve this you can use `*/`, which tells `revolver-webpack-plugin` "import from the next directory in `directoryList` that contains a match":
```js
//custom/foo.js
import * as foo from '*/foo'; //imports `src/foo`
```

In case you want to import a file from the next matching directory in `directoryList` (as opposed to letting `revolver-webpack-plugin` resolve the file following `directoryList`'s order), you can chain `./` or `../` after `*/` to get to the file you want:
```js
//custom/foo.js
import * as bar from '*/../path/to/bar';
```

## Options

* `directoryList` [Array] **(required)** :Two or more absolute paths where your files are located, sorted by priority. Example: ["path/to/dir-1", "path/to/dir-2", ..., "path/to/dir-n", "path/to/source-dir"]

* `excludePath` [RegEx] **(defaults to "node_modules")**: RegEx which matches the `path` property of the request object which should not be resolved (i.e. the path leading to the file you're requiring or importing).

* `excludeRequest` [RegEx] **(defaults to "node_modules")**: RegEx which matches the `request` property of the request object which should not be resolved (i.e. what you type in a require or import statement: "./foo" ).

* `fileExtension` [String] **(defaults to ".js")**: Extension name to append to files that lack an explicit type. Note: When requiring or importing a directory, this plugin will resort to default Webpack behavior, which is to look for an "/index.{extension}" file inside of said directory.

* `nextDirectoryPrefix` [String] **(defaults to "*/")**: Specify a pattern to match at the beginning of an import request. You only need to change this in case of using another plugin that looks for the default pattern.
