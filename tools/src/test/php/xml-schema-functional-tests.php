<?php declare(strict_types=1);

/**
 * validate all test data for a given version of CycloneDX.
 * call the script via `php -f <this-file> -- -v <CDX-version>`
 */

use Opis\JsonSchema;

require_once __DIR__ . '/vendor/autoload.php';

// region config

define('TESTSCHEMA_VERSION', getopt('v:')['v']);
define('SCHEMA_DIR', realpath(__DIR__ . '/../../../../schema'));
define('SCHEMA_FILE', SCHEMA_DIR . '/bom-' . TESTSCHEMA_VERSION . '.xsd');
define('TESTDATA_DIR', realpath(__DIR__ . '/../resources/' . TESTSCHEMA_VERSION));

if (empty(TESTSCHEMA_VERSION)) {
    throw new Exception('missing TESTSCHEMA_VERSION. expected via opt "-v"');
}
fwrite(STDOUT, 'DEBUG | TESTSCHEMA_VERSION = ' . TESTSCHEMA_VERSION . PHP_EOL);

if (!is_file(SCHEMA_FILE)) {
    throw new Exception('missing SCHEMA_FILE: ' . SCHEMA_FILE);
}
fwrite(STDOUT, 'DEBUG | SCHEMA_FILE = ' . SCHEMA_FILE . PHP_EOL);

if (!is_dir(TESTDATA_DIR)) {
    throw new Exception('missing TESTDATA_DIR: ' . TESTDATA_DIR);
}
fwrite(STDOUT, 'DEBUG | TESTDATA_DIR = ' . TESTDATA_DIR . PHP_EOL);

// endregion config

// region validator

$xmlOptions = \LIBXML_NONET;
if (\defined('LIBXML_COMPACT')) {
    $xmlOptions |= \LIBXML_COMPACT;
}
if (\defined('LIBXML_PARSEHUGE')) {
    $xmlOptions |= \LIBXML_PARSEHUGE;
}

/**
 * @param string $file file path to validate
 */
function validateFile(string $file): ?LibXMLError
{
    global $xmlOptions;

    libxml_use_internal_errors(true);
    libxml_clear_errors();

    $doc = new DOMDocument();
    if (!$doc->loadXML(file_get_contents($file), $xmlOptions)) {
        throw new Exception("failed loading file: $file" . PHP_EOL . libxml_get_last_error()->message);
    }

    $valid = $doc->schemaValidate(SCHEMA_FILE);
    return $valid
        ? null
        : libxml_get_last_error();
}

// endregion validator

$errCnt = 0;

foreach (glob(TESTDATA_DIR . '/valid-*.xml') as $file) {
    fwrite(STDOUT, PHP_EOL . "test $file ..." . PHP_EOL);
    $validationError = validateFile($file);
    if ($validationError === null) {
        fwrite(STDOUT, 'OK.' . PHP_EOL);
    } else {
        ++$errCnt;
        fwrite(STDERR, "ERROR: Unexpected validation error for file: $file" . PHP_EOL);
        fwrite(STDERR, print_r($validationError, true) . PHP_EOL);
    }
    unset($validationError);
}

foreach (glob(TESTDATA_DIR . '/invalid-*.xml') as $file) {
    fwrite(STDOUT, PHP_EOL . "test $file ..." . PHP_EOL);
    $validationError = validateFile($file);
    if ($validationError === null) {
        ++$errCnt;
        fwrite(STDERR, "ERROR: Missing expected validation error for file: $file" . PHP_EOL);
    } else {
        fwrite(STDOUT, 'OK.' . PHP_EOL);
    }
    unset($validationError);
}


// Exit statuses should be in the range 0 to 254, the exit status 255 is reserved by PHP and shall not be used.
// The status 0 is used to terminate the program successfully.
exit(min($errCnt, 254));