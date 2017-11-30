/**
 * Lifting functionality from https://www.npmjs.com/package/customization-resolver-webpack-plugin to allow overriding relative paths from a list of directories.
 */

const fs = require('fs');

function revolverPlugin (config) {
    let {directoryList, excludePath, excludeRequest, jsFileExtension} = config;

    this.directoryList = typeof directoryList === 'string' ? [directoryList] : directoryList;
    this.excludePath = excludePath || 'node_modules';
    this.excludeRequest = excludeRequest || 'node_modules';
    this.jsFileExtension = jsFileExtension || '.js';
}

revolverPlugin.prototype.apply = function apply (resolver) {
    const directoryList 	= this.directoryList;
    const excludePath 		= this.excludePath;
    const excludeRequest 	= this.excludeRequest;
    const jsFileExtension 	= this.jsFileExtension;

    resolver.plugin('before-new-resolve', function resolverPlugin (request, finalCallback) {
        if (!(request.request.startsWith('./') || request.request.startsWith('../')) || request.path.match(excludePath) || request.request.match(excludeRequest)) {
            return finalCallback();
        }

        const resolve = (customizedPath, resolutionMsg) => {
            let result = Object.assign({}, request, {
                path: customizedPath,
            });

            // we skip 'new-resolve' so we must do the work of this step: parse
            // request.request and add it to request. This seems the only way
            // to do the resolution without get caught in a infinite loop.
            let parsed = resolver.parse(result.request);
            let parsedResult = Object.assign({}, result, parsed);

            return this.doResolve('parsed-resolve', parsedResult, `found file: ${resolutionMsg}`, finalCallback);
        };

        const getFile = (path, fileName) => {
        	let fullFileName = this.join(path, fileName);

        	//If this path has an /index file, use that instead. This might not be the best way to do this...
        	if (fs.existsSync(fullFileName + '/index' + jsFileExtension)) {
        		fullFileName = fullFileName + '/index';
        	}

            return `${fullFileName}${jsFileExtension}`;
        };

        /**
         * Loops through the directory list [directoryList] and attempts to resolve the requests into the absolute path of the current directory.  
         * @param  {[Array]} directoryList [description]
         * @param  {[String]} subDir  [description]
         * @param  {[Integer]} index   [description]
         * @return {[null || Function]}         [description]
         */
        const walkDirectories = (directoryList, subDir, index) => {
        	let currIndex = index || 0,
        		nextIndex = currIndex + 1,
        		newPath = this.join(directoryList[currIndex], subDir),
        		newFile = getFile(newPath, request.request);

	        fs.stat(newFile, (err, stat) => {

                if (!err && stat && stat.isFile()) {
                    // found, use it
                    return resolve(newPath, 'source file');
                }

                //Recursively attempt to resolve the files following the directory list [directoryList] order.
                if (directoryList[nextIndex]) {
                	walkDirectories(directoryList, subDir, nextIndex);
                }

                else {
                	// nothing worked, lets other plugins try
                	return finalCallback();
                }

	            return null;
	        });
        };

        let subDir = null;

	    //Gets the subdirectory of the source by substracting the current source from the request path.
        for (let i = 0; i < directoryList.length; i++) {
        	if (request.path.startsWith(directoryList[i])) {
        		subDir = request.path.substring(directoryList[i].length + 1);

        		break;
        	}
        };

        if (subDir === null) {
        	return finalCallback();
        }

        walkDirectories(directoryList, subDir);

        return null;
    });
};

module.exports = revolverPlugin;
