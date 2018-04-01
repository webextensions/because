#!/usr/bin/env node

const
    fs = require('fs'),
    path = require('path');

const
    chalk = require('chalk'),
    globby = require('globby');

const ls = require('ls');

const logger = require('note-down');
logger.option('showLogLine', false, false); // Do not show which line in which file initiated the console log entry

// https://stackoverflow.com/questions/31060650/how-to-detect-if-the-current-npm-package-is-global/31061337#31061337
const isPackageBeingGloballyInstalled = !!process.env.npm_config_global;

// Note: The following approach may not be correct in some scenarios hence it is commented out
/*
    let npmInstallIsHappeningInsidePackageItself;
    const packageJson = require('./package.json');
    // packageJson._id would be undefined if it is npm installed
    // We add this condition because we don't want the copying to occur when this script gets executed along with running "npm install" while developing this package
    if (packageJson._id) {
        npmInstallIsHappeningInsidePackageItself = false;
    } else {
        npmInstallIsHappeningInsidePackageItself = true;
    }
/* */
let npmInstallIsHappeningInsidePackageItself;
if (process.env.INIT_CWD === process.env.PWD) {
    npmInstallIsHappeningInsidePackageItself = true;
} else {
    npmInstallIsHappeningInsidePackageItself = false;
}

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
        '    --setup                            Link files/folders from <project>/because/* to <project>/node_modules/because/* (skip existing links)',
        ''
    ].join('\n'));
};

const getFileStats = function (filePath, options = { useLStat: false }) {
    try {
        let stat;
        if (options.useLStat) {
            stat = fs.lstatSync(filePath);
        } else {
            stat = fs.statSync(filePath);
        }
        return stat;
    } catch (e) {
        return null;
    }
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

    let
        onlyListFilesBeingSearched = argv.onlyListFilesBeingSearched,
        setup = argv.setup;

    let firstUnnamedArgument = argv._[0],
        atLeastACommandLineArgument = onlyListFilesBeingSearched || setup;
    if (firstUnnamedArgument || atLeastACommandLineArgument) {
        if (setup) {
            if (isPackageBeingGloballyInstalled) {
                logger.info('Note: Since this package is being installed globally, the "because/" paths are not linked. Install the package locally to make use of symbolic links.');
            } else {
                if (npmInstallIsHappeningInsidePackageItself) {
                    logger.info('Note: It appears that you are working on the package code since npm install is running inside package itself. The "because/" paths are not linked. Install the package locally to make use of symbolic links.');
                } else {
                    let projectDirectory = process.env.INIT_CWD || process.env.PWD,
                        becauseFolderInProject = projectDirectory + '/because';

                    for (let entry of ls(becauseFolderInProject + '/*')) {
                        let linkFileToBeCreatedAt = 'node_modules/because/' + entry.file,
                            linkPointsTo = '../../because/' + entry.file;

                        let fileStats = getFileStats(linkFileToBeCreatedAt, {useLStat: true});

                        if (fileStats) {    // Equivalent to saying if-file-exists
                            if (fileStats.isSymbolicLink()) {
                                let existingSymbolicLinkPointsTo = fs.realpathSync(linkFileToBeCreatedAt),
                                    linkShouldBePointingTo = path.resolve(linkFileToBeCreatedAt, '..', linkPointsTo);

                                if (existingSymbolicLinkPointsTo === linkShouldBePointingTo) {
                                    logger.info(' ✓ ' + linkFileToBeCreatedAt + ' (The required symbolic link already exists there)');
                                } else {
                                    logger.error(' ✗ ' + linkFileToBeCreatedAt + ' (Error: A different symbolic link already exists there)');
                                    logger.warn('   Rename or delete the corresponding symbolic link in your node_modules/because/ directory and try again');
                                    process.exit(1);
                                }
                            } else {
                                logger.error(' ✗ ' + linkFileToBeCreatedAt + ' (Error: A file/directory already exists there)');
                                logger.warn('   Rename or delete the corresponding file/directory in your <project>/because/ directory and try again');
                                process.exit(1);
                            }
                        } else {
                            try {
                                fs.symlinkSync(linkPointsTo, linkFileToBeCreatedAt);
                                logger.success(' ✓ ' + linkFileToBeCreatedAt + ' (Created a new symbolic link)');
                            } catch (e) {
                                logger.error(' ✗ ' + linkFileToBeCreatedAt + ' (Error: Unable to create the symbolic link there)');
                                logger.warn('   Ensure that you have right permissions for that path');
                                process.exit(1);
                            }
                        }
                    }
                }
            }
        } else {
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
                    logger.debug('The command would looking for documentation in the following ' + paths.length + ' files');
                    logger.log(paths.join('\n'));
                    process.exit(0);
                }

                let textToLookFor = firstUnnamedArgument;
                logger.debug('Looking for ' + chalk.underline(textToLookFor) + ' in ' + paths.length + ' files.');

                for (let i = 0; i < paths.length; i++) {
                    let j = i;
                    fs.readFile(paths[j], 'utf8', function(err, data ) {
                        if (data.indexOf(textToLookFor) >= 0) {
                            matchesFound++;
                            if (matchesFound === 1) {
                                logger.info('Found following matches:');
                            }
                            logger.info('    ' + paths[j]);
                        }
                    });
                }
            })();
        }
    } else {
        showHelp();
        process.exit(0);
    }
} else {
    exitWithUnhandledError();
}
