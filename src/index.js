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
        this.mainFileName = options.mainFileName || '/index';
    }

    apply(resolver) {
        const self = this;

        this.resolvedHook = resolver.ensureHook('parsed-resolve');
        this.resolver = resolver;

        this.resolver.getHook('before-resolve').tapAsync('RevolverPlugin', (requestContext, resolveContext, callback) => {
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
     * Resolves the request using the matched `requestContext.request` file found within `requestPathData`.
     */
    resolveRequest(requestPathData, requestContext, resolveContext, callback, newFile, resolutionMsg = 'source file') {
        let result = Object.assign({}, requestContext, {
                path: requestPathData.fullDirPath,
            }),

            // Parse `requestContext.request` and add it to request.
            // This seems the only way to do the resolution without get caught in a infinite loop.
            parsed = this.resolver.parse(result.request),
            parsedResult = Object.assign({}, result, parsed);

        //Circumvent Webpack 5.x's change which will not resolve requests that point to directories with main files.
        if (requestPathData.hasMainFile) {
            parsedResult.request = parsedResult.request + this.mainFileName;
        }

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
            requestPathData = this.getRequestPathData(this.directoryList[currIndex].path, options.directoryData.subDirectory, options.requestContext.request);

        fs.stat(requestPathData.fullFilePath, (err, stat) => {
            // found, use it
            if (!err && stat && stat.isFile()) {
                return self.resolveRequest(requestPathData, options.requestContext, options.resolveContext, callback);
            }

            //Recursively attempt to resolve the files following the directory list `self.directoryList` order.
            if (self.directoryList[nextIndex]) {
                options.index = nextIndex;

                self.walkDirectories(options, callback);
            } else {
                // nothing worked, lets other plugins try.
                return callback();
            }

            return null;
        });
    }

    /**
     * Returns all path data that can be determined from the currently requested file.
     * This information is later used to determine if the file exists before attempting to resolve it,
     * and also to resolve the target file and continue the chain.
     */
    getRequestPathData(baseDir, subDir, fileName) {
        let fullDirPath = path.join(baseDir, subDir),
            fullFilePath = path.join(fullDirPath, fileName),
            currentExt = path.extname(fullFilePath),
            hasValidExt = currentExt && this.fileExtension.indexOf(currentExt) !== -1,
            effectiveExt = hasValidExt ? '' : this.fileExtension,
            hasMainFile = !currentExt && fs.existsSync(fullFilePath + this.mainFileName + effectiveExt);

        //If this fullFilePath has an /index file, use that instead. This might not be the best way to do this...
        fullFilePath = (hasMainFile ? (fullFilePath + this.mainFileName) : fullFilePath) + effectiveExt;

        return {fullDirPath, fullFilePath, hasMainFile};
    }

    /**
     * Gets the directory data off the source by looping through `this.directoryList` and comparing each item with the `requestContext.path`.
     */
    getDirectoryData(requestContext) {
        for (let i = 0; i < this.directoryList.length; i++) {
            let currentDirPath = this.directoryList[i].path || this.directoryList[i];

            if (requestContext.path.startsWith(currentDirPath)) {
                return {
                    index: i,
                    name: this.directoryList[i].name || currentDirPath,
                    subDirectory: requestContext.path.substring(currentDirPath.length + 1)
                }
            }
        }

        return null;
    }
}

module.exports = RevolverPlugin;
