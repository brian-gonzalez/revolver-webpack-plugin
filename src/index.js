/**
 * Allows overriding relative paths from a list of common containers.
 */

const fs = require('fs');
const path = require('path');

class RevolverPlugin {
    constructor(options) {
        this.directoryList = typeof options.directoryList === 'string' ? [options.directoryList] : options.directoryList;
        this.excludePath = options.excludePath || 'node_modules';
        this.excludeRequest = options.excludeRequest || 'node_modules';
        this.fileExtension = options.fileExtension || '.js';
        this.nextDirectoryPrefix = options.nextDirectoryPrefix || '*/';
    }

    apply(resolver) {
        const self = this;

        self.resolvedHook = resolver.ensureHook('parsed-resolve');
        self.resolver = resolver;

        self.resolver.getHook('before-resolve').tapAsync('RevolverPlugin', (requestContext, resolveContext, callback) => {
            let isRelativePath = requestContext.request.startsWith(self.nextDirectoryPrefix) || requestContext.request.startsWith('./') || requestContext.request.startsWith('../'),
                directoryData,
                index = 0;

            if (!isRelativePath || requestContext.path.match(self.excludePath) || requestContext.request.match(self.excludeRequest)) {
                return callback();
            }

            directoryData = self.getDirectoryData(requestContext);

            if (!directoryData) {
                return callback();
            }

            //Starting a file with `*/` indicates that it should look for the file on the next directory in line, as opposed to going through the entire `directoryList`.
            //This is useful to chain files with the same name and location without needing to specify the base directory name or alias.
            if (requestContext.request.startsWith(self.nextDirectoryPrefix)) {
                index = directoryData.index + 1;
                requestContext.request = requestContext.request.replace(self.nextDirectoryPrefix, './');
            }

            self.walkDirectories({requestContext, resolveContext, directoryData, index}, callback);

            return null;
        });
    }

    /**
     * Resolves the request using the matched `requestContext.request` file found within `targetPath`.
     */
    resolveRequest(targetPath, requestContext, resolveContext, callback, resolutionMsg = 'source file') {
        let result = Object.assign({}, requestContext, {
                path: targetPath,
            }),

            // Parse `requestContext.request` and add it to request.
            // This seems the only way to do the resolution without get caught in a infinite loop.
            parsed = this.resolver.parse(result.request),
            parsedResult = Object.assign({}, result, parsed);

        return this.resolver.doResolve(this.resolvedHook, parsedResult, `Match found: ${resolutionMsg}`, resolveContext, callback);
    }

    /**
     * Loops through the directory list [directoryList] and attempts to resolve the requests into the absolute path of the current directory.  
     * @param  {[String]} directoryData  [description]
     * @param  {[Integer]} index   [description]
     * @return {[null || Function]}         [description]
     */
    walkDirectories(options, callback) {
        let self = this,
            currIndex = options.index || 0,
            nextIndex = currIndex + 1,
            newPath = path.join(self.directoryList[currIndex].path, options.directoryData.subDirectory),
            newFile = self.getFullFilePath(newPath, options.requestContext.request);

        fs.stat(newFile, (err, stat) => {
            // found, use it
            if (!err && stat && stat.isFile()) {
                return self.resolveRequest(newPath, options.requestContext, options.resolveContext, callback);
            }

            //Recursively attempt to resolve the files following the directory list `self.directoryList` order.
            if (self.directoryList[nextIndex]) {
                options.index = nextIndex;

                self.walkDirectories(options, callback);
            } else {
                // nothing worked, let's other plugins try
                return callback();
            }

            return null;
        });
    }

    /**
     * Returns a concatenated file path name, this is later used to determine if the file exists before attempting to resolve it.
     */
    getFullFilePath(filePath, fileName) {
        let fullFileName = path.join(filePath, fileName),
            currentExtension = path.extname(fullFileName),
            matchesAllowedExtension = currentExtension && this.fileExtension.indexOf(currentExtension) !== -1,
            fileExtension = matchesAllowedExtension ? '' : this.fileExtension;

        //If this fullFileName has an /index file, use that instead. This might not be the best way to do this...
        if (!currentExtension && fs.existsSync(fullFileName + '/index' + fileExtension)) {
            fullFileName = fullFileName + '/index';
        }

        return `${fullFileName}${fileExtension}`;
    }

    /**
     * Gets the directory data off the source by looping through `this.directoryList` and comparing each item with the `requestContext.path`.
     */
    getDirectoryData(requestContext) {
        for (let i = 0; i < this.directoryList.length; i++) {
            let directoryPath = this.directoryList[i].path || this.directoryList[i];

            if (requestContext.path.startsWith(directoryPath)) {
                return {
                    index: i,
                    name: this.directoryList[i].name || directoryPath,
                    subDirectory: requestContext.path.substring(directoryPath.length + 1)
                }
            }
        }

        return null;
    }
}

module.exports = RevolverPlugin;
