#!/usr/bin/env node

const
    fs = require('fs');

const
    chalk = require('chalk'),
    globby = require('globby');

const logger = require('note-down');
logger.removeOption('showLogLine'); // Do not show which line in which file initiated the console log entry

const printCallStack = function () {    // eslint-disable-line no-unused-vars
    try {
        throw new Error('Call stack:');
    } catch (e) {
        console.log(e.stack.replace(/Error: /, ''));
    }
};

const exitWithUnhandledError = function (str) {
    if (str) {
        logger.error(str + '\n');
    }
    logger.error('This scenario is not handled yet. Exiting with error code 1.');
    process.exit(1);
};

const showHelp = function () {
    logger.verbose([
        '',
        'Format:',
        '    because because/path/to/file.ext',
        '',
        'Examples:',
        '    because because/project/deployment.md',
        '    because because/project/scripts.md',
        '    because --help',
        '',
        'Options:',
        '    -h --help                          Show help and exit',
        '    --only-list-files-being-searched   Only list the files being searched and exit',
        ''
    ].join('\n'));
};

const caseInsensitiveSorter = function (a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
};

// If it is running as a standalone command
if (!module.parent) {
    let argv = require('yargs').argv;

    if (argv.h || argv.help) {
        showHelp();
        process.exit(0);
    }

    let onlyListFilesBeingSearched = argv.onlyListFilesBeingSearched;

    let firstUnnamedArgument = argv._[0],
        atLeastACommandLineArgument = onlyListFilesBeingSearched;
    if (firstUnnamedArgument || atLeastACommandLineArgument) {
        let matchesFound = 0,
            becauserc = '',
            globPatterns = [
                '**',
                '!.git/**',
                '!node_modules/**'
            ];
        try {
            becauserc = fs.readFileSync('.becauserc', 'utf8');
            globPatterns = [];
            let arrBecauserc = becauserc.replace(/\r\n/g, '\n').split('\n');
            arrBecauserc.forEach(function (item) {
                item = item.split('#')[0];
                item = item.trim();
                if (item) {
                    globPatterns.push(item);
                }
            });
        } catch (e) {
            logger.verbose('Using default glob patterns for searching in files');
        }
        (async () => {
            const paths = await globby(globPatterns, {
                nocase: true,
                gitignore: true,
                dot: true
            });

            paths.sort(caseInsensitiveSorter);

            if (onlyListFilesBeingSearched) {
                logger.info('The command would looking for documentation in the following ' + paths.length + ' files');
                logger.log(paths.join('\n'));
                process.exit(0);
            }

            let textToLookFor = firstUnnamedArgument;
            logger.info('Looking for ' + chalk.underline(textToLookFor) + ' in ' + paths.length + ' files.');

            for (let i = 0; i < paths.length; i++) {
                let j = i;
                fs.readFile(paths[j], 'utf8', function(err, data ) {
                    if (data.indexOf(textToLookFor) >= 0) {
                        matchesFound++;
                        if (matchesFound === 1) {
                            logger.success('Found following matches:');
                        }
                        logger.success('    ' + paths[j]);
                    }
                });
            }
        })();
    } else {
        showHelp();
        process.exit(0);
    }
} else {
    exitWithUnhandledError();
}
