
# revolver-webpack-plugin

> Webpack resolver plugin to load relative paths from a different directory or list of directories.

## Information

Webpack doesn't natively support changing the source directory of your files when including them using require() or import. This plugin allows to specify a list of directories that Webpack should read from before trying to resolve relative paths. Think of it as a fallback system.

This is useful when you need to resolve relative files from different directories, but only if these files are available on said directory or directories, like when working with different themes or locales for a site and [resolve.alias](https://webpack.js.org/configuration/resolve/#resolve-alias) or [resolve.modules](https://webpack.js.org/configuration/resolve/#resolve-modules) won't work for your use case.

Let's say you have a build that uses the following configuration on your source directory:
```js
let someFile = require('./someFile'),
	otherFile = require('./path/to/otherFile');
	
//Do something with these files...
```

But then you need to override 'someFile.js' for a different build, while keeping the same 'otherFile.js' intact, and you don't want to duplicate your entire codebase just to modify a single file.

Using this plugin you can achieve exactly that, and more! Specify a list of directories on the `directoryList` property (sorted by priority), and revolve-webpack-plugin will parse those directories in the provided order every time Webpack tries to resolve a relative path.

## Install

This is for Webpack 2.x+. No support for Webpack 1.x or lower at the moment.

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

## Options

* `directoryList` *required* Array: Two or more absolute paths where your files are located, sorted by the priority you'd like these to be parsed in. Example: ["path/to/dir-1", "path/to/dir-2", ..., "path/to/dir-n", "path/to/source-dir"]

* `excludePath` String/RegEx: RegEx which matches `path` property of the request object which should not be resolved (i.e. the path leading to the file you're requiring or importing). Defaults to 'node_modules'.

* `excludeRequest` String/RegEx: RegEx which matches `request` property of the request object which should not be resolved (i.e. what you type in a require or import statement: "./myFile" ). Defaults to 'node_modules'.

* `jsFileExtension` String: file extension (with the dot) which gets added to file names without a file extension. Defaults to '.js'. Note: When requiring or importing a directory, this plugin will resort to default Webpack behavior, which is to look for an /index.{extension} file inside of said directory.

## References

Based off the greatly coded [customization-resolver-webpack-plugin](https://www.npmjs.com/package/customization-resolver-webpack-plugin). Enhanced its functionality such as adding the option for multiple directories, requiring a file from subdirectories (i.e. require(./path/to/file)), and requiring a directory (i.e. require(./path/to/dir), which then would attempt to load its index file if found).

## License

 MIT ©