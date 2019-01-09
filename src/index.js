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
        this.jsFileExtension = options.jsFileExtension || '.js';
    }

    apply(resolver) {
        const self = this;

        self.resolvedHook = resolver.ensureHook('parsed-resolve');
        self.resolver = resolver;

        self.resolver.getHook('before-resolve').tapAsync('RevolverPlugin', (requestContext, resolveContext, callback) => {
            let isRelativePath = requestContext.request.startsWith('./') || requestContext.request.startsWith('../'),
                //Only retrieve these values if `isRelativePath` is false in order to avoid unnecessary processing.
                specificPath = !isRelativePath ? self.getMatchingContainer(requestContext) : false,
                subDir;

            if (!(isRelativePath || specificPath) || requestContext.path.match(self.excludePath) || requestContext.request.match(self.excludeRequest)) {
                return callback();
            }

            if (specificPath) {
                let specificFile = self.getFullFilePath(specificPath.path, requestContext.request);

                fs.stat(specificFile, (err, stat) => {

                    if (!err && stat && stat.isFile()) {
                        // found, use it
                        return self.resolveRequest(specificPath.path, requestContext, resolveContext, callback);
                    }

                    // nothing worked, let's other plugins try
                    return callback();
                });

                return null;
            }

            subDir = self.getSubdirectory(requestContext);

            if (subDir === null) {
                return callback();
            }

            self.walkDirectories({subDir: subDir, requestContext: requestContext, resolveContext: resolveContext}, callback);

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
            // we skip 'new-resolve' so we must do the work of this step: parse
            // requestContext.request and add it to request. This seems the only way
            // to do the resolution without get caught in a infinite loop.
            parsed = this.resolver.parse(result.request),
            parsedResult = Object.assign({}, result, parsed);

        return this.resolver.doResolve(this.resolvedHook, parsedResult, `Match found: ${resolutionMsg}`, resolveContext, callback);
    }

    /**
     * Loops through the directory list [directoryList] and attempts to resolve the requests into the absolute path of the current directory.  
     * @param  {[String]} subDir  [description]
     * @param  {[Integer]} index   [description]
     * @return {[null || Function]}         [description]
     */
    walkDirectories(options, callback) {
        let self = this,
            currIndex = options.index || 0,
            nextIndex = currIndex + 1,
            newPath = path.join(self.directoryList[currIndex].path, options.subDir),
            newFile = self.getFullFilePath(newPath, options.requestContext.request);

        fs.stat(newFile, (err, stat) => {

            if (!err && stat && stat.isFile()) {
                // found, use it
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
     * Loops through `directoryList` until a starting match in the `requestContext.request` is found.
     * This helps determine where to look for in case a specific parent directory name is used from the revolverPath.
     */
    getMatchingContainer(requestContext) {
        for (let i = 0; i < this.directoryList.length; i++) {
            if (requestContext.request.startsWith(`${this.directoryList[i].name}/`)) {
                //Maybe this should be moved to `resolveRequest`.
                //Renames the `requestContext.request` value to remove the directory container name.
                requestContext.request = requestContext.request.replace(`${this.directoryList[i].name}/`, './');

                return this.directoryList[i];
            }
        }

        return false;
    }

    /**
     * Returns a concatenated file path name, this is later used to determine if the file exists before attempting to resolve it.
     */
    getFullFilePath(filePath, fileName) {
        let fullFileName = path.join(filePath, fileName),
            hasExtension = path.extname(fullFileName),
            fileExtension = hasExtension ? '' : this.jsFileExtension;

        //If this fullFileName has an /index file, use that instead. This might not be the best way to do this...
        if (!hasExtension && fs.existsSync(fullFileName + '/index' + fileExtension)) {
            fullFileName = fullFileName + '/index';
        }

        return `${fullFileName}${fileExtension}`;
    }

    /**
     * Gets the subdirectory of the source by substracting the current source from the `requestContext.path`.
     */
    getSubdirectory(requestContext) {
        for (let i = 0; i < this.directoryList.length; i++) {
            if (requestContext.path.startsWith(this.directoryList[i].path)) {
                return requestContext.path.substring(this.directoryList[i].path.length + 1);
            }
        }

        return null;
    }
}

module.exports = RevolverPlugin;
